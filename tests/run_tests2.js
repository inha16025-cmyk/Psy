// PsyStat 검증 2: node tests/run_tests2.js (기준값: tests/reference2.json)
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference2.json');
var pass = 0, fail = 0, worst = {};
function close(name, got, exp, tol) {
  if (Array.isArray(exp)) { if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length', got && got.length, exp.length); return; } exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol); }); return; }
  var err = Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
var flat = function (m) { return m.reduce(function (a, r) { return a.concat(r); }, []); };

// 이변량 정규
var bv = ref.bvn;
close('bvn', bv.h.map(function (h, i) { return S.pbvnorm(h, bv.k[i], bv.r[i]); }), bv.p, 1e-12);

// lavCor (bfi 일부: 리커트 10 + 성별 이분 + 연령 연속, 결측 포함)
var D = ref.bfiData, names = Object.keys(D), cols = names.map(function (k) { return D[k]; });
var t0 = Date.now();
var ca = S.corAuto(cols);
console.log('  corAuto (12변수, n=800) 소요: ' + (Date.now() - t0) + ' ms; 순서형 판정:', names.filter(function (_, i) { return ca.ordinal[i]; }).join(','));
close('lavcor', flat(ca.R), flat(ref.lavcor), 1e-5);
close('corauto', flat(ca.R), flat(ref.corauto), 1e-5);

// 2×2 빈칸
var Z = ref.zero;
close('zero2x2', flat(S.corAuto([Z.u, Z.w, Z.z]).R), flat(Z.R), 1e-5);

// nearPD
close('nearPD.a', flat(S.nearPD(ref.npd.a).mat), flat(ref.npd.aOut), 1e-5);
close('nearPD.b', flat(S.nearPD(ref.npd.b).mat), flat(ref.npd.bOut), 1e-5);

// EBICglasso + cor_auto
var NA = ref.netAuto, ncols = Object.keys(NA.data).map(function (k) { return NA.data[k]; });
var net = S.estimateNetwork(ncols, { method: 'ebicglasso', cor: 'auto' }).network;
close('netAuto', flat(net), flat(NA.net), 1e-4);

// 위계적 회귀
var M = ref.sim;
var h = S.hierarchicalRegression(M.dep, [[M.age, M.sex], [M.stress, M.support]], [['age', 'sex'], ['stress', 'support']]);
close('hier.r2', h.steps.map(function (s) { return s.model.R2; }), ref.hier.r2, 1e-12);
close('hier.dF', h.steps[1].dF, ref.hier.dF, 1e-10); close('hier.dP', h.steps[1].dP, ref.hier.dP, 1e-9);
close('hier.coef2', h.steps[1].model.coefs.map(function (c) { return c.b; }), ref.hier.coef2, 1e-10); close('hier.n', h.n, ref.hier.n, 0);
var hl = S.hierarchicalRegression(M['case'], [[M.age, M.sex], [M.stress, M.support]], [['age', 'sex'], ['stress', 'support']], { logistic: true });
close('hierLog.dev', hl.steps.map(function (s) { return s.model.deviance; }), ref.hierLog.dev, 1e-9);
close('hierLog.chi', hl.steps[1].blockChi2, ref.hierLog.chi, 1e-8);
close('hierLog.p1', hl.steps[0].blockP, ref.hierLog.p1, 1e-8);
close('hierLog.coef2', hl.steps[1].model.coefs.map(function (c) { return c.b; }), ref.hierLog.coef2, 1e-7);

// 조절
var md = S.moderation(M.dep, M.stress, M.support, [M.age], { center: true, covNames: ['age'] });
close('mod.coef', md.coefs.map(function (c) { return c.b; }), ref.mod.coef, 1e-10);
close('mod.se', md.coefs.map(function (c) { return c.se; }), ref.mod.se, 1e-10);
close('mod.dR2', md.dR2, ref.mod.dR2, 1e-10); close('mod.F', md.F, ref.mod.F, 1e-9);
close('mod.slopes', flat([md.slopes.map(function (s) { return s.est; }), md.slopes.map(function (s) { return s.se; }), md.slopes.map(function (s) { return s.p; })]), flat(ref.mod.slopes), 1e-9);
close('mod.jn', md.jn, [].concat(ref.mod.jn), 1e-9); close('mod.n', md.n, ref.mod.n, 0);

// 매개 (점추정은 정확히, 부트스트랩은 난수가 달라 근사 비교)
var me = S.mediation(M.dep3, M.stress, [M.med, M.m2], [M.age], { boot: 5000, seed: 42 });
close('med.a', me.est.a.map(function (x) { return x.a; }), ref.med.a, 1e-10);
close('med.b', me.est.b, ref.med.b, 1e-10); close('med.ind', me.est.ind, ref.med.ind, 1e-10);
close('med.direct', me.est.direct, ref.med.direct, 1e-10); close('med.total', me.est.total, ref.med.total, 1e-10);
close('med.seDirect', Math.sqrt(me.est.fy.cov[1][1]), ref.med.seDirect, 1e-10);
var bci = ref.med.bootCI; // [2.5%,97.5%] × 2
close('medBoot.se', me.boot.ind.map(function (x) { return x.se; }), ref.med.bootSE, 0.08);
close('medBoot.ci', [me.boot.ind[0].ci[0], me.boot.ind[0].ci[1], me.boot.ind[1].ci[0], me.boot.ind[1].ci[1]], flat(bci[0].map(function (_, j) { return [bci[0][j], bci[1][j]]; })), 0.01);

console.log('\n최대 상대오차(분석별):');
Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(12) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
