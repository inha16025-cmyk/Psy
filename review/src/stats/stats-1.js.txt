/*
 * PsyStat 통계 엔진 (stats) — 조각 1/4: 특수함수·분포·행렬·기초통계·검정·회귀·신뢰도
 * 외부 라이브러리·네트워크 통신 없음. 순수 JavaScript.
 * 조각들은 G.__PsyStatsNS 로 함수를 공유하며, 마지막 조각이 G.PsyStats 를 만든다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 계산 코드는 분할 전과 동일)
 */
(function (G) {
  'use strict';
  var NS = G.__PsyStatsNS || (G.__PsyStatsNS = {});

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
    var n1 = sum(y), p0 = n1 / n;
    if (n1 === 0 || n1 === n) throw new Error('종속변수가 한 범주뿐입니다 (사건=1: ' + n1 + '명 / 전체 ' + n + '명). "사건(=1)으로 볼 범주" 선택과 자료의 코딩(공백·숫자/문자 혼용 등)을 확인하세요.');
    var fit = logisticIRLS(X, y);
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

  // 다음 조각으로 내보내기
  NS.LANCZOS = LANCZOS; NS.lgamma = lgamma; NS.betacf = betacf; NS.ibeta = ibeta; NS.gammaP = gammaP; NS.gammaQcf = gammaQcf; NS.gammaQ = gammaQ; NS.pnorm = pnorm;
  NS.pnormUpper = pnormUpper; NS.qnorm = qnorm; NS.pt = pt; NS.ptTwoSided = ptTwoSided; NS.pfUpper = pfUpper; NS.pchisqUpper = pchisqUpper; NS.pchisq = pchisq; NS.invertCdf = invertCdf;
  NS.qt = qt; NS.qchisq = qchisq; NS.qf = qf; NS.wprob = wprob; NS.ptukey = ptukey; NS.zeros = zeros; NS.identity = identity; NS.transpose = transpose;
  NS.matmul = matmul; NS.copyM = copyM; NS.cholesky = cholesky; NS.logdetPD = logdetPD; NS.inverse = inverse; NS.eigenSym = eigenSym; NS.qrLeastSquares = qrLeastSquares; NS.isNum = isNum;
  NS.clean = clean; NS.sum = sum; NS.mean = mean; NS.variance = variance; NS.sd = sd; NS.sortNum = sortNum; NS.quantile = quantile; NS.quantileSPSS = quantileSPSS;
  NS.rank = rank; NS.pearson = pearson; NS.shapiroWilk = shapiroWilk; NS.descriptives = descriptives; NS.leveneTest = leveneTest; NS.onewayCore = onewayCore; NS.tTestOneSample = tTestOneSample; NS.tTestPaired = tTestPaired;
  NS.tTestIndependent = tTestIndependent; NS.anovaOneway = anovaOneway; NS.corTest = corTest; NS.corMatrix = corMatrix; NS.completeRows = completeRows; NS.lchoose = lchoose; NS.fisherExact2x2 = fisherExact2x2; NS.crosstab = crosstab;
  NS.linearRegression = linearRegression; NS.logisticIRLS = logisticIRLS; NS.devianceLogit = devianceLogit; NS.logisticRegression = logisticRegression; NS.hosmerLemeshow = hosmerLemeshow; NS.aucROC = aucROC; NS.reliability = reliability;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
