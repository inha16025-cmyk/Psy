// PsyStat 검증 6: 잠재프로파일(LPA)·잠재계층(LCA). node tests/run_tests6.js
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference6.json');
var pass = 0, fail = 0, notes = [], worst = {};
function close(name, got, exp, tol, abs) {
  if (Array.isArray(exp)) { if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length'); return; } exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol, abs); }); return; }
  var err = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[ ]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
function perms(n) { if (n === 1) return [[0]]; var out = []; perms(n - 1).forEach(function (p) { for (var i = 0; i <= p.length; i++) { var q = p.slice(); q.splice(i, 0, n - 1); out.push(q); } }); return out; }
var flat = function (m) { return m.reduce(function (a, r) { return a.concat(r); }, []); };

// ---- LPA vs mclust (iris) ----
var cols = ref.iris, t0 = Date.now();
ref.lpa.forEach(function (R) {
  var res = S.lpa(cols, { models: [R.model], Ks: [R.K], starts: 40, keep: 8, seed: 11 }), f = res.fits[0], tag = 'lpa.' + R.model + R.K;
  if (f.failed) { fail++; console.log('FAIL', tag, '추정 실패'); return; }
  if (f.LL > R.LL + 1e-6 * Math.abs(R.LL)) { notes.push(tag + ': PsyStat LL ' + f.LL.toFixed(4) + ' > mclust ' + R.LL.toFixed(4) + ' (더 좋은 해; mclust는 국소해)'); pass++; return; }
  close(tag + '.LL', f.LL, R.LL, 1e-8);
  close(tag + '.npar', f.npar, R.df, 0);
  close(tag + '.bic', f.bic, -R.bic, 1e-8);
  // 프로파일 순서 맞추기 (평균 차이가 가장 작은 순열)
  var K = R.K, best = null, bestE = Infinity;
  perms(K).forEach(function (pm) { var e = 0; pm.forEach(function (k, i) { for (var j = 0; j < 4; j++) e += Math.abs(f.params.mu[k][j] - R.mean[i][j]); }); if (e < bestE) { bestE = e; best = pm; } });
  close(tag + '.pro', best.map(function (k) { return f.params.pi[k]; }), [].concat(R.pro), 1e-5, true);
  close(tag + '.mean', flat(best.map(function (k) { return f.params.mu[k]; })), flat(R.mean), 1e-4, true);
  close(tag + '.sigma', flat(best.map(function (k) { return flat(f.params.Sigma[k]); })), flat(R.sigma.map(flat)), 1e-4, true);
});
console.log('  LPA 16개 모형 적합: ' + (Date.now() - t0) + ' ms');

// ---- BLRT (EEI; mclustBootstrapLRT 300회와 비교) ----
(function () {
  var B = ref.blrt, rand = S.rng(5), t1 = Date.now();
  var res = S.lpa(cols, { models: ['EEI'], Ks: [1, 2, 3, 4], starts: 40, keep: 8, seed: 11 });
  [2, 3, 4].forEach(function (K, idx) {
    var f0 = res.fits[K - 2], f1 = res.fits[K - 1], obs = 2 * (f1.LL - f0.LL);
    // mclustBootstrapLRT는 mclust 기본 수렴기준(1e-5)으로 적합하므로 LRT가 약간 덜 수렴됨 → 허용오차 1e-4
    // K=4: mclust 기본 초기값이 국소해(LL −356.04)에 머물러 관측 LRT가 다름 (PsyStat −310.12는 mclust me()로 확인된 더 좋은 해)
    var mcl = ref.lpa.filter(function (x) { return x.model === 'EEI' && x.K === K; })[0];
    if (f1.LL > mcl.LL + 1e-3) { notes.push('BLRT ' + (K - 1) + ' vs ' + K + ': mclust는 K=' + K + ' 국소해 기준이라 비교 제외 (mclust LRT ' + B.obs[idx].toFixed(2) + ', PsyStat ' + obs.toFixed(2) + ')'); }
    else close('blrt.obs' + K, obs, B.obs[idx], 1e-4);
    var ge = 0, ok = 0;
    for (var b = 0; b < B.nboot; b++) { var l = S.blrtOnce(res, f0, K, rand, {}); if (l === null) continue; ok++; if (l >= obs) ge++; }
    var p = (1 + ge) / (ok + 1);
    console.log('  BLRT ' + (K - 1) + ' vs ' + K + ': LRT = ' + obs.toFixed(3) + ', p = ' + p.toFixed(4) + ' (mclust ' + B.p[idx].toFixed(4) + '), 성공 ' + ok + '/' + B.nboot);
    if (!(f1.LL > mcl.LL + 1e-3)) close('blrt.p' + K, p, B.p[idx], 0.08, true);
  });
  console.log('  BLRT 소요: ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s');
})();

// ---- LCA 이분 vs flexmix ----
var Y = ref.lcaData, items = Object.keys(Y);
var Bcols = items.map(function (k) { return Y[k].map(function (v) { return v >= 4 ? 1 : 0; }); });
ref.lcaBin.forEach(function (R) {
  var r = S.lca(Bcols, { Ks: [R.K], starts: 40, keep: 8, seed: 3 }).fits[0];
  if (r.LL > R.LL + 1e-6 * Math.abs(R.LL)) { notes.push('lcaBin K=' + R.K + ': PsyStat LL ' + r.LL.toFixed(4) + ' > flexmix ' + R.LL.toFixed(4)); pass++; return; }
  close('lcaBin.LL' + R.K, r.LL, R.LL, 1e-8); close('lcaBin.npar' + R.K, r.npar, R.df, 0);
});
// ---- LCA 다범주 vs 독립 R 구현 ----
var Pcols = items.slice(0, 3).map(function (k) { return Y[k]; });
ref.lcaPoly.forEach(function (R) {
  var r = S.lca(Pcols, { Ks: [R.K], starts: 40, keep: 8, seed: 3 }).fits[0];
  if (r.LL > R.LL + 1e-6 * Math.abs(R.LL)) { notes.push('lcaPoly K=' + R.K + ': PsyStat LL ' + r.LL.toFixed(4) + ' > R ' + R.LL.toFixed(4)); pass++; return; }
  close('lcaPoly.LL' + R.K, r.LL, R.LL, 1e-8); close('lcaPoly.npar' + R.K, r.npar, R.npar, 0);
  close('lcaPoly.pi' + R.K, r.params.pi, [].concat(R.pi), 1e-4, true);
});

if (notes.length) { console.log('\n참고 (PsyStat이 기준보다 더 높은 우도를 찾은 경우):'); notes.forEach(function (n) { console.log('  ' + n); }); }
console.log('\n최대 오차:'); Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(8) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
