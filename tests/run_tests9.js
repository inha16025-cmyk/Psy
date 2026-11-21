// PsyStat 검증 9: walktrap(igraph), 브리지 중심성(R 독립 구현), NCT·부트스트랩 차이 검정(같은 순열/재표집 번호로 qgraph와 대조)
// node tests/run_tests9.js
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference9.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol, abs) {
  if (Array.isArray(exp)) { if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length', got && got.length, exp.length); return; } exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol, abs); }); return; }
  var err = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[ ]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
function check(name, cond, info) { if (cond) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : info); } }
// 분할이 같은지 (번호는 달라도 됨)
function samePartition(a, b) { for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) if ((a[i] === a[j]) !== (b[i] === b[j])) return false; return true; }
var flat = function (m) { return m.reduce(function (x, r) { return x.concat(r); }, []); };
// R의 upper.tri는 열 순서(1-2, 1-3, 2-3, 1-4, …), PsyStat은 행 순서(1-2, 1-3, 1-4, …) → R 순서를 행 순서로 바꿈
function rowOrder(v, p) { var pos = {}, k = 0; for (var j = 1; j < p; j++) for (var i = 0; i < j; i++) pos[i + ',' + j] = k++; var out = []; for (var a = 0; a < p; a++) for (var b = a + 1; b < p; b++) out.push(v[pos[a + ',' + b]]); return out; }

// ---- walktrap vs igraph ----
ref.walktrap.forEach(function (R, k) {
  var w = S.walktrap(R.W, 4);
  check('walktrap' + k + '.분할', samePartition(w.membership, R.memb), w.membership.join('') + ' vs ' + R.memb.join(''));
  close('walktrap' + k + '.Q', w.modularity, Math.max.apply(null, R.Q), 1e-10);
  close('walktrap' + k + '.Qseq', w.Qs, R.Q, 1e-10);
});

// ---- 브리지 중심성 vs R 독립 구현 ----
var B = ref.bridge, bc = S.bridgeCentrality(B.net, B.comm);
close('bridge.strength', bc.strength, B.strength, 1e-12); close('bridge.ei', bc.expectedInfluence, B.ei, 1e-12);
close('bridge.closeness', bc.closeness, B.closeness, 1e-10); close('bridge.betweenness', bc.betweenness, B.betweenness, 1e-10);

// ---- NCT: 같은 순열로 통계량·p값 ----
var cols10 = ref.data.slice(0, 10), opts = { method: 'ebicglasso', cor: 'pearson' }, N = ref.nct, t0 = Date.now();
var obs = S.nctObserved(cols10, ref.group, opts);
close('nct.obs.M', obs.stats.M, N.obs.M, 5e-5); close('nct.obs.S', obs.stats.S, N.obs.S, 5e-5);
close('nct.obs.edgeDiff', obs.stats.edgeDiff, rowOrder(N.obs.edgeDiff, 10), 5e-5, true); close('nct.obs.strDiff', obs.stats.strDiff, N.obs.strDiff, 5e-5, true);
var perms = N.perms.map(function (l) { return S.nctPermOnce(cols10, ref.group, opts, null, l); });
close('nct.permM', perms.map(function (x) { return x.M; }), N.permM, 5e-5, true);
close('nct.permS', perms.map(function (x) { return x.S; }), N.permS, 5e-5, true);
var sm = S.nctSummarize(obs.stats, perms, 'holm');
close('nct.pM', sm.structure.p, N.pM, 1e-12); close('nct.pS', sm.strength.p, N.pS, 1e-12);
close('nct.edgeP', sm.edgeP, rowOrder(N.edgeP, 10), 1e-12); close('nct.edgePholm', sm.edgePadj, rowOrder(N.edgePholm, 10), 1e-12); close('nct.strP', sm.strP, N.strP, 1e-12);
console.log('  NCT 관측 + 순열 30회: ' + (Date.now() - t0) + ' ms');

// ---- 부트스트랩 차이 검정: 같은 재표집 번호 ----
var Bt = ref.boot, samples = Bt.idx.map(function (ix) { return S.bootWithIndex(cols10, opts, ix); });
close('boot.edges', flat(samples.map(function (s) { return s.edges; })), flat(Bt.edges.map(function (r) { return rowOrder(r, 10); })), 5e-5, true);
close('boot.str', flat(samples.map(function (s) { return s.centrality.strength; })), flat(Bt.str), 5e-5, true);
var de = S.diffTest(samples.map(function (s) { return s.edges; }), 0, 1), ds = S.diffTest(samples.map(function (s) { return s.centrality.strength; }), 0, 5);
close('boot.edgeDiffCI', [de.lo, de.hi], Bt.edgeDiffCI, 5e-5, true); close('boot.strDiffCI', [ds.lo, ds.hi], Bt.strDiffCI, 5e-5, true);

console.log('\n최대 오차:'); Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(10) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
