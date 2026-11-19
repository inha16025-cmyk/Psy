// PsyStat 검증 3: 조건부 과정 모형. node tests/run_tests3.js (기준값: tests/reference3.json)
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference3.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol, abs) {
  if (Array.isArray(exp)) { if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length', got && got.length, exp.length); return; } exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol, abs); }); return; }
  var err = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
var D = ref.data;
var ciPairs = function (ci) { return ci[0].map(function (_, j) { return [ci[0][j], ci[1][j]]; }); };
var BOOT_TOL = 0.006; // 난수 생성기가 달라 생기는 몬테카를로 오차 허용 (절대값)

// Model 6
var r6 = S.processModel(D.y, D.x, [D.m1, D.m2, D.m3], null, [D.cv], { model: 6, boot: 5000, seed: 11 });
var k6 = ['ind:0', 'ind:1', 'ind:0-1', 'ind:2', 'ind:0-2', 'ind:1-2', 'ind:0-1-2'];
close('m6.ind', k6.map(function (k) { return r6.effects[k]; }), ref.m6.ind, 1e-10);
close('m6.yCoef', r6.eqs[3].coefs.map(function (c) { return c.b; }), ref.m6.yCoef, 1e-10);
close('m6.m3Coef', r6.eqs[2].coefs.map(function (c) { return c.b; }), ref.m6.m3Coef, 1e-10);
close('m6.direct', r6.direct[0].est, ref.m6.direct, 1e-10); close('m6.total', r6.total.b, ref.m6.total, 1e-10);
close('m6.decomp', r6.direct[0].est + r6.totalInd, ref.m6.total, 1e-10); close('m6.n', r6.n, ref.m6.n, 0);
close('m6Boot.se', k6.map(function (k) { return r6.boot.stats[k].se; }), ref.m6.bootSE, BOOT_TOL, true);
close('m6Boot.ci', k6.map(function (k) { return r6.boot.stats[k].ci; }), ciPairs(ref.m6.bootCI), BOOT_TOL, true);

// Model 7 (중심화 없음, ±1SD)
var r7 = S.processModel(D.y, D.x, [D.m1, D.m2], D.w, [D.cv], { model: 7, boot: 5000, seed: 12 });
var k7 = ['imm:0', 'imm:1', 'cond:0:0', 'cond:0:1', 'cond:0:2', 'cond:1:0', 'cond:1:1', 'cond:1:2'];
close('m7.est', k7.map(function (k) { return r7.effects[k]; }), ref.m7.est, 1e-10);
// R 공식 순서: (절편), x, w, cv, x:w  ↔  PsyStat: (절편), X, W, X×W, cv
var perm = function (a) { return [a[0], a[1], a[2], a[4], a[3]]; };
close('m7.m1Coef', r7.eqs[0].coefs.map(function (c) { return c.b; }), perm(ref.m7.m1Coef), 1e-10);
close('m7.wv', r7.wvals, ref.m7.wv, 1e-12);
close('m7Boot.se', k7.map(function (k) { return r7.boot.stats[k].se; }), ref.m7.bootSE, BOOT_TOL, true);
close('m7Boot.ci', k7.map(function (k) { return r7.boot.stats[k].ci; }), ciPairs(ref.m7.bootCI), BOOT_TOL, true);

// Model 8 (조건부 직접효과는 OLS SE)
var r8 = S.processModel(D.y, D.x, [D.m1], D.w, [], { model: 8, boot: 0 });
close('m8.direct', [r8.direct.map(function (d) { return d.est; }), r8.direct.map(function (d) { return d.se; })], ref.m8.direct, 1e-10);
close('m8.imm', r8.effects['imm:0'], ref.m8.imm, 1e-10);

// Model 14 (중심화, 16/50/84 백분위)
var r14 = S.processModel(D.y, D.x, [D.m1], D.w, [D.cv], { model: 14, center: true, probe: 'percentile', boot: 5000, seed: 13 });
var k14 = ['imm:0', 'cond:0:0', 'cond:0:1', 'cond:0:2'];
close('m14.est', k14.map(function (k) { return r14.effects[k]; }), ref.m14.est, 1e-10);
close('m14.yCoef', r14.eqs[1].coefs.map(function (c) { return c.b; }), [ref.m14.yCoef[0], ref.m14.yCoef[1], ref.m14.yCoef[2], ref.m14.yCoef[3], ref.m14.yCoef[5], ref.m14.yCoef[4]], 1e-10);
close('m14.wp', r14.wvals, ref.m14.wp, 1e-12);
close('m14Boot.se', k14.map(function (k) { return r14.boot.stats[k].se; }), ref.m14.bootSE, BOOT_TOL, true);
close('m14Boot.ci', k14.map(function (k) { return r14.boot.stats[k].ci; }), ciPairs(ref.m14.bootCI), BOOT_TOL, true);

// Model 15 (이분 W)
var r15 = S.processModel(D.y, D.x, [D.m1], D.wb, [], { model: 15, boot: 0 });
close('m15.cond', [r15.effects['cond:0:0'], r15.effects['cond:0:1']], ref.m15.cond, 1e-10);
close('m15.imm', r15.effects['imm:0'], ref.m15.imm, 1e-10);
close('m15.direct', [r15.direct.map(function (d) { return d.est; }), r15.direct.map(function (d) { return d.se; })], ref.m15.direct, 1e-10);
close('m15.binary', r15.binaryW ? 1 : 0, 1, 0);

console.log('\n최대 오차(모형별; Boot는 절대오차):');
Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(10) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
