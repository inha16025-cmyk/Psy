/*
 * PsyStat 통계 엔진 (stats) — 조각 3/3: 잠재프로파일 분석(LPA)·잠재계층분석(LCA)
 * 외부 라이브러리·네트워크 통신 없음. 순수 JavaScript.
 * - LPA: 가우시안 혼합모형 (mclust 모형 EEI, VVI, EEE, VVV = tidyLPA 모형 1, 2(변형), 3, 6에 해당)
 * - LCA: 범주형 지표의 잠재계층모형 (poLCA와 같은 모형)
 * - 추정: EM 알고리즘, 여러 무작위 시작값 (짧게 여러 번 → 상위 몇 개를 수렴까지; Mplus STARTS 방식)
 * - 프로파일 수 검정: 부트스트랩 우도비 검정(BLRT; McLachlan, 1987; mclust::mclustBootstrapLRT와 같은 p값 정의)
 */
(function (G) {
  'use strict';
  var St = G.PsyStats;
  if (!St) return;
  var LOG2PI = Math.log(2 * Math.PI);

  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new Array(c).fill(0)); return m; }
  function logSumExp(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; if (m === -Infinity) return -Infinity; var s = 0; for (var j = 0; j < a.length; j++) s += Math.exp(a[j] - m); return m + Math.log(s); }

  /* ---------------- 공통: E 단계 결과로 적합도 계산 ---------------- */
  function fitStats(LL, npar, n, Z, K) {
    var ent = 0;
    if (K > 1) {
      var e = 0;
      for (var i = 0; i < n; i++) for (var k = 0; k < K; k++) { var p = Z[i][k]; if (p > 0) e -= p * Math.log(p); }
      ent = 1 - e / (n * Math.log(K));
    } else ent = 1;
    var cls = Z.map(function (r) { var b = 0; for (var k = 1; k < K; k++) if (r[k] > r[b]) b = k; return b; });
    var props = new Array(K).fill(0), counts = new Array(K).fill(0), avgPP = zeros(K, K);
    Z.forEach(function (r, i) { counts[cls[i]]++; for (var k = 0; k < K; k++) { props[k] += r[k] / n; avgPP[cls[i]][k] += r[k]; } });
    avgPP = avgPP.map(function (row, k) { return row.map(function (v) { return counts[k] ? v / counts[k] : NaN; }); });
    return { LL: LL, npar: npar, n: n, aic: -2 * LL + 2 * npar, bic: -2 * LL + npar * Math.log(n), sabic: -2 * LL + npar * Math.log((n + 2) / 24),
      caic: -2 * LL + npar * (Math.log(n) + 1), entropy: ent, classes: cls, props: props, counts: counts, avgPP: avgPP,
      minProp: Math.min.apply(null, props), minCount: Math.min.apply(null, counts) };
  }

  /* ---------------- 다중 시작 EM 틀 ---------------- */
  // spec: { init(rand) → state, step(state) → { state, LL } 또는 null(퇴화), finish(state) → 결과 }
  function multiStart(spec, opts) {
    var rand = St.rng(opts.seed || 1), nStart = opts.starts || 20, nKeep = Math.min(opts.keep || 5, nStart), short = opts.shortIter || 30;
    var runs = [];
    for (var s = 0; s < nStart; s++) {
      var st = spec.init(rand), LL = -Infinity, ok = true;
      for (var it = 0; it < short; it++) { var r = spec.step(st); if (!r) { ok = false; break; } st = r.state; LL = r.LL; }
      if (ok && isFinite(LL)) runs.push({ st: st, LL: LL });
    }
    if (!runs.length) return null;
    runs.sort(function (a, b) { return b.LL - a.LL; });
    var finals = [];
    runs.slice(0, nKeep).forEach(function (run) {
      var st = run.st, LL = run.LL, prev = -Infinity, conv = false;
      for (var it = 0; it < (opts.maxIter || 20000); it++) {
        var r = spec.step(st); if (!r) { st = null; break; }
        st = r.state; prev = LL; LL = r.LL;
        if (Math.abs(LL - prev) < (opts.tol || 1e-13) * (1 + Math.abs(LL))) { conv = true; break; }
      }
      if (st) finals.push({ st: st, LL: LL, conv: conv });
    });
    if (!finals.length) return null;
    finals.sort(function (a, b) { return b.LL - a.LL; });
    var best = finals[0], rep = finals.filter(function (f) { return Math.abs(f.LL - best.LL) < 1e-6 * (1 + Math.abs(best.LL)); }).length;
    var out = spec.finish(best.st);
    out.converged = best.conv; out.replicated = rep; out.finalRuns = finals.length; out.startsOk = runs.length; out.starts = nStart;
    out.finalLLs = finals.map(function (f) { return f.LL; });
    return out;
  }

  /* ---------------- LPA (가우시안 혼합) ---------------- */
  var LPA_MODELS = {
    EEI: { label: '분산 같음, 공분산 0', full: false, equal: true },
    VVI: { label: '분산 다름, 공분산 0', full: false, equal: false },
    EEE: { label: '분산·공분산 같음', full: true, equal: true },
    VVV: { label: '분산·공분산 다름', full: true, equal: false }
  };
  function lpaNpar(K, d, model) {
    var m = LPA_MODELS[model], cov = m.full ? d * (d + 1) / 2 : d;
    return K * d + (K - 1) + (m.equal ? cov : K * cov);
  }
  // M 단계: Z → {pi, mu, Sigma[k]}
  function lpaM(X, Z, K, model) {
    var n = X.length, d = X[0].length, m = LPA_MODELS[model], nk = new Array(K).fill(0), mu = zeros(K, d);
    for (var i = 0; i < n; i++) for (var k = 0; k < K; k++) { var z = Z[i][k]; nk[k] += z; for (var j = 0; j < d; j++) mu[k][j] += z * X[i][j]; }
    for (var k2 = 0; k2 < K; k2++) { if (!(nk[k2] > 1e-8)) return null; for (var j2 = 0; j2 < d; j2++) mu[k2][j2] /= nk[k2]; }
    var W = [];
    for (var k3 = 0; k3 < K; k3++) {
      var Wk = zeros(d, d);
      for (var i2 = 0; i2 < n; i2++) {
        var z2 = Z[i2][k3]; if (z2 === 0) continue;
        for (var a = 0; a < d; a++) { var da = X[i2][a] - mu[k3][a]; if (!m.full) { Wk[a][a] += z2 * da * da; continue; } for (var b = a; b < d; b++) Wk[a][b] += z2 * da * (X[i2][b] - mu[k3][b]); }
      }
      for (var a2 = 0; a2 < d; a2++) for (var b2 = 0; b2 < a2; b2++) Wk[a2][b2] = Wk[b2][a2];
      W.push(Wk);
    }
    var Sig = [];
    if (m.equal) {
      var Sp = zeros(d, d);
      W.forEach(function (Wk) { for (var a = 0; a < d; a++) for (var b = 0; b < d; b++) Sp[a][b] += Wk[a][b] / n; });
      for (var k4 = 0; k4 < K; k4++) Sig.push(Sp);
    } else W.forEach(function (Wk, k) { Sig.push(Wk.map(function (r) { return r.map(function (v) { return v / nk[k]; }); })); });
    return { pi: nk.map(function (v) { return v / n; }), mu: mu, Sigma: Sig };
  }
  // E 단계: 각 사례·프로파일의 로그밀도, LL, 사후확률
  function lpaE(X, P) {
    var n = X.length, d = X[0].length, K = P.pi.length, pre = [];
    for (var k = 0; k < K; k++) {
      var L = St.cholesky(P.Sigma[k]);
      if (!L) return null;
      var ld = 0; for (var a = 0; a < d; a++) { if (!(L[a][a] > 1e-7)) return null; ld += 2 * Math.log(L[a][a]); }
      pre.push({ L: L, c: Math.log(P.pi[k]) - 0.5 * (d * LOG2PI + ld) });
    }
    var LL = 0, Z = [], y = new Array(d), lf = new Array(K);
    for (var i = 0; i < n; i++) {
      for (var k2 = 0; k2 < K; k2++) {
        var L2 = pre[k2].L, q = 0;
        for (var a2 = 0; a2 < d; a2++) { var s = X[i][a2] - P.mu[k2][a2]; for (var b = 0; b < a2; b++) s -= L2[a2][b] * y[b]; y[a2] = s / L2[a2][a2]; q += y[a2] * y[a2]; }
        lf[k2] = pre[k2].c - 0.5 * q;
      }
      var lse = logSumExp(lf); LL += lse;
      Z.push(lf.map(function (v) { return Math.exp(v - lse); }));
    }
    return { LL: LL, Z: Z };
  }
  // k-평균++ 초기 분할 (무작위 시작값)
  function kmeansZ(X, K, rand) {
    var n = X.length, d = X[0].length, C = [X[Math.floor(rand() * n)].slice()];
    while (C.length < K) {
      var D = X.map(function (x) { var m = Infinity; C.forEach(function (c) { var s = 0; for (var j = 0; j < d; j++) s += (x[j] - c[j]) * (x[j] - c[j]); if (s < m) m = s; }); return m; });
      var tot = D.reduce(function (a, b) { return a + b; }, 0), r = rand() * tot, i = 0;
      while (i < n - 1 && r > D[i]) { r -= D[i]; i++; }
      C.push(X[i].slice());
    }
    var lab = new Array(n).fill(0);
    for (var it = 0; it < 10; it++) {
      lab = X.map(function (x) { var b = 0, bm = Infinity; C.forEach(function (c, k) { var s = 0; for (var j = 0; j < d; j++) s += (x[j] - c[j]) * (x[j] - c[j]); if (s < bm) { bm = s; b = k; } }); return b; });
      C = C.map(function (c, k) { var m = new Array(d).fill(0), cnt = 0; X.forEach(function (x, i2) { if (lab[i2] === k) { cnt++; for (var j = 0; j < d; j++) m[j] += x[j]; } }); return cnt ? m.map(function (v) { return v / cnt; }) : c; });
    }
    return X.map(function (_, i3) { var z = new Array(K).fill(0.02 / Math.max(1, K - 1)); z[lab[i3]] = 0.98; if (K === 1) z[0] = 1; return z; });
  }
  function lpaFitK(X, K, model, opts) {
    var n = X.length, d = X[0].length;
    var spec = {
      init: function (rand) {
        var Z = rand() < 0.7 ? kmeansZ(X, K, rand) : X.map(function () { var r = []; for (var k = 0; k < K; k++) r.push(rand() + 0.05); var s = r.reduce(function (a, b) { return a + b; }, 0); return r.map(function (v) { return v / s; }); });
        return { Z: Z };
      },
      step: function (st) {
        var P = lpaM(X, st.Z, K, model); if (!P) return null;
        var E = lpaE(X, P); if (!E) return null;
        return { state: { Z: E.Z, P: P }, LL: E.LL };
      },
      finish: function (st) {
        var P = lpaM(X, st.Z, K, model), E = lpaE(X, P); // 마지막 사후확률에 맞춘 모수
        var fs = fitStats(E.LL, lpaNpar(K, d, model), n, E.Z, K);
        fs.params = P; fs.Z = E.Z; fs.K = K; fs.model = model; fs.d = d;
        return fs;
      }
    };
    if (K === 1) { var Z1 = X.map(function () { return [1]; }), P1 = lpaM(X, Z1, 1, model), E1 = lpaE(X, P1); if (!E1) return null; var f1 = fitStats(E1.LL, lpaNpar(1, d, model), n, E1.Z, 1); f1.params = P1; f1.Z = E1.Z; f1.K = 1; f1.model = model; f1.d = d; f1.converged = true; f1.replicated = 1; f1.starts = 1; f1.finalRuns = 1; f1.startsOk = 1; return f1; }
    var r = multiStart(spec, opts);
    if (r) orderClasses(r, function (k) { return r.params.pi[k]; }, function (perm) {
      r.params = { pi: perm.map(function (k) { return r.params.pi[k]; }), mu: perm.map(function (k) { return r.params.mu[k]; }), Sigma: perm.map(function (k) { return r.params.Sigma[k]; }) };
    });
    return r;
  }
  // 프로파일 순서: 비율 큰 순 (표시용)
  function orderClasses(r, sizeOf, permParams) {
    var K = r.K, perm = []; for (var k = 0; k < K; k++) perm.push(k);
    perm.sort(function (a, b) { return sizeOf(b) - sizeOf(a); });
    var inv = new Array(K); perm.forEach(function (k, i) { inv[k] = i; });
    permParams(perm);
    r.Z = r.Z.map(function (row) { return perm.map(function (k) { return row[k]; }); });
    var fs = fitStats(r.LL, r.npar, r.n, r.Z, K);
    ['classes', 'props', 'counts', 'avgPP', 'minProp', 'minCount', 'entropy'].forEach(function (key) { r[key] = fs[key]; });
  }
  function sampleMVN(mu, L, rand) {
    var d = mu.length, z = [];
    for (var j = 0; j < d; j++) { var u = 1 - rand(), v = rand(); z.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); }
    return mu.map(function (m, a) { var s = m; for (var b = 0; b <= a; b++) s += L[a][b] * z[b]; return s; });
  }

  /* ---------------- LCA (범주형 지표) ---------------- */
  // X: n×J 정수 코드 (0..C_j−1), C: 각 문항 범주 수
  function lcaNpar(K, C) { return (K - 1) + K * C.reduce(function (s, c) { return s + c - 1; }, 0); }
  function lcaM(X, Z, K, C) {
    var n = X.length, J = C.length, nk = new Array(K).fill(0), rho = [];
    for (var k = 0; k < K; k++) { rho.push(C.map(function (c) { return new Array(c).fill(0); })); }
    for (var i = 0; i < n; i++) for (var k2 = 0; k2 < K; k2++) { var z = Z[i][k2]; nk[k2] += z; for (var j = 0; j < J; j++) rho[k2][j][X[i][j]] += z; }
    for (var k3 = 0; k3 < K; k3++) { if (!(nk[k3] > 1e-8)) return null; for (var j2 = 0; j2 < J; j2++) for (var c = 0; c < C[j2]; c++) rho[k3][j2][c] /= nk[k3]; }
    return { pi: nk.map(function (v) { return v / n; }), rho: rho };
  }
  function lcaE(X, P) {
    var n = X.length, K = P.pi.length, J = X[0].length, LL = 0, Z = [], lf = new Array(K);
    var lr = P.rho.map(function (rk) { return rk.map(function (rj) { return rj.map(function (p) { return Math.log(Math.max(p, 1e-300)); }); }); });
    var lp = P.pi.map(function (p) { return Math.log(p); });
    for (var i = 0; i < n; i++) {
      for (var k = 0; k < K; k++) { var s = lp[k]; for (var j = 0; j < J; j++) s += lr[k][j][X[i][j]]; lf[k] = s; }
      var lse = logSumExp(lf); LL += lse; Z.push(lf.map(function (v) { return Math.exp(v - lse); }));
    }
    return { LL: LL, Z: Z };
  }
  function lcaFitK(X, K, C, opts) {
    var n = X.length;
    var randRho = function (rand) { var r = []; for (var k = 0; k < K; k++) r.push(C.map(function (c) { var v = []; for (var q = 0; q < c; q++) v.push(rand() + 0.1); var s = v.reduce(function (a, b) { return a + b; }, 0); return v.map(function (x) { return x / s; }); })); return r; };
    var spec = {
      init: function (rand) { var P = { pi: new Array(K).fill(1 / K), rho: randRho(rand) }; return { Z: lcaE(X, P).Z }; },
      step: function (st) { var P = lcaM(X, st.Z, K, C); if (!P) return null; var E = lcaE(X, P); return { state: { Z: E.Z, P: P }, LL: E.LL }; },
      finish: function (st) { var P = lcaM(X, st.Z, K, C), E = lcaE(X, P), fs = fitStats(E.LL, lcaNpar(K, C), n, E.Z, K); fs.params = P; fs.Z = E.Z; fs.K = K; return fs; }
    };
    var r;
    if (K === 1) { var P1 = lcaM(X, X.map(function () { return [1]; }), 1, C), E1 = lcaE(X, P1); r = fitStats(E1.LL, lcaNpar(1, C), n, E1.Z, 1); r.params = P1; r.Z = E1.Z; r.K = 1; r.converged = true; r.replicated = 1; r.starts = 1; r.finalRuns = 1; r.startsOk = 1; }
    else r = multiStart(spec, opts);
    if (!r) return null;
    if (K > 1) orderClasses(r, function (k) { return r.params.pi[k]; }, function (perm) { r.params = { pi: perm.map(function (k) { return r.params.pi[k]; }), rho: perm.map(function (k) { return r.params.rho[k]; }) }; });
    // 반응 패턴 적합도 (poLCA와 같은 정의: 관측된 패턴에 대해 G², χ²; df = min(N, ∏C − 1) − 모수 수)
    var pat = {};
    X.forEach(function (x) { var key = x.join(','); pat[key] = (pat[key] || 0) + 1; });
    var G2 = 0, X2 = 0, lr = r.params.rho.map(function (rk) { return rk.map(function (rj) { return rj.map(function (p) { return Math.log(Math.max(p, 1e-300)); }); }); });
    Object.keys(pat).forEach(function (key) {
      var x = key.split(',').map(Number), lf = r.params.pi.map(function (p, k) { var s = Math.log(p); for (var j = 0; j < x.length; j++) s += lr[k][j][x[j]]; return s; });
      var e = n * Math.exp(logSumExp(lf)), o = pat[key];
      G2 += 2 * o * Math.log(o / e); X2 += (o - e) * (o - e) / e;
    });
    var cells = C.reduce(function (a, c) { return a * c; }, 1);
    r.G2 = G2; r.X2 = X2; r.dfPattern = Math.min(n, cells - 1) - r.npar; r.patterns = Object.keys(pat).length;
    return r;
  }

  /* ---------------- 실행 진입점 ---------------- */
  // 결측은 목록별 제거. LPA: cols = 숫자 배열들. LCA: cols = 값 배열들(문자·숫자; 범주로 처리)
  function prepLPA(cols) {
    var rows = St.completeRows(cols);
    return { rows: rows, X: rows.map(function (i) { return cols.map(function (c) { return c[i]; }); }) };
  }
  function prepLCA(cols) {
    var rows = [];
    for (var i = 0; i < cols[0].length; i++) { var ok = true; for (var j = 0; j < cols.length; j++) { var v = cols[j][i]; if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) { ok = false; break; } } if (ok) rows.push(i); }
    var levels = cols.map(function (c) {
      var lv = []; rows.forEach(function (i) { var s = String(c[i]); if (lv.indexOf(s) < 0) lv.push(s); });
      return lv.sort(function (a, b) { var x = Number(a), y = Number(b); return (!isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
    });
    var X = rows.map(function (i) { return cols.map(function (c, j) { return levels[j].indexOf(String(c[i])); }); });
    return { rows: rows, X: X, levels: levels, C: levels.map(function (l) { return l.length; }) };
  }
  function lpa(cols, opts) {
    opts = opts || {};
    var pr = prepLPA(cols), models = opts.models || ['EEI'], Ks = opts.Ks || [1, 2, 3, 4], out = [];
    if (pr.X.length < 10) throw new Error('완전 사례가 너무 적습니다.');
    models.forEach(function (m) { Ks.forEach(function (K) { var r = lpaFitK(pr.X, K, m, opts); out.push(r ? r : { K: K, model: m, failed: true }); }); });
    return { kind: 'LPA', rows: pr.rows, X: pr.X, fits: out };
  }
  function lca(cols, opts) {
    opts = opts || {};
    var pr = prepLCA(cols), Ks = opts.Ks || [1, 2, 3, 4], out = [];
    if (pr.X.length < 10) throw new Error('완전 사례가 너무 적습니다.');
    if (pr.C.some(function (c) { return c < 2; })) throw new Error('응답이 한 가지뿐인 문항이 있습니다.');
    if (pr.C.some(function (c) { return c > 10; })) throw new Error('범주가 10개를 넘는 문항이 있습니다. LCA에는 범주형 지표를 쓰세요(연속 점수는 LPA).');
    Ks.forEach(function (K) { var r = lcaFitK(pr.X, K, pr.C, opts); out.push(r ? r : { K: K, failed: true }); });
    return { kind: 'LCA', rows: pr.rows, X: pr.X, levels: pr.levels, C: pr.C, fits: out };
  }

  // BLRT 1회: 귀무(K−1) 모형에서 자료를 생성해 K−1, K 모형을 적합 → LRT
  function blrtOnce(res, fit0, K, rand, opts) {
    var n = res.X.length, Xb = [], p = fit0.params;
    var cum = []; p.pi.reduce(function (a, v, k) { cum[k] = a + v; return a + v; }, 0);
    var draw = function () { var u = rand(), k = 0; while (k < cum.length - 1 && u > cum[k]) k++; return k; };
    if (res.kind === 'LPA') {
      var Ls = p.Sigma.map(function (S) { return St.cholesky(S); });
      for (var i = 0; i < n; i++) { var k = draw(); Xb.push(sampleMVN(p.mu[k], Ls[k], rand)); }
    } else {
      for (var i2 = 0; i2 < n; i2++) {
        var k2 = draw();
        Xb.push(p.rho[k2].map(function (rj) { var u = rand(), c = 0, acc = rj[0]; while (c < rj.length - 1 && u > acc) { c++; acc += rj[c]; } return c; }));
      }
    }
    var o = { starts: opts.starts || 10, keep: opts.keep || 3, seed: Math.floor(rand() * 1e9), tol: 1e-8, maxIter: 1000 };
    var f0 = res.kind === 'LPA' ? lpaFitK(Xb, K - 1, fit0.model, o) : lcaFitK(Xb, K - 1, res.C, o);
    var f1 = res.kind === 'LPA' ? lpaFitK(Xb, K, fit0.model, o) : lcaFitK(Xb, K, res.C, o);
    if (!f0 || !f1) return null;
    return Math.max(0, 2 * (f1.LL - f0.LL));
  }

  var api = { lpa: lpa, lca: lca, blrtOnce: blrtOnce, lpaFitK: lpaFitK, lcaFitK: lcaFitK, lpaNpar: lpaNpar, lcaNpar: lcaNpar, LPA_MODELS: LPA_MODELS };
  Object.keys(api).forEach(function (k) { St[k] = api[k]; });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
