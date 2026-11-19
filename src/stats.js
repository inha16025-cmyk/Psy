/*
 * PsyStat 통계 엔진 (stats.js)
 * - 외부 라이브러리·네트워크 통신 없음. 순수 JavaScript.
 * - 브라우저(window.PsyStats)와 Node.js(module.exports) 양쪽에서 동작.
 * - 검증: tests/ 폴더의 테스트가 R(qgraph, glasso, psych, car, stats)과
 *   Python(scipy, statsmodels) 결과와 수치를 대조한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PsyStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. 특수함수                                                          */
  /* ------------------------------------------------------------------ */

  var LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    var a = LANCZOS[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // 정칙화 불완전 베타함수 I_x(a,b) (Lentz 연분수)
  function betacf(x, a, b) {
    var FPMIN = 1e-300, EPS = 1e-16;
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= 10000; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }

  // 정칙화 불완전 감마함수 P(a,x), Q(a,x)
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      var sum = 1 / a, del = sum, ap = a;
      for (var n = 0; n < 100000; n++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    return 1 - gammaQcf(a, x);
  }
  function gammaQcf(a, x) {
    var FPMIN = 1e-300, b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (var i = 1; i < 100000; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) return 1 - gammaP(a, x);
    return gammaQcf(a, x);
  }

  /* ------------------------------------------------------------------ */
  /* 2. 확률분포                                                          */
  /* ------------------------------------------------------------------ */

  // 표준정규 누적: 위꼬리 = 0.5*Q(1/2, z^2/2)
  function pnorm(z) {
    if (!isFinite(z)) return z > 0 ? 1 : 0;
    var q = 0.5 * gammaQ(0.5, z * z / 2);
    return z >= 0 ? 1 - q : q;
  }
  function pnormUpper(z) { return pnorm(-z); }

  // 정규분위수: Acklam 근사 + Halley 보정
  function qnorm(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    for (var it = 0; it < 2; it++) {
      var e = pnorm(x) - p;
      var u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
      x = x - u / (1 + x * u / 2);
    }
    return x;
  }

  // t 분포: 누적 P(T <= t)
  function pt(t, df) {
    if (!isFinite(t)) return t > 0 ? 1 : 0;
    var x = df / (df + t * t);
    var tail = 0.5 * ibeta(x, df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
  }
  function ptTwoSided(t, df) { return ibeta(df / (df + t * t), df / 2, 0.5); }
  // F 분포 위꼬리
  function pfUpper(f, d1, d2) {
    if (!(f > 0)) return 1;
    return ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
  }
  function pchisqUpper(x, df) { return x <= 0 ? 1 : gammaQ(df / 2, x / 2); }
  function pchisq(x, df) { return x <= 0 ? 0 : gammaP(df / 2, x / 2); }

  // 단조 누적분포의 역함수 (이분법; 정밀도 ~1e-13)
  function invertCdf(cdf, p, lo, hi) {
    while (cdf(hi) < p) { lo = hi; hi *= 2; if (hi > 1e12) break; }
    while (cdf(lo) > p) { hi = lo; lo = lo < 0 ? lo * 2 : lo - Math.max(1, Math.abs(lo)); if (lo < -1e12) break; }
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (cdf(mid) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-14 * Math.max(1, Math.abs(mid))) break;
    }
    return (lo + hi) / 2;
  }
  function qt(p, df) {
    if (p === 0.5) return 0;
    var z = qnorm(p);
    return invertCdf(function (x) { return pt(x, df); }, p, z - 10, z + 10);
  }
  function qchisq(p, df) { return invertCdf(function (x) { return pchisq(x, df); }, p, 0, Math.max(1, df * 3)); }
  function qf(p, d1, d2) { return invertCdf(function (x) { return 1 - pfUpper(x, d1, d2); }, p, 0, 10); }

  // 스튜던트화 범위 분포 (R의 ptukey.c 이식; Copenhaver & Holland, 1988)
  function wprob(w, rr, cc) {
    var nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3, wincr1 = 2, wincr2 = 3;
    var xleg = [0.981560634246719250690549090149, 0.904117256370474856678465866119, 0.769902674194304687036893833213,
      0.587317954286617447296702418941, 0.367831498998180193752691536644, 0.125233408511468915472441369464];
    var aleg = [0.047175336386511827194615961485, 0.106939325995318430960254718194, 0.160078328543346226334652529543,
      0.203167426723065921749064455810, 0.233492536538354808760849898925, 0.249147045813402785000562436043];
    var qsqz = w * 0.5;
    if (qsqz >= bb) return 1.0;
    var pr_w = 2 * pnorm(qsqz) - 1;
    if (pr_w >= Math.exp(C2 / cc)) pr_w = Math.pow(pr_w, cc); else pr_w = 0;
    var wincr = w > wlar ? wincr1 : wincr2;
    var blb = qsqz, binc = (bb - qsqz) / wincr, bub = blb + binc, einsum = 0, cc1 = cc - 1;
    for (var wi = 1; wi <= wincr; wi++) {
      var elsum = 0, a = 0.5 * (bub + blb), b = 0.5 * (bub - blb);
      for (var jj = 1; jj <= nleg; jj++) {
        var j, xx;
        if (ihalf < jj) { j = (nleg - jj) + 1; xx = xleg[j - 1]; }
        else { j = jj; xx = -xleg[j - 1]; }
        var c = b * xx, ac = a + c, qexpo = ac * ac;
        if (qexpo > C3) break;
        var pplus = 2 * pnorm(ac), pminus = 2 * pnorm(ac - w);
        var rinsum = pplus * 0.5 - pminus * 0.5;
        if (rinsum >= Math.exp(C1 / cc1)) {
          rinsum = (aleg[j - 1] * Math.exp(-(0.5 * qexpo))) * Math.pow(rinsum, cc1);
          elsum += rinsum;
        }
      }
      elsum *= ((2.0 * b) * cc) / Math.sqrt(2 * Math.PI);
      einsum += elsum;
      blb = bub; bub += binc;
    }
    pr_w += einsum;
    if (pr_w <= Math.exp(C1 / rr)) return 0;
    pr_w = Math.pow(pr_w, rr);
    return pr_w >= 1 ? 1 : pr_w;
  }
  // P(Q <= q), nranges=1, nmeans=cc, df
  function ptukey(q, cc, df) {
    var rr = 1;
    var nlegq = 16, ihalfq = 8, eps1 = -30.0, eps2 = 1.0e-14, dhaf = 100, dquar = 800, deigh = 5000, dlarg = 25000;
    var xlegq = [0.989400934991649932596154173450, 0.944575023073232576077988415535, 0.865631202387831743880467897712,
      0.755404408355003033895101194847, 0.617876244402643748446671764049, 0.458016777657227386342419442984,
      0.281603550779258913230460501460, 0.950125098376374401853193354250e-1];
    var alegq = [0.271524594117540948517805724560e-1, 0.622535239386478928628438369944e-1, 0.951585116824927848099251076022e-1,
      0.124628971255533872052476282192, 0.149595988816576732081501730547, 0.169156519395002538189312079030,
      0.182603415044923588866763667969, 0.189450610455068496285396723208];
    if (q <= 0) return 0;
    if (!isFinite(q)) return 1;
    if (df > dlarg) return wprob(q, rr, cc);
    var f2 = df * 0.5;
    var f2lf = ((f2 * Math.log(df)) - (df * Math.LN2)) - lgamma(f2);
    var f21 = f2 - 1.0, ff4 = df * 0.25, ulen;
    if (df <= dhaf) ulen = 1; else if (df <= dquar) ulen = 0.5; else if (df <= deigh) ulen = 0.25; else ulen = 0.125;
    f2lf += Math.log(ulen);
    var ans = 0, otsum = 0;
    for (var i = 1; i <= 50; i++) {
      otsum = 0;
      var twa1 = (2 * i - 1) * ulen;
      for (var jj = 1; jj <= nlegq; jj++) {
        var j, t1;
        if (ihalfq < jj) {
          j = jj - ihalfq - 1;
          t1 = (f2lf + (f21 * Math.log(twa1 + (xlegq[j] * ulen)))) - (((xlegq[j] * ulen) + twa1) * ff4);
        } else {
          j = jj - 1;
          t1 = (f2lf + (f21 * Math.log(twa1 - (xlegq[j] * ulen)))) + (((xlegq[j] * ulen) - twa1) * ff4);
        }
        if (t1 >= eps1) {
          var qsqz;
          if (ihalfq < jj) qsqz = q * Math.sqrt(((xlegq[j] * ulen) + twa1) * 0.5);
          else qsqz = q * Math.sqrt(((-(xlegq[j] * ulen)) + twa1) * 0.5);
          var wprb = wprob(qsqz, rr, cc);
          otsum += (wprb * alegq[j]) * Math.exp(t1);
        }
      }
      if (i * ulen >= 1.0 && otsum <= eps2) break;
      ans += otsum;
    }
    return ans > 1 ? 1 : ans;
  }

  /* ------------------------------------------------------------------ */
  /* 3. 행렬 유틸리티                                                     */
  /* ------------------------------------------------------------------ */

  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) { m.push(new Array(c).fill(0)); } return m; }
  function identity(n) { var m = zeros(n, n); for (var i = 0; i < n; i++) m[i][i] = 1; return m; }
  function transpose(A) { var r = A.length, c = A[0].length, T = zeros(c, r); for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) T[j][i] = A[i][j]; return T; }
  function matmul(A, B) {
    var r = A.length, k = B.length, c = B[0].length, C = zeros(r, c);
    for (var i = 0; i < r; i++) for (var l = 0; l < k; l++) { var a = A[i][l]; if (a === 0) continue; for (var j = 0; j < c; j++) C[i][j] += a * B[l][j]; }
    return C;
  }
  function copyM(A) { return A.map(function (r) { return r.slice(); }); }

  // 촐레스키 분해 (양정치 확인용). 실패 시 null
  function cholesky(A) {
    var n = A.length, L = zeros(n, n);
    for (var j = 0; j < n; j++) {
      var s = A[j][j];
      for (var k = 0; k < j; k++) s -= L[j][k] * L[j][k];
      if (!(s > 0)) return null;
      L[j][j] = Math.sqrt(s);
      for (var i = j + 1; i < n; i++) {
        var t = A[i][j];
        for (var k2 = 0; k2 < j; k2++) t -= L[i][k2] * L[j][k2];
        L[i][j] = t / L[j][j];
      }
    }
    return L;
  }
  function logdetPD(A) { var L = cholesky(A); if (!L) return NaN; var s = 0; for (var i = 0; i < A.length; i++) s += Math.log(L[i][i]); return 2 * s; }

  // 역행렬 (부분 피벗 가우스-조던)
  function inverse(A) {
    var n = A.length, M = A.map(function (r, i) { var e = new Array(n).fill(0); e[i] = 1; return r.concat(e); });
    for (var c = 0; c < n; c++) {
      var p = c, best = Math.abs(M[c][c]);
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > best) { best = Math.abs(M[r][c]); p = r; }
      if (best < 1e-14) throw new Error('행렬이 특이(singular)합니다. 변수 간 완전한 공선성이 있는지 확인하세요.');
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      var piv = M[c][c];
      for (var j = 0; j < 2 * n; j++) M[c][j] /= piv;
      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === c) continue;
        var f = M[r2][c]; if (f === 0) continue;
        for (var j2 = 0; j2 < 2 * n; j2++) M[r2][j2] -= f * M[c][j2];
      }
    }
    return M.map(function (r) { return r.slice(n); });
  }

  // 대칭행렬 고유값 (야코비 방법)
  function eigenSym(A) {
    var n = A.length, a = copyM(A), v = identity(n);
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22) break;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        var theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        var c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (var k = 0; k < n; k++) {
          var akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (var k2 = 0; k2 < n; k2++) {
          var apk = a[p][k2], aqk = a[q][k2];
          a[p][k2] = c * apk - s * aqk; a[q][k2] = s * apk + c * aqk;
        }
        for (var k3 = 0; k3 < n; k3++) {
          var vkp = v[k3][p], vkq = v[k3][q];
          v[k3][p] = c * vkp - s * vkq; v[k3][q] = s * vkp + c * vkq;
        }
      }
    }
    var vals = []; for (var d = 0; d < n; d++) vals.push(a[d][d]);
    var idx = vals.map(function (x, i) { return i; }).sort(function (x, y) { return vals[y] - vals[x]; });
    return { values: idx.map(function (i) { return vals[i]; }), vectors: v.map(function (row) { return idx.map(function (i) { return row[i]; }); }) };
  }

  // 하우스홀더 QR 최소제곱. X: n×p (행 우선)
  function qrLeastSquares(X, y) {
    var n = X.length, p = X[0].length;
    var A = copyM(X), b = y.slice();
    var rdiag = new Array(p);
    for (var k = 0; k < p; k++) {
      var nrm = 0;
      for (var i = k; i < n; i++) nrm = Math.hypot(nrm, A[i][k]);
      if (nrm === 0) throw new Error('설계행렬의 계수가 부족합니다 (완전한 공선성).');
      if (A[k][k] < 0) nrm = -nrm;
      for (var i2 = k; i2 < n; i2++) A[i2][k] /= nrm;
      A[k][k] += 1;
      for (var j = k + 1; j < p; j++) {
        var s = 0;
        for (var i3 = k; i3 < n; i3++) s += A[i3][k] * A[i3][j];
        s = -s / A[k][k];
        for (var i4 = k; i4 < n; i4++) A[i4][j] += s * A[i4][k];
      }
      var sb = 0;
      for (var i5 = k; i5 < n; i5++) sb += A[i5][k] * b[i5];
      sb = -sb / A[k][k];
      for (var i6 = k; i6 < n; i6++) b[i6] += sb * A[i6][k];
      rdiag[k] = -nrm;
    }
    var maxd = Math.max.apply(null, rdiag.map(Math.abs));
    for (var kk = 0; kk < p; kk++) if (Math.abs(rdiag[kk]) < 1e-10 * maxd) throw new Error('설계행렬의 계수가 부족합니다 (완전한 공선성).');
    var beta = new Array(p);
    for (var k2 = p - 1; k2 >= 0; k2--) {
      var t = b[k2];
      for (var j2 = k2 + 1; j2 < p; j2++) t -= A[k2][j2] * beta[j2];
      beta[k2] = t / rdiag[k2];
    }
    // R 상삼각 → (R'R)^-1 = R^-1 R^-T
    var R = zeros(p, p);
    for (var r = 0; r < p; r++) { R[r][r] = rdiag[r]; for (var c = r + 1; c < p; c++) R[r][c] = A[r][c]; }
    var Rinv = zeros(p, p);
    for (var c2 = 0; c2 < p; c2++) {
      Rinv[c2][c2] = 1 / R[c2][c2];
      for (var r2 = c2 - 1; r2 >= 0; r2--) {
        var s2 = 0;
        for (var m = r2 + 1; m <= c2; m++) s2 += R[r2][m] * Rinv[m][c2];
        Rinv[r2][c2] = -s2 / R[r2][r2];
      }
    }
    var XtXinv = matmul(Rinv, transpose(Rinv));
    return { beta: beta, XtXinv: XtXinv };
  }

  /* ------------------------------------------------------------------ */
  /* 4. 기초 통계                                                         */
  /* ------------------------------------------------------------------ */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clean(x) { return x.filter(isNum); }
  function sum(x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i]; return s; }
  function mean(x) { return sum(x) / x.length; }
  function variance(x) {
    var m = mean(x), s = 0;
    for (var i = 0; i < x.length; i++) s += (x[i] - m) * (x[i] - m);
    return s / (x.length - 1);
  }
  function sd(x) { return Math.sqrt(variance(x)); }
  function sortNum(x) { return x.slice().sort(function (a, b) { return a - b; }); }
  // R type 7 분위수
  function quantile(x, p) {
    var s = sortNum(x), n = s.length, h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  // SPSS 기본(가중평균, type 6) 분위수
  function quantileSPSS(x, p) {
    var s = sortNum(x), n = s.length, h = (n + 1) * p;
    if (h <= 1) return s[0];
    if (h >= n) return s[n - 1];
    var lo = Math.floor(h);
    return s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
  }
  function rank(x) { // 동순위 평균
    var idx = x.map(function (v, i) { return i; }).sort(function (a, b) { return x[a] - x[b]; });
    var r = new Array(x.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      var rk = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[idx[k]] = rk;
      i = j + 1;
    }
    return r;
  }
  function pearson(x, y) {
    var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < x.length; i++) { var dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxy / Math.sqrt(sxx * syy);
  }

  // Shapiro-Wilk W (Royston, 1995; AS R94 — R의 swilk.c와 동일 알고리즘)
  function shapiroWilk(xin) {
    var x = sortNum(clean(xin)), n = x.length;
    if (n < 3 || n > 5000) return { W: NaN, p: NaN };
    if (x[n - 1] - x[0] < 1e-12) return { W: NaN, p: NaN };
    function poly(cc, xx) { var r = cc[0]; if (cc.length > 1) { var p = xx * cc[cc.length - 1]; for (var j = cc.length - 2; j > 0; j--) p = (p + cc[j]) * xx; r += p; } return r; }
    var nn2 = Math.floor(n / 2), a = new Array(nn2 + 1), an = n;
    var g = [-2.273, 0.459], c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
    var c3 = [0.544, -0.39978, 0.025054, -6.714e-4], c4 = [1.3822, -0.77857, 0.062767, -0.0020322], c5 = [-1.5861, -0.31082, -0.083751, 0.0038915], c6 = [-0.4803, -0.082676, 0.0030302];
    if (n === 3) a[1] = Math.SQRT1_2;
    else {
      var an25 = an + 0.25, summ2 = 0, m = new Array(nn2 + 1);
      for (var i = 1; i <= nn2; i++) { m[i] = qnorm((i - 0.375) / an25); summ2 += m[i] * m[i]; }
      summ2 *= 2;
      var ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(an), a1 = poly(c1, rsn) - m[1] / ssumm2, i1, fac;
      if (n > 5) {
        i1 = 3;
        var a2 = -m[2] / ssumm2 + poly(c2, rsn);
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
        a[2] = a2;
      } else {
        i1 = 2;
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1));
      }
      a[1] = a1;
      for (var i2 = i1; i2 <= nn2; i2++) a[i2] = -m[i2] / fac;
    }
    var num = 0;
    for (var k = 1; k <= nn2; k++) num += a[k] * (x[n - k] - x[k - 1]);
    var mu = mean(x), ss = 0;
    for (var k2 = 0; k2 < n; k2++) ss += (x[k2] - mu) * (x[k2] - mu);
    var w = num * num / ss;
    if (w > 1) w = 1;
    var pw;
    if (n === 3) {
      pw = 1.90985931710274 * (Math.asin(Math.sqrt(w)) - 1.04719755119660);
      return { W: w, p: Math.max(pw, 0) };
    }
    var w1 = Math.log(1 - w), xx = Math.log(an), mm, s, y;
    if (n <= 11) {
      var gamma = poly(g, an);
      if (w1 >= gamma) return { W: w, p: 1e-99 };
      y = -Math.log(gamma - w1);
      mm = poly(c3, an); s = Math.exp(poly(c4, an));
    } else {
      mm = poly(c5, xx); s = Math.exp(poly(c6, xx)); y = w1;
    }
    pw = pnormUpper((y - mm) / s);
    return { W: w, p: pw };
  }

  function descriptives(xin) {
    var x = clean(xin), n = x.length, miss = xin.length - n;
    if (n === 0) return { n: 0, missing: miss };
    var m = mean(x), s = n > 1 ? sd(x) : NaN;
    var m2 = 0, m3 = 0, m4 = 0;
    for (var i = 0; i < n; i++) { var d = x[i] - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    m2 /= n; m3 /= n; m4 /= n;
    // SPSS/Excel 방식 표본 왜도·첨도(G1, G2)와 표준오차
    var g1 = m3 / Math.pow(m2, 1.5), g2 = m4 / (m2 * m2) - 3;
    var G1 = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : NaN;
    var G2 = n > 3 ? ((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3)) : NaN;
    var seSkew = n > 2 ? Math.sqrt(6 * n * (n - 1) / ((n - 2) * (n + 1) * (n + 3))) : NaN;
    var seKurt = n > 3 ? 2 * seSkew * Math.sqrt((n * n - 1) / ((n - 3) * (n + 5))) : NaN;
    var sw = n >= 3 ? shapiroWilk(x) : { W: NaN, p: NaN };
    return {
      n: n, missing: miss, mean: m, sd: s, se: s / Math.sqrt(n), median: quantile(x, 0.5),
      min: Math.min.apply(null, x), max: Math.max.apply(null, x),
      q1: quantile(x, 0.25), q3: quantile(x, 0.75),
      skew: G1, seSkew: seSkew, kurt: G2, seKurt: seKurt, swW: sw.W, swP: sw.p
    };
  }

  /* ------------------------------------------------------------------ */
  /* 5. t 검정 / 분산분석                                                 */
  /* ------------------------------------------------------------------ */

  function leveneTest(groups, center) { // center: 'mean'(SPSS) | 'median'(Brown-Forsythe, R car 기본)
    var z = groups.map(function (g) {
      var c = center === 'median' ? quantile(g, 0.5) : mean(g);
      return g.map(function (v) { return Math.abs(v - c); });
    });
    var a = onewayCore(z);
    return { F: a.F, df1: a.dfB, df2: a.dfW, p: a.p };
  }

  function onewayCore(groups) {
    var k = groups.length, N = 0, all = [];
    groups.forEach(function (g) { N += g.length; all = all.concat(g); });
    var gm = mean(all), ssb = 0, ssw = 0;
    groups.forEach(function (g) {
      var m = mean(g); ssb += g.length * (m - gm) * (m - gm);
      g.forEach(function (v) { ssw += (v - m) * (v - m); });
    });
    var dfB = k - 1, dfW = N - k, msb = ssb / dfB, msw = ssw / dfW, F = msb / msw;
    return { k: k, N: N, ssb: ssb, ssw: ssw, sst: ssb + ssw, dfB: dfB, dfW: dfW, msb: msb, msw: msw, F: F, p: pfUpper(F, dfB, dfW) };
  }

  function tTestOneSample(xin, mu, conf) {
    conf = conf || 0.95;
    var x = clean(xin), n = x.length, m = mean(x), s = sd(x), se = s / Math.sqrt(n), df = n - 1;
    var t = (m - mu) / se, tc = qt(1 - (1 - conf) / 2, df);
    return { n: n, mean: m, sd: s, se: se, t: t, df: df, p: ptTwoSided(t, df), diff: m - mu,
      ciLow: m - mu - tc * se, ciHigh: m - mu + tc * se, d: (m - mu) / s };
  }

  function tTestPaired(xin, yin, conf) {
    conf = conf || 0.95;
    var x = [], y = [];
    for (var i = 0; i < xin.length; i++) if (isNum(xin[i]) && isNum(yin[i])) { x.push(xin[i]); y.push(yin[i]); }
    var d = x.map(function (v, i) { return v - y[i]; });
    var n = d.length, md = mean(d), sdd = sd(d), se = sdd / Math.sqrt(n), df = n - 1, t = md / se;
    var tc = qt(1 - (1 - conf) / 2, df);
    return { n: n, mean1: mean(x), mean2: mean(y), sd1: sd(x), sd2: sd(y), r: pearson(x, y),
      meanDiff: md, sdDiff: sdd, se: se, t: t, df: df, p: ptTwoSided(t, df),
      ciLow: md - tc * se, ciHigh: md + tc * se, dz: md / sdd };
  }

  function tTestIndependent(g1in, g2in, conf) {
    conf = conf || 0.95;
    var a = clean(g1in), b = clean(g2in), n1 = a.length, n2 = b.length;
    var m1 = mean(a), m2 = mean(b), v1 = variance(a), v2 = variance(b), diff = m1 - m2;
    var sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    var seS = Math.sqrt(sp2 * (1 / n1 + 1 / n2)), dfS = n1 + n2 - 2, tS = diff / seS;
    var seW = Math.sqrt(v1 / n1 + v2 / n2);
    var dfW = Math.pow(v1 / n1 + v2 / n2, 2) / (Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1));
    var tW = diff / seW, cS = qt(1 - (1 - conf) / 2, dfS), cW = qt(1 - (1 - conf) / 2, dfW);
    var d = diff / Math.sqrt(sp2);
    var J = 1 - 3 / (4 * (n1 + n2) - 9); // Hedges g 보정
    return {
      n1: n1, n2: n2, mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2), diff: diff,
      student: { t: tS, df: dfS, p: ptTwoSided(tS, dfS), se: seS, ciLow: diff - cS * seS, ciHigh: diff + cS * seS },
      welch: { t: tW, df: dfW, p: ptTwoSided(tW, dfW), se: seW, ciLow: diff - cW * seW, ciHigh: diff + cW * seW },
      levene: leveneTest([a, b], 'mean'), d: d, g: d * J
    };
  }

  function anovaOneway(groupsIn, labels) {
    var groups = groupsIn.map(clean);
    var core = onewayCore(groups), k = core.k;
    var desc = groups.map(function (g, i) { return { label: labels[i], n: g.length, mean: mean(g), sd: sd(g) }; });
    var eta2 = core.ssb / core.sst;
    var omega2 = (core.ssb - core.dfB * core.msw) / (core.sst + core.msw);
    // Welch ANOVA
    var w = groups.map(function (g) { return g.length / variance(g); }), sw = sum(w);
    var mw = sum(groups.map(function (g, i) { return w[i] * mean(g); })) / sw;
    var A = sum(groups.map(function (g, i) { return w[i] * Math.pow(mean(g) - mw, 2); })) / (k - 1);
    var lam = sum(groups.map(function (g, i) { return Math.pow(1 - w[i] / sw, 2) / (g.length - 1); }));
    var B = 1 + 2 * (k - 2) / (k * k - 1) * lam;
    var Fw = A / B, df2w = (k * k - 1) / (3 * lam);
    // 사후검정
    var posthoc = [];
    for (var i = 0; i < k; i++) for (var j = i + 1; j < k; j++) {
      var gi = groups[i], gj = groups[j], ni = gi.length, nj = gj.length, d = mean(gi) - mean(gj);
      var seT = Math.sqrt(core.msw / 2 * (1 / ni + 1 / nj));
      var qT = Math.abs(d) / seT;
      var pT = 1 - ptukey(qT, k, core.dfW);
      var seB = Math.sqrt(core.msw * (1 / ni + 1 / nj)), tB = d / seB;
      var pB = Math.min(1, ptTwoSided(tB, core.dfW) * k * (k - 1) / 2);
      var vi = variance(gi) / ni, vj = variance(gj) / nj;
      var dfGH = Math.pow(vi + vj, 2) / (vi * vi / (ni - 1) + vj * vj / (nj - 1));
      var qGH = Math.abs(d) / Math.sqrt((vi + vj) / 2);
      var pGH = 1 - ptukey(qGH, k, dfGH);
      posthoc.push({ a: labels[i], b: labels[j], diff: d, se: seB, pTukey: Math.max(0, pT), pBonf: pB, pGH: Math.max(0, pGH) });
    }
    return {
      desc: desc, ssb: core.ssb, ssw: core.ssw, sst: core.sst, dfB: core.dfB, dfW: core.dfW, msb: core.msb, msw: core.msw,
      F: core.F, p: core.p, eta2: eta2, omega2: omega2,
      welch: { F: Fw, df1: k - 1, df2: df2w, p: pfUpper(Fw, k - 1, df2w) },
      levene: leveneTest(groups, 'mean'), posthoc: posthoc
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. 상관 / 교차분석                                                   */
  /* ------------------------------------------------------------------ */

  function corTest(xin, yin, method, conf) {
    conf = conf || 0.95;
    var x = [], y = [];
    for (var i = 0; i < xin.length; i++) if (isNum(xin[i]) && isNum(yin[i])) { x.push(xin[i]); y.push(yin[i]); }
    var n = x.length;
    if (method === 'spearman') { x = rank(x); y = rank(y); }
    var r = pearson(x, y), df = n - 2, t = r * Math.sqrt(df / (1 - r * r));
    var p = Math.abs(r) >= 1 ? 0 : ptTwoSided(t, df);
    var z = 0.5 * Math.log((1 + r) / (1 - r)), se = 1 / Math.sqrt(n - 3), zc = qnorm(1 - (1 - conf) / 2);
    return { r: r, n: n, t: t, df: df, p: p, ciLow: Math.tanh(z - zc * se), ciHigh: Math.tanh(z + zc * se) };
  }

  function corMatrix(cols, method, missing) {
    var k = cols.length, rows;
    if (missing !== 'pairwise') {
      rows = completeRows(cols);
      cols = cols.map(function (c) { return rows.map(function (i) { return c[i]; }); });
    }
    var R = zeros(k, k), P = zeros(k, k), N = zeros(k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) {
      if (i === j) { R[i][i] = 1; P[i][i] = 0; N[i][i] = clean(cols[i]).length; continue; }
      var ct = corTest(cols[i], cols[j], method);
      R[i][j] = R[j][i] = ct.r; P[i][j] = P[j][i] = ct.p; N[i][j] = N[j][i] = ct.n;
    }
    return { R: R, P: P, N: N };
  }

  function completeRows(cols) {
    var n = cols[0].length, out = [];
    for (var i = 0; i < n; i++) { var ok = true; for (var j = 0; j < cols.length; j++) if (!isNum(cols[j][i])) { ok = false; break; } if (ok) out.push(i); }
    return out;
  }

  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
  function fisherExact2x2(a, b, c, d) {
    var r1 = a + b, c1 = a + c, n = a + b + c + d;
    var lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1);
    function dh(x) { return Math.exp(lchoose(c1, x) + lchoose(n - c1, r1 - x) - lchoose(n, r1)); }
    var pobs = dh(a), p = 0;
    for (var x = lo; x <= hi; x++) { var px = dh(x); if (px <= pobs * (1 + 1e-7)) p += px; }
    return Math.min(1, p);
  }

  function crosstab(rowVar, colVar) {
    var rl = [], cl = [], pairs = [];
    for (var i = 0; i < rowVar.length; i++) {
      var r = rowVar[i], c = colVar[i];
      if (r === null || r === undefined || r === '' || c === null || c === undefined || c === '') continue;
      if (typeof r === 'number' && !isFinite(r)) continue;
      if (typeof c === 'number' && !isFinite(c)) continue;
      pairs.push([String(r), String(c)]);
    }
    function sortLabels(arr) { return arr.sort(function (a, b) { var na = Number(a), nb = Number(b); if (!isNaN(na) && !isNaN(nb)) return na - nb; return a < b ? -1 : a > b ? 1 : 0; }); }
    pairs.forEach(function (p) { if (rl.indexOf(p[0]) < 0) rl.push(p[0]); if (cl.indexOf(p[1]) < 0) cl.push(p[1]); });
    sortLabels(rl); sortLabels(cl);
    var O = zeros(rl.length, cl.length);
    pairs.forEach(function (p) { O[rl.indexOf(p[0])][cl.indexOf(p[1])]++; });
    var n = pairs.length, rs = O.map(sum), cs = cl.map(function (_, j) { return sum(O.map(function (r) { return r[j]; })); });
    var E = zeros(rl.length, cl.length), chi = 0, g2 = 0, lowE = 0;
    for (var a = 0; a < rl.length; a++) for (var b = 0; b < cl.length; b++) {
      E[a][b] = rs[a] * cs[b] / n;
      if (E[a][b] < 5) lowE++;
      chi += Math.pow(O[a][b] - E[a][b], 2) / E[a][b];
      if (O[a][b] > 0) g2 += 2 * O[a][b] * Math.log(O[a][b] / E[a][b]);
    }
    var df = (rl.length - 1) * (cl.length - 1);
    var res = { rows: rl, cols: cl, O: O, E: E, rowSums: rs, colSums: cs, n: n, chi2: chi, df: df, p: pchisqUpper(chi, df),
      G2: g2, pG2: pchisqUpper(g2, df), cramerV: Math.sqrt(chi / (n * (Math.min(rl.length, cl.length) - 1))),
      lowExpected: lowE, cells: rl.length * cl.length };
    if (rl.length === 2 && cl.length === 2) {
      var A = O[0][0], B = O[0][1], C = O[1][0], D = O[1][1];
      var yates = 0;
      for (var a2 = 0; a2 < 2; a2++) for (var b2 = 0; b2 < 2; b2++) yates += Math.pow(Math.max(0, Math.abs(O[a2][b2] - E[a2][b2]) - 0.5), 2) / E[a2][b2];
      res.yates = { chi2: yates, p: pchisqUpper(yates, 1) };
      res.fisherP = fisherExact2x2(A, B, C, D);
      res.phi = (A * D - B * C) / Math.sqrt(rs[0] * rs[1] * cs[0] * cs[1]);
      res.oddsRatio = (A * D) / (B * C);
    }
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* 7. 회귀분석                                                          */
  /* ------------------------------------------------------------------ */

  function linearRegression(yin, Xcols, names, conf) {
    conf = conf || 0.95;
    var rows = completeRows([yin].concat(Xcols));
    var y = rows.map(function (i) { return yin[i]; });
    var Xc = Xcols.map(function (c) { return rows.map(function (i) { return c[i]; }); });
    var n = y.length, p = Xcols.length + 1;
    if (n <= p) throw new Error('사례 수가 예측변수 수보다 충분히 많아야 합니다.');
    var X = rows.map(function (_, r) { return [1].concat(Xc.map(function (c) { return c[r]; })); });
    var fit = qrLeastSquares(X, y), b = fit.beta;
    var yhat = X.map(function (row) { var s = 0; for (var j = 0; j < p; j++) s += row[j] * b[j]; return s; });
    var my = mean(y), sse = 0, sst = 0;
    for (var i = 0; i < n; i++) { sse += Math.pow(y[i] - yhat[i], 2); sst += Math.pow(y[i] - my, 2); }
    var dfE = n - p, mse = sse / dfE, R2 = 1 - sse / sst, adjR2 = 1 - (1 - R2) * (n - 1) / dfE;
    var dfM = p - 1, F = ((sst - sse) / dfM) / mse, tc = qt(1 - (1 - conf) / 2, dfE);
    var sdy = sd(y);
    var coefs = b.map(function (bj, j) {
      var se = Math.sqrt(mse * fit.XtXinv[j][j]), t = bj / se;
      return { name: j === 0 ? '(절편)' : names[j - 1], b: bj, se: se, t: t, p: ptTwoSided(t, dfE),
        ciLow: bj - tc * se, ciHigh: bj + tc * se, beta: j === 0 ? NaN : bj * sd(Xc[j - 1]) / sdy, vif: NaN };
    });
    if (Xcols.length > 1) {
      for (var j = 0; j < Xcols.length; j++) {
        var others = Xc.filter(function (_, k) { return k !== j; });
        var Xo = rows.map(function (_, r) { return [1].concat(others.map(function (c) { return c[r]; })); });
        var fo = qrLeastSquares(Xo, Xc[j]).beta, mj = mean(Xc[j]), s1 = 0, s2 = 0;
        for (var r = 0; r < n; r++) { var pr = 0; for (var q = 0; q < fo.length; q++) pr += Xo[r][q] * fo[q]; s1 += Math.pow(Xc[j][r] - pr, 2); s2 += Math.pow(Xc[j][r] - mj, 2); }
        coefs[j + 1].vif = 1 / (s1 / s2);
      }
    } else if (Xcols.length === 1) coefs[1].vif = 1;
    var resid = y.map(function (v, i) { return v - yhat[i]; });
    var dw = 0; for (var i2 = 1; i2 < n; i2++) dw += Math.pow(resid[i2] - resid[i2 - 1], 2);
    dw /= sse;
    return { n: n, coefs: coefs, R2: R2, adjR2: adjR2, R: Math.sqrt(R2), F: F, dfM: dfM, dfE: dfE, p: pfUpper(F, dfM, dfE),
      sse: sse, ssr: sst - sse, sst: sst, see: Math.sqrt(mse), durbinWatson: dw, residuals: resid, fitted: yhat };
  }

  function logisticIRLS(X, y) {
    var n = X.length, p = X[0].length, b = new Array(p).fill(0), dev = Infinity, it, converged = false;
    for (it = 1; it <= 100; it++) {
      var eta = X.map(function (r) { var s = 0; for (var j = 0; j < p; j++) s += r[j] * b[j]; return s; });
      var mu = eta.map(function (e) { return 1 / (1 + Math.exp(-e)); });
      var XtWX = zeros(p, p), XtWz = new Array(p).fill(0);
      for (var i = 0; i < n; i++) {
        var w = Math.max(mu[i] * (1 - mu[i]), 1e-12), z = eta[i] + (y[i] - mu[i]) / w;
        for (var a = 0; a < p; a++) { XtWz[a] += X[i][a] * w * z; for (var c = a; c < p; c++) XtWX[a][c] += X[i][a] * w * X[i][c]; }
      }
      for (var a2 = 0; a2 < p; a2++) for (var c2 = 0; c2 < a2; c2++) XtWX[a2][c2] = XtWX[c2][a2];
      var inv = inverse(XtWX);
      var nb = inv.map(function (row) { var s = 0; for (var j = 0; j < p; j++) s += row[j] * XtWz[j]; return s; });
      var nd = devianceLogit(X, y, nb);
      b = nb;
      if (Math.abs(nd - dev) / (Math.abs(nd) + 0.1) < 1e-10) { dev = nd; converged = true; break; }
      dev = nd;
    }
    var etaF = X.map(function (r) { var s = 0; for (var j = 0; j < p; j++) s += r[j] * b[j]; return s; });
    var muF = etaF.map(function (e) { return 1 / (1 + Math.exp(-e)); });
    var I = zeros(p, p);
    for (var i2 = 0; i2 < n; i2++) { var w2 = muF[i2] * (1 - muF[i2]); for (var a3 = 0; a3 < p; a3++) for (var c3 = 0; c3 < p; c3++) I[a3][c3] += X[i2][a3] * w2 * X[i2][c3]; }
    var cov;
    try { cov = inverse(I); } catch (e) { cov = zeros(p, p).map(function (r) { return r.map(function () { return NaN; }); }); }
    return { beta: b, cov: cov, deviance: dev, iterations: it, converged: converged, mu: muF };
  }
  function devianceLogit(X, y, b) {
    var d = 0;
    for (var i = 0; i < X.length; i++) {
      var e = 0; for (var j = 0; j < b.length; j++) e += X[i][j] * b[j];
      // log(1+exp(e)) 안정 계산
      var l1pe = e > 0 ? e + Math.log1p(Math.exp(-e)) : Math.log1p(Math.exp(e));
      d += -2 * (y[i] * e - l1pe);
    }
    return d;
  }

  // 이분형 로지스틱 회귀. yin: 0/1 숫자 배열
  function logisticRegression(yin, Xcols, names, opts) {
    opts = opts || {};
    var cutoff = opts.cutoff || 0.5, conf = opts.conf || 0.95, hlGroups = opts.hlGroups || 10;
    var rows = completeRows([yin].concat(Xcols));
    var y = rows.map(function (i) { return yin[i]; });
    if (y.some(function (v) { return v !== 0 && v !== 1; })) throw new Error('종속변수는 0과 1로만 코딩되어야 합니다.');
    var Xc = Xcols.map(function (c) { return rows.map(function (i) { return c[i]; }); });
    var n = y.length, p = Xcols.length + 1;
    var X = rows.map(function (_, r) { return [1].concat(Xc.map(function (c) { return c[r]; })); });
    var fit = logisticIRLS(X, y);
    var n1 = sum(y), p0 = n1 / n;
    var dev0 = -2 * (n1 * Math.log(p0) + (n - n1) * Math.log(1 - p0));
    var chi = dev0 - fit.deviance, dfM = p - 1;
    var zc = qnorm(1 - (1 - conf) / 2);
    var warnings = [];
    var coefs = fit.beta.map(function (bj, j) {
      var se = Math.sqrt(fit.cov[j][j]), z = bj / se;
      return { name: j === 0 ? '(절편)' : names[j - 1], b: bj, se: se, z: z, wald: z * z, p: 2 * pnormUpper(Math.abs(z)),
        or: Math.exp(bj), orLow: Math.exp(bj - zc * se), orHigh: Math.exp(bj + zc * se) };
    });
    if (!fit.converged || coefs.some(function (c) { return !isFinite(c.se) || c.se > 1e3 || Math.abs(c.b) > 15; }) ||
        fit.mu.some(function (m) { return m < 1e-8 || m > 1 - 1e-8; })) {
      warnings.push('완전 분리(complete separation) 또는 준완전 분리가 의심됩니다. 계수와 표준오차가 매우 커질 수 있으니 해석에 주의하세요 (Firth 보정 로지스틱 회귀를 고려).');
    }
    var coxSnell = 1 - Math.exp(-chi / n);
    var nagelkerke = coxSnell / (1 - Math.exp(-dev0 / n));
    var mcfadden = 1 - fit.deviance / dev0;
    // Hosmer-Lemeshow: 예측확률 분위수로 집단화 (R ResourceSelection::hoslem.test 방식)
    var hl = hosmerLemeshow(y, fit.mu, hlGroups);
    var tp = 0, tn = 0, fp = 0, fn = 0;
    for (var i = 0; i < n; i++) { var pr = fit.mu[i] >= cutoff ? 1 : 0; if (pr === 1 && y[i] === 1) tp++; else if (pr === 0 && y[i] === 0) tn++; else if (pr === 1) fp++; else fn++; }
    var auc = aucROC(y, fit.mu);
    return { n: n, nEvents: n1, coefs: coefs, deviance: fit.deviance, nullDeviance: dev0, chi2: chi, dfM: dfM, pModel: pchisqUpper(chi, dfM),
      aic: fit.deviance + 2 * p, bic: fit.deviance + Math.log(n) * p, coxSnell: coxSnell, nagelkerke: nagelkerke, mcfadden: mcfadden,
      hl: hl, classification: { tp: tp, tn: tn, fp: fp, fn: fn, cutoff: cutoff, accuracy: (tp + tn) / n,
        sensitivity: tp / (tp + fn), specificity: tn / (tn + fp) }, auc: auc,
      iterations: fit.iterations, converged: fit.converged, warnings: warnings, fitted: fit.mu };
  }

  function hosmerLemeshow(y, mu, g) {
    var n = y.length, probs = [];
    for (var k = 0; k <= g; k++) probs.push(quantile(mu, k / g));
    var breaks = []; probs.forEach(function (b) { if (breaks.indexOf(b) < 0) breaks.push(b); });
    var G = breaks.length - 1, O1 = new Array(G).fill(0), E1 = new Array(G).fill(0), Nn = new Array(G).fill(0);
    for (var i = 0; i < n; i++) {
      var gi = 0;
      for (var b2 = 1; b2 < breaks.length; b2++) { if (mu[i] <= breaks[b2]) { gi = b2 - 1; break; } }
      O1[gi] += y[i]; E1[gi] += mu[i]; Nn[gi]++;
    }
    var chi = 0;
    for (var j = 0; j < G; j++) {
      if (Nn[j] === 0) continue;
      var e0 = Nn[j] - E1[j], o0 = Nn[j] - O1[j];
      chi += Math.pow(O1[j] - E1[j], 2) / E1[j] + Math.pow(o0 - e0, 2) / e0;
    }
    var df = G - 2;
    return { chi2: chi, df: df, p: df > 0 ? pchisqUpper(chi, df) : NaN, groups: G };
  }

  function aucROC(y, s) { // Mann-Whitney U 기반
    var r = rank(s), n1 = 0, sr = 0;
    for (var i = 0; i < y.length; i++) if (y[i] === 1) { n1++; sr += r[i]; }
    var n0 = y.length - n1;
    return (sr - n1 * (n1 + 1) / 2) / (n1 * n0);
  }

  /* ------------------------------------------------------------------ */
  /* 8. 신뢰도                                                            */
  /* ------------------------------------------------------------------ */

  function reliability(colsIn, names) {
    var rows = completeRows(colsIn);
    var cols = colsIn.map(function (c) { return rows.map(function (i) { return c[i]; }); });
    var k = cols.length, n = rows.length;
    function alphaOf(cs) {
      var kk = cs.length, sv = sum(cs.map(variance));
      var tot = rows.map(function (_, r) { return sum(cs.map(function (c) { return c[r]; })); });
      return kk / (kk - 1) * (1 - sv / variance(tot));
    }
    var alpha = alphaOf(cols);
    var R = corMatrix(cols, 'pearson').R, rbar = 0, cnt = 0;
    for (var i = 0; i < k; i++) for (var j = i + 1; j < k; j++) { rbar += R[i][j]; cnt++; }
    rbar /= cnt;
    var stdAlpha = k * rbar / (1 + (k - 1) * rbar);
    var total = rows.map(function (_, r) { return sum(cols.map(function (c) { return c[r]; })); });
    var items = cols.map(function (c, j) {
      var rest = total.map(function (t, r) { return t - c[r]; });
      var others = cols.filter(function (_, q) { return q !== j; });
      return { name: names[j], mean: mean(c), sd: sd(c), rCorrected: pearson(c, rest),
        alphaIfDeleted: others.length > 1 ? alphaOf(others) : NaN };
    });
    return { n: n, k: k, alpha: alpha, stdAlpha: stdAlpha, meanInterItem: rbar, items: items };
  }

  /* ------------------------------------------------------------------ */
  /* 9. 네트워크 분석 (가우시안 그래프 모형)                              */
  /* ------------------------------------------------------------------ */

  function covMatrix(cols) {
    var k = cols.length, n = cols[0].length, m = cols.map(mean), S = zeros(k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) {
      var s = 0; for (var r = 0; r < n; r++) s += (cols[i][r] - m[i]) * (cols[j][r] - m[j]);
      S[i][j] = S[j][i] = s / (n - 1);
    }
    return S;
  }
  function cov2cor(S) {
    var k = S.length, R = zeros(k, k), d = S.map(function (r, i) { return Math.sqrt(r[i]); });
    for (var i = 0; i < k; i++) for (var j = 0; j < k; j++) R[i][j] = S[i][j] / (d[i] * d[j]);
    return R;
  }

  /*
   * 그래피컬 라쏘 (Friedman, Hastie & Tibshirani, 2008)
   * penalize.diagonal = FALSE (qgraph::EBICglasso 기본값)
   * init: {W, B} 웜스타트(선택)
   */
  function glasso(S, lambda, init, opts) {
    opts = opts || {};
    var thr = opts.thr || 1e-7, maxit = opts.maxit || 10000;
    var p = S.length, W = init ? copyM(init.W) : copyM(S), B = init ? copyM(init.B) : zeros(p, p); // B[j]: 열 j의 베타 (길이 p, j위치 무시)
    var offS = 0; for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) if (i !== j) offS += Math.abs(S[i][j]);
    offS /= p * (p - 1);
    if (offS === 0) offS = 1;
    for (var d = 0; d < p; d++) W[d][d] = S[d][d];
    for (var it = 0; it < maxit; it++) {
      var dw = 0;
      for (var j2 = 0; j2 < p; j2++) {
        var beta = B[j2];
        // 좌표하강 라쏘: W11 beta = s12
        for (var inner = 0; inner < 10000; inner++) {
          var dlx = 0;
          for (var k = 0; k < p; k++) {
            if (k === j2) continue;
            var a = S[k][j2];
            for (var l = 0; l < p; l++) if (l !== j2 && l !== k) a -= W[k][l] * beta[l];
            var nb = 0;
            if (a > lambda) nb = (a - lambda) / W[k][k]; else if (a < -lambda) nb = (a + lambda) / W[k][k];
            var diff = nb - beta[k];
            if (diff !== 0) { dlx = Math.max(dlx, Math.abs(diff)); beta[k] = nb; }
          }
          if (dlx < thr * 1e-2) break;
        }
        for (var k2 = 0; k2 < p; k2++) {
          if (k2 === j2) continue;
          var w = 0; for (var l2 = 0; l2 < p; l2++) if (l2 !== j2) w += W[k2][l2] * beta[l2];
          dw += Math.abs(w - W[k2][j2]);
          W[k2][j2] = w; W[j2][k2] = w;
        }
      }
      if (dw / (p * (p - 1)) < thr * offS) break;
    }
    // 정밀도 행렬
    var K = zeros(p, p);
    for (var j3 = 0; j3 < p; j3++) {
      var s = W[j3][j3];
      for (var k3 = 0; k3 < p; k3++) if (k3 !== j3) s -= W[k3][j3] * B[j3][k3];
      var kjj = 1 / s;
      K[j3][j3] = kjj;
      for (var k4 = 0; k4 < p; k4++) if (k4 !== j3) K[k4][j3] = -B[j3][k4] * kjj;
    }
    return { W: W, K: K, B: B };
  }

  // 정밀도 행렬 → 편상관 네트워크 (qgraph::wi2net + forceSymmetric(상삼각 사용))
  function wi2net(K) {
    var p = K.length, N = zeros(p, p);
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var v = -K[i][j] / Math.sqrt(K[i][i] * K[j][j]);
      if (v === 0) v = 0; // -0 제거
      N[i][j] = N[j][i] = v;
    }
    return N;
  }

  function logGaus(S, K, n) {
    var p = S.length, tr = 0;
    for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) tr += K[i][j] * S[j][i];
    return n / 2 * (logdetPD(K) - tr);
  }

  /*
   * EBICglasso: qgraph::EBICglasso(S, n, gamma=0.5, nlambda=100, lambda.min.ratio=0.01,
   *   penalize.diagonal=FALSE, refit=FALSE, threshold=FALSE) 와 동일한 절차
   */
  function ebicGlasso(Sin, n, opts) {
    opts = opts || {};
    var gamma = opts.gamma === undefined ? 0.5 : opts.gamma, nlambda = opts.nlambda || 100, lmr = opts.lambdaMinRatio || 0.01;
    var threshold = !!opts.threshold;
    var S = cov2cor(Sin), p = S.length;
    if (!cholesky(S)) throw new Error('상관행렬이 양정치(positive definite)가 아닙니다. 변수 간 중복(완전상관)이나 사례 수 부족을 확인하세요.');
    var lmax = 0;
    for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) if (i !== j) lmax = Math.max(lmax, Math.abs(S[i][j]));
    var lmin = lmr * lmax, lambdas = [];
    for (var l = 0; l < nlambda; l++) lambdas.push(Math.exp(Math.log(lmin) + (Math.log(lmax) - Math.log(lmin)) * l / (nlambda - 1)));
    var fits = new Array(nlambda), init = null;
    for (var li = nlambda - 1; li >= 0; li--) { // 큰 λ부터 웜스타트
      var f = glasso(S, lambdas[li], init, opts);
      init = { W: f.W, B: f.B };
      var K = f.K;
      if (threshold) {
        var th = Math.log(p * (p - 1) / 2) / Math.sqrt(n);
        K = K.map(function (r) { return r.map(function (v) { return Math.abs(v) < th ? 0 : v; }); });
      }
      fits[li] = K;
    }
    var ebics = fits.map(function (K) {
      var E = 0;
      for (var i2 = 0; i2 < p; i2++) for (var j2 = 0; j2 < i2; j2++) if (K[i2][j2] !== 0) E++;
      return -2 * logGaus(S, K, n) + E * Math.log(n) + 4 * E * gamma * Math.log(p);
    });
    var opt = 0;
    for (var e = 1; e < nlambda; e++) if (ebics[e] < ebics[opt]) opt = e;
    var net = wi2net(fits[opt]);
    var notes = [];
    if (opt === 0) notes.push('가장 작은 λ의 네트워크가 선택되었습니다. 희소성(sparsity) 가정이 위배되었을 수 있습니다.');
    if (lambdas[opt] < 0.1 * lmax && !threshold) notes.push('밀집된(dense) 정규화 네트워크가 선택되었습니다 (λ < 0.1·λmax). 최근 연구에 따르면 특이도가 떨어질 수 있으니 가장 작은 엣지들의 해석에 주의하세요 (Williams & Rast, 2020).');
    if (net.every(function (r) { return r.every(function (v) { return v === 0; }); })) notes.push('빈 네트워크(엣지 없음)가 선택되었습니다.');
    return { network: net, lambda: lambdas[opt], lambdaIndex: opt, lambdas: lambdas, ebic: ebics, K: fits[opt], S: S, notes: notes };
  }

  // 비정규화 편상관 네트워크 (선택적으로 유의성 임계)
  function partialCorNetwork(Sin, n, alpha) {
    var S = cov2cor(Sin), p = S.length, K = inverse(S), net = wi2net(K), P = zeros(p, p);
    var df = n - p; // 편상관 t 검정: df = n - 2 - (p-2)
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var r = net[i][j], t = r * Math.sqrt(df / (1 - r * r));
      P[i][j] = P[j][i] = ptTwoSided(t, df);
      if (alpha && P[i][j] >= alpha) { net[i][j] = net[j][i] = 0; }
    }
    return { network: net, P: P, K: K, S: S, notes: [] };
  }

  // 중심성 (qgraph::centrality_auto와 동일 정의: 거리 = 1/|w|)
  function centrality(net) {
    var p = net.length, strength = [], ei = [], INF = Infinity;
    for (var i = 0; i < p; i++) {
      var s = 0, e = 0;
      for (var j = 0; j < p; j++) if (j !== i) { s += Math.abs(net[i][j]); e += net[i][j]; }
      strength.push(s); ei.push(e);
    }
    // 연결 성분
    var comp = new Array(p).fill(-1), cid = 0;
    for (var s0 = 0; s0 < p; s0++) {
      if (comp[s0] >= 0) continue;
      var stack = [s0]; comp[s0] = cid;
      while (stack.length) { var u = stack.pop(); for (var v = 0; v < p; v++) if (v !== u && net[u][v] !== 0 && comp[v] < 0) { comp[v] = cid; stack.push(v); } }
      cid++;
    }
    var sizes = new Array(cid).fill(0); comp.forEach(function (c) { sizes[c]++; });
    var big = sizes.indexOf(Math.max.apply(null, sizes));
    var closeness = new Array(p).fill(NaN), betw = new Array(p).fill(0);
    for (var src = 0; src < p; src++) {
      // 다익스트라 + Brandes
      var dist = new Array(p).fill(INF), sigma = new Array(p).fill(0), preds = [], done = new Array(p).fill(false), order = [];
      for (var q = 0; q < p; q++) preds.push([]);
      dist[src] = 0; sigma[src] = 1;
      for (var step = 0; step < p; step++) {
        var uu = -1, best = INF;
        for (var c = 0; c < p; c++) if (!done[c] && dist[c] < best) { best = dist[c]; uu = c; }
        if (uu < 0) break;
        done[uu] = true; order.push(uu);
        for (var vv = 0; vv < p; vv++) {
          if (vv === uu || net[uu][vv] === 0 || done[vv]) continue;
          var nd = dist[uu] + 1 / Math.abs(net[uu][vv]);
          var tol = 1e-12 * Math.max(1, nd);
          if (nd < dist[vv] - tol) { dist[vv] = nd; sigma[vv] = sigma[uu]; preds[vv] = [uu]; }
          else if (Math.abs(nd - dist[vv]) <= tol) { sigma[vv] += sigma[uu]; preds[vv].push(uu); }
        }
      }
      if (comp[src] === big && sizes[big] > 1) {
        var tot = 0; for (var t = 0; t < p; t++) if (t !== src && comp[t] === big) tot += dist[t];
        closeness[src] = 1 / tot;
      }
      var delta = new Array(p).fill(0);
      for (var oi = order.length - 1; oi >= 0; oi--) {
        var w = order[oi];
        preds[w].forEach(function (pv) { delta[pv] += sigma[pv] / sigma[w] * (1 + delta[w]); });
        if (w !== src) betw[w] += delta[w];
      }
    }
    betw = betw.map(function (b) { return b / 2; }); // 무방향: 쌍당 1회
    return { strength: strength, expectedInfluence: ei, closeness: closeness, betweenness: betw };
  }

  function zscore(arr) {
    var x = arr.filter(isNum); if (x.length < 2) return arr.map(function () { return NaN; });
    var m = mean(x), s = sd(x);
    return arr.map(function (v) { return isNum(v) ? (s > 0 ? (v - m) / s : 0) : NaN; });
  }

  // 노드 예측력 (비정규화/정규화 정밀도 행렬 기준 R² = 1 - 1/K_ii, 상관행렬 기준)
  function predictability(K) { return K.map(function (r, i) { return 1 - 1 / r[i]; }); }

  // 재현 가능한 난수 (mulberry32)
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // 데이터 행렬(행: 사례)로 네트워크 추정
  function estimateNetwork(cols, opts) {
    opts = opts || {};
    var n = cols[0].length;
    var use = opts.cor === 'spearman' ? cols.map(rank) : cols;
    var S = covMatrix(use);
    if (opts.method === 'pcor') return partialCorNetwork(S, n, opts.alpha);
    return ebicGlasso(S, n, opts);
  }

  // Fruchterman-Reingold 배치 (결정적; 원형 초기값)
  function layoutFR(net, iters) {
    iters = iters || 500;
    var p = net.length, pos = [];
    for (var i = 0; i < p; i++) pos.push([Math.cos(2 * Math.PI * i / p), Math.sin(2 * Math.PI * i / p)]);
    if (p < 2) return pos;
    var maxw = 0; for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) maxw = Math.max(maxw, Math.abs(net[a][b]));
    var area = 4, kopt = Math.sqrt(area / p), temp = 0.2;
    for (var it = 0; it < iters; it++) {
      var disp = pos.map(function () { return [0, 0]; });
      for (var u = 0; u < p; u++) for (var v = u + 1; v < p; v++) {
        var dx = pos[u][0] - pos[v][0], dy = pos[u][1] - pos[v][1], d = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-4);
        var fr = kopt * kopt / d;
        var w = maxw > 0 ? Math.abs(net[u][v]) / maxw : 0;
        var fa = w * d * d / kopt;
        var f = (fr - fa) / d;
        disp[u][0] += dx * f; disp[u][1] += dy * f; disp[v][0] -= dx * f; disp[v][1] -= dy * f;
      }
      for (var q = 0; q < p; q++) {
        // 중심으로 약한 인력 (고립 노드가 멀리 가지 않도록)
        disp[q][0] -= pos[q][0] * 0.05 * kopt; disp[q][1] -= pos[q][1] * 0.05 * kopt;
        var dl = Math.sqrt(disp[q][0] * disp[q][0] + disp[q][1] * disp[q][1]);
        if (dl > 0) { var m = Math.min(dl, temp); pos[q][0] += disp[q][0] / dl * m; pos[q][1] += disp[q][1] / dl * m; }
      }
      temp *= 0.99;
    }
    var xs = pos.map(function (p2) { return p2[0]; }), ys = pos.map(function (p2) { return p2[1]; });
    var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mny = Math.min.apply(null, ys), mxy = Math.max.apply(null, ys);
    return pos.map(function (p2) { return [(p2[0] - mnx) / ((mxx - mnx) || 1), (p2[1] - mny) / ((mxy - mny) || 1)]; });
  }

  /*
   * 네트워크 안정성 (Epskamp, Borsboom & Fried, 2018; bootnet 방식)
   * bootEdgeOnce: 사례 복원추출 후 재추정 → 엣지 벡터(상삼각)
   * caseDropOnce: 사례의 prop 비율을 제거 후 재추정 → 중심성
   */
  function subsetCols(cols, idx) { return cols.map(function (c) { return idx.map(function (i) { return c[i]; }); }); }
  function upperVec(m) { var v = []; for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) v.push(m[i][j]); return v; }
  function bootEdgeOnce(cols, opts, rand) {
    var n = cols[0].length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var net = estimateNetwork(subsetCols(cols, idx), opts).network;
    return { edges: upperVec(net), centrality: centrality(net) };
  }
  function caseDropOnce(cols, opts, prop, rand) {
    var n = cols[0].length, keep = Math.round(n * (1 - prop)), idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    for (var k = n - 1; k > 0; k--) { var r = Math.floor(rand() * (k + 1)), t = idx[k]; idx[k] = idx[r]; idx[r] = t; }
    idx = idx.slice(0, keep).sort(function (a, b) { return a - b; });
    return centrality(estimateNetwork(subsetCols(cols, idx), opts).network);
  }
  // CS 계수: 상관 ≥ cor 인 표본이 certainty 이상인 최대 제거비율
  function csCoefficient(props, corrsByProp, cor, certainty) {
    cor = cor || 0.7; certainty = certainty || 0.95;
    var cs = 0;
    props.forEach(function (p, i) {
      var arr = corrsByProp[i].filter(isNum);
      if (!arr.length) return;
      var ok = arr.filter(function (r) { return r >= cor; }).length / arr.length;
      if (ok >= certainty) cs = Math.max(cs, p);
    });
    return cs;
  }

  return {
    // 분포
    lgamma: lgamma, ibeta: ibeta, gammaP: gammaP, gammaQ: gammaQ,
    pnorm: pnorm, qnorm: qnorm, pt: pt, ptTwoSided: ptTwoSided, qt: qt, pfUpper: pfUpper, qf: qf,
    pchisq: pchisq, pchisqUpper: pchisqUpper, qchisq: qchisq, ptukey: ptukey,
    // 행렬
    inverse: inverse, cholesky: cholesky, eigenSym: eigenSym, matmul: matmul, transpose: transpose, logdetPD: logdetPD,
    // 기초
    isNum: isNum, clean: clean, mean: mean, sd: sd, variance: variance, quantile: quantile, quantileSPSS: quantileSPSS, rank: rank,
    pearson: pearson, completeRows: completeRows, descriptives: descriptives, shapiroWilk: shapiroWilk,
    // 검정
    tTestOneSample: tTestOneSample, tTestPaired: tTestPaired, tTestIndependent: tTestIndependent, leveneTest: leveneTest,
    anovaOneway: anovaOneway, corTest: corTest, corMatrix: corMatrix, crosstab: crosstab, fisherExact2x2: fisherExact2x2,
    linearRegression: linearRegression, logisticRegression: logisticRegression, reliability: reliability,
    // 네트워크
    covMatrix: covMatrix, cov2cor: cov2cor, glasso: glasso, ebicGlasso: ebicGlasso, partialCorNetwork: partialCorNetwork,
    wi2net: wi2net, centrality: centrality, zscore: zscore, predictability: predictability, estimateNetwork: estimateNetwork,
    layoutFR: layoutFR, rng: rng, upperVec: upperVec, bootEdgeOnce: bootEdgeOnce, caseDropOnce: caseDropOnce,
    csCoefficient: csCoefficient
  };
});
