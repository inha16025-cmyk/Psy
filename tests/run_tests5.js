// PsyStat 검증 5: 구조방정식 vs lavaan. node tests/run_tests5.js
'use strict';
var SEM = require('../src/sem.js');
var ref = require('./reference5.json');
var pass = 0, fail = 0, worst = {}, VERBOSE = process.argv.indexOf('-v') > 0;
function close(name, got, exp, tol) {
  var err = Math.abs(got - exp) / Math.max(1, Math.abs(exp));
  if (!(err <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp, 'err', err.toExponential(2)); } else pass++;
  var g = name.split(/[.[ ]/)[0]; worst[g] = Math.max(worst[g] || 0, err);
}
function key(l, o, r) { return o === '~~' && l > r ? r + o + l : l + o + r; }
function compare(tag, res, R, tolEst, tolSe, robust) {
  var mine = {};
  res.params.forEach(function (p) { mine[key(p.lhs, p.op, p.rhs)] = p; });
  var matched = 0;
  R.lhs.forEach(function (l, i) {
    var k = key(l, R.op[i], R.rhs[i]), p = mine[k];
    if (!p) { if (R.se[i] !== 0 && R.se[i] !== null && VERBOSE) console.log('  (lavaan에만 있음)', tag, k); return; }
    matched++;
    close(tag + '.est ' + k, p.est, R.est[i], tolEst);
    if (p.free) close(tag + '.se ' + k, p.se, R.se[i], tolSe);
    close(tag + '.std ' + k, p.std, R.std[i], tolEst);
  });
  close(tag + '.nparams', matched, res.params.length, 0);
  var F = R.fit, f = res.fit;
  close(tag + '.fit chisq', f.chisq, F.chisq, 1e-6); close(tag + '.fit df', f.df, F.df, 0); close(tag + '.fit npar', f.npar, F.npar, 0);
  close(tag + '.fit cfi', f.cfi, F.cfi, 1e-6); close(tag + '.fit tli', f.tli, F.tli, 1e-6); close(tag + '.fit rmsea', f.rmsea, F.rmsea, 1e-6);
  close(tag + '.fit rmseaLo', f.rmseaLow, F['rmsea.ci.lower'], 1e-5); close(tag + '.fit rmseaHi', f.rmseaHigh, F['rmsea.ci.upper'], 1e-5);
  close(tag + '.fit pclose', f.rmseaPclose, F['rmsea.pvalue'], 1e-5);
  close(tag + '.fit srmr', f.srmr, F.srmr, 1e-6); close(tag + '.fit aic', f.aic, F.aic, 1e-8); close(tag + '.fit bic', f.bic, F.bic, 1e-8);
  close(tag + '.fit baseChisq', f.baseChisq, F['baseline.chisq'], 1e-8); close(tag + '.fit baseDf', f.baseDf, F['baseline.df'], 0);
  if (robust) {
    close(tag + '.fit scaling', f.scalingFactor, F['chisq.scaling.factor'], 1e-5);
    close(tag + '.fit chisqScaled', f.chisqScaled, F['chisq.scaled'], 1e-5);
    close(tag + '.fit cfiRobust', f.cfiRobust, F['cfi.robust'], 1e-5); close(tag + '.fit tliRobust', f.tliRobust, F['tli.robust'], 1e-5);
    close(tag + '.fit rmseaRobust', f.rmseaRobust, F['rmsea.robust'], 1e-5);
    close(tag + '.fit rmseaRobustLo', f.rmseaRobustLow, F['rmsea.ci.lower.robust'], 1e-4); close(tag + '.fit rmseaRobustHi', f.rmseaRobustHigh, F['rmsea.ci.upper.robust'], 1e-4);
  }
}
function dataOf(D) { return D; }
var t0;
[['hs.cfa', ref.hs.data, ref.hs.cfa], ['hs.sem', ref.hs.data, ref.hs.sem], ['pd.sem', ref.pd.data, ref.pd.sem]].forEach(function (c) {
  ['ML', 'MLR'].forEach(function (est) {
    t0 = Date.now();
    var res = SEM.fitSEM(c[2].model, dataOf(c[1]), { estimator: est });
    var tag = c[0] + '.' + est;
    console.log('  ' + tag + ': 수렴 ' + res.converged + ', 반복 ' + res.iterations + ', ' + (Date.now() - t0) + ' ms');
    var R = est === 'ML' ? c[2].ml : c[2].mlr;
    // PoliticalDemocracy: 일부 잔차공분산은 목적함수가 매우 평평한 영역에 있어 lavaan 기본 수렴기준이 일찍 멈춘다.
    // PsyStat의 χ²(40.17948949)가 lavaan(40.17948953)보다 작으므로(더 정확한 최소점) 허용오차를 2e-4로 둔다.
    compare(tag, res, R, c[0] === 'pd.sem' ? 2e-4 : 1e-5, est === 'ML' ? 1e-4 : 1e-3, est === 'MLR');
    if (R.def) {
      R.def.name.forEach(function (nm, i) {
        var d = res.defined.filter(function (x) { return x.name === nm; })[0];
        close(tag + '.def est ' + nm, d.est, R.def.est[i], 1e-5); close(tag + '.def se ' + nm, d.se, R.def.se[i], est === 'ML' ? 1e-4 : 1e-3);
      });
    }
  });
});

// 정의 모수 부트스트랩 (백분위) vs lavaan bootstrap = 2000 (난수 생성기가 달라 근사 비교, 절대오차 0.01)
(function () {
  var St = require('../src/stats.js'), res = SEM.fitSEM(ref.hs.sem.model, ref.hs.data, {}), rand = St.rng(7), draws = res.defined.map(function () { return []; });
  var t1 = Date.now(), ok = 0;
  for (var b = 0; b < 2000; b++) { var o = SEM.bootstrapOnce(res, rand); if (!o) continue; ok++; o.defined.forEach(function (v, j) { draws[j].push(v); }); }
  console.log('  부트스트랩 2000회: 성공 ' + ok + ', ' + (Date.now() - t1) + ' ms');
  ref.hs.boot.name.forEach(function (nm, i) {
    var j = res.defined.map(function (d) { return d.name; }).indexOf(nm);
    var lo = St.quantile(draws[j], 0.025), hi = St.quantile(draws[j], 0.975);
    [['lo', lo, ref.hs.boot.lo[i]], ['hi', hi, ref.hs.boot.hi[i]]].forEach(function (x) {
      var err = Math.abs(x[1] - x[2]); if (err > 0.01) { fail++; console.log('FAIL boot', nm, x[0], x[1], x[2]); } else pass++;
      worst.boot = Math.max(worst.boot || 0, err);
    });
  });
})();

console.log('\n최대 상대오차:');
Object.keys(worst).forEach(function (k) { console.log('  ' + k.padEnd(10) + worst[k].toExponential(2)); });
console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
