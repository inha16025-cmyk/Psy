/*
 * PsyStat 통계 엔진 (stats) — 조각 4/4: 네트워크 확장 (커뮤니티·브리지 중심성·NCT·부트스트랩 차이 검정)
 * 외부 라이브러리·네트워크 통신 없음. 순수 JavaScript.
 * - 커뮤니티: walktrap (Pons & Latapy, 2006; igraph::cluster_walktrap과 같은 절차: 자기 고리 = 연결 가중치 평균,
 *   걸음 수 4, 모듈성 최대 분할). EGA(Golino & Epskamp, 2017)는 EBICglasso 네트워크 |가중치|에 walktrap을 적용
 * - 브리지 중심성 (Jones, Ma, & McNally, 2021): 강도, 기대영향(1단계), 매개, 근접 (거리 = 1/|w|)
 * - NCT (van Borkulo et al., 2023): 순열 검정으로 두 집단 네트워크의 구조·전체 강도·엣지·중심성 비교
 */
(function (G) {
  'use strict';
  var St = G.PsyStats;
  if (!St) return;
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new Array(c).fill(0)); return m; }

  /* ---------------- 모듈성 (igraph::modularity와 같은 정의, 자기 고리 없음) ---------------- */
  function modularity(W, memb) {
    var n = W.length, m = 0, k = new Array(n).fill(0);
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j) { k[i] += W[i][j]; if (j > i) m += W[i][j]; }
    if (m === 0) return 0;
    var Q = 0, groups = {};
    memb.forEach(function (c, i2) { (groups[c] = groups[c] || []).push(i2); });
    Object.keys(groups).forEach(function (c) {
      var g = groups[c], e = 0, a = 0;
      g.forEach(function (u) { a += k[u]; g.forEach(function (v) { if (u < v) e += W[u][v]; }); });
      Q += e / m - (a / (2 * m)) * (a / (2 * m));
    });
    return Q;
  }

  /* ---------------- walktrap ---------------- */
  function walktrap(Win, steps) {
    steps = steps || 4;
    var n = Win.length, W = Win.map(function (r) { return r.map(function (v) { return Math.abs(v); }); }), A = W.map(function (r) { return r.slice(); });
    for (var i = 0; i < n; i++) {
      var s = 0, c = 0; for (var j = 0; j < n; j++) if (j !== i && W[i][j] > 0) { s += W[i][j]; c++; }
      A[i][i] = c ? s / c : 1; // 자기 고리: 연결 가중치 평균 (igraph/Pons 구현과 같음)
    }
    var d = A.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
    var P = A.map(function (r, i2) { return r.map(function (v) { return v / d[i2]; }); }), Pt = P.map(function (r) { return r.slice(); });
    for (var t = 1; t < steps; t++) Pt = Pt.map(function (r) { return P[0].map(function (_, j2) { var acc = 0; for (var k = 0; k < n; k++) acc += r[k] * P[k][j2]; return acc; }); });
    var comms = []; for (var i3 = 0; i3 < n; i3++) comms.push({ id: i3, members: [i3], P: Pt[i3], size: 1 });
    var memb = []; for (var i4 = 0; i4 < n; i4++) memb.push(i4);
    var best = { Q: modularity(W, memb), memb: memb.slice() }, Qs = [best.Q], merges = [], next = n;
    var adj = function (c1, c2) { return c1.members.some(function (a) { return c2.members.some(function (b) { return W[a][b] > 0; }); }); };
    while (true) {
      var pick = null;
      for (var a = 0; a < comms.length; a++) for (var b = a + 1; b < comms.length; b++) {
        if (!adj(comms[a], comms[b])) continue;
        var r2 = 0; for (var k2 = 0; k2 < n; k2++) { var df = comms[a].P[k2] - comms[b].P[k2]; r2 += df * df / d[k2]; }
        var ds = comms[a].size * comms[b].size / (comms[a].size + comms[b].size) * r2 / n;
        if (!pick || ds < pick.ds) pick = { a: a, b: b, ds: ds };
      }
      if (!pick) break;
      var c1 = comms[pick.a], c2 = comms[pick.b], sz = c1.size + c2.size;
      merges.push([c1.id, c2.id]);
      var nc = { id: next++, members: c1.members.concat(c2.members), size: sz, P: c1.P.map(function (v, k3) { return (c1.size * v + c2.size * c2.P[k3]) / sz; }) };
      comms = comms.filter(function (_, q) { return q !== pick.a && q !== pick.b; }).concat([nc]);
      // 현재 분할의 모듈성
      comms.forEach(function (cm, ci) { cm.members.forEach(function (u) { memb[u] = ci; }); });
      var Q = modularity(W, memb); Qs.push(Q);
      if (Q > best.Q + 1e-12) best = { Q: Q, memb: memb.slice() };
    }
    // 번호 정리: 처음 나오는 순서대로 1, 2, …
    var map = {}, lab = 0, out = best.memb.map(function (c3) { if (!(c3 in map)) map[c3] = ++lab; return map[c3]; });
    return { membership: out, modularity: best.Q, nComm: lab, merges: merges, Qs: Qs };
  }

  /* ---------------- 브리지 중심성 ---------------- */
  function bridgeCentrality(net, comm) {
    var n = net.length, str = new Array(n).fill(0), ei = new Array(n).fill(0), INF = Infinity;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j && comm[i] !== comm[j]) { str[i] += Math.abs(net[i][j]); ei[i] += net[i][j]; }
    // 최단 경로 (거리 1/|w|): 브리지 근접 = 다른 커뮤니티 노드까지 평균 거리의 역수, 브리지 매개 = 서로 다른 커뮤니티 쌍의 최단 경로 위에 놓인 횟수(경로가 여러 개면 비율)
    var dist = [], sigma = [], preds = [];
    for (var s = 0; s < n; s++) {
      var D = new Array(n).fill(INF), sg = new Array(n).fill(0), pr = [], done = new Array(n).fill(false);
      for (var q = 0; q < n; q++) pr.push([]);
      D[s] = 0; sg[s] = 1;
      for (var step = 0; step < n; step++) {
        var u = -1, bd = INF; for (var c = 0; c < n; c++) if (!done[c] && D[c] < bd) { bd = D[c]; u = c; }
        if (u < 0) break; done[u] = true;
        for (var v = 0; v < n; v++) {
          if (v === u || net[u][v] === 0 || done[v]) continue;
          var nd = D[u] + 1 / Math.abs(net[u][v]), tol = 1e-12 * Math.max(1, nd);
          if (nd < D[v] - tol) { D[v] = nd; sg[v] = sg[u]; pr[v] = [u]; } else if (Math.abs(nd - D[v]) <= tol) { sg[v] += sg[u]; pr[v].push(u); }
        }
      }
      dist.push(D); sigma.push(sg); preds.push(pr);
    }
    var clo = [], btw = new Array(n).fill(0);
    for (var i2 = 0; i2 < n; i2++) {
      var ds = []; for (var j2 = 0; j2 < n; j2++) if (comm[j2] !== comm[i2] && isFinite(dist[i2][j2])) ds.push(dist[i2][j2]);
      clo.push(ds.length ? 1 / (ds.reduce(function (a, b) { return a + b; }, 0) / ds.length) : NaN);
    }
    // 쌍 (s, t), s < t, 서로 다른 커뮤니티: 경로 수 σ_st 중 v를 지나는 비율 = σ_sv σ_vt / σ_st (d_sv + d_vt = d_st)
    for (var s2 = 0; s2 < n; s2++) for (var t2 = s2 + 1; t2 < n; t2++) {
      if (comm[s2] === comm[t2] || !isFinite(dist[s2][t2])) continue;
      for (var v2 = 0; v2 < n; v2++) {
        if (v2 === s2 || v2 === t2) continue;
        var through = dist[s2][v2] + dist[v2][t2];
        if (Math.abs(through - dist[s2][t2]) <= 1e-9 * Math.max(1, dist[s2][t2])) btw[v2] += sigma[s2][v2] * sigma[v2][t2] / sigma[s2][t2];
      }
    }
    return { strength: str, expectedInfluence: ei, closeness: clo, betweenness: btw };
  }

  /* ---------------- 공통: 행 부분집합으로 네트워크 추정 ---------------- */
  function sub(cols, idx) { return cols.map(function (c) { return idx.map(function (i) { return c[i]; }); }); }
  function upper(m) { var v = []; for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) v.push(m[i][j]); return v; }
  function netStats(n1, n2) {
    var p = n1.length, e1 = upper(n1), e2 = upper(n2), M = 0, gs1 = 0, gs2 = 0, ed = [];
    for (var k = 0; k < e1.length; k++) { var dd = Math.abs(e1[k] - e2[k]); ed.push(dd); if (dd > M) M = dd; gs1 += Math.abs(e1[k]); gs2 += Math.abs(e2[k]); }
    var c1 = St.centrality(n1), c2 = St.centrality(n2);
    return { M: M, gs1: gs1, gs2: gs2, S: Math.abs(gs1 - gs2), edgeDiff: ed,
      strDiff: c1.strength.map(function (v, i) { return Math.abs(v - c2.strength[i]); }), eiDiff: c1.expectedInfluence.map(function (v, i) { return Math.abs(v - c2.expectedInfluence[i]); }) };
  }

  /* ---------------- NCT ---------------- */
  // cols: 합친 자료(행 = 사례), g: 0/1 집단, opts: estimateNetwork 옵션
  function nctObserved(cols, g, opts) {
    var i1 = [], i2 = []; g.forEach(function (v, i) { (v === 0 ? i1 : i2).push(i); });
    var n1 = St.estimateNetwork(sub(cols, i1), opts).network, n2 = St.estimateNetwork(sub(cols, i2), opts).network;
    return { net1: n1, net2: n2, stats: netStats(n1, n2), n1: i1.length, n2: i2.length };
  }
  // 순열 1회: 집단 표지를 섞는다(perm을 주면 그 배정 사용 — 검증용)
  function nctPermOnce(cols, g, opts, rand, perm) {
    var n = g.length, lab = perm;
    if (!lab) { lab = g.slice(); for (var k = n - 1; k > 0; k--) { var r = Math.floor(rand() * (k + 1)), t = lab[k]; lab[k] = lab[r]; lab[r] = t; } }
    var i1 = [], i2 = []; lab.forEach(function (v, i) { (v === 0 ? i1 : i2).push(i); });
    try { return netStats(St.estimateNetwork(sub(cols, i1), opts).network, St.estimateNetwork(sub(cols, i2), opts).network); } catch (e) { return null; }
  }
  // 순열 결과로 p값 (Phipson & Smyth, 2010: (1 + #{T* ≥ T}) / (B + 1))
  function nctSummarize(obs, perms, adjust) {
    var B = perms.length, pv = function (o, arr) { var ge = 0; arr.forEach(function (v) { if (v >= o - 1e-12) ge++; }); return (1 + ge) / (B + 1); };
    var out = { B: B, structure: { M: obs.M, p: pv(obs.M, perms.map(function (x) { return x.M; })) },
      strength: { gs1: obs.gs1, gs2: obs.gs2, S: obs.S, p: pv(obs.S, perms.map(function (x) { return x.S; })) } };
    out.edgeP = obs.edgeDiff.map(function (o, k) { return pv(o, perms.map(function (x) { return x.edgeDiff[k]; })); });
    out.strP = obs.strDiff.map(function (o, k) { return pv(o, perms.map(function (x) { return x.strDiff[k]; })); });
    out.eiP = obs.eiDiff.map(function (o, k) { return pv(o, perms.map(function (x) { return x.eiDiff[k]; })); });
    var adj = function (ps) { return adjust === 'holm' ? holm(ps) : adjust === 'BH' ? bh(ps) : ps.slice(); };
    out.edgePadj = adj(out.edgeP); out.strPadj = adj(out.strP); out.eiPadj = adj(out.eiP); out.adjust = adjust || 'none';
    return out;
  }
  function holm(ps) { var m = ps.length, o = ps.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return a[0] - b[0]; }), r = new Array(m), run = 0; o.forEach(function (x, k) { run = Math.max(run, Math.min(1, (m - k) * x[0])); r[x[1]] = run; }); return r; }
  function bh(ps) { var m = ps.length, o = ps.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return b[0] - a[0]; }), r = new Array(m), run = 1; o.forEach(function (x, k) { run = Math.min(run, Math.min(1, x[0] * m / (m - k))); r[x[1]] = run; }); return r; }

  /* ---------------- 부트스트랩 차이 검정 (bootnet differenceTest와 같은 방식: 차이의 백분위 구간이 0을 포함하는지) ---------------- */
  function diffTest(samples, i, j, alpha) {
    alpha = alpha || 0.05;
    var d = samples.map(function (s) { return s[i] - s[j]; }).sort(function (a, b) { return a - b; });
    var lo = St.quantile(d, alpha / 2), hi = St.quantile(d, 1 - alpha / 2);
    return { lo: lo, hi: hi, sig: lo > 0 || hi < 0 };
  }
  // 지정한 사례 번호로 재표집해 네트워크 추정 (검증용; 일반 부트스트랩은 PsyStats.bootEdgeOnce)
  function bootWithIndex(cols, opts, idx) { var net = St.estimateNetwork(sub(cols, idx), opts).network; return { edges: upper(net), centrality: St.centrality(net), net: net }; }

  var api = { walktrap: walktrap, modularity: modularity, bridgeCentrality: bridgeCentrality, nctObserved: nctObserved, nctPermOnce: nctPermOnce, nctSummarize: nctSummarize,
    diffTest: diffTest, bootWithIndex: bootWithIndex, holm: holm, bh: bh, upperTri: upper };
  Object.keys(api).forEach(function (k) { St[k] = api[k]; });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
