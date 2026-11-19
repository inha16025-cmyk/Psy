// PsyStat 검증 4: MANOVA, Box's M, 판별분석. node tests/run_tests4.js
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference4.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol) {
  if (Array.isArray(exp)) { if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length', got && got.length, exp.length); return; } exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol); }); return; }
  var err = Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
var I = ref.iris, names = ['SL', 'SW', 'PL', 'PW'];
var mv = S.manova(I.X, I.g, names);
['pillai', 'wilks', 'hotelling', 'roy'].forEach(function (k) {
  var t = mv.tests[k]; close('manova.' + k, [t.stat, t.F, t.df1, t.df2], ref.manova[k], 1e-9);
});
close('manova.uniF', mv.univariate.map(function (u) { return u.F; }), ref.manova.uniF, 1e-10);
var bm = mv.boxM;
close('boxM', [bm.M, bm.chi2, bm.df, bm.pChi], ref.boxm, 1e-9);
console.log('  참고: iris Box M F 근사 =', bm.F.toFixed(3), 'df =', bm.df1, ',', bm.df2.toFixed(1));

var da = S.discriminant(I.X, I.g, names, { priors: 'equal' });
// 비표준화 계수: MASS::lda scaling과 열 부호만 다를 수 있음
var sc = ref.lda.scaling; // 4×2 (행: 변수)
da.funcs.forEach(function (fn, k) {
  var col = sc.map(function (r) { return r[k]; }), sgn = Math.sign(col[0]) === Math.sign(fn.coef[0]) ? 1 : -1;
  close('lda.scaling' + k, fn.coef.map(function (v) { return v * sgn; }), col, 1e-8);
});
close('lda.eig', da.funcs.map(function (f) { return f.eigen; }), ref.lda.eig, 1e-9);
close('lda.canCor', da.funcs.map(function (f) { return f.canCor; }), ref.lda.canCor, 1e-9);
var idx = [0, 50, 70, 83, 133, 149];
close('lda.post', idx.map(function (i) { return da.posteriors[i]; }), ref.lda.post, 1e-8);
close('lda.cls', da.predicted.map(function (c) { return c + 1; }), ref.lda.cls, 0);
// 교차타당화: 분류표로 비교
var cvR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
ref.lda.cvCls.forEach(function (c, i) { cvR[da.groupIndex[i]][c - 1]++; });
close('lda.cv', da.cvConfusion, cvR, 0);
// Wilks Λ (전체) = MANOVA Wilks
close('lda.wilks', da.wilksSeq[0].lambda, ref.manova.wilks[0], 1e-10);

var M = ref.sim;
var mv2 = S.manova([M.y1, M.y2, M.y3], M.g, ['y1', 'y2', 'y3']);
var w = mv2.tests.wilks;
close('sim.wilks', [w.stat, w.F, w.df1, w.df2], M.wilks, 1e-9);
var da2 = S.discriminant([M.y1, M.y2, M.y3], M.g, ['y1', 'y2', 'y3']);
var c2 = da2.funcs[0].coef, s2 = Math.sign(c2[0]) === Math.sign(M.scaling[0]) ? 1 : -1;
close('sim.scaling', c2.map(function (v) { return v * s2; }), M.scaling, 1e-8);

console.log('\n최대 상대오차:');
Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(14) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
