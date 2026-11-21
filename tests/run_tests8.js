// PsyStat 검증 8: 다항 로지스틱(nnet::multinom)과 ML 3단계(R 독립 구현 + 몬테카를로). node tests/run_tests8.js
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference8.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol, abs) {
  if (Array.isArray(exp)) { exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol, abs); }); return; }
  var err = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[ ]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
function check(name, cond, info) { if (cond) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : info); } }
var flat = function (m) { return m.reduce(function (a, r) { return a.concat(r); }, []); };

// ---- (1) 다항 로지스틱 vs nnet::multinom (bfi: 학력 ~ 연령 + 성별) ----
var M = ref.mn, t0 = Date.now();
var mn = S.multinomialLogistic(M.education, [M.age, M.gender], ['age', 'gender']);
console.log('  다항 로지스틱 (n = ' + mn.n + ', 범주 ' + mn.K + '): ' + (Date.now() - t0) + ' ms');
close('mn.coef', mn.coefs.map(function (c) { return c.b; }), flat(M.coef), 1e-5);
close('mn.se', mn.coefs.map(function (c) { return c.se; }), flat(M.se), 1e-3);
close('mn.ll', mn.ll, M.ll, 1e-8); close('mn.ll0', mn.ll0, M.ll0, 1e-8);
close('mn.lrAge', mn.lrTests[0].chi2, M.lrAge, 1e-5);

// ---- (2) ML 3단계 vs R 독립 구현 (mclust 사후확률 사용) ----
var Z = ref.ml3.Z, cls = Z.map(function (r) { var b = 0; for (var k = 1; k < 3; k++) if (r[k] > r[b]) b = k; return b; });
var o = S.ml3Step({ K: 3, Z: Z, classes: cls }, [ref.ml3.covariate], ["z"], { ref: 0 });
close('ml3.ll', o.ll, ref.ml3.ll, 1e-9);
close('ml3.beta', flat(o.beta), ref.ml3.beta, 1e-5);
close('ml3.se', o.coefs.map(function (c) { return c.se; }), ref.ml3.se, 2e-3);

// ---- (3) 몬테카를로: 참 기울기 +0.8 / −0.8 (기준 = 집단 0), 엔트로피 ≈ .75 ----
(function () {
  var reps = 60, B = 60, n = 600, slope = [0, 0.8, -0.8], shift = [2.2, 1.6], rand = S.rng(31), t1 = Date.now();
  var bias = { ml: [0, 0], naive: [0, 0] }, covH = 0, covB = 0, tot = 0, used = 0, skipped = 0, ents = [];
  var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (var r = 0; r < reps; r++) {
    var X1 = [], X2 = [], z = [];
    for (var i = 0; i < n; i++) {
      var zz = S.qnorm(rand()), e = slope.map(function (b) { return Math.exp(b * zz); }), s = e[0] + e[1] + e[2], u = rand() * s, c = 0;
      while (c < 2 && u > e[c]) { u -= e[c]; c++; }
      X1.push(shift[0] * c + S.qnorm(rand())); X2.push(shift[1] * c + S.qnorm(rand())); z.push(zz);
    }
    var resL = S.lpa([X1, X2], { models: ['EEI'], Ks: [3], starts: 10, keep: 3, seed: r + 1 }), f = resL.fits[0];
    if (!f || f.failed) { skipped++; continue; }
    var best = null, bestE = Infinity;
    perms.forEach(function (pm) { var e2 = 0; pm.forEach(function (k, j) { e2 += Math.abs(f.params.mu[k][0] - shift[0] * j); }); if (e2 < bestE) { bestE = e2; best = pm; } });
    var out;
    try { out = S.ml3Step(f, [z], ['z'], { ref: best[0] }); } catch (er) { skipped++; continue; }
    var draws = [];
    for (var b = 0; b < B; b++) { var d = S.ml3BootstrapOnce(resL, f, [z], ['z'], best[0], rand); if (d) draws.push(d); }
    S.ml3ApplyBootstrap(out, draws);
    used++; ents.push(f.entropy);
    [1, 2].forEach(function (j, q) {
      var c2 = out.coefs.filter(function (cc) { return cc.cls === best[j] && cc.name === 'z'; })[0];
      bias.ml[q] += c2.b - slope[j]; bias.naive[q] += c2.naiveB - slope[j];
      if (Math.abs(c2.b - slope[j]) <= 1.96 * c2.se) covH++;
      if (Math.abs(c2.b - slope[j]) <= 1.96 * c2.bootSE) covB++;
      tot++;
    });
  }
  var ent = ents.reduce(function (a, v) { return a + v; }, 0) / ents.length;
  var fm = function (a) { return a.map(function (v) { return (v / used >= 0 ? '+' : '') + (v / used).toFixed(3); }).join(' / '); };
  console.log('  ML 3단계 몬테카를로: ' + used + '/' + reps + '회 (제외 ' + skipped + '), 평균 엔트로피 ' + ent.toFixed(2) + ', 부트스트랩 ' + B + '회, ' + ((Date.now() - t1) / 1000).toFixed(0) + '초');
  console.log('    기울기 편향 (참 +0.8 / −0.8)  ML 3단계 ' + fm(bias.ml) + '  | 보정 없음 ' + fm(bias.naive));
  console.log('    95% CI 포함률  헤세 행렬 SE ' + (covH / tot).toFixed(3) + '  | 3단계 부트스트랩 SE ' + (covB / tot).toFixed(3));
  var mx = function (a) { return Math.max.apply(null, a.map(function (v) { return Math.abs(v / used); })); };
  check('ml3mc.ML 3단계 기울기 편향 < 0.08', mx(bias.ml) < 0.08, mx(bias.ml));
  check('ml3mc.보정 없음은 0 쪽으로 감쇠 (편향 > 2×ML)', mx(bias.naive) > 2 * mx(bias.ml), mx(bias.naive));
  check('ml3mc.부트스트랩 포함률 .88–.98', covB / tot > 0.88 && covB / tot < 0.98, covB / tot);
})();

console.log('\n최대 오차:'); Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(6) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
