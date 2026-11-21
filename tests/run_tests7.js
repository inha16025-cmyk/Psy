// PsyStat 검증 7: BCH 원거리 결과변수. node tests/run_tests7.js
// (1) R 독립 구현과의 정확 대조
// (2) 몬테카를로: 참값 복원(편향)과 95% CI 포함률
//     조건 A (중간 분리, 엔트로피 ≈ .8) — 통과 기준 적용
//     조건 B (매우 약한 분리, 엔트로피 ≈ .55) — 알려진 한계로 보고만 함 (BCH > 보정 없음, 부트스트랩 > 샌드위치만 확인)
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference7.json');
var R6 = require('./reference6.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol, abs) {
  if (Array.isArray(exp)) { exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol, abs); }); return; }
  var err = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[ ]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
function check(name, cond, info) { if (cond) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : info); } }
var flat = function (m) { return m.reduce(function (a, r) { return a.concat(r); }, []); };

// ---- (1) R 독립 구현과 대조: 단계 1 사후확률은 mclust 것을 그대로 사용 ----
var iris = R6.iris, species = [];
for (var i = 0; i < 150; i++) species.push(['setosa', 'versicolor', 'virginica'][Math.floor(i / 50)]);
var lp = S.lpa([iris[0], iris[1]], { models: ['EEI'], Ks: [3], starts: 40, keep: 8, seed: 3 }).fits[0];
close('step1.LL', lp.LL, ref.LL, 1e-8);
var Z = ref.Z, cls = Z.map(function (r) { var b = 0; for (var k = 1; k < 3; k++) if (r[k] > r[b]) b = k; return b; });
var fitR = { K: 3, Z: Z, classes: cls };
close('bch.D', flat(S.classificationError(Z, cls)), flat(ref.D), 1e-12);
var bc = S.bchDistal(fitR, iris[2], 'continuous');
close('bch.contMean', bc.means, ref.contMean, 1e-10); close('bch.contSE', bc.se, ref.contSE, 1e-10);
close('bch.contWald', bc.overall.chi2, ref.contWald, 1e-9); close('bch.contPairs', bc.pairs.map(function (p) { return p.chi2; }), ref.contPairs, 1e-9);
var bk = S.bchDistal(fitR, species, 'categorical');
close('bch.props', flat(bk.props), flat(ref.props), 1e-10);
close('bch.catWald', bk.overall.chi2, ref.catWald, 1e-9); close('bch.catPairs', bk.pairs.map(function (p) { return p.chi2; }), ref.catPairs, 1e-9);

// ---- (2) 몬테카를로 ----
function simulate(label, shift, reps, B, seed) {
  var n = 600, truthM = [10, 13, 16], truthP = [0.2, 0.5, 0.8], rand = S.rng(seed), t0 = Date.now();
  var bias = { bch: [0, 0, 0], naive: [0, 0, 0], bchP: [0, 0, 0], naiveP: [0, 0, 0] }, sw = { m: 0, p: 0 }, bt = { m: 0, p: 0 }, tot = 0, ents = [], used = 0, skipped = 0;
  var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (var r = 0; r < reps; r++) {
    var X1 = [], X2 = [], y = [], yc = [];
    for (var i2 = 0; i2 < n; i2++) {
      var c = Math.floor(rand() * 3);
      X1.push(shift[0] * c + S.qnorm(rand())); X2.push(shift[1] * c + S.qnorm(rand()));
      y.push(truthM[c] + 2 * S.qnorm(rand())); yc.push(rand() < truthP[c] ? 1 : 0);
    }
    var resL = S.lpa([X1, X2], { models: ['EEI'], Ks: [3], starts: 10, keep: 3, seed: r + 1 }), f = resL.fits[0];
    if (!f || f.failed) { skipped++; continue; }
    var b, bc2;
    try { b = S.bchDistal(f, y, 'continuous'); bc2 = S.bchDistal(f, yc, 'categorical'); } catch (e) { skipped++; continue; }
    var dm = [], dp = [];
    for (var bb = 0; bb < B; bb++) { var o = S.bchBootstrapOnce(resL, f, [{ y: y, type: 'continuous' }, { y: yc, type: 'categorical', levels: bc2.levels }], rand); if (o[0]) dm.push(o[0]); if (o[1]) dp.push(o[1]); }
    S.bchApplyBootstrap(b, dm); S.bchApplyBootstrap(bc2, dp);
    var best = null, bestE = Infinity;
    perms.forEach(function (pm) { var e = 0; pm.forEach(function (k, j) { e += Math.abs(f.params.mu[k][0] - shift[0] * j); }); if (e < bestE) { bestE = e; best = pm; } });
    used++; ents.push(f.entropy);
    best.forEach(function (k, j) {
      var p1 = bc2.props[k][1];
      bias.bch[j] += b.means[k] - truthM[j]; bias.naive[j] += b.naiveMeans[k] - truthM[j];
      bias.bchP[j] += p1 - truthP[j]; bias.naiveP[j] += bc2.naiveProps[k][1] - truthP[j];
      if (Math.abs(b.means[k] - truthM[j]) <= 1.96 * b.se[k]) sw.m++;
      if (Math.abs(p1 - truthP[j]) <= 1.96 * bc2.se[k][1]) sw.p++;
      if (Math.abs(b.means[k] - truthM[j]) <= 1.96 * b.boot.se[k]) bt.m++;
      if (Math.abs(p1 - truthP[j]) <= 1.96 * bc2.boot.se[k][1]) bt.p++;
      tot++;
    });
  }
  var avg = function (a) { return a.map(function (v) { return v / used; }); };
  var fmt = function (a) { return avg(a).map(function (v) { return (v >= 0 ? '+' : '') + v.toFixed(3); }).join(' / '); };
  var mx = function (a) { return Math.max.apply(null, avg(a).map(Math.abs)); };
  var ent = ents.reduce(function (a, v) { return a + v; }, 0) / ents.length;
  console.log('  ' + label + ': ' + used + '/' + reps + '회 (제외 ' + skipped + '), n = ' + n + ', 평균 엔트로피 ' + ent.toFixed(2) + ', 부트스트랩 ' + B + '회, ' + ((Date.now() - t0) / 1000).toFixed(0) + '초');
  console.log('    연속 평균 편향 (참 10/13/16)  BCH ' + fmt(bias.bch) + '  | 보정 없음 ' + fmt(bias.naive));
  console.log('    범주 비율 편향 (참 .2/.5/.8)  BCH ' + fmt(bias.bchP) + '  | 보정 없음 ' + fmt(bias.naiveP));
  console.log('    95% CI 포함률  샌드위치: 평균 ' + (sw.m / tot).toFixed(3) + ', 비율 ' + (sw.p / tot).toFixed(3) + '  | 3단계 부트스트랩: 평균 ' + (bt.m / tot).toFixed(3) + ', 비율 ' + (bt.p / tot).toFixed(3));
  return { ent: ent, bchM: mx(bias.bch), naiveM: mx(bias.naive), bchP: mx(bias.bchP), naiveP: mx(bias.naiveP), swM: sw.m / tot, swP: sw.p / tot, btM: bt.m / tot, btP: bt.p / tot };
}
var A = simulate('조건 A (중간 분리)', [2.2, 1.6], 120, 60, 2024);
check('A.엔트로피 .70–.90', A.ent > 0.70 && A.ent < 0.90, A.ent);
check('A.BCH 평균 편향 < 0.15', A.bchM < 0.15, A.bchM);
check('A.BCH 비율 편향 < 0.02', A.bchP < 0.02, A.bchP);
check('A.보정 없음 편향 > 2×BCH (평균)', A.naiveM > 2 * A.bchM, A.naiveM + ' vs ' + A.bchM);
check('A.부트스트랩 평균 CI 포함률 .90–.98', A.btM > 0.90 && A.btM < 0.98, A.btM);
check('A.부트스트랩 비율 CI 포함률 .90–.98', A.btP > 0.90 && A.btP < 0.98, A.btP);
var B2 = simulate('조건 B (매우 약한 분리; 알려진 한계)', [1.3, 0.9], 80, 40, 77);
check('B.보정 없음 편향 > BCH (평균)', B2.naiveM > B2.bchM, B2.naiveM + ' vs ' + B2.bchM);
check('B.부트스트랩 포함률 > 샌드위치 포함률', B2.btM > B2.swM && B2.btP > B2.swP);

console.log('\n최대 오차:'); Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(6) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
