// PsyStat 수치 검증: node tests/run_tests.js
// 기준값: tests/reference.json (tests/make_reference.R 로 R에서 생성)
'use strict';
var S = require('../src/stats.js');
var ref = require('./reference.json');
var pass = 0, fail = 0, worst = {};

function close(name, got, exp, tol) {
  tol = tol || 1e-6;
  if (Array.isArray(exp)) {
    if (!Array.isArray(got) || got.length !== exp.length) { fail++; console.log('FAIL', name, 'length', got && got.length, exp.length); return; }
    exp.forEach(function (e, i) { close(name + '[' + i + ']', got[i], e, tol); });
    return;
  }
  var err = Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (exp === null && (got === null || isNaN(got))) { pass++; return; }
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'relerr', err.toExponential(2)); }
  else pass++;
  var grp = name.split(/[.[]/)[0];
  worst[grp] = Math.max(worst[grp] || 0, err);
}
function flat(m) { return m.reduce(function (a, r) { return a.concat(r); }, []); }

var D = ref.data;

// ---- 분포 ----
var R = ref.dist;
close('dist.pt', [S.pt(-2.5, 5), S.pt(0.3, 12), S.pt(1.96, 30), S.pt(4, 200)], R.pt, 1e-10);
close('dist.pf', [S.pfUpper(0.5, 2, 10), S.pfUpper(2.5, 3, 50), S.pfUpper(4, 5, 100), S.pfUpper(10, 1, 7)], R.pf, 1e-10);
close('dist.pchisq', [S.pchisqUpper(0.2, 1), S.pchisqUpper(3.84, 1), S.pchisqUpper(10, 4), S.pchisqUpper(30, 12)], R.pchisq, 1e-10);
close('dist.qt', [S.qt(0.975, 3), S.qt(0.995, 20), S.qt(0.9, 100)], R.qt, 1e-9);
close('dist.qnorm', [S.qnorm(1e-6), S.qnorm(0.01), S.qnorm(0.3), S.qnorm(0.975)], R.qnorm, 1e-10);
close('dist.qchisq', [S.qchisq(0.95, 3), S.qchisq(0.5, 10)], R.qchisq, 1e-9);
close('dist.ptukey', [S.ptukey(1.5, 3, 20), S.ptukey(3.2, 4, 60), S.ptukey(4.1, 5, 12), S.ptukey(5.5, 8, 200)], R.ptukey, 1e-8);

// ---- 기술통계 ----
var ds = S.descriptives(D.x1);
close('desc.mean', ds.mean, ref.desc.mean, 1e-12); close('desc.sd', ds.sd, ref.desc.sd, 1e-12);
close('desc.median', ds.median, ref.desc.median, 1e-12); close('desc.q1', ds.q1, ref.desc.q1, 1e-12);
close('desc.skew', ds.skew, ref.desc.skew, 1e-10); close('desc.kurt', ds.kurt, ref.desc.kurt, 1e-10);
close('desc.swW', ds.swW, ref.desc.swW, 1e-6); close('desc.swP', ds.swP, ref.desc.swP, 1e-5);
var sw3 = S.shapiroWilk(D.x3); close('desc.sw3W', sw3.W, ref.desc.sw3W, 1e-6); close('desc.sw3P', sw3.p, ref.desc.sw3P, 1e-5);
var sw10 = S.shapiroWilk(D.x2.slice(0, 10)); close('desc.sw10W', sw10.W, ref.desc.sw10W, 1e-6); close('desc.sw10P', sw10.p, ref.desc.sw10P, 1e-5);
var sw5 = S.shapiroWilk(D.x2.slice(0, 5)); close('desc.sw5W', sw5.W, ref.desc.sw5W, 1e-6); close('desc.sw5P', sw5.p, ref.desc.sw5P, 1e-5);

// ---- t 검정 ----
var g1 = D.x2.filter(function (_, i) { return D.sex[i] === 1; }), g2 = D.x2.filter(function (_, i) { return D.sex[i] === 2; });
var ti = S.tTestIndependent(g1, g2);
close('ttest.tS', ti.student.t, ref.ttest.tS, 1e-10); close('ttest.pS', ti.student.p, ref.ttest.pS, 1e-9);
close('ttest.ciS', [ti.student.ciLow, ti.student.ciHigh], ref.ttest.ciS, 1e-9);
close('ttest.tW', ti.welch.t, ref.ttest.tW, 1e-10); close('ttest.dfW', ti.welch.df, ref.ttest.dfW, 1e-10); close('ttest.pW', ti.welch.p, ref.ttest.pW, 1e-9);
close('ttest.leveneF', ti.levene.F, ref.ttest.leveneF, 1e-10); close('ttest.leveneP', ti.levene.p, ref.ttest.leveneP, 1e-9);
var tp = S.tTestPaired(D.post, D.pre);
close('ttest.tP', tp.t, ref.ttest.tP, 1e-10); close('ttest.pP', tp.p, ref.ttest.pP, 1e-9); close('ttest.ciP', [tp.ciLow, tp.ciHigh], ref.ttest.ciP, 1e-9);
var t1 = S.tTestOneSample(D.pre, 19); close('ttest.t1', t1.t, ref.ttest.t1, 1e-10); close('ttest.p1', t1.p, ref.ttest.p1, 1e-9);

// ---- 분산분석 ----
var labs = ['A', 'B', 'C'];
var grp = labs.map(function (l) { return D.x1.filter(function (v, i) { return D.group[i] === l && v !== null; }); });
var an = S.anovaOneway(grp, labs);
close('anova.F', an.F, ref.anova.F, 1e-10); close('anova.p', an.p, ref.anova.p, 1e-9);
close('anova.ssb', an.ssb, ref.anova.ssb, 1e-10); close('anova.ssw', an.ssw, ref.anova.ssw, 1e-10);
// R TukeyHSD diff 부호: 뒤 집단 - 앞 집단
close('anova.tukeyDiff', an.posthoc.map(function (p) { return -p.diff; }), ref.anova.tukeyDiff, 1e-10);
close('anova.tukeyP', an.posthoc.map(function (p) { return p.pTukey; }), ref.anova.tukeyP, 1e-7);
close('anova.welchF', an.welch.F, ref.anova.welchF, 1e-10); close('anova.welchDf2', an.welch.df2, ref.anova.welchDf2, 1e-10);
close('anova.welchP', an.welch.p, ref.anova.welchP, 1e-9);
close('anova.bonfP', an.posthoc.map(function (p) { return p.pBonf; }), ref.anova.bonfP, 1e-9);
close('anova.ghP', an.posthoc.map(function (p) { return p.pGH; }), ref.anova.ghP, 1e-7);
close('anova.leveneF', an.levene.F, ref.anova.leveneF, 1e-10);

// ---- 상관 ----
var cp = S.corTest(D.x1, D.x2, 'pearson');
close('cor.r', cp.r, ref.cor.r, 1e-12); close('cor.p', cp.p, ref.cor.p, 1e-9); close('cor.ci', [cp.ciLow, cp.ciHigh], ref.cor.ci, 1e-9);
close('cor.rho', S.corTest(D.x1, D.x3, 'spearman').r, ref.cor.rho, 1e-12);

// ---- 교차분석 ----
var ct = S.crosstab(D.cat1, D.cat2);
close('chisq.chi2', ct.chi2, ref.chisq.chi2, 1e-10); close('chisq.df', ct.df, ref.chisq.df); close('chisq.p', ct.p, ref.chisq.p, 1e-9);
var ct22 = S.crosstab(D.sex, D.yb);
close('chisq.yates', ct22.yates.chi2, ref.chisq.yates, 1e-10); close('chisq.yatesP', ct22.yates.p, ref.chisq.yatesP, 1e-9);
close('chisq.fisherP', ct22.fisherP, ref.chisq.fisherP, 1e-8);

// ---- 선형회귀 ----
var lm = S.linearRegression(D.x2, [D.x1, D.x3, D.x4], ['x1', 'x3', 'x4']);
close('lm.coef', lm.coefs.map(function (c) { return c.b; }), ref.lm.coef, 1e-10);
close('lm.se', lm.coefs.map(function (c) { return c.se; }), ref.lm.se, 1e-9);
close('lm.p', lm.coefs.map(function (c) { return c.p; }), ref.lm.p, 1e-8);
close('lm.r2', lm.R2, ref.lm.r2, 1e-12); close('lm.adjr2', lm.adjR2, ref.lm.adjr2, 1e-12); close('lm.F', lm.F, ref.lm.F, 1e-10);
close('lm.vif', lm.coefs.slice(1).map(function (c) { return c.vif; }), ref.lm.vif, 1e-9); close('lm.n', lm.n, ref.lm.n);

// ---- 로지스틱 ----
var lg = S.logisticRegression(D.yb, [D.x1, D.x2, D.x3], ['x1', 'x2', 'x3']);
close('logit.coef', lg.coefs.map(function (c) { return c.b; }), ref.logit.coef, 1e-7);
close('logit.se', lg.coefs.map(function (c) { return c.se; }), ref.logit.se, 1e-6);
close('logit.p', lg.coefs.map(function (c) { return c.p; }), ref.logit.p, 1e-6);
close('logit.deviance', lg.deviance, ref.logit.deviance, 1e-9); close('logit.null', lg.nullDeviance, ref.logit.null, 1e-10);
close('logit.aic', lg.aic, ref.logit.aic, 1e-9); close('logit.coxSnell', lg.coxSnell, ref.logit.coxSnell, 1e-8);
close('logit.nagelkerke', lg.nagelkerke, ref.logit.nagelkerke, 1e-8);
close('logit.hl', [lg.hl.chi2, lg.hl.df, lg.hl.p], ref.logit.hl, 1e-6); close('logit.n', lg.n, ref.logit.n);

// ---- 신뢰도 (bfi 친화성 문항) ----
var A = ref.alpha.data, an2 = ['A1', 'A2', 'A3', 'A4', 'A5'];
var rel = S.reliability(an2.map(function (k) { return A[k]; }), an2);
close('alpha.raw', rel.alpha, ref.alpha.raw, 1e-10); close('alpha.std', rel.stdAlpha, ref.alpha.std, 1e-10);
close('alpha.rdrop', rel.items.map(function (i) { return i.rCorrected; }), ref.alpha.rdrop, 1e-10);
close('alpha.ifdel', rel.items.map(function (i) { return i.alphaIfDeleted; }), ref.alpha.ifdel, 1e-10);

// ---- 네트워크 (bfi 15문항) ----
var N = ref.network, items = Object.keys(N.data);
var cols = items.map(function (k) { return N.data[k]; });
var t0 = Date.now();
var eg = S.estimateNetwork(cols, { method: 'ebicglasso' });
console.log('  EBICglasso (p=15, n=' + N.n + ') 소요: ' + (Date.now() - t0) + ' ms, 선택 λ index', eg.lambdaIndex);
close('network.lambda', eg.lambda, N.lambda, 1e-9);
close('network.lambdas', eg.lambdas, N.lambdas, 1e-9);
close('network.ebic', eg.ebic, N.ebic, 1e-4);
close('network.net', flat(eg.network), flat(N.net), 1e-4);
var nz = function (m) { return flat(m).filter(function (v) { return v !== 0; }).length / 2; };
close('network.edgeCount', nz(eg.network), nz(N.net), 0);
var ce = S.centrality(N.net); // 같은 네트워크에서 중심성 정의 검증
close('central.strength', ce.strength, N.strength, 1e-10);
close('central.ei', ce.expectedInfluence, N.ei, 1e-10);
close('central.closeness', ce.closeness, N.closeness, 1e-8);
close('central.betweenness', ce.betweenness, N.betweenness, 1e-10);
var egT = S.estimateNetwork(cols, { method: 'ebicglasso', threshold: true });
close('network.threshold', flat(egT.network), flat(N.netThreshold), 1e-4);
close('network.pcor', flat(S.estimateNetwork(cols, { method: 'pcor' }).network), flat(N.pcor), 1e-10);
var sim = ['x1', 'x2', 'x3', 'x4', 'pre', 'post'];
var simRows = S.completeRows(sim.map(function (k) { return D[k]; }));
var simCols = sim.map(function (k) { return simRows.map(function (i) { return D[k][i]; }); });
close('network.spearman', flat(S.estimateNetwork(simCols, { method: 'ebicglasso', cor: 'spearman' }).network), flat(N.simNet), 1e-4);

console.log('\n최대 상대오차(분석별):');
Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(10) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
