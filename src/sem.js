/*
 * PsyStat 구조방정식 엔진 (sem.js)
 * - lavaan 문법의 부분집합: =~, ~, ~~, :=, 라벨(a*x), 고정값(1*x), 해제(NA*x)
 * - lavaan::sem()/cfa() 기본값을 따름: 첫 지표 적재량 1 고정, fixed.x = TRUE,
 *   외생 잠재변수 간 공분산, 순수 결과변수 간 잔차공분산 자동 추가
 * - 추정: ML (Fisher scoring), 표준오차: 기대정보(ML) / Huber-White 샌드위치(MLR, 관측정보)
 * - 검정: χ² = N·F_ML, MLR은 Yuan-Bentler(Mplus 방식) 척도화
 * - RAM 표기: Σ = F (I − A)⁻¹ S (I − A)⁻ᵀ Fᵀ
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./stats.js'));
  else root.PsySEM = factory(root.PsyStats);
})(typeof self !== 'undefined' ? self : this, function (St) {
  'use strict';

  /* ---------------- 행렬 도우미 ---------------- */
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new Array(c).fill(0)); return m; }
  function mm(A, B) {
    var r = A.length, k = B.length, c = B[0].length, C = zeros(r, c);
    for (var i = 0; i < r; i++) for (var l = 0; l < k; l++) { var a = A[i][l]; if (a === 0) continue; var Bl = B[l], Ci = C[i]; for (var j = 0; j < c; j++) Ci[j] += a * Bl[j]; }
    return C;
  }
  function tr(A) { var s = 0; for (var i = 0; i < A.length; i++) s += A[i][i]; return s; }
  function T(A) { return St.transpose(A); }
  function trProd(A, B) { var s = 0, n = A.length; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) s += A[i][j] * B[j][i]; return s; }

  /* ---------------- 1. 문법 해석 ---------------- */
  function parseModel(text) {
    var out = [], defs = [], lines = text.replace(/\r/g, '').split(/[\n;]/);
    lines.forEach(function (raw, ln) {
      var line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      var m = /^(.+?)\s*(=~|~~|:=|~)\s*(.+)$/.exec(line);
      if (!m) throw new Error((ln + 1) + '번째 줄을 해석할 수 없습니다: "' + line + '"');
      var lhs = m[1].trim(), op = m[2], rhs = m[3].trim();
      if (op === ':=') { defs.push({ name: lhs, expr: rhs, fn: compileExpr(rhs) }); return; }
      if (!/^[A-Za-z가-힣_.][A-Za-z0-9가-힣_.]*$/.test(lhs)) throw new Error((ln + 1) + '번째 줄의 왼쪽 변수 이름이 올바르지 않습니다: "' + lhs + '"');
      rhs.split('+').forEach(function (term) {
        term = term.trim(); if (!term) return;
        var label = null, fixed = null, freeForce = false, name = term, mm2 = /^(.+?)\s*\*\s*(.+)$/.exec(term);
        if (mm2) {
          var mod = mm2[1].trim(); name = mm2[2].trim();
          if (/^NA$/i.test(mod)) freeForce = true;
          else if (!isNaN(Number(mod))) fixed = Number(mod);
          else if (/^[A-Za-z가-힣_.][A-Za-z0-9가-힣_.]*$/.test(mod)) label = mod;
          else throw new Error((ln + 1) + '번째 줄의 수정자를 해석할 수 없습니다: "' + mod + '"');
        }
        if (name === '1') throw new Error('절편(~ 1)은 현재 지원하지 않습니다.');
        if (!/^[A-Za-z가-힣_.][A-Za-z0-9가-힣_.]*$/.test(name)) throw new Error((ln + 1) + '번째 줄의 변수 이름이 올바르지 않습니다: "' + name + '"');
        out.push({ lhs: lhs, op: op, rhs: name, label: label, fixed: fixed, freeForce: freeForce, user: true });
      });
    });
    return { pt: out, defs: defs };
  }

  // := 수식 컴파일 (+ − * / ^, 괄호, 라벨, 숫자)
  function compileExpr(src) {
    // (전송용 줄 길이 제한 때문에 정규식을 문자열로 나눠 만듦; 내용은 같음)
    var TOK_RE = new RegExp('\\s*([A-Za-z가-힣_.][A-Za-z0-9가-힣_.]*|' +
      '\\d*\\.?\\d+(?:[eE][-+]?\\d+)?|[-+*/^()])\\s*', 'g');
    var toks = src.match(TOK_RE);
    if (!toks || toks.join('').replace(/\s/g, '') !== src.replace(/\s/g, '')) throw new Error('정의 수식을 해석할 수 없습니다: "' + src + '"');
    toks = toks.map(function (t) { return t.trim(); });
    var i = 0, names = [];
    function peek() { return toks[i]; }
    function expr() { var n = term(); while (peek() === '+' || peek() === '-') { var o = toks[i++], r = term(); n = { o: o, a: n, b: r }; } return n; }
    function term() { var n = power(); while (peek() === '*' || peek() === '/') { var o = toks[i++], r = power(); n = { o: o, a: n, b: r }; } return n; }
    function power() { var n = unary(); if (peek() === '^') { i++; n = { o: '^', a: n, b: power() }; } return n; }
    function unary() { if (peek() === '-') { i++; return { o: 'neg', a: unary() }; } if (peek() === '+') { i++; return unary(); } return atom(); }
    function atom() {
      var t = toks[i++];
      if (t === '(') { var n = expr(); if (toks[i++] !== ')') throw new Error('괄호가 맞지 않습니다: "' + src + '"'); return n; }
      if (t === undefined) throw new Error('수식이 끝나지 않았습니다: "' + src + '"');
      if (!isNaN(Number(t))) return { v: Number(t) };
      if (names.indexOf(t) < 0) names.push(t);
      return { name: t };
    }
    var tree = expr();
    if (i !== toks.length) throw new Error('수식을 해석할 수 없습니다: "' + src + '"');
    function ev(n, env) {
      if (n.v !== undefined) return n.v;
      if (n.name !== undefined) { if (!(n.name in env)) throw new Error('정의 수식의 라벨 "' + n.name + '"이(가) 모형에 없습니다.'); return env[n.name]; }
      if (n.o === 'neg') return -ev(n.a, env);
      var a = ev(n.a, env), b = ev(n.b, env);
      return n.o === '+' ? a + b : n.o === '-' ? a - b : n.o === '*' ? a * b : n.o === '/' ? a / b : Math.pow(a, b);
    }
    var fn = function (env) { return ev(tree, env); };
    fn.names = names;
    return fn;
  }

  /* ---------------- 2. 모형 구성 (lavaan 기본값) ---------------- */
  function buildModel(parsed, dataNames) {
    var pt = parsed.pt.map(function (p) { return Object.assign({}, p); });
    var latents = [];
    pt.forEach(function (p) { if (p.op === '=~' && latents.indexOf(p.lhs) < 0) latents.push(p.lhs); });
    var all = [];
    pt.forEach(function (p) { [p.lhs, p.rhs].forEach(function (v) { if (all.indexOf(v) < 0) all.push(v); }); });
    var observed = all.filter(function (v) { return latents.indexOf(v) < 0; });
    observed.forEach(function (v) { if (dataNames.indexOf(v) < 0) throw new Error('변수 "' + v + '"이(가) 자료에 없습니다. 잠재변수라면 =~ 로 정의하세요.'); });
    // 관측변수 순서: 자료 순서
    observed.sort(function (a, b) { return dataNames.indexOf(a) - dataNames.indexOf(b); });
    var isLat = function (v) { return latents.indexOf(v) >= 0; };
    var depReg = {}, predReg = {}, indicator = {};
    pt.forEach(function (p) {
      if (p.op === '~') { depReg[p.lhs] = true; predReg[p.rhs] = true; }
      if (p.op === '=~') indicator[p.rhs] = true;
    });
    // 외생 관측변수 (fixed.x): 회귀의 예측변수로만 쓰이고, 종속·지표가 아니며 ~~ 사용자 지정도 없는 관측변수
    var userCov = {};
    pt.forEach(function (p) { if (p.op === '~~') { userCov[p.lhs] = true; userCov[p.rhs] = true; } });
    var xObs = observed.filter(function (v) { return predReg[v] && !depReg[v] && !indicator[v] && !userCov[v]; });
    var has = function (op, a, b) { return pt.some(function (p) { return p.op === op && ((p.lhs === a && p.rhs === b) || (op === '~~' && p.lhs === b && p.rhs === a)); }); };
    // 첫 지표 고정
    latents.forEach(function (f) {
      var first = pt.filter(function (p) { return p.op === '=~' && p.lhs === f; })[0];
      if (first && first.fixed === null && !first.freeForce && !first.label) first.fixed = 1;
    });
    var add = function (p) { p.user = false; p.label = null; p.fixed = null; p.freeForce = false; pt.push(p); };
    // 분산
    observed.forEach(function (v) { if (xObs.indexOf(v) < 0 && !has('~~', v, v)) add({ lhs: v, op: '~~', rhs: v }); });
    latents.forEach(function (v) { if (!has('~~', v, v)) add({ lhs: v, op: '~~', rhs: v }); });
    // 외생 잠재변수 간 공분산
    var exoLat = latents.filter(function (v) { return !depReg[v]; });
    for (var i = 0; i < exoLat.length; i++) for (var j = i + 1; j < exoLat.length; j++) if (!has('~~', exoLat[i], exoLat[j])) add({ lhs: exoLat[i], op: '~~', rhs: exoLat[j] });
    // 순수 결과변수(종속이면서 예측변수가 아닌 변수) 간 잔차공분산
    var pureY = all.filter(function (v) { return depReg[v] && !predReg[v]; });
    for (var a = 0; a < pureY.length; a++) for (var b = a + 1; b < pureY.length; b++) if (!has('~~', pureY[a], pureY[b])) add({ lhs: pureY[a], op: '~~', rhs: pureY[b] });
    // 모수 번호 (같은 라벨 = 같은 모수)
    var labelIdx = {}, nFree = 0;
    pt.forEach(function (p) {
      if (p.fixed !== null) { p.free = -1; return; }
      if (p.label) { if (!(p.label in labelIdx)) labelIdx[p.label] = nFree++; p.free = labelIdx[p.label]; }
      else p.free = nFree++;
    });
    var vars = observed.concat(latents), idx = {};
    vars.forEach(function (v, k) { idx[v] = k; });
    return { pt: pt, latents: latents, observed: observed, xObs: xObs, vars: vars, idx: idx, nFree: nFree, defs: parsed.defs, labelIdx: labelIdx };
  }

  /* ---------------- 3. 모형 공분산 ---------------- */
  function matrices(model, theta, Sx) {
    var nv = model.vars.length, A = zeros(nv, nv), S = zeros(nv, nv), id = model.idx;
    model.pt.forEach(function (p) {
      var v = p.free >= 0 ? theta[p.free] : p.fixed;
      if (p.op === '=~') A[id[p.rhs]][id[p.lhs]] = v;
      else if (p.op === '~') A[id[p.lhs]][id[p.rhs]] = v;
      else if (p.op === '~~') { S[id[p.lhs]][id[p.rhs]] = v; S[id[p.rhs]][id[p.lhs]] = v; }
    });
    // fixed.x: 외생 관측변수 블록은 표본값 고정
    model.xObs.forEach(function (a) { model.xObs.forEach(function (b) { S[id[a]][id[b]] = Sx[a + '|' + b]; }); });
    var IA = zeros(nv, nv);
    for (var i = 0; i < nv; i++) for (var j = 0; j < nv; j++) IA[i][j] = (i === j ? 1 : 0) - A[i][j];
    var B = St.inverse(IA), BS = mm(B, S), Sf = mm(BS, T(B));
    var p = model.observed.length, Sigma = zeros(p, p);
    for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Sigma[a2][b2] = Sf[a2][b2];
    return { A: A, S: S, B: B, Sf: Sf, Sigma: Sigma };
  }

  // ∂Σ/∂θ_k (관측 블록) 목록
  function derivs(model, M) {
    var nv = model.vars.length, p = model.observed.length, id = model.idx, D = [];
    for (var k = 0; k < model.nFree; k++) D.push(zeros(p, p));
    var B = M.B, Sf = M.Sf;
    model.pt.forEach(function (q) {
      if (q.free < 0) return;
      var Dk = D[q.free], r, c;
      if (q.op === '~~') {
        r = id[q.lhs]; c = id[q.rhs];
        for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) {
          var v = B[a][r] * B[b][c] + (r !== c ? B[a][c] * B[b][r] : 0);
          Dk[a][b] += v;
        }
      } else {
        // A[r][c] 원소: ∂Sf = B E_rc Sf + (B E_rc Sf)ᵀ
        if (q.op === '=~') { r = id[q.rhs]; c = id[q.lhs]; } else { r = id[q.lhs]; c = id[q.rhs]; }
        for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Dk[a2][b2] += B[a2][r] * Sf[c][b2] + B[b2][r] * Sf[c][a2];
      }
    });
    return D;
  }

  function mlF(Sigma, Sinv, S, logdetS) {
    var ld = St.logdetPD(Sigma);
    if (!isFinite(ld)) return Infinity;
    return ld + trProd(S, Sinv) - logdetS - S.length;
  }

  /* ---------------- 4. 추정 ---------------- */
  function startValues(model, S) {
    var theta = new Array(model.nFree).fill(0), id = model.idx, set = {};
    var sv = function (v) { return S[id[v]] ? S[id[v]][id[v]] : 1; };
    model.pt.forEach(function (p) {
      if (p.free < 0 || set[p.free]) return;
      var val = 0;
      if (p.op === '=~') {
        var ind = model.pt.filter(function (q) { return q.op === '=~' && q.lhs === p.lhs; }), marker = ind[0].rhs;
        if (marker === p.rhs) val = 1;
        else { var cm = S[id[marker]][id[p.rhs]], others = ind.filter(function (q) { return q.rhs !== marker && q.rhs !== p.rhs; });
          var ref = others.length ? others.reduce(function (s, q) { return s + S[id[marker]][id[q.rhs]]; }, 0) / others.length : S[id[marker]][id[marker]] * 0.5;
          val = Math.abs(ref) > 1e-8 ? cm / ref * (Math.abs(cm) > 0 ? 1 : 0) : 1; if (!isFinite(val) || Math.abs(val) > 10) val = 1; }
      } else if (p.op === '~~') {
        if (p.lhs === p.rhs) {
          if (model.latents.indexOf(p.lhs) >= 0) {
            var ind2 = model.pt.filter(function (q) { return q.op === '=~' && q.lhs === p.lhs; });
            val = ind2.length ? Math.max(0.05, 0.5 * sv(ind2[0].rhs)) : 0.05;
          } else val = 0.5 * sv(p.lhs);
        } else val = 0;
      }
      theta[p.free] = val; set[p.free] = true;
    });
    return theta;
  }

  function fitML(model, S, Sx, opts) {
    opts = opts || {};
    var theta = opts.start ? opts.start.slice() : startValues(model, S), logdetS = St.logdetPD(S), q = model.nFree;
    var ev = function (th) {
      var M; try { M = matrices(model, th, Sx); } catch (e) { return { F: Infinity }; }
      var Si; try { Si = St.inverse(M.Sigma); } catch (e2) { return { F: Infinity }; }
      var F = mlF(M.Sigma, Si, S, logdetS);
      return { M: M, Si: Si, F: F };
    };
    var cur = ev(theta), it, converged = false;
    if (!isFinite(cur.F)) throw new Error('시작값에서 모형 공분산이 양정치가 아닙니다. 모형 지정을 확인하세요.');
    for (it = 1; it <= (opts.maxit || 500); it++) {
      var D = derivs(model, cur.M), Si = cur.Si, Rm = mm(mm(Si, S), Si);
      var W = Si.map(function (r, i) { return r.map(function (v, j) { return v - Rm[i][j]; }); }); // Σ⁻¹ − Σ⁻¹SΣ⁻¹
      var g = D.map(function (Dk) { return trProd(W, Dk); });
      var MK = D.map(function (Dk) { return mm(Si, Dk); }), H = zeros(q, q);
      for (var a = 0; a < q; a++) for (var b = a; b < q; b++) { H[a][b] = H[b][a] = trProd(MK[a], MK[b]); }
      var step;
      try { var Hi = St.inverse(H); step = Hi.map(function (r) { return -r.reduce(function (s, v, j) { return s + v * g[j]; }, 0); }); }
      catch (e) { throw new Error('정보행렬이 특이합니다. 모형이 식별되지 않았을 수 있습니다(자유도, 잠재변수 척도 지정, 중복 경로 확인).'); }
      var lam = 1, nxt, nt;
      for (var h = 0; h < 30; h++) {
        nt = theta.map(function (v, k) { return v + lam * step[k]; });
        nxt = ev(nt);
        if (isFinite(nxt.F) && nxt.F <= cur.F + 1e-12) break;
        lam /= 2;
      }
      if (!isFinite(nxt.F)) break;
      var maxStep = Math.max.apply(null, step.map(function (v) { return Math.abs(v * lam); }));
      var dF = cur.F - nxt.F;
      theta = nt; cur = nxt;
      var gmax = Math.max.apply(null, g.map(Math.abs));
      if (maxStep < (opts.tol || 1e-11) || (gmax < 1e-12 && maxStep < 1e-8)) { converged = true; break; }
    }
    return { theta: theta, F: cur.F, M: cur.M, Si: cur.Si, iterations: it, converged: converged };
  }

  /* ---------------- 5. 표준오차 · 검정 ---------------- */
  function gradF(model, theta, S, Sx) {
    var M = matrices(model, theta, Sx), Si = St.inverse(M.Sigma), D = derivs(model, M), Rm = mm(mm(Si, S), Si);
    var W = Si.map(function (r, i) { return r.map(function (v, j) { return v - Rm[i][j]; }); });
    return D.map(function (Dk) { return trProd(W, Dk); });
  }

  // vech 인덱스
  function vechIdx(p) { var o = []; for (var j = 0; j < p; j++) for (var i = j; i < p; i++) o.push([i, j]); return o; }

  function inference(model, fit, S, Sx, Xc, N, estimator) {
    var q = model.nFree, M = fit.M, Si = fit.Si, D = derivs(model, M), p = S.length;
    var MK = D.map(function (Dk) { return mm(Si, Dk); }), Hexp = zeros(q, q);
    for (var a = 0; a < q; a++) for (var b = a; b < q; b++) Hexp[a][b] = Hexp[b][a] = trProd(MK[a], MK[b]);
    var Aexp = Hexp.map(function (r) { return r.map(function (v) { return v / 2; }); }); // 사례당 기대정보
    var res = { Aexp: Aexp };
    if (estimator === 'ML') {
      var Ai = St.inverse(Aexp);
      res.vcov = Ai.map(function (r) { return r.map(function (v) { return v / N; }); });
      return res;
    }
    // MLR: 관측정보 (해석적 기울기의 중심차분)
    var Hobs = zeros(q, q);
    for (var k = 0; k < q; k++) {
      var hk = 1e-5 * Math.max(1, Math.abs(fit.theta[k]));
      var tp = fit.theta.slice(), tm = fit.theta.slice(); tp[k] += hk; tm[k] -= hk;
      var gp = gradF(model, tp, S, Sx), gm = gradF(model, tm, S, Sx);
      for (var l = 0; l < q; l++) Hobs[k][l] = (gp[l] - gm[l]) / (2 * hk);
    }
    for (var a2 = 0; a2 < q; a2++) for (var b2 = a2 + 1; b2 < q; b2++) { var v = (Hobs[a2][b2] + Hobs[b2][a2]) / 2; Hobs[a2][b2] = Hobs[b2][a2] = v; }
    var Aobs = Hobs.map(function (r) { return r.map(function (v2) { return v2 / 2; }); });
    // 사례별 점수: s_ik = −½ tr(Σ⁻¹∂Σ_k) + ½ zᵢ'∂Σ_k zᵢ
    var trk = MK.map(tr), Bm = zeros(q, q), vi = vechIdx(p), ps = vi.length, B1 = zeros(ps, ps), Sinv = St.inverse(S);
    for (var i = 0; i < N; i++) {
      var x = Xc[i], z = Si.map(function (r) { return r.reduce(function (s2, w, j) { return s2 + w * x[j]; }, 0); });
      var zs = Sinv.map(function (r) { return r.reduce(function (s2, w, j) { return s2 + w * x[j]; }, 0); });
      var sc = D.map(function (Dk, kk) { var quad = 0; for (var r = 0; r < p; r++) { var zr = z[r]; if (zr === 0) continue; for (var c = 0; c < p; c++) quad += zr * Dk[r][c] * z[c]; } return -0.5 * trk[kk] + 0.5 * quad; });
      for (var a3 = 0; a3 < q; a3++) for (var b3 = a3; b3 < q; b3++) Bm[a3][b3] += sc[a3] * sc[b3];
      // 포화모형 점수 (vech Σ): 대각 ½(z_k² − Σ⁻¹_kk), 비대각 z_k z_l − Σ⁻¹_kl
      var s1 = vi.map(function (pr) { return pr[0] === pr[1] ? 0.5 * (zs[pr[0]] * zs[pr[0]] - Sinv[pr[0]][pr[0]]) : zs[pr[0]] * zs[pr[1]] - Sinv[pr[0]][pr[1]]; });
      for (var a4 = 0; a4 < ps; a4++) { var sa = s1[a4]; if (sa === 0) continue; var row = B1[a4]; for (var b4 = a4; b4 < ps; b4++) row[b4] += sa * s1[b4]; }
    }
    for (var a5 = 0; a5 < q; a5++) for (var b5 = a5; b5 < q; b5++) { Bm[a5][b5] /= N; Bm[b5][a5] = Bm[a5][b5]; }
    for (var a6 = 0; a6 < ps; a6++) for (var b6 = a6; b6 < ps; b6++) { B1[a6][b6] /= N; B1[b6][a6] = B1[a6][b6]; }
    var Aoi = St.inverse(Aobs), V = mm(mm(Aoi, Bm), Aoi);
    res.vcov = V.map(function (r) { return r.map(function (v3) { return v3 / N; }); });
    res.Aobs = Aobs; res.B0 = Bm;
    // 포화모형 정보 (lavaan yuan.bentler.mplus: h1.information = "unstructured", 즉 Σ = S에서 평가)
    var Si0 = Si; Si = Sinv;
    var P = Sinv, A1 = zeros(ps, ps);
    var e = function (pr) { return pr[0] === pr[1] ? [[pr[0], pr[1], 1]] : [[pr[0], pr[1], 1], [pr[1], pr[0], 1]]; };
    for (var a7 = 0; a7 < ps; a7++) for (var b7 = a7; b7 < ps; b7++) {
      var Ea = e(vi[a7]), Eb = e(vi[b7]), t1 = 0, t2 = 0;
      Ea.forEach(function (ea) { Eb.forEach(function (eb) {
        // tr(Σ⁻¹ E_ij Σ⁻¹ E_kl) = Σ⁻¹[j][k] Σ⁻¹[l][i];  tr(P E_ij Σ⁻¹ E_kl) = Σ⁻¹[j][k] P[l][i]
        t1 += Si[ea[1]][eb[0]] * Si[eb[1]][ea[0]];
        t2 += Si[ea[1]][eb[0]] * P[eb[1]][ea[0]];
      }); });
      A1[a7][b7] = A1[b7][a7] = 0.5 * (-t1 + 2 * t2);
    }
    Si = Si0;
    // fixed.x: 두 변수 모두 외생 관측변수인 원소는 제외
    var xi = model.xObs.map(function (v) { return model.idx[v]; }), keep = [];
    vi.forEach(function (pr, k2) { if (!(xi.indexOf(pr[0]) >= 0 && xi.indexOf(pr[1]) >= 0)) keep.push(k2); });
    res.A1 = keep.map(function (a8) { return keep.map(function (b8) { return A1[a8][b8]; }); });
    res.B1 = keep.map(function (a8) { return keep.map(function (b8) { return B1[a8][b8]; }); });
    return res;
  }

  // 비중심 χ² 누적확률
  function pnchisq(x, df, ncp) {
    if (ncp <= 0) return St.pchisq(x, df);
    var lam = ncp / 2, j0 = Math.floor(lam), s = 0;
    var logp0 = -lam + j0 * Math.log(lam) - St.lgamma(j0 + 1);
    for (var dir = 0; dir < 2; dir++) {
      for (var j = dir ? j0 - 1 : j0; dir ? j >= 0 : true; j += dir ? -1 : 1) {
        var lp = -lam + j * Math.log(lam) - St.lgamma(j + 1), w = Math.exp(lp);
        s += w * St.pchisq(x, df + 2 * j);
        if (w < 1e-16 && Math.abs(j - j0) > 5) break;
        if (!dir && j > j0 + 10000) break;
      }
    }
    return Math.min(1, s);
  }
  function rmseaCI(X2, df, N) {
    if (df <= 0) return [NaN, NaN];
    var find = function (target) {
      if (pnchisq(X2, df, 0) < target) return 0;
      var lo = 0, hi = Math.max(10, X2 * 3);
      while (pnchisq(X2, df, hi) > target) hi *= 2;
      for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (pnchisq(X2, df, mid) > target) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    return [Math.sqrt(find(0.95) / (N * df)), Math.sqrt(find(0.05) / (N * df))];
  }

  /* ---------------- 6. 전체 실행 ---------------- */
  function covN(cols) { // N 분모 공분산
    var k = cols.length, n = cols[0].length, m = cols.map(function (c) { return c.reduce(function (s, v) { return s + v; }, 0) / n; }), S = zeros(k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) { var s = 0; for (var r = 0; r < n; r++) s += (cols[i][r] - m[i]) * (cols[j][r] - m[j]); S[i][j] = S[j][i] = s / n; }
    return { S: S, means: m };
  }

  function prepare(model, data) { // data: {name: array}
    var cols = model.observed.map(function (v) { return data[v]; });
    var rows = St.completeRows(cols), n = rows.length;
    var X = cols.map(function (c) { return rows.map(function (i) { return c[i]; }); });
    return { X: X, rows: rows, n: n };
  }
  function moments(model, X) {
    var cs = covN(X), S = cs.S, Sx = {}, id = model.idx;
    model.xObs.forEach(function (a) { model.xObs.forEach(function (b) { Sx[a + '|' + b] = S[id[a]][id[b]]; }); });
    return { S: S, Sx: Sx, means: cs.means };
  }

  function baselineFit(model, S, N) { // 독립모형: 대각만 (fixed.x 블록 공분산은 고정 포함)
    var p = S.length, xi = model.xObs.map(function (v) { return model.idx[v]; });
    var Sig = zeros(p, p);
    for (var i = 0; i < p; i++) Sig[i][i] = S[i][i];
    xi.forEach(function (a) { xi.forEach(function (b) { Sig[a][b] = S[a][b]; }); });
    var F = mlF(Sig, St.inverse(Sig), S, St.logdetPD(S));
    var nx = xi.length, df = p * (p - 1) / 2 - nx * (nx - 1) / 2;
    return { chisq: N * F, df: df, Sigma: Sig };
  }

  // 기저모형 객체: 각 (비외생) 관측변수의 분산만 자유, fixed.x 블록은 고정
  function baselineModel(model) {
    var pt = [], k = 0;
    model.observed.forEach(function (v) { if (model.xObs.indexOf(v) < 0) pt.push({ lhs: v, op: '~~', rhs: v, free: k++, fixed: null, user: false }); });
    var idx = {}; model.observed.forEach(function (v, i) { idx[v] = i; });
    return { pt: pt, latents: [], observed: model.observed, xObs: model.xObs, vars: model.observed, idx: idx, nFree: k, defs: [], labelIdx: {} };
  }

  function standardize(model, M, theta) {
    var Sf = M.Sf, id = model.idx, sd = Sf.map(function (r, i) { return Math.sqrt(r[i]); });
    var resVar = function (v) { return M.S[id[v]][id[v]]; };
    return model.pt.map(function (p) {
      var est = p.free >= 0 ? theta[p.free] : p.fixed;
      if (p.op === '=~') return est * sd[id[p.lhs]] / sd[id[p.rhs]];
      if (p.op === '~') return est * sd[id[p.rhs]] / sd[id[p.lhs]];
      if (p.lhs === p.rhs) return est / Sf[id[p.lhs]][id[p.lhs]];
      var a = resVar(p.lhs), b = resVar(p.rhs);
      return est / Math.sqrt(a * b);
    });
  }

  function evalDefs(model, theta) {
    var env = {};
    Object.keys(model.labelIdx).forEach(function (l) { env[l] = theta[model.labelIdx[l]]; });
    return model.defs.map(function (d) { return d.fn(env); });
  }

  function fitSEM(text, data, opts) {
    opts = opts || {};
    var estimator = opts.estimator === 'MLR' ? 'MLR' : 'ML';
    var parsed = parseModel(text);
    if (!parsed.pt.length) throw new Error('모형 문법이 비어 있습니다.');
    var model = buildModel(parsed, Object.keys(data));
    var pre = prepare(model, data), N = pre.n, p = model.observed.length;
    if (N < p + 1) throw new Error('완전 사례 수(' + N + ')가 관측변수 수보다 많아야 합니다.');
    var mo = moments(model, pre.X), S = mo.S;
    if (!St.cholesky(S)) throw new Error('표본 공분산 행렬이 양정치가 아닙니다 (중복 변수 또는 사례 부족).');
    var fit = fitML(model, S, mo.Sx);
    var nx = model.xObs.length, pstar = p * (p + 1) / 2 - nx * (nx + 1) / 2;
    var df = pstar - model.nFree, chisq = N * fit.F;
    var Xc = []; for (var i = 0; i < N; i++) Xc.push(pre.X.map(function (c, j) { return c[i] - mo.means[j]; }));
    var inf = inference(model, fit, S, mo.Sx, Xc, N, estimator);
    var se = inf.vcov.map(function (r, i2) { return Math.sqrt(Math.max(r[i2], 0)); });
    var base = baselineFit(model, S, N);
    var out = { model: model, N: N, estimator: estimator, converged: fit.converged, iterations: fit.iterations, theta: fit.theta, se: se, vcov: inf.vcov, M: fit.M, S: S };
    // 적합도 (ML)
    var cfi = function (X2, d, Xb, db) { var num = Math.max(X2 - d, 0), den = Math.max(Xb - db, X2 - d, 0); return den === 0 ? 1 : 1 - num / den; };
    var tli = function (X2, d, Xb, db) { return d > 0 ? (Xb / db - X2 / d) / (Xb / db - 1) : NaN; };
    var logdetSig = St.logdetPD(fit.M.Sigma), logl = -N / 2 * (p * Math.log(2 * Math.PI) + logdetSig + trProd(S, fit.Si));
    if (model.xObs.length) { // lavaan: fixed.x이면 x의 주변 로그우도를 뺀 조건부 로그우도
      var xi2 = model.xObs.map(function (v) { return model.idx[v]; }), Sxx = xi2.map(function (a) { return xi2.map(function (b) { return S[a][b]; }); });
      logl -= -N / 2 * (xi2.length * Math.log(2 * Math.PI) + St.logdetPD(Sxx) + xi2.length);
    }
    var ci = rmseaCI(chisq, df, N);
    var srmr = 0, cnt = 0;
    for (var a = 0; a < p; a++) for (var b = 0; b <= a; b++) { var rr = (S[a][b] - fit.M.Sigma[a][b]) / Math.sqrt(S[a][a] * S[b][b]); srmr += rr * rr; cnt++; }
    out.fit = { chisq: chisq, df: df, pvalue: df > 0 ? St.pchisqUpper(chisq, df) : NaN, baseChisq: base.chisq, baseDf: base.df,
      cfi: cfi(chisq, df, base.chisq, base.df), tli: tli(chisq, df, base.chisq, base.df),
      rmsea: df > 0 ? Math.sqrt(Math.max(chisq - df, 0) / (N * df)) : NaN, rmseaLow: ci[0], rmseaHigh: ci[1],
      rmseaPclose: df > 0 ? 1 - pnchisq(chisq, df, N * df * 0.0025) : NaN,
      srmr: Math.sqrt(srmr / cnt), logl: logl, npar: model.nFree, aic: -2 * logl + 2 * model.nFree, bic: -2 * logl + Math.log(N) * model.nFree };
    if (estimator === 'MLR' && df > 0) {
      // Yuan-Bentler (Mplus 방식): c = [tr(A1⁻¹B1) − tr(A0⁻¹B0)] / df
      var tr1 = trProd(St.inverse(inf.A1), inf.B1), tr0 = trProd(St.inverse(inf.Aobs), inf.B0);
      var c = (tr1 - tr0) / df;
      out.fit.scalingFactor = c; out.fit.chisqScaled = chisq / c; out.fit.pScaled = St.pchisqUpper(chisq / c, df);
      // 기저(독립)모형의 척도화 계수 → 강건 CFI/TLI (Brosseau-Liard & Savalei, 2014), 강건 RMSEA (Brosseau-Liard, Savalei, & Li, 2012)
      var bm = baselineModel(model), bfit = fitML(bm, S, mo.Sx), binf = inference(bm, bfit, S, mo.Sx, Xc, N, 'MLR');
      var cb = (trProd(St.inverse(binf.A1), binf.B1) - trProd(St.inverse(binf.Aobs), binf.B0)) / base.df;
      var num = Math.max(chisq - c * df, 0), den = Math.max(base.chisq - cb * base.df, num, 0);
      out.fit.cfiRobust = den === 0 ? 1 : 1 - num / den;
      out.fit.tliRobust = 1 - ((chisq - c * df) / df) / ((base.chisq - cb * base.df) / base.df);
      out.fit.rmseaRobust = Math.sqrt(Math.max(chisq - c * df, 0) / (N * df));
      var ciR = rmseaCI(chisq / c, df, N); // 척도화 χ²의 비중심 구간 × √c
      out.fit.rmseaRobustLow = ciR[0] * Math.sqrt(c); out.fit.rmseaRobustHigh = ciR[1] * Math.sqrt(c);
    }
    // 모수표
    var std = standardize(model, fit.M, fit.theta), z975 = St.qnorm(0.975);
    out.params = model.pt.map(function (q2, k) {
      var est = q2.free >= 0 ? fit.theta[q2.free] : q2.fixed, s2 = q2.free >= 0 ? se[q2.free] : NaN, z = est / s2;
      return { lhs: q2.lhs, op: q2.op, rhs: q2.rhs, label: q2.label, free: q2.free >= 0, est: est, se: s2, z: z,
        p: q2.free >= 0 ? 2 * St.pnorm(-Math.abs(z)) : NaN, ciLow: est - z975 * s2, ciHigh: est + z975 * s2, std: std[k], user: q2.user };
    });
    // R² (종속변수)
    var id = model.idx;
    out.r2 = model.vars.filter(function (v) { return model.pt.some(function (q3) { return (q3.op === '~' && q3.lhs === v) || (q3.op === '=~' && q3.rhs === v); }); })
      .map(function (v) { return { name: v, r2: 1 - fit.M.S[id[v]][id[v]] / fit.M.Sf[id[v]][id[v]] }; });
    // 정의 모수 (델타 방법)
    if (model.defs.length) {
      var d0 = evalDefs(model, fit.theta);
      out.defined = model.defs.map(function (d, j) {
        var grad = fit.theta.map(function (t, k) {
          var h = 1e-6 * Math.max(1, Math.abs(t)), tp = fit.theta.slice(), tm = fit.theta.slice(); tp[k] += h; tm[k] -= h;
          return (evalDefs(model, tp)[j] - evalDefs(model, tm)[j]) / (2 * h);
        });
        var v = 0; for (var a2 = 0; a2 < grad.length; a2++) for (var b2 = 0; b2 < grad.length; b2++) v += grad[a2] * inf.vcov[a2][b2] * grad[b2];
        var s3 = Math.sqrt(v), z2 = d0[j] / s3;
        return { name: d.name, expr: d.expr, est: d0[j], se: s3, z: z2, p: 2 * St.pnorm(-Math.abs(z2)), ciLow: d0[j] - z975 * s3, ciHigh: d0[j] + z975 * s3 };
      });
    }
    // 신뢰도: CR(ω), AVE (표준화 적재량; 교차적재·오차공분산이 없다고 가정)
    out.reliability = model.latents.map(function (f) {
      var L = out.params.filter(function (q4) { return q4.op === '=~' && q4.lhs === f; });
      var sl = L.reduce(function (s4, q4) { return s4 + q4.std; }, 0), sl2 = L.reduce(function (s4, q4) { return s4 + q4.std * q4.std; }, 0);
      var th = L.reduce(function (s4, q4) { return s4 + (1 - q4.std * q4.std); }, 0);
      return { factor: f, k: L.length, cr: sl * sl / (sl * sl + th), ave: sl2 / L.length };
    });
    var warn = [];
    if (!fit.converged) warn.push('추정이 수렴하지 않았습니다. 결과를 해석하지 마세요.');
    if (df < 0) warn.push('자유도가 음수입니다: 모형이 식별되지 않습니다.');
    out.params.forEach(function (q5) { if (q5.op === '~~' && q5.lhs === q5.rhs && q5.est < 0) warn.push('"' + q5.lhs + '"의 (잔차)분산이 음수입니다(Heywood 사례). 모형 지정이나 표본 크기를 점검하세요.'); });
    if (!St.cholesky(fit.M.Sf.map(function (r) { return r.slice(); }))) warn.push('모형이 추정한 잠재변수 공분산 행렬이 양정치가 아닙니다(상관 > 1 가능성).');
    out.warnings = warn;
    out._ctx = { parsedText: text, X: pre.X, estimator: estimator };
    return out;
  }

  // 정의 모수 부트스트랩 (사례 재표집, 백분위) — 비동기 진행은 호출 측에서 chunk 단위로
  function bootstrapOnce(res, rand) {
    var model = res.model, X = res._ctx.X, N = res.N, idx = [];
    for (var i = 0; i < N; i++) idx.push(Math.floor(rand() * N));
    var Xb = X.map(function (c) { return idx.map(function (r) { return c[r]; }); });
    var mo = moments(model, Xb);
    if (!St.cholesky(mo.S)) return null;
    try {
      var f = fitML(model, mo.S, mo.Sx, { start: res.theta, maxit: 300, tol: 1e-8 });
      if (!f.converged) return null;
      return { theta: f.theta, defined: evalDefs(model, f.theta) };
    } catch (e) { return null; }
  }

  return { parseModel: parseModel, buildModel: buildModel, fitSEM: fitSEM, bootstrapOnce: bootstrapOnce, pnchisq: pnchisq, compileExpr: compileExpr };
});
