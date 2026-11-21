/*
 * PsyStat 통계 엔진 (stats) — 조각 3/4: 잠재프로파일 분석(LPA)·잠재계층분석(LCA)
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

  /* ---------------- 3단계: BCH 원거리 결과변수 (Bolck, Croon, & Hagenaars, 2004; Vermunt, 2010; Bakk et al., 2013) ---------------- */
  // 분류오류행렬 D[s][t] = P(배정 = t | 실제 = s) = Σ_i p_is·1(w_i = t) / Σ_i p_is
  function classificationError(Z, cls) {
    var K = Z[0].length, D = zeros(K, K), tot = new Array(K).fill(0);
    Z.forEach(function (r, i) { for (var s = 0; s < K; s++) { D[s][cls[i]] += r[s]; tot[s] += r[s]; } });
    return D.map(function (row, s) { return row.map(function (v) { return v / tot[s]; }); });
  }
  // BCH 가중치: 배정 집단이 t인 사례의 집단 s 가중치 = (D⁻¹)[t][s]
  function bchWeights(Z, cls) {
    var K = Z[0].length, used = new Array(K).fill(0); cls.forEach(function (c) { used[c]++; });
    if (used.some(function (u) { return u === 0; })) throw new Error('최빈 배정으로 사례가 한 명도 배정되지 않은 집단이 있어 BCH를 계산할 수 없습니다. 집단 수를 줄이거나 다른 해를 고르세요.');
    var D = classificationError(Z, cls), H;
    try { H = St.inverse(D); } catch (e) { throw new Error('분류오류행렬이 특이해 BCH를 계산할 수 없습니다(집단 구분이 매우 약함).'); }
    return { D: D, H: H, W: cls.map(function (t) { return H[t].slice(); }) };
  }
  function waldTest(est, V, C) { // C: 대비행렬 (행 = 제약)
    var Ce = C.map(function (c) { return c.reduce(function (s, v, j) { return s + v * est[j]; }, 0); });
    var CV = C.map(function (c) { return V[0].map(function (_, j) { return c.reduce(function (s, v, a) { return s + v * V[a][j]; }, 0); }); });
    var CVC = CV.map(function (row) { return C.map(function (c) { return row.reduce(function (s, v, j) { return s + v * c[j]; }, 0); }); });
    var Inv = St.inverse(CVC), chi = 0;
    for (var a = 0; a < Ce.length; a++) for (var b = 0; b < Ce.length; b++) chi += Ce[a] * Inv[a][b] * Ce[b];
    return { chi2: chi, df: C.length, p: St.pchisqUpper(chi, C.length) };
  }
  // fit: lpa/lca 결과의 해 (Z, classes), y: 단계 1 사례 순서와 같은 길이 (결측 가능), type: 'continuous' | 'categorical'
  function bchDistal(fit, y, type) {
    var K = fit.K, bw = bchWeights(fit.Z, fit.classes), warn = [];
    var idx = []; y.forEach(function (v, i) { if (v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !isFinite(v))) idx.push(i); });
    if (idx.length < K + 2) throw new Error('결과변수의 유효 사례가 너무 적습니다.');
    var condD = 0; bw.H.forEach(function (r) { r.forEach(function (v) { condD = Math.max(condD, Math.abs(v)); }); });
    if (condD > 10) warn.push('분류오류행렬이 불안정합니다(D⁻¹ 원소 최대 ' + condD.toFixed(1) + '). 집단 구분이 약해 BCH 추정이 불안정할 수 있습니다.');
    var negShare = idx.filter(function (i) { return bw.W[i].some(function (w) { return w < 0; }); }).length / idx.length;
    var Ws = []; for (var s = 0; s < K; s++) Ws.push(idx.reduce(function (a, i) { return a + bw.W[i][s]; }, 0));
    if (Ws.some(function (w) { return !(w > 1); })) throw new Error('BCH 가중치 합이 너무 작은 집단이 있어 추정할 수 없습니다.');
    var out = { K: K, n: idx.length, D: bw.D, weightN: Ws, negWeightShare: negShare, warnings: warn, type: type };
    // 비교용: 최빈 배정(보정 없음)
    var naiveN = new Array(K).fill(0); idx.forEach(function (i) { naiveN[fit.classes[i]]++; });
    if (type === 'continuous') {
      var mu = [], sdv = [];
      for (var s2 = 0; s2 < K; s2++) {
        var m = idx.reduce(function (a, i) { return a + bw.W[i][s2] * y[i]; }, 0) / Ws[s2];
        var v = idx.reduce(function (a, i) { return a + bw.W[i][s2] * (y[i] - m) * (y[i] - m); }, 0) / Ws[s2];
        mu.push(m); sdv.push(Math.sqrt(Math.max(v, 0))); if (v < 0) warn.push('집단 ' + (s2 + 1) + '의 가중 분산이 음수입니다(음수 가중치의 영향).');
      }
      // 샌드위치 공분산: ψ_is = w_is (y_i − μ_s) / W_s
      var V = zeros(K, K);
      idx.forEach(function (i) { var ps = mu.map(function (m, s3) { return bw.W[i][s3] * (y[i] - m) / Ws[s3]; }); for (var a = 0; a < K; a++) for (var b = 0; b < K; b++) V[a][b] += ps[a] * ps[b]; });
      var C = []; for (var k = 1; k < K; k++) { var c = new Array(K).fill(0); c[0] = 1; c[k] = -1; C.push(c); }
      out.means = mu; out.sds = sdv; out.se = V.map(function (r, s4) { return Math.sqrt(r[s4]); }); out.V = V;
      out.overall = K > 1 ? waldTest(mu, V, C) : null;
      out.pairs = [];
      for (var a2 = 0; a2 < K; a2++) for (var b2 = a2 + 1; b2 < K; b2++) {
        var c2 = new Array(K).fill(0); c2[a2] = 1; c2[b2] = -1;
        var wt = waldTest(mu, V, [c2]), se = Math.sqrt(V[a2][a2] + V[b2][b2] - 2 * V[a2][b2]);
        out.pairs.push({ a: a2, b: b2, diff: mu[a2] - mu[b2], se: se, chi2: wt.chi2, p: wt.p });
      }
      out.naiveMeans = []; for (var s5 = 0; s5 < K; s5++) { var g = idx.filter(function (i) { return fit.classes[i] === s5; }).map(function (i) { return y[i]; }); out.naiveMeans.push(g.length ? St.mean(g) : NaN); }
      out.naiveN = naiveN;
    } else {
      var levels = []; idx.forEach(function (i) { var l = String(y[i]); if (levels.indexOf(l) < 0) levels.push(l); });
      levels.sort(function (p1, p2) { var x = Number(p1), z = Number(p2); return (!isNaN(x) && !isNaN(z)) ? x - z : (p1 < p2 ? -1 : p1 > p2 ? 1 : 0); });
      var L = levels.length;
      if (L < 2) throw new Error('범주형 결과변수의 응답이 한 가지뿐입니다.');
      if (L > 15) throw new Error('범주가 15개를 넘습니다. 연속형으로 분석하세요.');
      var yl = y.map(function (v) { return levels.indexOf(String(v)); });
      var P = []; for (var s6 = 0; s6 < K; s6++) P.push(levels.map(function (_, l) { return idx.reduce(function (a, i) { return a + bw.W[i][s6] * (yl[i] === l ? 1 : 0); }, 0) / Ws[s6]; }));
      if (P.some(function (r) { return r.some(function (p) { return p < 0 || p > 1; }); })) warn.push('일부 추정 비율이 0–1 범위를 벗어났습니다(음수 가중치의 영향). 해당 집단이 작거나 분류가 불확실할 때 생기며, 해석에 주의하세요.');
      // 모수: 각 집단의 앞 L−1개 범주 비율, ψ = w_is(1(y=l) − p_sl)/W_s
      var q = K * (L - 1), V2 = zeros(q, q), est = [];
      for (var s7 = 0; s7 < K; s7++) for (var l2 = 0; l2 < L - 1; l2++) est.push(P[s7][l2]);
      idx.forEach(function (i) {
        var ps = []; for (var s8 = 0; s8 < K; s8++) for (var l3 = 0; l3 < L - 1; l3++) ps.push(bw.W[i][s8] * ((yl[i] === l3 ? 1 : 0) - P[s8][l3]) / Ws[s8]);
        for (var a3 = 0; a3 < q; a3++) { if (ps[a3] === 0) continue; for (var b3 = 0; b3 < q; b3++) V2[a3][b3] += ps[a3] * ps[b3]; }
      });
      var cmat = function (sa, sb) { var rows = []; for (var l4 = 0; l4 < L - 1; l4++) { var c3 = new Array(q).fill(0); c3[sa * (L - 1) + l4] = 1; c3[sb * (L - 1) + l4] = -1; rows.push(c3); } return rows; };
      var Call = []; for (var k2 = 1; k2 < K; k2++) Call = Call.concat(cmat(0, k2));
      out.levels = levels; out.props = P;
      out.se = P.map(function (r, s9) { return r.map(function (_, l5) { if (l5 === L - 1) { var c4 = new Array(q).fill(0); for (var m2 = 0; m2 < L - 1; m2++) c4[s9 * (L - 1) + m2] = 1; var vv = 0; for (var a4 = 0; a4 < q; a4++) for (var b4 = 0; b4 < q; b4++) vv += c4[a4] * V2[a4][b4] * c4[b4]; return Math.sqrt(vv); } var j = s9 * (L - 1) + l5; return Math.sqrt(V2[j][j]); }); });
      out.overall = K > 1 ? waldTest(est, V2, Call) : null;
      out.pairs = [];
      for (var a5 = 0; a5 < K; a5++) for (var b5 = a5 + 1; b5 < K; b5++) { var wt2 = waldTest(est, V2, cmat(a5, b5)); out.pairs.push({ a: a5, b: b5, chi2: wt2.chi2, df: wt2.df, p: wt2.p }); }
      out.naiveProps = []; for (var s10 = 0; s10 < K; s10++) { var g2 = idx.filter(function (i) { return fit.classes[i] === s10; }); out.naiveProps.push(levels.map(function (_, l6) { return g2.length ? g2.filter(function (i) { return yl[i] === l6; }).length / g2.length : NaN; })); }
      out.naiveN = naiveN;
    }
    return out;
  }

  // 원래 해의 모수에서 시작해 재추정 (부트스트랩용; 집단 번호가 원래 해와 같게 유지됨)
  function refitFrom(kind, X, fit, C) {
    var P = fit.params, LL = -Infinity, E = null;
    for (var it = 0; it < 500; it++) {
      E = kind === 'LPA' ? lpaE(X, P) : lcaE(X, P);
      if (!E) return null;
      if (Math.abs(E.LL - LL) < 1e-8 * (1 + Math.abs(E.LL))) break;
      LL = E.LL;
      P = kind === 'LPA' ? lpaM(X, E.Z, fit.K, fit.model) : lcaM(X, E.Z, fit.K, C);
      if (!P) return null;
    }
    var cls = E.Z.map(function (r) { var b = 0; for (var k = 1; k < r.length; k++) if (r[k] > r[b]) b = k; return b; });
    return { K: fit.K, Z: E.Z, classes: cls };
  }
  // 3단계 전체 부트스트랩: 사례 재표집 → 단계 1 재추정 → D·가중치 → 단계 3. 단계 1 불확실성을 표준오차에 반영
  // outcomes: [{ y, type, levels }] — 재표집·재추정 1번으로 여러 결과변수를 함께 계산. 반환: 결과변수별 추정치 벡터(실패 시 null)
  function bchBootstrapOnce(res, fit, outcomes, rand) {
    var n = res.X.length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var f2 = refitFrom(res.kind, idx.map(function (q) { return res.X[q]; }), fit, res.C);
    return outcomes.map(function (o) {
      if (!f2) return null;
      try {
        var b = bchDistal(f2, idx.map(function (q) { return o.y[q]; }), o.type);
        if (o.type === 'continuous') return b.means;
        if (o.levels && b.levels.join('|') !== o.levels.join('|')) return null; // 재표집에서 범주가 빠지면 생략
        var est = []; b.props.forEach(function (r) { for (var l = 0; l < r.length - 1; l++) est.push(r[l]); }); return est;
      } catch (e) { return null; }
    });
  }
  // 부트스트랩 결과로 표준오차와 Wald 검정을 다시 계산
  function bchApplyBootstrap(out, draws) {
    var q = draws[0].length, m = new Array(q).fill(0), V = zeros(q, q), B = draws.length;
    draws.forEach(function (d) { for (var a = 0; a < q; a++) m[a] += d[a] / B; });
    draws.forEach(function (d) { for (var a = 0; a < q; a++) for (var b = 0; b < q; b++) V[a][b] += (d[a] - m[a]) * (d[b] - m[b]) / (B - 1); });
    var K = out.K, bo = { B: B, V: V };
    if (out.type === 'continuous') {
      var C = []; for (var k = 1; k < K; k++) { var c = new Array(K).fill(0); c[0] = 1; c[k] = -1; C.push(c); }
      bo.se = V.map(function (r, s) { return Math.sqrt(r[s]); });
      bo.overall = waldTest(out.means, V, C);
      bo.pairs = out.pairs.map(function (p) { var c2 = new Array(K).fill(0); c2[p.a] = 1; c2[p.b] = -1; var w = waldTest(out.means, V, [c2]); return { a: p.a, b: p.b, se: Math.sqrt(V[p.a][p.a] + V[p.b][p.b] - 2 * V[p.a][p.b]), chi2: w.chi2, p: w.p }; });
    } else {
      var L = out.levels.length, est = []; out.props.forEach(function (r) { for (var l = 0; l < L - 1; l++) est.push(r[l]); });
      var cm = function (sa, sb) { var rows = []; for (var l2 = 0; l2 < L - 1; l2++) { var c3 = new Array(q).fill(0); c3[sa * (L - 1) + l2] = 1; c3[sb * (L - 1) + l2] = -1; rows.push(c3); } return rows; };
      var Call = []; for (var k2 = 1; k2 < K; k2++) Call = Call.concat(cm(0, k2));
      bo.se = out.props.map(function (r, s) { return r.map(function (_, l) { var c4 = new Array(q).fill(0); if (l === L - 1) { for (var m2 = 0; m2 < L - 1; m2++) c4[s * (L - 1) + m2] = 1; } else c4[s * (L - 1) + l] = 1; var vv = 0; for (var a = 0; a < q; a++) for (var b = 0; b < q; b++) vv += c4[a] * V[a][b] * c4[b]; return Math.sqrt(vv); }); });
      bo.overall = waldTest(est, V, Call);
      bo.pairs = out.pairs.map(function (p) { var w = waldTest(est, V, cm(p.a, p.b)); return { a: p.a, b: p.b, chi2: w.chi2, df: w.df, p: w.p }; });
    }
    out.boot = bo;
    return out;
  }

  /* ---------------- 다항 로지스틱 회귀 (기준 범주 대비; 관측 반응 또는 분류오류 고정 ML 3단계) ---------------- */
  // X: n×p 설계행렬(절편 포함), R: n×K 반응 가중치 (관측 범주면 원-핫, EM 단계에서는 사후확률), ref: 기준 범주
  function mnProbs(X, beta, K, ref) { // beta: (K−1) × p (기준 제외 순서)
    return X.map(function (x) {
      var eta = [], b = 0;
      for (var k = 0; k < K; k++) { if (k === ref) { eta.push(0); continue; } var e = 0, row = beta[b++]; for (var j = 0; j < x.length; j++) e += row[j] * x[j]; eta.push(e); }
      var lse = logSumExp(eta); return eta.map(function (v) { return Math.exp(v - lse); });
    });
  }
  // 가중 다항 로지스틱 M 단계: Σ_i Σ_k R_ik log π_ik 최대화 (뉴턴-랩슨, 단계 반감)
  function mnFitWeighted(X, R, K, ref, beta0, maxit) {
    var n = X.length, p = X[0].length, q = (K - 1) * p, beta = beta0 ? beta0.map(function (r) { return r.slice(); }) : [];
    if (!beta0) for (var k = 0; k < K - 1; k++) beta.push(new Array(p).fill(0));
    var others = []; for (var k1 = 0; k1 < K; k1++) if (k1 !== ref) others.push(k1);
    var obj = function (bt) { var P = mnProbs(X, bt, K, ref), s = 0; for (var i = 0; i < n; i++) for (var k = 0; k < K; k++) if (R[i][k]) s += R[i][k] * Math.log(Math.max(P[i][k], 1e-300)); return s; };
    var cur = obj(beta);
    for (var it = 0; it < (maxit || 100); it++) {
      var P = mnProbs(X, beta, K, ref), g = new Array(q).fill(0), H = zeros(q, q);
      for (var i = 0; i < n; i++) {
        var w = 0; for (var k2 = 0; k2 < K; k2++) w += R[i][k2];
        for (var a = 0; a < K - 1; a++) {
          var ka = others[a], ra = R[i][ka] - w * P[i][ka];
          for (var j = 0; j < p; j++) g[a * p + j] += ra * X[i][j];
          for (var b2 = 0; b2 < K - 1; b2++) {
            var kb = others[b2], h = w * P[i][ka] * ((a === b2 ? 1 : 0) - P[i][kb]);
            for (var j1 = 0; j1 < p; j1++) for (var j2 = 0; j2 < p; j2++) H[a * p + j1][b2 * p + j2] += h * X[i][j1] * X[i][j2];
          }
        }
      }
      var step; try { var Hi = St.inverse(H); step = Hi.map(function (r) { return r.reduce(function (s, v, j) { return s + v * g[j]; }, 0); }); } catch (e) { return { beta: beta, ll: cur, singular: true }; }
      var lam = 1, nb, nv;
      for (var h2 = 0; h2 < 30; h2++) { nb = beta.map(function (r, a) { return r.map(function (v, j) { return v + lam * step[a * p + j]; }); }); nv = obj(nb); if (nv >= cur - 1e-12) break; lam /= 2; }
      var dl = nv - cur; beta = nb; cur = nv;
      if (Math.abs(dl) < 1e-12 * (1 + Math.abs(cur)) && Math.max.apply(null, step.map(Math.abs)) * lam < 1e-9) break;
    }
    return { beta: beta, ll: cur, H: null };
  }
  // ML 3단계 우도: Σ_i log Σ_s π_is(z) D[s][w_i]
  function ml3LL(X, beta, K, ref, D, w) {
    var P = mnProbs(X, beta, K, ref), s = 0;
    for (var i = 0; i < X.length; i++) { var t = 0; for (var k = 0; k < K; k++) t += P[i][k] * D[k][w[i]]; s += Math.log(Math.max(t, 1e-300)); }
    return s;
  }
  // 관측 정보행렬(수치 2차 미분) → 표준오차
  function numericHessianSE(f, beta) {
    var p = beta[0].length, q = beta.length * p, flat = [].concat.apply([], beta), H = zeros(q, q);
    var unflat = function (v) { var r = []; for (var a = 0; a < beta.length; a++) r.push(v.slice(a * p, (a + 1) * p)); return r; };
    var f0 = f(beta);
    for (var a2 = 0; a2 < q; a2++) {
      var ha = 1e-4 * Math.max(1, Math.abs(flat[a2]));
      for (var b = a2; b < q; b++) {
        var hb = 1e-4 * Math.max(1, Math.abs(flat[b]));
        var v = function (da, db) { var t = flat.slice(); t[a2] += da; t[b] += db; return f(unflat(t)); };
        var val = a2 === b ? (v(ha, 0) - 2 * f0 + v(-ha, 0)) / (ha * ha) : (v(ha, hb) - v(ha, -hb) - v(-ha, hb) + v(-ha, -hb)) / (4 * ha * hb);
        H[a2][b] = H[b][a2] = -val;
      }
    }
    var V; try { V = St.inverse(H); } catch (e) { V = null; }
    return { V: V, se: V ? V.map(function (r, i) { return Math.sqrt(Math.max(r[i], 0)); }) : flat.map(function () { return NaN; }) };
  }
  // 설계행렬: 절편 + 공변인 열
  function design(cols, rows) { return rows.map(function (i) { return [1].concat(cols.map(function (c) { return c[i]; })); }); }

  // 일반 다항 로지스틱 회귀 (관측된 범주형 종속변수)
  function multinomialLogistic(yin, Xcols, names, opts) {
    opts = opts || {};
    var rows = [];
    for (var i = 0; i < yin.length; i++) {
      var v = yin[i]; if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) continue;
      var ok = true; for (var j = 0; j < Xcols.length; j++) if (!St.isNum(Xcols[j][i])) { ok = false; break; }
      if (ok) rows.push(i);
    }
    var levels = []; rows.forEach(function (i2) { var s = String(yin[i2]); if (levels.indexOf(s) < 0) levels.push(s); });
    levels.sort(function (a, b) { var x = Number(a), y = Number(b); return (!isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
    var K = levels.length; if (K < 2) throw new Error('종속변수의 범주가 2개 이상이어야 합니다.');
    if (K > 15) throw new Error('범주가 너무 많습니다(15개 초과).');
    var ref = opts.ref !== undefined && levels.indexOf(String(opts.ref)) >= 0 ? levels.indexOf(String(opts.ref)) : 0;
    var X = design(Xcols, rows), n = X.length, p = X[0].length;
    if (n <= (K - 1) * p) throw new Error('사례 수가 모수 수보다 충분히 많아야 합니다.');
    var R = rows.map(function (i3) { var r = new Array(K).fill(0); r[levels.indexOf(String(yin[i3]))] = 1; return r; });
    var fit = mnFitWeighted(X, R, K, ref, null, 200);
    var llf = function (bt) { var P = mnProbs(X, bt, K, ref), s = 0; for (var i4 = 0; i4 < n; i4++) for (var k = 0; k < K; k++) if (R[i4][k]) s += Math.log(Math.max(P[i4][k], 1e-300)); return s; };
    var inf = numericHessianSE(llf, fit.beta);
    var counts = levels.map(function (_, k) { return R.reduce(function (s, r) { return s + r[k]; }, 0); });
    var ll0 = counts.reduce(function (s, c) { return s + (c ? c * Math.log(c / n) : 0); }, 0);
    var chi = 2 * (fit.ll - ll0), dfM = (K - 1) * (p - 1), z975 = St.qnorm(0.975);
    var others = []; for (var k1 = 0; k1 < K; k1++) if (k1 !== ref) others.push(k1);
    var coefs = [];
    others.forEach(function (k, a) {
      fit.beta[a].forEach(function (b, j) {
        var se = inf.se[a * p + j], zz = b / se;
        coefs.push({ level: levels[k], name: j === 0 ? '(절편)' : names[j - 1], b: b, se: se, z: zz, wald: zz * zz, p: 2 * St.pnorm(-Math.abs(zz)), or: Math.exp(b), orLow: Math.exp(b - z975 * se), orHigh: Math.exp(b + z975 * se) });
      });
    });
    // 예측변수별 우도비 검정 (그 예측변수를 뺀 모형과 비교)
    var lrTests = names.map(function (nm, j) {
      if (!Xcols.length) return null;
      var keep = []; for (var c = 0; c < Xcols.length; c++) if (c !== j) keep.push(Xcols[c]);
      var X2 = design(keep, rows), f2 = mnFitWeighted(X2, R, K, ref, null, 200), ch = 2 * (fit.ll - f2.ll);
      return { name: nm, chi2: ch, df: K - 1, p: St.pchisqUpper(ch, K - 1) };
    }).filter(Boolean);
    var P = mnProbs(X, fit.beta, K, ref), conf = zeros(K, K);
    P.forEach(function (pr, i5) { var b = 0; for (var k2 = 1; k2 < K; k2++) if (pr[k2] > pr[b]) b = k2; conf[R[i5].indexOf(1)][b]++; });
    var cs = 1 - Math.exp(-chi / n), nag = cs / (1 - Math.exp(2 * ll0 / n));
    var warn = [];
    if (fit.singular || coefs.some(function (c) { return !isFinite(c.se) || c.se > 1e3 || Math.abs(c.b) > 15; })) warn.push('분리(separation) 또는 작은 범주 때문에 추정이 불안정할 수 있습니다. 계수·표준오차가 비정상적으로 큰지 확인하세요.');
    return { n: n, K: K, levels: levels, ref: ref, counts: counts, coefs: coefs, ll: fit.ll, ll0: ll0, deviance: -2 * fit.ll, chi2: chi, dfM: dfM, p: St.pchisqUpper(chi, dfM),
      aic: -2 * fit.ll + 2 * (K - 1) * p, bic: -2 * fit.ll + Math.log(n) * (K - 1) * p, coxSnell: cs, nagelkerke: nag, mcfadden: 1 - fit.ll / ll0,
      lrTests: lrTests, confusion: conf, accuracy: conf.reduce(function (s, r, k3) { return s + r[k3]; }, 0) / n, warnings: warn, beta: fit.beta, V: inf.V };
  }

  /*
   * ML 3단계: 공변인 → 잠재집단 소속 (Vermunt, 2010; Bakk, Tekle, & Vermunt, 2013)
   * P(W_i = w | z_i) = Σ_s π_s(z_i) D[s][w], D는 단계 1에서 고정. EM(사후확률 → 가중 다항 로지스틱)으로 최대화
   */
  function ml3Fit(D, w, X, K, ref, beta0) {
    var beta = beta0, ll = -Infinity;
    if (!beta) { beta = []; for (var k = 0; k < K - 1; k++) beta.push(new Array(X[0].length).fill(0)); }
    for (var it = 0; it < 2000; it++) {
      var P = mnProbs(X, beta, K, ref), Rr = P.map(function (pr, i) { var t = 0, q = pr.map(function (v, s) { var u = v * D[s][w[i]]; t += u; return u; }); return q.map(function (u) { return u / t; }); });
      var m = mnFitWeighted(X, Rr, K, ref, beta, 3);
      beta = m.beta;
      var nl = ml3LL(X, beta, K, ref, D, w);
      if (Math.abs(nl - ll) < 1e-11 * (1 + Math.abs(nl))) { ll = nl; break; }
      ll = nl;
    }
    return { beta: beta, ll: ll };
  }
  // fit: 단계 1 해, Zcols: 공변인 열 (단계 1 사례 순서), names, ref: 기준 집단(0부터)
  function ml3Step(fit, Zcols, names, opts) {
    opts = opts || {};
    var K = fit.K, ref = opts.ref || 0, rows = [];
    for (var i = 0; i < fit.classes.length; i++) { var ok = true; for (var j = 0; j < Zcols.length; j++) if (!St.isNum(Zcols[j][i])) { ok = false; break; } if (ok) rows.push(i); }
    if (rows.length < K * (Zcols.length + 2)) throw new Error('공변인이 있는 사례가 너무 적습니다.');
    var D = classificationError(fit.Z, fit.classes), X = design(Zcols, rows), w = rows.map(function (i2) { return fit.classes[i2]; });
    var used = new Array(K).fill(0); w.forEach(function (t) { used[t]++; });
    if (used.some(function (u) { return u === 0; })) throw new Error('최빈 배정으로 사례가 한 명도 배정되지 않은 집단이 있어 ML 3단계를 계산할 수 없습니다.');
    var res = ml3Fit(D, w, X, K, ref, null);
    var inf = numericHessianSE(function (bt) { return ml3LL(X, bt, K, ref, D, w); }, res.beta);
    // 비교용: 최빈 배정을 관측 범주로 본 다항 로지스틱 (보정 없음)
    var Rn = w.map(function (t) { var r = new Array(K).fill(0); r[t] = 1; return r; }), naive = mnFitWeighted(X, Rn, K, ref, null, 200);
    // 공변인 전체 효과의 우도비 검정 (각 공변인을 뺀 모형과 비교)
    var p = X[0].length, z975 = St.qnorm(0.975), others = []; for (var k = 0; k < K; k++) if (k !== ref) others.push(k);
    var coefs = [];
    others.forEach(function (k2, a) { res.beta[a].forEach(function (b, j2) {
      var se = inf.se[a * p + j2], zz = b / se;
      coefs.push({ cls: k2, name: j2 === 0 ? '(절편)' : names[j2 - 1], b: b, se: se, z: zz, p: 2 * St.pnorm(-Math.abs(zz)), or: Math.exp(b), orLow: Math.exp(b - z975 * se), orHigh: Math.exp(b + z975 * se), naiveB: naive.beta[a][j2] });
    }); });
    var lr = names.map(function (nm, j3) {
      var keep = []; for (var c = 0; c < Zcols.length; c++) if (c !== j3) keep.push(Zcols[c]);
      var r2 = ml3Fit(D, w, design(keep, rows), K, ref, null), ch = 2 * (res.ll - r2.ll);
      return { name: nm, chi2: ch, df: K - 1, p: St.pchisqUpper(ch, K - 1) };
    });
    var warn = [];
    if (coefs.some(function (c2) { return !isFinite(c2.se) || c2.se > 1e3 || Math.abs(c2.b) > 15; })) warn.push('추정이 불안정합니다(분리 또는 작은 집단). 오즈비가 비정상적으로 크면 해석하지 마세요.');
    return { K: K, n: rows.length, ref: ref, D: D, coefs: coefs, ll: res.ll, beta: res.beta, V: inf.V, lrTests: lr, warnings: warn, rows: rows };
  }
  // 3단계 전체 부트스트랩 1회 → 계수 벡터
  function ml3BootstrapOnce(res, fit, Zcols, names, ref, rand) {
    var n = res.X.length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var f2 = refitFrom(res.kind, idx.map(function (q) { return res.X[q]; }), fit, res.C);
    if (!f2) return null;
    try { var r = ml3Step(f2, Zcols.map(function (c) { return idx.map(function (q) { return c[q]; }); }), names, { ref: ref }); return [].concat.apply([], r.beta); } catch (e) { return null; }
  }
  function ml3ApplyBootstrap(out, draws) {
    var q = draws[0].length, m = new Array(q).fill(0), B = draws.length, sd = new Array(q).fill(0);
    draws.forEach(function (d) { for (var a = 0; a < q; a++) m[a] += d[a] / B; });
    draws.forEach(function (d) { for (var a = 0; a < q; a++) sd[a] += (d[a] - m[a]) * (d[a] - m[a]) / (B - 1); });
    var z975 = St.qnorm(0.975);
    out.coefs.forEach(function (c, a) { var se = Math.sqrt(sd[a]), zz = c.b / se; c.bootSE = se; c.bootP = 2 * St.pnorm(-Math.abs(zz)); c.bootOrLow = Math.exp(c.b - z975 * se); c.bootOrHigh = Math.exp(c.b + z975 * se); });
    out.bootB = B;
    return out;
  }

  var api = { lpa: lpa, lca: lca, blrtOnce: blrtOnce, classificationError: classificationError, bchWeights: bchWeights, bchDistal: bchDistal,
    multinomialLogistic: multinomialLogistic, ml3Step: ml3Step, ml3BootstrapOnce: ml3BootstrapOnce, ml3ApplyBootstrap: ml3ApplyBootstrap,
    bchBootstrapOnce: bchBootstrapOnce, bchApplyBootstrap: bchApplyBootstrap, refitFrom: refitFrom, lpaFitK: lpaFitK, lcaFitK: lcaFitK, lpaNpar: lpaNpar, lcaNpar: lcaNpar, LPA_MODELS: LPA_MODELS };
  Object.keys(api).forEach(function (k) { St[k] = api[k]; });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
