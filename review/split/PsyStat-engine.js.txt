/* PsyStat 0.9.2 \uACC4\uC0B0 \uC5D4\uC9C4 \u2014 PsyStat.html\uACFC
  \uAC19\uC740 \uD3F4\uB354\uC5D0 \uB450\uC138\uC694 */
/*
 * PsyStat \uD1B5\uACC4 \uC5D4\uC9C4 (stats) \u2014 \uC870\uAC01 1/4:
  \uD2B9\uC218\uD568\uC218\u00B7\uBD84\uD3EC\u00B7\uD589\uB82C\u00B7\uAE30
  \uCD08\uD1B5\uACC4\u00B7\uAC80\uC815\u00B7\uD68C\uADC0\u00B7\uC2E0\uB8B0
  \uB3C4
 * \uC678\uBD80 \uB77C\uC774\uBE0C\uB7EC\uB9AC\u00B7\uB124\uD2B8\uC6CC\uD06C
  \uD1B5\uC2E0 \uC5C6\uC74C. \uC21C\uC218 JavaScript.
 * \uC870\uAC01\uB4E4\uC740 G.__PsyStatsNS \uB85C \uD568\uC218\uB97C
  \uACF5\uC720\uD558\uBA70, \uB9C8\uC9C0\uB9C9 \uC870\uAC01\uC774 G.PsyStats
  \uB97C \uB9CC\uB4E0\uB2E4.
 * (\uC804\uC1A1 \uC2DC\uC2A4\uD15C\uC758 \uC2A4\uD06C\uB9BD\uD2B8
  \uBE14\uB85D \uD06C\uAE30 \uC81C\uD55C \uB54C\uBB38\uC5D0 \uB098\uB214;
  \uACC4\uC0B0 \uCF54\uB4DC\uB294 \uBD84\uD560 \uC804\uACFC \uB3D9\uC77C)
 */
(function (G) {
  'use strict';
  var NS = G.__PsyStatsNS || (G.__PsyStatsNS = {});

  /* ------------------------------------------------------------------ */
  /* 1. \uD2B9\uC218\uD568\uC218                                            
                 */
  /* ------------------------------------------------------------------ */

  var LANCZOS = [0.99999999999980993, 676.5203681218851,
    -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x)))
      - lgamma(1 - x);
    x -= 1;
    var a = LANCZOS[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t +
      Math.log(a);
  }

  // \uC815\uCE59\uD654 \uBD88\uC644\uC804 \uBCA0\uD0C0\uD568\uC218 I_x(a,b)
  // (Lentz \uC5F0\uBD84\uC218)
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
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(
      x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }

  // \uC815\uCE59\uD654 \uBD88\uC644\uC804 \uAC10\uB9C8\uD568\uC218 P(a,x),
  // Q(a,x)
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
  /* 2. \uD655\uB960\uBD84\uD3EC                                            
                 */
  /* ------------------------------------------------------------------ */

  // \uD45C\uC900\uC815\uADDC \uB204\uC801: \uC704\uAF2C\uB9AC = 0.5*Q(1/2,
  // z^2/2)
  function pnorm(z) {
    if (!isFinite(z)) return z > 0 ? 1 : 0;
    var q = 0.5 * gammaQ(0.5, z * z / 2);
    return z >= 0 ? 1 - q : q;
  }
  function pnormUpper(z) { return pnorm(-z); }

  // \uC815\uADDC\uBD84\uC704\uC218: Acklam \uADFC\uC0AC + Halley
  // \uBCF4\uC815
  function qnorm(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02,
      -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01,
      2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02,
      -1.556989798598866e+02, 6.680131188771972e+01,
      -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00,
      2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01,
      2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[
        5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[
        5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4])
        * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    for (var it = 0; it < 2; it++) {
      var e = pnorm(x) - p;
      var u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
      x = x - u / (1 + x * u / 2);
    }
    return x;
  }

  // t \uBD84\uD3EC: \uB204\uC801 P(T <= t)
  function pt(t, df) {
    if (!isFinite(t)) return t > 0 ? 1 : 0;
    var x = df / (df + t * t);
    var tail = 0.5 * ibeta(x, df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
  }
  function ptTwoSided(t, df) { return ibeta(df / (df + t * t), df / 2, 0.5);
    }
  // F \uBD84\uD3EC \uC704\uAF2C\uB9AC
  function pfUpper(f, d1, d2) {
    if (!(f > 0)) return 1;
    return ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
  }
  function pchisqUpper(x, df) { return x <= 0 ? 1 : gammaQ(df / 2, x / 2); }
  function pchisq(x, df) { return x <= 0 ? 0 : gammaP(df / 2, x / 2); }

  // \uB2E8\uC870 \uB204\uC801\uBD84\uD3EC\uC758 \uC5ED\uD568\uC218
  // (\uC774\uBD84\uBC95; \uC815\uBC00\uB3C4 ~1e-13)
  function invertCdf(cdf, p, lo, hi) {
    while (cdf(hi) < p) { lo = hi; hi *= 2; if (hi > 1e12) break; }
    while (cdf(lo) > p) { hi = lo; lo = lo < 0 ? lo * 2 : lo - Math.max(1,
      Math.abs(lo)); if (lo < -1e12) break; }
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
  function qchisq(p, df) { return invertCdf(function (x) { return pchisq(x,
    df); }, p, 0, Math.max(1, df * 3)); }
  function qf(p, d1, d2) { return invertCdf(function (x) { return 1 -
    pfUpper(x, d1, d2); }, p, 0, 10); }

  // \uC2A4\uD29C\uB358\uD2B8\uD654 \uBC94\uC704 \uBD84\uD3EC (R\uC758
  // ptukey.c \uC774\uC2DD; Copenhaver & Holland, 1988)
  function wprob(w, rr, cc) {
    var nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3,
      wincr1 = 2, wincr2 = 3;
    var xleg = [0.981560634246719250690549090149,
      0.904117256370474856678465866119, 0.769902674194304687036893833213,
      0.587317954286617447296702418941, 0.367831498998180193752691536644,
        0.125233408511468915472441369464];
    var aleg = [0.047175336386511827194615961485,
      0.106939325995318430960254718194, 0.160078328543346226334652529543,
      0.203167426723065921749064455810, 0.233492536538354808760849898925,
        0.249147045813402785000562436043];
    var qsqz = w * 0.5;
    if (qsqz >= bb) return 1.0;
    var pr_w = 2 * pnorm(qsqz) - 1;
    if (pr_w >= Math.exp(C2 / cc)) pr_w = Math.pow(pr_w, cc); else pr_w = 0;
    var wincr = w > wlar ? wincr1 : wincr2;
    var blb = qsqz, binc = (bb - qsqz) / wincr, bub = blb + binc, einsum =
      0, cc1 = cc - 1;
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
          rinsum = (aleg[j - 1] * Math.exp(-(0.5 * qexpo))) * Math.pow(
            rinsum, cc1);
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
    var nlegq = 16, ihalfq = 8, eps1 = -30.0, eps2 = 1.0e-14, dhaf = 100,
      dquar = 800, deigh = 5000, dlarg = 25000;
    var xlegq = [0.989400934991649932596154173450,
      0.944575023073232576077988415535, 0.865631202387831743880467897712,
      0.755404408355003033895101194847, 0.617876244402643748446671764049,
        0.458016777657227386342419442984,
      0.281603550779258913230460501460,
        0.950125098376374401853193354250e-1];
    var alegq = [0.271524594117540948517805724560e-1,
      0.622535239386478928628438369944e-1,
      0.951585116824927848099251076022e-1,
      0.124628971255533872052476282192, 0.149595988816576732081501730547,
        0.169156519395002538189312079030,
      0.182603415044923588866763667969, 0.189450610455068496285396723208];
    if (q <= 0) return 0;
    if (!isFinite(q)) return 1;
    if (df > dlarg) return wprob(q, rr, cc);
    var f2 = df * 0.5;
    var f2lf = ((f2 * Math.log(df)) - (df * Math.LN2)) - lgamma(f2);
    var f21 = f2 - 1.0, ff4 = df * 0.25, ulen;
    if (df <= dhaf) ulen = 1; else if (df <= dquar) ulen = 0.5; else if (df
      <= deigh) ulen = 0.25; else ulen = 0.125;
    f2lf += Math.log(ulen);
    var ans = 0, otsum = 0;
    for (var i = 1; i <= 50; i++) {
      otsum = 0;
      var twa1 = (2 * i - 1) * ulen;
      for (var jj = 1; jj <= nlegq; jj++) {
        var j, t1;
        if (ihalfq < jj) {
          j = jj - ihalfq - 1;
          t1 = (f2lf + (f21 * Math.log(twa1 + (xlegq[j] * ulen)))) - (((
            xlegq[j] * ulen) + twa1) * ff4);
        } else {
          j = jj - 1;
          t1 = (f2lf + (f21 * Math.log(twa1 - (xlegq[j] * ulen)))) + (((
            xlegq[j] * ulen) - twa1) * ff4);
        }
        if (t1 >= eps1) {
          var qsqz;
          if (ihalfq < jj) qsqz = q * Math.sqrt(((xlegq[j] * ulen) + twa1) *
            0.5);
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
  /* 3. \uD589\uB82C \uC720\uD2F8\uB9AC\uD2F0                               
                         */
  /* ------------------------------------------------------------------ */

  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) { m.push(
    new Array(c).fill(0)); } return m; }
  function identity(n) { var m = zeros(n, n); for (var i = 0; i < n; i++) m[
    i][i] = 1; return m; }
  function transpose(A) { var r = A.length, c = A[0].length, T = zeros(c,
    r); for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) T[j][i] = A[
    i][j]; return T; }
  function matmul(A, B) {
    var r = A.length, k = B.length, c = B[0].length, C = zeros(r, c);
    for (var i = 0; i < r; i++) for (var l = 0; l < k; l++) { var a = A[i][
      l]; if (a === 0) continue; for (var j = 0; j < c; j++) C[i][j] += a *
      B[l][j]; }
    return C;
  }
  function copyM(A) { return A.map(function (r) { return r.slice(); }); }

  // \uCD10\uB808\uC2A4\uD0A4 \uBD84\uD574 (\uC591\uC815\uCE58
  // \uD655\uC778\uC6A9). \uC2E4\uD328 \uC2DC null
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
  function logdetPD(A) { var L = cholesky(A); if (!L) return NaN; var s = 0;
    for (var i = 0; i < A.length; i++) s += Math.log(L[i][i]); return 2 * s;
    }

  // \uC5ED\uD589\uB82C (\uBD80\uBD84 \uD53C\uBC97
  // \uAC00\uC6B0\uC2A4-\uC870\uB358)
  function inverse(A) {
    var n = A.length, M = A.map(function (r, i) { var e = new Array(n).fill(
      0); e[i] = 1; return r.concat(e); });
    for (var c = 0; c < n; c++) {
      var p = c, best = Math.abs(M[c][c]);
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > best) { best =
        Math.abs(M[r][c]); p = r; }
      if (best < 1e-14) throw new Error(
        ('\uD589\uB82C\uC774 \uD2B9\uC774(singular)\uD569\uB2C8'
        + '\uB2E4. \uBCC0\uC218 \uAC04 \uC644\uC804\uD55C \uACF5'
        + '\uC120\uC131\uC774 \uC788\uB294\uC9C0 \uD655\uC778\uD558'
        + '\uC138\uC694.'));
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

  // \uB300\uCE6D\uD589\uB82C \uACE0\uC720\uAC12 (\uC57C\uCF54\uBE44
  // \uBC29\uBC95)
  function eigenSym(A) {
    var n = A.length, a = copyM(A), v = identity(n);
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) off += a[
        i][j] * a[i][j];
      if (off < 1e-22) break;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        var theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta *
          theta + 1));
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
    var idx = vals.map(function (x, i) { return i; }).sort(function (x, y) {
      return vals[y] - vals[x]; });
    return { values: idx.map(function (i) { return vals[i]; }), vectors:
      v.map(function (row) { return idx.map(function (i) { return row[i];
      }); }) };
  }

  // \uD558\uC6B0\uC2A4\uD640\uB354 QR \uCD5C\uC18C\uC81C\uACF1. X: n\u00D7p
  // (\uD589 \uC6B0\uC120)
  function qrLeastSquares(X, y) {
    var n = X.length, p = X[0].length;
    var A = copyM(X), b = y.slice();
    var rdiag = new Array(p);
    for (var k = 0; k < p; k++) {
      var nrm = 0;
      for (var i = k; i < n; i++) nrm = Math.hypot(nrm, A[i][k]);
      if (nrm === 0) throw new Error(
        ('\uC124\uACC4\uD589\uB82C\uC758 \uACC4\uC218\uAC00 \uBD80'
        + '\uC871\uD569\uB2C8\uB2E4 (\uC644\uC804\uD55C \uACF5'
        + '\uC120\uC131).'));
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
    for (var kk = 0; kk < p; kk++) if (Math.abs(rdiag[kk]) < 1e-10 * maxd)
      throw new Error(
      ('\uC124\uACC4\uD589\uB82C\uC758 \uACC4\uC218\uAC00 \uBD80'
      + '\uC871\uD569\uB2C8\uB2E4 (\uC644\uC804\uD55C \uACF5\uC120'
      + '\uC131).'));
    var beta = new Array(p);
    for (var k2 = p - 1; k2 >= 0; k2--) {
      var t = b[k2];
      for (var j2 = k2 + 1; j2 < p; j2++) t -= A[k2][j2] * beta[j2];
      beta[k2] = t / rdiag[k2];
    }
    // R \uC0C1\uC0BC\uAC01 \u2192 (R'R)^-1 = R^-1 R^-T
    var R = zeros(p, p);
    for (var r = 0; r < p; r++) { R[r][r] = rdiag[r]; for (var c = r + 1; c
      < p; c++) R[r][c] = A[r][c]; }
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
  /* 4. \uAE30\uCD08 \uD1B5\uACC4                                           
                 */
  /* ------------------------------------------------------------------ */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clean(x) { return x.filter(isNum); }
  function sum(x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i];
    return s; }
  function mean(x) { return sum(x) / x.length; }
  function variance(x) {
    var m = mean(x), s = 0;
    for (var i = 0; i < x.length; i++) s += (x[i] - m) * (x[i] - m);
    return s / (x.length - 1);
  }
  function sd(x) { return Math.sqrt(variance(x)); }
  function sortNum(x) { return x.slice().sort(function (a, b) { return a -
    b; }); }
  // R type 7 \uBD84\uC704\uC218
  function quantile(x, p) {
    var s = sortNum(x), n = s.length, h = (n - 1) * p, lo = Math.floor(h),
      hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  // SPSS \uAE30\uBCF8(\uAC00\uC911\uD3C9\uADE0, type 6) \uBD84\uC704\uC218
  function quantileSPSS(x, p) {
    var s = sortNum(x), n = s.length, h = (n + 1) * p;
    if (h <= 1) return s[0];
    if (h >= n) return s[n - 1];
    var lo = Math.floor(h);
    return s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
  }
  function rank(x) { // \uB3D9\uC21C\uC704 \uD3C9\uADE0
    var idx = x.map(function (v, i) { return i; }).sort(function (a, b) {
      return x[a] - x[b]; });
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
    for (var i = 0; i < x.length; i++) { var dx = x[i] - mx, dy = y[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxy / Math.sqrt(sxx * syy);
  }

  // Shapiro-Wilk W (Royston, 1995; AS R94 \u2014 R\uC758 swilk.c\uC640
  // \uB3D9\uC77C \uC54C\uACE0\uB9AC\uC998)
  function shapiroWilk(xin) {
    var x = sortNum(clean(xin)), n = x.length;
    if (n < 3 || n > 5000) return { W: NaN, p: NaN };
    if (x[n - 1] - x[0] < 1e-12) return { W: NaN, p: NaN };
    function poly(cc, xx) { var r = cc[0]; if (cc.length > 1) { var p = xx *
      cc[cc.length - 1]; for (var j = cc.length - 2; j > 0; j--) p = (p +
      cc[j]) * xx; r += p; } return r; }
    var nn2 = Math.floor(n / 2), a = new Array(nn2 + 1), an = n;
    var g = [-2.273, 0.459], c1 = [0, 0.221157, -0.147981, -2.07119,
      4.434685, -2.706056], c2 = [0, 0.042981, -0.293762, -1.752461,
      5.682633, -3.582633];
    var c3 = [0.544, -0.39978, 0.025054, -6.714e-4], c4 = [1.3822, -0.77857,
      0.062767, -0.0020322], c5 = [-1.5861, -0.31082, -0.083751, 0.0038915],
      c6 = [-0.4803, -0.082676, 0.0030302];
    if (n === 3) a[1] = Math.SQRT1_2;
    else {
      var an25 = an + 0.25, summ2 = 0, m = new Array(nn2 + 1);
      for (var i = 1; i <= nn2; i++) { m[i] = qnorm((i - 0.375) / an25);
        summ2 += m[i] * m[i]; }
      summ2 *= 2;
      var ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(an), a1 = poly(c1,
        rsn) - m[1] / ssumm2, i1, fac;
      if (n > 5) {
        i1 = 3;
        var a2 = -m[2] / ssumm2 + poly(c2, rsn);
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2
          * a1 * a1 - 2 * a2 * a2));
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
    for (var i = 0; i < n; i++) { var d = x[i] - m; m2 += d * d; m3 += d * d
      * d; m4 += d * d * d * d; }
    m2 /= n; m3 /= n; m4 /= n;
    // SPSS/Excel \uBC29\uC2DD \uD45C\uBCF8
    // \uC65C\uB3C4\u00B7\uCCA8\uB3C4(G1, G2)\uC640 \uD45C\uC900\uC624\uCC28
    var g1 = m3 / Math.pow(m2, 1.5), g2 = m4 / (m2 * m2) - 3;
    var G1 = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : NaN;
    var G2 = n > 3 ? ((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3)) :
      NaN;
    var seSkew = n > 2 ? Math.sqrt(6 * n * (n - 1) / ((n - 2) * (n + 1) * (n
      + 3))) : NaN;
    var seKurt = n > 3 ? 2 * seSkew * Math.sqrt((n * n - 1) / ((n - 3) * (n
      + 5))) : NaN;
    var sw = n >= 3 ? shapiroWilk(x) : { W: NaN, p: NaN };
    return {
      n: n, missing: miss, mean: m, sd: s, se: s / Math.sqrt(n), median:
        quantile(x, 0.5),
      min: Math.min.apply(null, x), max: Math.max.apply(null, x),
      q1: quantile(x, 0.25), q3: quantile(x, 0.75),
      skew: G1, seSkew: seSkew, kurt: G2, seKurt: seKurt, swW: sw.W, swP:
        sw.p
    };
  }

  /* ------------------------------------------------------------------ */
  /* 5. t \uAC80\uC815 / \uBD84\uC0B0\uBD84\uC11D                           
                         */
  /* ------------------------------------------------------------------ */

  function leveneTest(groups, center) {
    // center: 'mean'(SPSS) | 'median'(Brown-Forsythe, R car \uAE30\uBCF8)
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
    var dfB = k - 1, dfW = N - k, msb = ssb / dfB, msw = ssw / dfW, F = msb
      / msw;
    return { k: k, N: N, ssb: ssb, ssw: ssw, sst: ssb + ssw, dfB: dfB, dfW:
      dfW, msb: msb, msw: msw, F: F, p: pfUpper(F, dfB, dfW) };
  }

  function tTestOneSample(xin, mu, conf) {
    conf = conf || 0.95;
    var x = clean(xin), n = x.length, m = mean(x), s = sd(x), se = s /
      Math.sqrt(n), df = n - 1;
    var t = (m - mu) / se, tc = qt(1 - (1 - conf) / 2, df);
    return { n: n, mean: m, sd: s, se: se, t: t, df: df, p: ptTwoSided(t,
      df), diff: m - mu,
      ciLow: m - mu - tc * se, ciHigh: m - mu + tc * se, d: (m - mu) / s };
  }

  function tTestPaired(xin, yin, conf) {
    conf = conf || 0.95;
    var x = [], y = [];
    for (var i = 0; i < xin.length; i++) if (isNum(xin[i]) && isNum(yin[i]))
      { x.push(xin[i]); y.push(yin[i]); }
    var d = x.map(function (v, i) { return v - y[i]; });
    var n = d.length, md = mean(d), sdd = sd(d), se = sdd / Math.sqrt(n), df
      = n - 1, t = md / se;
    var tc = qt(1 - (1 - conf) / 2, df);
    return { n: n, mean1: mean(x), mean2: mean(y), sd1: sd(x), sd2: sd(y),
      r: pearson(x, y),
      meanDiff: md, sdDiff: sdd, se: se, t: t, df: df, p: ptTwoSided(t, df),
      ciLow: md - tc * se, ciHigh: md + tc * se, dz: md / sdd };
  }

  function tTestIndependent(g1in, g2in, conf) {
    conf = conf || 0.95;
    var a = clean(g1in), b = clean(g2in), n1 = a.length, n2 = b.length;
    var m1 = mean(a), m2 = mean(b), v1 = variance(a), v2 = variance(b), diff
      = m1 - m2;
    var sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    var seS = Math.sqrt(sp2 * (1 / n1 + 1 / n2)), dfS = n1 + n2 - 2, tS =
      diff / seS;
    var seW = Math.sqrt(v1 / n1 + v2 / n2);
    var dfW = Math.pow(v1 / n1 + v2 / n2, 2) / (Math.pow(v1 / n1, 2) / (n1 -
      1) + Math.pow(v2 / n2, 2) / (n2 - 1));
    var tW = diff / seW, cS = qt(1 - (1 - conf) / 2, dfS), cW = qt(1 - (1 -
      conf) / 2, dfW);
    var d = diff / Math.sqrt(sp2);
    var J = 1 - 3 / (4 * (n1 + n2) - 9); // Hedges g \uBCF4\uC815
    return {
      n1: n1, n2: n2, mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2:
        Math.sqrt(v2), diff: diff,
      student: { t: tS, df: dfS, p: ptTwoSided(tS, dfS), se: seS, ciLow:
        diff - cS * seS, ciHigh: diff + cS * seS },
      welch: { t: tW, df: dfW, p: ptTwoSided(tW, dfW), se: seW, ciLow: diff
        - cW * seW, ciHigh: diff + cW * seW },
      levene: leveneTest([a, b], 'mean'), d: d, g: d * J
    };
  }

  function anovaOneway(groupsIn, labels) {
    var groups = groupsIn.map(clean);
    var core = onewayCore(groups), k = core.k;
    var desc = groups.map(function (g, i) { return { label: labels[i], n:
      g.length, mean: mean(g), sd: sd(g) }; });
    var eta2 = core.ssb / core.sst;
    var omega2 = (core.ssb - core.dfB * core.msw) / (core.sst + core.msw);
    // Welch ANOVA
    var w = groups.map(function (g) { return g.length / variance(g); }), sw
      = sum(w);
    var mw = sum(groups.map(function (g, i) { return w[i] * mean(g); })) /
      sw;
    var A = sum(groups.map(function (g, i) { return w[i] * Math.pow(mean(g)
      - mw, 2); })) / (k - 1);
    var lam = sum(groups.map(function (g, i) { return Math.pow(1 - w[i] /
      sw, 2) / (g.length - 1); }));
    var B = 1 + 2 * (k - 2) / (k * k - 1) * lam;
    var Fw = A / B, df2w = (k * k - 1) / (3 * lam);
    // \uC0AC\uD6C4\uAC80\uC815
    var posthoc = [];
    for (var i = 0; i < k; i++) for (var j = i + 1; j < k; j++) {
      var gi = groups[i], gj = groups[j], ni = gi.length, nj = gj.length, d
        = mean(gi) - mean(gj);
      var seT = Math.sqrt(core.msw / 2 * (1 / ni + 1 / nj));
      var qT = Math.abs(d) / seT;
      var pT = 1 - ptukey(qT, k, core.dfW);
      var seB = Math.sqrt(core.msw * (1 / ni + 1 / nj)), tB = d / seB;
      var pB = Math.min(1, ptTwoSided(tB, core.dfW) * k * (k - 1) / 2);
      var vi = variance(gi) / ni, vj = variance(gj) / nj;
      var dfGH = Math.pow(vi + vj, 2) / (vi * vi / (ni - 1) + vj * vj / (nj
        - 1));
      var qGH = Math.abs(d) / Math.sqrt((vi + vj) / 2);
      var pGH = 1 - ptukey(qGH, k, dfGH);
      posthoc.push({ a: labels[i], b: labels[j], diff: d, se: seB, pTukey:
        Math.max(0, pT), pBonf: pB, pGH: Math.max(0, pGH) });
    }
    return {
      desc: desc, ssb: core.ssb, ssw: core.ssw, sst: core.sst, dfB:
        core.dfB, dfW: core.dfW, msb: core.msb, msw: core.msw,
      F: core.F, p: core.p, eta2: eta2, omega2: omega2,
      welch: { F: Fw, df1: k - 1, df2: df2w, p: pfUpper(Fw, k - 1, df2w) },
      levene: leveneTest(groups, 'mean'), posthoc: posthoc
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. \uC0C1\uAD00 / \uAD50\uCC28\uBD84\uC11D                             
                         */
  /* ------------------------------------------------------------------ */

  function corTest(xin, yin, method, conf) {
    conf = conf || 0.95;
    var x = [], y = [];
    for (var i = 0; i < xin.length; i++) if (isNum(xin[i]) && isNum(yin[i]))
      { x.push(xin[i]); y.push(yin[i]); }
    var n = x.length;
    if (method === 'spearman') { x = rank(x); y = rank(y); }
    var r = pearson(x, y), df = n - 2, t = r * Math.sqrt(df / (1 - r * r));
    var p = Math.abs(r) >= 1 ? 0 : ptTwoSided(t, df);
    var z = 0.5 * Math.log((1 + r) / (1 - r)), se = 1 / Math.sqrt(n - 3), zc
      = qnorm(1 - (1 - conf) / 2);
    return { r: r, n: n, t: t, df: df, p: p, ciLow: Math.tanh(z - zc * se),
      ciHigh: Math.tanh(z + zc * se) };
  }

  function corMatrix(cols, method, missing) {
    var k = cols.length, rows;
    if (missing !== 'pairwise') {
      rows = completeRows(cols);
      cols = cols.map(function (c) { return rows.map(function (i) {
        return c[i]; }); });
    }
    var R = zeros(k, k), P = zeros(k, k), N = zeros(k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) {
      if (i === j) { R[i][i] = 1; P[i][i] = 0; N[i][i] = clean(cols[
        i]).length; continue; }
      var ct = corTest(cols[i], cols[j], method);
      R[i][j] = R[j][i] = ct.r; P[i][j] = P[j][i] = ct.p; N[i][j] = N[j][i]
        = ct.n;
    }
    return { R: R, P: P, N: N };
  }

  function completeRows(cols) {
    var n = cols[0].length, out = [];
    for (var i = 0; i < n; i++) { var ok = true; for (var j = 0; j <
      cols.length; j++) if (!isNum(cols[j][i])) { ok = false; break; } if (
      ok) out.push(i); }
    return out;
  }

  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n -
    k + 1); }
  function fisherExact2x2(a, b, c, d) {
    var r1 = a + b, c1 = a + c, n = a + b + c + d;
    var lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1);
    function dh(x) { return Math.exp(lchoose(c1, x) + lchoose(n - c1, r1 -
      x) - lchoose(n, r1)); }
    var pobs = dh(a), p = 0;
    for (var x = lo; x <= hi; x++) { var px = dh(x); if (px <= pobs * (1 +
      1e-7)) p += px; }
    return Math.min(1, p);
  }

  function crosstab(rowVar, colVar) {
    var rl = [], cl = [], pairs = [];
    for (var i = 0; i < rowVar.length; i++) {
      var r = rowVar[i], c = colVar[i];
      if (r === null || r === undefined || r === '' || c === null || c ===
        undefined || c === '') continue;
      if (typeof r === 'number' && !isFinite(r)) continue;
      if (typeof c === 'number' && !isFinite(c)) continue;
      pairs.push([String(r), String(c)]);
    }
    function sortLabels(arr) { return arr.sort(function (a, b) { var na =
      Number(a), nb = Number(b); if (!isNaN(na) && !isNaN(nb)) return na -
      nb; return a < b ? -1 : a > b ? 1 : 0; }); }
    pairs.forEach(function (p) { if (rl.indexOf(p[0]) < 0) rl.push(p[0]); if
      (cl.indexOf(p[1]) < 0) cl.push(p[1]); });
    sortLabels(rl); sortLabels(cl);
    var O = zeros(rl.length, cl.length);
    pairs.forEach(function (p) { O[rl.indexOf(p[0])][cl.indexOf(p[1])]++;
      });
    var n = pairs.length, rs = O.map(sum), cs = cl.map(function (_, j) {
      return sum(O.map(function (r) { return r[j]; })); });
    var E = zeros(rl.length, cl.length), chi = 0, g2 = 0, lowE = 0;
    for (var a = 0; a < rl.length; a++) for (var b = 0; b < cl.length; b++)
      {
      E[a][b] = rs[a] * cs[b] / n;
      if (E[a][b] < 5) lowE++;
      chi += Math.pow(O[a][b] - E[a][b], 2) / E[a][b];
      if (O[a][b] > 0) g2 += 2 * O[a][b] * Math.log(O[a][b] / E[a][b]);
    }
    var df = (rl.length - 1) * (cl.length - 1);
    var res = { rows: rl, cols: cl, O: O, E: E, rowSums: rs, colSums: cs, n:
      n, chi2: chi, df: df, p: pchisqUpper(chi, df),
      G2: g2, pG2: pchisqUpper(g2, df), cramerV: Math.sqrt(chi / (n * (
        Math.min(rl.length, cl.length) - 1))),
      lowExpected: lowE, cells: rl.length * cl.length };
    if (rl.length === 2 && cl.length === 2) {
      var A = O[0][0], B = O[0][1], C = O[1][0], D = O[1][1];
      var yates = 0;
      for (var a2 = 0; a2 < 2; a2++) for (var b2 = 0; b2 < 2; b2++) yates +=
        Math.pow(Math.max(0, Math.abs(O[a2][b2] - E[a2][b2]) - 0.5), 2) / E[
        a2][b2];
      res.yates = { chi2: yates, p: pchisqUpper(yates, 1) };
      res.fisherP = fisherExact2x2(A, B, C, D);
      res.phi = (A * D - B * C) / Math.sqrt(rs[0] * rs[1] * cs[0] * cs[1]);
      res.oddsRatio = (A * D) / (B * C);
    }
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* 7. \uD68C\uADC0\uBD84\uC11D                                            
                 */
  /* ------------------------------------------------------------------ */

  function linearRegression(yin, Xcols, names, conf) {
    conf = conf || 0.95;
    var rows = completeRows([yin].concat(Xcols));
    var y = rows.map(function (i) { return yin[i]; });
    var Xc = Xcols.map(function (c) { return rows.map(function (i) {
      return c[i]; }); });
    var n = y.length, p = Xcols.length + 1;
    if (n <= p) throw new Error(
      ('\uC0AC\uB840 \uC218\uAC00 \uC608\uCE21\uBCC0\uC218 \uC218'
      + '\uBCF4\uB2E4 \uCDA9\uBD84\uD788 \uB9CE\uC544\uC57C \uD569'
      + '\uB2C8\uB2E4.'));
    var X = rows.map(function (_, r) { return [1].concat(Xc.map(function (c)
      { return c[r]; })); });
    var fit = qrLeastSquares(X, y), b = fit.beta;
    var yhat = X.map(function (row) { var s = 0; for (var j = 0; j < p; j++)
      s += row[j] * b[j]; return s; });
    var my = mean(y), sse = 0, sst = 0;
    for (var i = 0; i < n; i++) { sse += Math.pow(y[i] - yhat[i], 2); sst +=
      Math.pow(y[i] - my, 2); }
    var dfE = n - p, mse = sse / dfE, R2 = 1 - sse / sst, adjR2 = 1 - (1 -
      R2) * (n - 1) / dfE;
    var dfM = p - 1, F = ((sst - sse) / dfM) / mse, tc = qt(1 - (1 - conf) /
      2, dfE);
    var sdy = sd(y);
    var coefs = b.map(function (bj, j) {
      var se = Math.sqrt(mse * fit.XtXinv[j][j]), t = bj / se;
      return { name: j === 0 ? '(\uC808\uD3B8)' : names[j - 1], b: bj, se:
        se, t: t, p: ptTwoSided(t, dfE),
        ciLow: bj - tc * se, ciHigh: bj + tc * se, beta: j === 0 ? NaN : bj
          * sd(Xc[j - 1]) / sdy, vif: NaN };
    });
    if (Xcols.length > 1) {
      for (var j = 0; j < Xcols.length; j++) {
        var others = Xc.filter(function (_, k) { return k !== j; });
        var Xo = rows.map(function (_, r) { return [1].concat(others.map(
          function (c) { return c[r]; })); });
        var fo = qrLeastSquares(Xo, Xc[j]).beta, mj = mean(Xc[j]), s1 = 0,
          s2 = 0;
        for (var r = 0; r < n; r++) { var pr = 0; for (var q = 0; q <
          fo.length; q++) pr += Xo[r][q] * fo[q]; s1 += Math.pow(Xc[j][r] -
          pr, 2); s2 += Math.pow(Xc[j][r] - mj, 2); }
        coefs[j + 1].vif = 1 / (s1 / s2);
      }
    } else if (Xcols.length === 1) coefs[1].vif = 1;
    var resid = y.map(function (v, i) { return v - yhat[i]; });
    var dw = 0; for (var i2 = 1; i2 < n; i2++) dw += Math.pow(resid[i2] -
      resid[i2 - 1], 2);
    dw /= sse;
    return { n: n, coefs: coefs, R2: R2, adjR2: adjR2, R: Math.sqrt(R2), F:
      F, dfM: dfM, dfE: dfE, p: pfUpper(F, dfM, dfE),
      sse: sse, ssr: sst - sse, sst: sst, see: Math.sqrt(mse), durbinWatson:
        dw, residuals: resid, fitted: yhat };
  }

  function logisticIRLS(X, y) {
    var n = X.length, p = X[0].length, b = new Array(p).fill(0), dev =
      Infinity, it, converged = false;
    for (it = 1; it <= 100; it++) {
      var eta = X.map(function (r) { var s = 0; for (var j = 0; j < p; j++)
        s += r[j] * b[j]; return s; });
      var mu = eta.map(function (e) { return 1 / (1 + Math.exp(-e)); });
      var XtWX = zeros(p, p), XtWz = new Array(p).fill(0);
      for (var i = 0; i < n; i++) {
        var w = Math.max(mu[i] * (1 - mu[i]), 1e-12), z = eta[i] + (y[i] -
          mu[i]) / w;
        for (var a = 0; a < p; a++) { XtWz[a] += X[i][a] * w * z; for (var c
          = a; c < p; c++) XtWX[a][c] += X[i][a] * w * X[i][c]; }
      }
      for (var a2 = 0; a2 < p; a2++) for (var c2 = 0; c2 < a2; c2++) XtWX[
        a2][c2] = XtWX[c2][a2];
      var inv = inverse(XtWX);
      var nb = inv.map(function (row) { var s = 0; for (var j = 0; j < p;
        j++) s += row[j] * XtWz[j]; return s; });
      var nd = devianceLogit(X, y, nb);
      b = nb;
      if (Math.abs(nd - dev) / (Math.abs(nd) + 0.1) < 1e-10) { dev = nd;
        converged = true; break; }
      dev = nd;
    }
    var etaF = X.map(function (r) { var s = 0; for (var j = 0; j < p; j++) s
      += r[j] * b[j]; return s; });
    var muF = etaF.map(function (e) { return 1 / (1 + Math.exp(-e)); });
    var I = zeros(p, p);
    for (var i2 = 0; i2 < n; i2++) { var w2 = muF[i2] * (1 - muF[i2]); for (
      var a3 = 0; a3 < p; a3++) for (var c3 = 0; c3 < p; c3++) I[a3][c3] +=
      X[i2][a3] * w2 * X[i2][c3]; }
    var cov;
    try { cov = inverse(I); } catch (e) { cov = zeros(p, p).map(function (r)
      { return r.map(function () { return NaN; }); }); }
    return { beta: b, cov: cov, deviance: dev, iterations: it, converged:
      converged, mu: muF };
  }
  function devianceLogit(X, y, b) {
    var d = 0;
    for (var i = 0; i < X.length; i++) {
      var e = 0; for (var j = 0; j < b.length; j++) e += X[i][j] * b[j];
      // log(1+exp(e)) \uC548\uC815 \uACC4\uC0B0
      var l1pe = e > 0 ? e + Math.log1p(Math.exp(-e)) : Math.log1p(Math.exp(
        e));
      d += -2 * (y[i] * e - l1pe);
    }
    return d;
  }

  // \uC774\uBD84\uD615 \uB85C\uC9C0\uC2A4\uD2F1 \uD68C\uADC0. yin: 0/1
  // \uC22B\uC790 \uBC30\uC5F4
  function logisticRegression(yin, Xcols, names, opts) {
    opts = opts || {};
    var cutoff = opts.cutoff || 0.5, conf = opts.conf || 0.95, hlGroups =
      opts.hlGroups || 10;
    var rows = completeRows([yin].concat(Xcols));
    var y = rows.map(function (i) { return yin[i]; });
    if (y.some(function (v) { return v !== 0 && v !== 1; })) throw new
      Error(('\uC885\uC18D\uBCC0\uC218\uB294 0\uACFC 1\uB85C\uB9CC '
      + '\uCF54\uB529\uB418\uC5B4\uC57C \uD569\uB2C8\uB2E4.'));
    var Xc = Xcols.map(function (c) { return rows.map(function (i) {
      return c[i]; }); });
    var n = y.length, p = Xcols.length + 1;
    var X = rows.map(function (_, r) { return [1].concat(Xc.map(function (c)
      { return c[r]; })); });
    var n1 = sum(y), p0 = n1 / n;
    if (n1 === 0 || n1 === n) throw new Error(
      ('\uC885\uC18D\uBCC0\uC218\uAC00 \uD55C \uBC94\uC8FC\uBFD0'
      + '\uC785\uB2C8\uB2E4 (\uC0AC\uAC74=1: ') + n1 +
      '\uBA85 / \uC804\uCCB4 ' + n +
      ('\uBA85). "\uC0AC\uAC74(=1)\uC73C\uB85C \uBCFC \uBC94\uC8FC'
      + '" \uC120\uD0DD\uACFC \uC790\uB8CC\uC758 \uCF54\uB529('
      + '\uACF5\uBC31\u00B7\uC22B\uC790/\uBB38\uC790 \uD63C\uC6A9 '
      + '\uB4F1)\uC744 \uD655\uC778\uD558\uC138\uC694.'));
    var fit = logisticIRLS(X, y);
    var dev0 = -2 * (n1 * Math.log(p0) + (n - n1) * Math.log(1 - p0));
    var chi = dev0 - fit.deviance, dfM = p - 1;
    var zc = qnorm(1 - (1 - conf) / 2);
    var warnings = [];
    var coefs = fit.beta.map(function (bj, j) {
      var se = Math.sqrt(fit.cov[j][j]), z = bj / se;
      return { name: j === 0 ? '(\uC808\uD3B8)' : names[j - 1], b: bj, se:
        se, z: z, wald: z * z, p: 2 * pnormUpper(Math.abs(z)),
        or: Math.exp(bj), orLow: Math.exp(bj - zc * se), orHigh: Math.exp(bj
          + zc * se) };
    });
    if (!fit.converged || coefs.some(function (c) { return !isFinite(c.se)
      || c.se > 1e3 || Math.abs(c.b) > 15; }) ||
        fit.mu.some(function (m) { return m < 1e-8 || m > 1 - 1e-8; })) {
      warnings.push(('\uC644\uC804 \uBD84\uB9AC(complete separation) \uB610'
        + '\uB294 \uC900\uC644\uC804 \uBD84\uB9AC\uAC00 \uC758'
        + '\uC2EC\uB429\uB2C8\uB2E4. \uACC4\uC218\uC640 \uD45C'
        + '\uC900\uC624\uCC28\uAC00 \uB9E4\uC6B0 \uCEE4\uC9C8 '
        + '\uC218 \uC788\uC73C\uB2C8 \uD574\uC11D\uC5D0 \uC8FC'
        + '\uC758\uD558\uC138\uC694 (Firth \uBCF4\uC815 \uB85C'
        + '\uC9C0\uC2A4\uD2F1 \uD68C\uADC0\uB97C \uACE0\uB824).'));
    }
    var coxSnell = 1 - Math.exp(-chi / n);
    var nagelkerke = coxSnell / (1 - Math.exp(-dev0 / n));
    var mcfadden = 1 - fit.deviance / dev0;
    // Hosmer-Lemeshow: \uC608\uCE21\uD655\uB960 \uBD84\uC704\uC218\uB85C
    // \uC9D1\uB2E8\uD654 (R ResourceSelection::hoslem.test \uBC29\uC2DD)
    var hl = hosmerLemeshow(y, fit.mu, hlGroups);
    var tp = 0, tn = 0, fp = 0, fn = 0;
    for (var i = 0; i < n; i++) { var pr = fit.mu[i] >= cutoff ? 1 : 0; if (
      pr === 1 && y[i] === 1) tp++; else if (pr === 0 && y[i] === 0) tn++;
      else if (pr === 1) fp++; else fn++; }
    var auc = aucROC(y, fit.mu);
    return { n: n, nEvents: n1, coefs: coefs, deviance: fit.deviance,
      nullDeviance: dev0, chi2: chi, dfM: dfM, pModel: pchisqUpper(chi,
      dfM),
      aic: fit.deviance + 2 * p, bic: fit.deviance + Math.log(n) * p,
        coxSnell: coxSnell, nagelkerke: nagelkerke, mcfadden: mcfadden,
      hl: hl, classification: { tp: tp, tn: tn, fp: fp, fn: fn, cutoff:
        cutoff, accuracy: (tp + tn) / n,
        sensitivity: tp / (tp + fn), specificity: tn / (tn + fp) }, auc:
          auc,
      iterations: fit.iterations, converged: fit.converged, warnings:
        warnings, fitted: fit.mu };
  }

  function hosmerLemeshow(y, mu, g) {
    var n = y.length, probs = [];
    for (var k = 0; k <= g; k++) probs.push(quantile(mu, k / g));
    var breaks = []; probs.forEach(function (b) { if (breaks.indexOf(b) < 0)
      breaks.push(b); });
    var G = breaks.length - 1, O1 = new Array(G).fill(0), E1 = new Array(
      G).fill(0), Nn = new Array(G).fill(0);
    for (var i = 0; i < n; i++) {
      var gi = 0;
      for (var b2 = 1; b2 < breaks.length; b2++) { if (mu[i] <= breaks[b2])
        { gi = b2 - 1; break; } }
      O1[gi] += y[i]; E1[gi] += mu[i]; Nn[gi]++;
    }
    var chi = 0;
    for (var j = 0; j < G; j++) {
      if (Nn[j] === 0) continue;
      var e0 = Nn[j] - E1[j], o0 = Nn[j] - O1[j];
      chi += Math.pow(O1[j] - E1[j], 2) / E1[j] + Math.pow(o0 - e0, 2) / e0;
    }
    var df = G - 2;
    return { chi2: chi, df: df, p: df > 0 ? pchisqUpper(chi, df) : NaN,
      groups: G };
  }

  function aucROC(y, s) { // Mann-Whitney U \uAE30\uBC18
    var r = rank(s), n1 = 0, sr = 0;
    for (var i = 0; i < y.length; i++) if (y[i] === 1) { n1++; sr += r[i]; }
    var n0 = y.length - n1;
    return (sr - n1 * (n1 + 1) / 2) / (n1 * n0);
  }

  /* ------------------------------------------------------------------ */
  /* 8. \uC2E0\uB8B0\uB3C4                                                  
             */
  /* ------------------------------------------------------------------ */

  function reliability(colsIn, names) {
    var rows = completeRows(colsIn);
    var cols = colsIn.map(function (c) { return rows.map(function (i) {
      return c[i]; }); });
    var k = cols.length, n = rows.length;
    function alphaOf(cs) {
      var kk = cs.length, sv = sum(cs.map(variance));
      var tot = rows.map(function (_, r) { return sum(cs.map(function (c) {
        return c[r]; })); });
      return kk / (kk - 1) * (1 - sv / variance(tot));
    }
    var alpha = alphaOf(cols);
    var R = corMatrix(cols, 'pearson').R, rbar = 0, cnt = 0;
    for (var i = 0; i < k; i++) for (var j = i + 1; j < k; j++) { rbar += R[
      i][j]; cnt++; }
    rbar /= cnt;
    var stdAlpha = k * rbar / (1 + (k - 1) * rbar);
    var total = rows.map(function (_, r) { return sum(cols.map(function (c)
      { return c[r]; })); });
    var items = cols.map(function (c, j) {
      var rest = total.map(function (t, r) { return t - c[r]; });
      var others = cols.filter(function (_, q) { return q !== j; });
      return { name: names[j], mean: mean(c), sd: sd(c), rCorrected:
        pearson(c, rest),
        alphaIfDeleted: others.length > 1 ? alphaOf(others) : NaN };
    });
    return { n: n, k: k, alpha: alpha, stdAlpha: stdAlpha, meanInterItem:
      rbar, items: items };
  }

  // \uB2E4\uC74C \uC870\uAC01\uC73C\uB85C \uB0B4\uBCF4\uB0B4\uAE30
  NS.LANCZOS = LANCZOS; NS.lgamma = lgamma; NS.betacf = betacf; NS.ibeta =
    ibeta; NS.gammaP = gammaP; NS.gammaQcf = gammaQcf; NS.gammaQ = gammaQ;
    NS.pnorm = pnorm;
  NS.pnormUpper = pnormUpper; NS.qnorm = qnorm; NS.pt = pt; NS.ptTwoSided =
    ptTwoSided; NS.pfUpper = pfUpper; NS.pchisqUpper = pchisqUpper;
    NS.pchisq = pchisq; NS.invertCdf = invertCdf;
  NS.qt = qt; NS.qchisq = qchisq; NS.qf = qf; NS.wprob = wprob; NS.ptukey =
    ptukey; NS.zeros = zeros; NS.identity = identity; NS.transpose =
    transpose;
  NS.matmul = matmul; NS.copyM = copyM; NS.cholesky = cholesky; NS.logdetPD
    = logdetPD; NS.inverse = inverse; NS.eigenSym = eigenSym;
    NS.qrLeastSquares = qrLeastSquares; NS.isNum = isNum;
  NS.clean = clean; NS.sum = sum; NS.mean = mean; NS.variance = variance;
    NS.sd = sd; NS.sortNum = sortNum; NS.quantile = quantile;
    NS.quantileSPSS = quantileSPSS;
  NS.rank = rank; NS.pearson = pearson; NS.shapiroWilk = shapiroWilk;
    NS.descriptives = descriptives; NS.leveneTest = leveneTest;
    NS.onewayCore = onewayCore; NS.tTestOneSample = tTestOneSample;
    NS.tTestPaired = tTestPaired;
  NS.tTestIndependent = tTestIndependent; NS.anovaOneway = anovaOneway;
    NS.corTest = corTest; NS.corMatrix = corMatrix; NS.completeRows =
    completeRows; NS.lchoose = lchoose; NS.fisherExact2x2 = fisherExact2x2;
    NS.crosstab = crosstab;
  NS.linearRegression = linearRegression; NS.logisticIRLS = logisticIRLS;
    NS.devianceLogit = devianceLogit; NS.logisticRegression =
    logisticRegression; NS.hosmerLemeshow = hosmerLemeshow; NS.aucROC =
    aucROC; NS.reliability = reliability;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ?
  global : this);

/*
 * PsyStat \uD1B5\uACC4 \uC5D4\uC9C4 (stats) \u2014 \uC870\uAC01 2/4:
  \uB124\uD2B8\uC6CC\uD06C\u00B7\uB2E4\uBD84\uC0C1\uAD00\u00B7\uC870\uC808
  \u00B7\uB9E4\uAC1C\u00B7\uB2E4\uBCC0\uB7C9\u00B7\uC548\uC815\uC131
 * \uC678\uBD80 \uB77C\uC774\uBE0C\uB7EC\uB9AC\u00B7\uB124\uD2B8\uC6CC\uD06C
  \uD1B5\uC2E0 \uC5C6\uC74C. \uC21C\uC218 JavaScript.
 * \uC870\uAC01\uB4E4\uC740 G.__PsyStatsNS \uB85C \uD568\uC218\uB97C
  \uACF5\uC720\uD558\uBA70, \uB9C8\uC9C0\uB9C9 \uC870\uAC01\uC774 G.PsyStats
  \uB97C \uB9CC\uB4E0\uB2E4.
 * (\uC804\uC1A1 \uC2DC\uC2A4\uD15C\uC758 \uC2A4\uD06C\uB9BD\uD2B8
  \uBE14\uB85D \uD06C\uAE30 \uC81C\uD55C \uB54C\uBB38\uC5D0 \uB098\uB214;
  \uACC4\uC0B0 \uCF54\uB4DC\uB294 \uBD84\uD560 \uC804\uACFC \uB3D9\uC77C)
 */
(function (G) {
  'use strict';
  var NS = G.__PsyStatsNS || (G.__PsyStatsNS = {});
  // \uC55E \uC870\uAC01\uC5D0\uC11C \uAC00\uC838\uC624\uAE30
  var lgamma = NS.lgamma, ibeta = NS.ibeta, gammaP = NS.gammaP, gammaQ =
    NS.gammaQ, pnorm = NS.pnorm, pnormUpper = NS.pnormUpper, qnorm =
    NS.qnorm, pt = NS.pt;
  var ptTwoSided = NS.ptTwoSided, pfUpper = NS.pfUpper, pchisqUpper =
    NS.pchisqUpper, pchisq = NS.pchisq, qt = NS.qt, qchisq = NS.qchisq, qf =
    NS.qf, ptukey = NS.ptukey;
  var zeros = NS.zeros, identity = NS.identity, transpose = NS.transpose,
    matmul = NS.matmul, copyM = NS.copyM, cholesky = NS.cholesky, logdetPD =
    NS.logdetPD, inverse = NS.inverse;
  var eigenSym = NS.eigenSym, qrLeastSquares = NS.qrLeastSquares, isNum =
    NS.isNum, clean = NS.clean, sum = NS.sum, mean = NS.mean, variance =
    NS.variance, sd = NS.sd;
  var quantile = NS.quantile, quantileSPSS = NS.quantileSPSS, rank =
    NS.rank, pearson = NS.pearson, shapiroWilk = NS.shapiroWilk,
    descriptives = NS.descriptives, leveneTest = NS.leveneTest,
    tTestOneSample = NS.tTestOneSample;
  var tTestPaired = NS.tTestPaired, tTestIndependent = NS.tTestIndependent,
    anovaOneway = NS.anovaOneway, corTest = NS.corTest, corMatrix =
    NS.corMatrix, completeRows = NS.completeRows, fisherExact2x2 =
    NS.fisherExact2x2, crosstab = NS.crosstab;
  var linearRegression = NS.linearRegression, logisticRegression =
    NS.logisticRegression, reliability = NS.reliability;
  /* ------------------------------------------------------------------ */
  /* 9. \uB124\uD2B8\uC6CC\uD06C \uBD84\uC11D (\uAC00\uC6B0\uC2DC\uC548
    \uADF8\uB798\uD504 \uBAA8\uD615)                              */
  /* ------------------------------------------------------------------ */

  function covMatrix(cols) {
    var k = cols.length, n = cols[0].length, m = cols.map(mean), S = zeros(
      k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) {
      var s = 0; for (var r = 0; r < n; r++) s += (cols[i][r] - m[i]) * (
        cols[j][r] - m[j]);
      S[i][j] = S[j][i] = s / (n - 1);
    }
    return S;
  }
  function cov2cor(S) {
    var k = S.length, R = zeros(k, k), d = S.map(function (r, i) {
      return Math.sqrt(r[i]); });
    for (var i = 0; i < k; i++) for (var j = 0; j < k; j++) R[i][j] = S[i][
      j] / (d[i] * d[j]);
    return R;
  }

  /*
   * \uADF8\uB798\uD53C\uCEEC \uB77C\uC3D8 (Friedman, Hastie & Tibshirani,
  2008)
   * penalize.diagonal = FALSE (qgraph::EBICglasso \uAE30\uBCF8\uAC12)
   * init: {W, B} \uC6DC\uC2A4\uD0C0\uD2B8(\uC120\uD0DD)
   */
  function glasso(S, lambda, init, opts) {
    opts = opts || {};
    var thr = opts.thr || 1e-7, maxit = opts.maxit || 10000;
    var p = S.length, W = init ? copyM(init.W) : copyM(S), B = init ? copyM(
      init.B) : zeros(p, p);
      // B[j]: \uC5F4 j\uC758 \uBCA0\uD0C0 (\uAE38\uC774 p, j\uC704\uCE58
      // \uBB34\uC2DC)
    var offS = 0; for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) if
      (i !== j) offS += Math.abs(S[i][j]);
    offS /= p * (p - 1);
    if (offS === 0) offS = 1;
    for (var d = 0; d < p; d++) W[d][d] = S[d][d];
    for (var it = 0; it < maxit; it++) {
      var dw = 0;
      for (var j2 = 0; j2 < p; j2++) {
        var beta = B[j2];
        // \uC88C\uD45C\uD558\uAC15 \uB77C\uC3D8: W11 beta = s12
        for (var inner = 0; inner < 10000; inner++) {
          var dlx = 0;
          for (var k = 0; k < p; k++) {
            if (k === j2) continue;
            var a = S[k][j2];
            for (var l = 0; l < p; l++) if (l !== j2 && l !== k) a -= W[k][
              l] * beta[l];
            var nb = 0;
            if (a > lambda) nb = (a - lambda) / W[k][k]; else if (a <
              -lambda) nb = (a + lambda) / W[k][k];
            var diff = nb - beta[k];
            if (diff !== 0) { dlx = Math.max(dlx, Math.abs(diff)); beta[k] =
              nb; }
          }
          if (dlx < thr * 1e-2) break;
        }
        for (var k2 = 0; k2 < p; k2++) {
          if (k2 === j2) continue;
          var w = 0; for (var l2 = 0; l2 < p; l2++) if (l2 !== j2) w += W[
            k2][l2] * beta[l2];
          dw += Math.abs(w - W[k2][j2]);
          W[k2][j2] = w; W[j2][k2] = w;
        }
      }
      if (dw / (p * (p - 1)) < thr * offS) break;
    }
    // \uC815\uBC00\uB3C4 \uD589\uB82C
    var K = zeros(p, p);
    for (var j3 = 0; j3 < p; j3++) {
      var s = W[j3][j3];
      for (var k3 = 0; k3 < p; k3++) if (k3 !== j3) s -= W[k3][j3] * B[j3][
        k3];
      var kjj = 1 / s;
      K[j3][j3] = kjj;
      for (var k4 = 0; k4 < p; k4++) if (k4 !== j3) K[k4][j3] = -B[j3][k4] *
        kjj;
    }
    return { W: W, K: K, B: B };
  }

  // \uC815\uBC00\uB3C4 \uD589\uB82C \u2192 \uD3B8\uC0C1\uAD00
  // \uB124\uD2B8\uC6CC\uD06C (qgraph::wi2net +
  // forceSymmetric(\uC0C1\uC0BC\uAC01 \uC0AC\uC6A9))
  function wi2net(K) {
    var p = K.length, N = zeros(p, p);
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var v = -K[i][j] / Math.sqrt(K[i][i] * K[j][j]);
      if (v === 0) v = 0; // -0 \uC81C\uAC70
      N[i][j] = N[j][i] = v;
    }
    return N;
  }

  function logGaus(S, K, n) {
    var p = S.length, tr = 0;
    for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) tr += K[i][j] *
      S[j][i];
    return n / 2 * (logdetPD(K) - tr);
  }

  /*
   * EBICglasso: qgraph::EBICglasso(S, n, gamma=0.5, nlambda=100,
  lambda.min.ratio=0.01,
   *   penalize.diagonal=FALSE, refit=FALSE, threshold=FALSE) \uC640
  \uB3D9\uC77C\uD55C \uC808\uCC28
   */
  function ebicGlasso(Sin, n, opts) {
    opts = opts || {};
    var gamma = opts.gamma === undefined ? 0.5 : opts.gamma, nlambda =
      opts.nlambda || 100, lmr = opts.lambdaMinRatio || 0.01;
    var threshold = !!opts.threshold;
    var S = cov2cor(Sin), p = S.length;
    if (!cholesky(S)) throw new Error(
      ('\uC0C1\uAD00\uD589\uB82C\uC774 \uC591\uC815\uCE58(positive'
      + ' definite)\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uBCC0\uC218 '
      + '\uAC04 \uC911\uBCF5(\uC644\uC804\uC0C1\uAD00)\uC774\uB098 '
      + '\uC0AC\uB840 \uC218 \uBD80\uC871\uC744 \uD655\uC778\uD558'
      + '\uC138\uC694.'));
    var lmax = 0;
    for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) if (i !== j)
      lmax = Math.max(lmax, Math.abs(S[i][j]));
    var lmin = lmr * lmax, lambdas = [];
    for (var l = 0; l < nlambda; l++) lambdas.push(Math.exp(Math.log(lmin) +
      (Math.log(lmax) - Math.log(lmin)) * l / (nlambda - 1)));
    var fits = new Array(nlambda), init = null;
    for (var li = nlambda - 1; li >= 0; li--) {
      // \uD070 \u03BB\uBD80\uD130 \uC6DC\uC2A4\uD0C0\uD2B8
      var f = glasso(S, lambdas[li], init, opts);
      init = { W: f.W, B: f.B };
      var K = f.K;
      if (threshold) {
        var th = Math.log(p * (p - 1) / 2) / Math.sqrt(n);
        K = K.map(function (r) { return r.map(function (v) {
          return Math.abs(v) < th ? 0 : v; }); });
      }
      fits[li] = K;
    }
    var ebics = fits.map(function (K) {
      var E = 0;
      for (var i2 = 0; i2 < p; i2++) for (var j2 = 0; j2 < i2; j2++) if (K[
        i2][j2] !== 0) E++;
      return -2 * logGaus(S, K, n) + E * Math.log(n) + 4 * E * gamma *
        Math.log(p);
    });
    var opt = 0;
    for (var e = 1; e < nlambda; e++) if (ebics[e] < ebics[opt]) opt = e;
    var net = wi2net(fits[opt]);
    var notes = [];
    if (opt === 0) notes.push(
      ('\uAC00\uC7A5 \uC791\uC740 \u03BB\uC758 \uB124\uD2B8\uC6CC'
      + '\uD06C\uAC00 \uC120\uD0DD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. '
      + '\uD76C\uC18C\uC131(sparsity) \uAC00\uC815\uC774 \uC704'
      + '\uBC30\uB418\uC5C8\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'));
    if (lambdas[opt] < 0.1 * lmax && !threshold) notes.push(
      ('\uBC00\uC9D1\uB41C(dense) \uC815\uADDC\uD654 \uB124\uD2B8'
      + '\uC6CC\uD06C\uAC00 \uC120\uD0DD\uB418\uC5C8\uC2B5\uB2C8'
      + '\uB2E4 (\u03BB < 0.1\u00B7\u03BBmax). \uCD5C\uADFC \uC5F0'
      + '\uAD6C\uC5D0 \uB530\uB974\uBA74 \uD2B9\uC774\uB3C4\uAC00 '
      + '\uB5A8\uC5B4\uC9C8 \uC218 \uC788\uC73C\uB2C8 \uAC00\uC7A5 '
      + '\uC791\uC740 \uC5E3\uC9C0\uB4E4\uC758 \uD574\uC11D\uC5D0 '
      + '\uC8FC\uC758\uD558\uC138\uC694 (Williams & Rast, 2020).'));
    if (net.every(function (r) { return r.every(function (v) { return v ===
      0; }); })) notes.push(
      ('\uBE48 \uB124\uD2B8\uC6CC\uD06C(\uC5E3\uC9C0 \uC5C6\uC74C)'
      + '\uAC00 \uC120\uD0DD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'));
    return { network: net, lambda: lambdas[opt], lambdaIndex: opt, lambdas:
      lambdas, ebic: ebics, K: fits[opt], S: S, notes: notes };
  }

  // \uBE44\uC815\uADDC\uD654 \uD3B8\uC0C1\uAD00 \uB124\uD2B8\uC6CC\uD06C
  // (\uC120\uD0DD\uC801\uC73C\uB85C \uC720\uC758\uC131 \uC784\uACC4)
  function partialCorNetwork(Sin, n, alpha) {
    var S = cov2cor(Sin), p = S.length, K = inverse(S), net = wi2net(K), P =
      zeros(p, p);
    var df = n - p; // \uD3B8\uC0C1\uAD00 t \uAC80\uC815: df = n - 2 - (p-2)
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var r = net[i][j], t = r * Math.sqrt(df / (1 - r * r));
      P[i][j] = P[j][i] = ptTwoSided(t, df);
      if (alpha && P[i][j] >= alpha) { net[i][j] = net[j][i] = 0; }
    }
    return { network: net, P: P, K: K, S: S, notes: [] };
  }

  // \uC911\uC2EC\uC131 (qgraph::centrality_auto\uC640 \uB3D9\uC77C
  // \uC815\uC758: \uAC70\uB9AC = 1/|w|)
  function centrality(net) {
    var p = net.length, strength = [], ei = [], INF = Infinity;
    for (var i = 0; i < p; i++) {
      var s = 0, e = 0;
      for (var j = 0; j < p; j++) if (j !== i) { s += Math.abs(net[i][j]); e
        += net[i][j]; }
      strength.push(s); ei.push(e);
    }
    // \uC5F0\uACB0 \uC131\uBD84
    var comp = new Array(p).fill(-1), cid = 0;
    for (var s0 = 0; s0 < p; s0++) {
      if (comp[s0] >= 0) continue;
      var stack = [s0]; comp[s0] = cid;
      while (stack.length) { var u = stack.pop(); for (var v = 0; v < p;
        v++) if (v !== u && net[u][v] !== 0 && comp[v] < 0) { comp[v] = cid;
        stack.push(v); } }
      cid++;
    }
    var sizes = new Array(cid).fill(0); comp.forEach(function (c) { sizes[
      c]++; });
    var big = sizes.indexOf(Math.max.apply(null, sizes));
    var closeness = new Array(p).fill(NaN), betw = new Array(p).fill(0);
    for (var src = 0; src < p; src++) {
      // \uB2E4\uC775\uC2A4\uD2B8\uB77C + Brandes
      var dist = new Array(p).fill(INF), sigma = new Array(p).fill(0), preds
        = [], done = new Array(p).fill(false), order = [];
      for (var q = 0; q < p; q++) preds.push([]);
      dist[src] = 0; sigma[src] = 1;
      for (var step = 0; step < p; step++) {
        var uu = -1, best = INF;
        for (var c = 0; c < p; c++) if (!done[c] && dist[c] < best) { best =
          dist[c]; uu = c; }
        if (uu < 0) break;
        done[uu] = true; order.push(uu);
        for (var vv = 0; vv < p; vv++) {
          if (vv === uu || net[uu][vv] === 0 || done[vv]) continue;
          var nd = dist[uu] + 1 / Math.abs(net[uu][vv]);
          var tol = 1e-12 * Math.max(1, nd);
          if (nd < dist[vv] - tol) { dist[vv] = nd; sigma[vv] = sigma[uu];
            preds[vv] = [uu]; }
          else if (Math.abs(nd - dist[vv]) <= tol) { sigma[vv] += sigma[uu];
            preds[vv].push(uu); }
        }
      }
      if (comp[src] === big && sizes[big] > 1) {
        var tot = 0; for (var t = 0; t < p; t++) if (t !== src && comp[t]
          === big) tot += dist[t];
        closeness[src] = 1 / tot;
      }
      var delta = new Array(p).fill(0);
      for (var oi = order.length - 1; oi >= 0; oi--) {
        var w = order[oi];
        preds[w].forEach(function (pv) { delta[pv] += sigma[pv] / sigma[w] *
          (1 + delta[w]); });
        if (w !== src) betw[w] += delta[w];
      }
    }
    betw = betw.map(function (b) { return b / 2; });
      // \uBB34\uBC29\uD5A5: \uC30D\uB2F9 1\uD68C
    return { strength: strength, expectedInfluence: ei, closeness:
      closeness, betweenness: betw };
  }

  function zscore(arr) {
    var x = arr.filter(isNum); if (x.length < 2) return arr.map(function ()
      { return NaN; });
    var m = mean(x), s = sd(x);
    return arr.map(function (v) { return isNum(v) ? (s > 0 ? (v - m) / s :
      0) : NaN; });
  }

  // \uB178\uB4DC \uC608\uCE21\uB825
  // (\uBE44\uC815\uADDC\uD654/\uC815\uADDC\uD654 \uC815\uBC00\uB3C4
  // \uD589\uB82C \uAE30\uC900 R\u00B2 = 1 - 1/K_ii,
  // \uC0C1\uAD00\uD589\uB82C \uAE30\uC900)
  function predictability(K) { return K.map(function (r, i) { return 1 - 1 /
    r[i]; }); }

  // \uC7AC\uD604 \uAC00\uB2A5\uD55C \uB09C\uC218 (mulberry32)
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // \uB370\uC774\uD130 \uD589\uB82C(\uD589: \uC0AC\uB840)\uB85C
  // \uB124\uD2B8\uC6CC\uD06C \uCD94\uC815
  function estimateNetwork(cols, opts) {
    opts = opts || {};
    var n = cols[0].length;
    var S;
    if (opts.cor === 'auto') {
      var ca = corAuto(cols, { ordinal: opts.ordinal });
      S = ca.R;
      if (!cholesky(S)) { S = nearPD(S).mat; if (opts.onNearPD)
        opts.onNearPD(); }
    } else S = covMatrix(opts.cor === 'spearman' ? cols.map(rank) : cols);
    if (opts.method === 'pcor') return partialCorNetwork(S, n, opts.alpha);
    return ebicGlasso(S, n, opts);
  }

  // Fruchterman-Reingold \uBC30\uCE58 (\uACB0\uC815\uC801; \uC6D0\uD615
  // \uCD08\uAE30\uAC12)
  function layoutFR(net, iters) {
    iters = iters || 500;
    var p = net.length, pos = [];
    for (var i = 0; i < p; i++) pos.push([Math.cos(2 * Math.PI * i / p),
      Math.sin(2 * Math.PI * i / p)]);
    if (p < 2) return pos;
    var maxw = 0; for (var a = 0; a < p; a++) for (var b = 0; b < p; b++)
      maxw = Math.max(maxw, Math.abs(net[a][b]));
    var area = 4, kopt = Math.sqrt(area / p), temp = 0.2;
    for (var it = 0; it < iters; it++) {
      var disp = pos.map(function () { return [0, 0]; });
      for (var u = 0; u < p; u++) for (var v = u + 1; v < p; v++) {
        var dx = pos[u][0] - pos[v][0], dy = pos[u][1] - pos[v][1], d =
          Math.max(Math.sqrt(dx * dx + dy * dy), 1e-4);
        var fr = kopt * kopt / d;
        var w = maxw > 0 ? Math.abs(net[u][v]) / maxw : 0;
        var fa = w * d * d / kopt;
        var f = (fr - fa) / d;
        disp[u][0] += dx * f; disp[u][1] += dy * f; disp[v][0] -= dx * f;
          disp[v][1] -= dy * f;
      }
      for (var q = 0; q < p; q++) {
        // \uC911\uC2EC\uC73C\uB85C \uC57D\uD55C \uC778\uB825 (\uACE0\uB9BD
        // \uB178\uB4DC\uAC00 \uBA40\uB9AC \uAC00\uC9C0 \uC54A\uB3C4\uB85D)
        disp[q][0] -= pos[q][0] * 0.05 * kopt; disp[q][1] -= pos[q][1] *
          0.05 * kopt;
        var dl = Math.sqrt(disp[q][0] * disp[q][0] + disp[q][1] * disp[q][
          1]);
        if (dl > 0) { var m = Math.min(dl, temp); pos[q][0] += disp[q][0] /
          dl * m; pos[q][1] += disp[q][1] / dl * m; }
      }
      temp *= 0.99;
    }
    var xs = pos.map(function (p2) { return p2[0]; }), ys = pos.map(function
      (p2) { return p2[1]; });
    var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mny
      = Math.min.apply(null, ys), mxy = Math.max.apply(null, ys);
    return pos.map(function (p2) { return [(p2[0] - mnx) / ((mxx - mnx) ||
      1), (p2[1] - mny) / ((mxy - mny) || 1)]; });
  }

  /* ------------------------------------------------------------------ */
  /* 10. \uC774\uBCC0\uB7C9 \uC815\uADDC\uBD84\uD3EC \u00B7
    \uB2E4\uBD84/\uB2E4\uACC4\uC5F4 \uC0C1\uAD00 (lavaan::lavCor two-step
    \uBC29\uC2DD) */
  /* ------------------------------------------------------------------ */

  // P(X > dh, Y > dk), \uC0C1\uAD00 r (Genz, 2004; bvnu)
  var GL = {
    3: { w: [0.1713244923791705, 0.3607615730481384, 0.4679139345726904], x:
      [-0.9324695142031522, -0.6612093864662647, -0.2386191860831970] },
    6: { w: [.04717533638651177, .1069393259953183, .1600783285433464,
      .2031674267230659, .2334925365383547, .2491470458134029],
      x: [-.9815606342467191, -.9041172563704750, -.7699026741943050,
        -.5873179542866171, -.3678314989981802, -.1252334085114692] },
    10: { w: [.01761400713915212, .04060142980038694, .06267204833410906,
      .08327674157670475, .1019301198172404, .1181945319615184,
      .1316886384491766, .1420961093183821, .1491729864726037,
      .1527533871307259],
      x: [-.9931285991850949, -.9639719272779138, -.9122344282513259,
        -.8391169718222188, -.7463319064601508, -.6360536807265150,
        -.5108670019508271, -.3737060887154196, -.2277858511416451,
        -.07652652113349733] }
  };
  function bvnu(dh, dk, r) {
    if (dh === Infinity || dk === Infinity) return 0;
    if (dh === -Infinity) return dk === -Infinity ? 1 : pnorm(-dk);
    if (dk === -Infinity) return pnorm(-dh);
    if (r === 0) return pnorm(-dh) * pnorm(-dk);
    var tp = 2 * Math.PI, h = dh, k = dk, hk = h * k, bvn = 0, g = Math.abs(
      r) < 0.3 ? GL[3] : Math.abs(r) < 0.75 ? GL[6] : GL[10];
    var w = g.w.concat(g.w), x = g.x.map(function (v) { return 1 - v;
      }).concat(g.x.map(function (v) { return 1 + v; }));
    var i;
    if (Math.abs(r) < 0.925) {
      var hs = (h * h + k * k) / 2, asr = Math.asin(r) / 2;
      for (i = 0; i < x.length; i++) { var sn = Math.sin(asr * x[i]); bvn +=
        w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn)); }
      bvn = bvn * asr / tp + pnorm(-h) * pnorm(-k);
    } else {
      if (r < 0) { k = -k; hk = -hk; }
      if (Math.abs(r) < 1) {
        var as = 1 - r * r, a = Math.sqrt(as), bs = (h - k) * (h - k), c = (
          4 - hk) / 8, d = (12 - hk) / 80;
        var asr2 = -(bs / as + hk) / 2;
        if (asr2 > -100) bvn = a * Math.exp(asr2) * (1 - c * (bs - as) * (1
          - d * bs) / 3 + c * d * as * as);
        if (hk > -100) { var b = Math.sqrt(bs), sp = Math.sqrt(tp) * pnorm(
          -b / a); bvn -= Math.exp(-hk / 2) * sp * b * (1 - c * bs * (1 - d
          * bs) / 3); }
        a = a / 2;
        var acc = 0;
        for (i = 0; i < x.length; i++) {
          var xs = (a * x[i]) * (a * x[i]), asr3 = -(bs / xs + hk) / 2;
          if (asr3 > -100) {
            var sp2 = 1 + c * xs * (1 + 5 * d * xs), rs = Math.sqrt(1 - xs),
              ep = Math.exp(-(hk / 2) * xs / ((1 + rs) * (1 + rs))) / rs;
            acc += Math.exp(asr3) * (sp2 - ep) * w[i];
          }
        }
        bvn = (a * acc - bvn) / tp;
      }
      if (r > 0) bvn += pnorm(-Math.max(h, k));
      else if (h >= k) bvn = -bvn;
      else { var L = h < 0 ? pnorm(k) - pnorm(h) : pnorm(-h) - pnorm(-k);
        bvn = L - bvn; }
    }
    return Math.max(0, Math.min(1, bvn));
  }
  // \uD558\uCE21 \uB204\uC801 P(X <= h, Y <= k)
  function pbvnorm(h, k, r) { return bvnu(-h, -k, r); }

  // \uBE0C\uB80C\uD2B8 1\uCC28\uC6D0 \uCD5C\uC18C\uD654 (Brent, 1973)
  function fminBrent(fn, a, b, tol) {
    tol = tol || 1e-10;
    var gr = 0.3819660112501051, x = a + gr * (b - a), w = x, v = x, fx =
      fn(x), fw = fx, fv = fx, d = 0, e = 0;
    for (var it = 0; it < 200; it++) {
      var m = 0.5 * (a + b), tol1 = tol * Math.abs(x) + 1e-12, tol2 = 2 *
        tol1;
      if (Math.abs(x - m) <= tol2 - 0.5 * (b - a)) break;
      var useGolden = true;
      if (Math.abs(e) > tol1) {
        var r = (x - w) * (fx - fv), q = (x - v) * (fx - fw), p = (x - v) *
          q - (x - w) * r;
        q = 2 * (q - r); if (q > 0) p = -p; q = Math.abs(q);
        if (Math.abs(p) < Math.abs(0.5 * q * e) && p > q * (a - x) && p < q
          * (b - x)) {
          e = d; d = p / q; var u0 = x + d;
          if (u0 - a < tol2 || b - u0 < tol2) d = x < m ? tol1 : -tol1;
          useGolden = false;
        }
      }
      if (useGolden) { e = (x < m ? b : a) - x; d = gr * e; }
      var u = Math.abs(d) >= tol1 ? x + d : x + (d > 0 ? tol1 : -tol1), fu =
        fn(u);
      if (fu <= fx) { if (u < x) b = x; else a = x; v = w; fv = fw; w = x;
        fw = fx; x = u; fx = fu; }
      else {
        if (u < x) a = u; else b = u;
        if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; } else if
          (fu <= fv || v === x || v === w) { v = u; fv = fu; }
      }
    }
    return { x: x, f: fx };
  }

  function ordLevels(x) { var lv = []; x.forEach(function (v) { if (isNum(v)
    && lv.indexOf(v) < 0) lv.push(v); }); return lv.sort(function (a, b) {
    return a - b; }); }
  // \uC77C\uBCC0\uB7C9 \uC5ED\uCE58: \uD574\uB2F9 \uBCC0\uC218\uC758
  // \uBAA8\uB4E0 \uAD00\uCE21\uAC12 \uC0AC\uC6A9 (lavaan \uBC29\uC2DD)
  function thresholds(x) {
    var lv = ordLevels(x), n = 0, cnt = lv.map(function () { return 0; });
    x.forEach(function (v) { if (isNum(v)) { cnt[lv.indexOf(v)]++; n++; }
      });
    var th = [], cum = 0;
    for (var i = 0; i < lv.length - 1; i++) { cum += cnt[i]; th.push(qnorm(
      cum / n)); }
    return { levels: lv, tau: th };
  }

  // \uB2E4\uBD84\uC0C1\uAD00(polychoric)/\uC0AC\uBD84\uC0C1\uAD00(tetrachor
  // ic): \uC5ED\uCE58 \uACE0\uC815, \u03C1\uB9CC \uCD5C\uB300\uC6B0\uB3C4
  // \uCD94\uC815
  function polychoric(xin, yin, tx, ty) {
    tx = tx || thresholds(xin); ty = ty || thresholds(yin);
    var I = tx.levels.length, J = ty.levels.length, T = zeros(I, J), n = 0;
    for (var r = 0; r < xin.length; r++) if (isNum(xin[r]) && isNum(yin[r]))
      { T[tx.levels.indexOf(xin[r])][ty.levels.indexOf(yin[r])]++; n++; }
    if (I < 2 || J < 2) return { rho: NaN, n: n, table: T };
    // lavaan \uADDC\uCE59 (zero.add = c(0.5, 0), zero.keep.margins = TRUE):
    // 2\u00D72 \uD45C\uC5D0\uC11C\uB9CC \uCC98\uB9AC
    var zeroCells = 0;
    if (I === 2 && J === 2) {
      var zs = [];
      for (var a0 = 0; a0 < 2; a0++) for (var b0 = 0; b0 < 2; b0++) if (T[
        a0][b0] === 0) zs.push([a0, b0]);
      zeroCells = zs.length;
      if (zs.length >= 2) return { rho: T[0][0] > 0 ? 1 : -1, n: n, table:
        T, zeroCells: zeroCells };
      if (zs.length === 1) {
        var sgn = zs[0][0] === zs[0][1] ? 1 : -1;
          // \uB300\uAC01 \uCE78\uC774 \uBE44\uBA74 \uB300\uAC01 +0.5,
          // \uBE44\uB300\uAC01 \u22120.5 (\uC8FC\uBCC0\uD569 \uC720\uC9C0)
        T[0][0] += 0.5 * sgn; T[1][1] += 0.5 * sgn; T[0][1] -= 0.5 * sgn; T[
          1][0] -= 0.5 * sgn;
      }
      if (T[0][0] * T[1][1] === T[0][1] * T[1][0]) return { rho: 0, n: n,
        table: T, zeroCells: zeroCells };
    }
    var ta = [-Infinity].concat(tx.tau, [Infinity]), tb = [
      -Infinity].concat(ty.tau, [Infinity]);
    function nll(rho) {
      var ll = 0;
      for (var i = 0; i < I; i++) for (var j = 0; j < J; j++) {
        if (!T[i][j]) continue;
        var p = pbvnorm(ta[i + 1], tb[j + 1], rho) - pbvnorm(ta[i], tb[j +
          1], rho) - pbvnorm(ta[i + 1], tb[j], rho) + pbvnorm(ta[i], tb[j],
          rho);
        ll += T[i][j] * Math.log(Math.max(p, 1e-300));
      }
      return -ll;
    }
    var opt = fminBrent(nll, -0.9999, 0.9999, 1e-12);
    return { rho: opt.x, n: n, table: T, zeroCells: zeroCells };
  }

  // \uB2E4\uACC4\uC5F4\uC0C1\uAD00(polyserial): \uC5F0\uC18D\uBCC0\uC218
  // x(\uD3C9\uADE0\u00B7SD \uACE0\uC815), \uC21C\uC11C\uD615 y(\uC5ED\uCE58
  // \uACE0\uC815)\uC5D0\uC11C \u03C1 \uCD5C\uB300\uC6B0\uB3C4
  function polyserial(xin, yin, ty) {
    ty = ty || thresholds(yin);
    var xs = clean(xin), m = mean(xs), s = Math.sqrt(variance(xs) * (
      xs.length - 1) / xs.length); // ML(N) \uBD84\uC0B0
    var z = [], k = [];
    for (var r = 0; r < xin.length; r++) if (isNum(xin[r]) && isNum(yin[r]))
      { z.push((xin[r] - m) / s); k.push(ty.levels.indexOf(yin[r])); }
    var tb = [-Infinity].concat(ty.tau, [Infinity]);
    function nll(rho) {
      var sq = Math.sqrt(1 - rho * rho), ll = 0;
      for (var i = 0; i < z.length; i++) {
        var p = pnorm((tb[k[i] + 1] - rho * z[i]) / sq) - pnorm((tb[k[i]] -
          rho * z[i]) / sq);
        ll += Math.log(Math.max(p, 1e-300));
      }
      return -ll;
    }
    return { rho: fminBrent(nll, -0.9999, 0.9999, 1e-12).x, n: z.length };
  }

  // qgraph::cor_auto \uD310\uC815 \uADDC\uCE59: \uC815\uC218\uC774\uACE0
  // \uACE0\uC720\uAC12 \uC218(\uACB0\uCE21 NA \uD3EC\uD568) \u2264 7
  // \uC774\uBA74 \uC21C\uC11C\uD615
  function isOrdinalAuto(x, maxLevels) {
    maxLevels = maxLevels || 7;
    var vals = clean(x);
    if (!vals.every(function (v) { return v % 1 === 0; })) return false;
    var nl = ordLevels(x).length + (vals.length < x.length ? 1 : 0);
    return nl <= maxLevels;
  }

  // \uD63C\uD569 \uC0C1\uAD00\uD589\uB82C (lavaan::lavCor(estimator =
  // "two.step", missing = "pairwise")\uC640 \uAC19\uC740 \uADDC\uCE59)
  function corAuto(cols, opts) {
    opts = opts || {};
    var p = cols.length, R = identity(p), ord = cols.map(function (c, i) {
      return opts.ordinal ? opts.ordinal[i] : isOrdinalAuto(c); });
    var th = cols.map(function (c, i) { return ord[i] ? thresholds(c) :
      null; });
    var kinds = zeros(p, p).map(function (r) { return r.map(function () {
      return ''; }); }), notes = [];
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var r;
      if (ord[i] && ord[j]) { var pc = polychoric(cols[i], cols[j], th[i],
        th[j]); r = pc.rho; kinds[i][j] = th[i].levels.length === 2 && th[
        j].levels.length === 2 ? 'tetrachoric' : 'polychoric'; if (
        pc.zeroCells) notes.push(i + ',' + j); }
      else if (ord[i]) { r = polyserial(cols[j], cols[i], th[i]).rho; kinds[
        i][j] = 'polyserial'; }
      else if (ord[j]) { r = polyserial(cols[i], cols[j], th[j]).rho; kinds[
        i][j] = 'polyserial'; }
      else { r = corTest(cols[i], cols[j], 'pearson').r; kinds[i][j] =
        'pearson'; }
      R[i][j] = R[j][i] = r; kinds[j][i] = kinds[i][j];
    }
    return { R: R, ordinal: ord, kinds: kinds, zeroCellPairs: notes };
  }

  // \uAC00\uC7A5 \uAC00\uAE4C\uC6B4 \uC591\uC815\uCE58
  // \uC0C1\uAD00\uD589\uB82C (Higham, 2002; Matrix::nearPD(corr = TRUE,
  // keepDiag = TRUE)\uC640 \uAC19\uC740 \uC808\uCC28)
  function nearPD(x, opts) {
    opts = opts || {};
    var eigTol = 1e-6, convTol = 1e-7, posdTol = 1e-8, n = x.length;
    var X = copyM(x), DS = zeros(n, n), it = 0, conv = Infinity;
    function normInf(M) { return Math.max.apply(null, M.map(function (r) {
      return r.reduce(function (s, v) { return s + Math.abs(v); }, 0); }));
      }
    while (it < 100 && conv > convTol) {
      var Y = X, R = Y.map(function (r, i) { return r.map(function (v, j) {
        return v - DS[i][j]; }); });
      var e = eigenSym(R), thr = eigTol * e.values[0], Q = e.vectors, d =
        e.values;
      X = zeros(n, n);
      for (var k = 0; k < n; k++) if (d[k] > thr) for (var a = 0; a < n;
        a++) for (var b = 0; b < n; b++) X[a][b] += Q[a][k] * d[k] * Q[b][
        k];
      DS = X.map(function (r, i) { return r.map(function (v, j) { return v -
        R[i][j]; }); });
      for (var q = 0; q < n; q++) X[q][q] = 1;
      conv = normInf(Y.map(function (r, i) { return r.map(function (v, j) {
        return v - X[i][j]; }); })) / normInf(Y);
      it++;
    }
    var e2 = eigenSym(X), Eps = posdTol * Math.abs(e2.values[0]);
    if (e2.values[n - 1] < Eps) {
      var dd = e2.values.map(function (v) { return Math.max(v, Eps); }), Q2
        = e2.vectors, X2 = zeros(n, n);
      for (var k2 = 0; k2 < n; k2++) for (var a2 = 0; a2 < n; a2++) for (var
        b2 = 0; b2 < n; b2++) X2[a2][b2] += Q2[a2][k2] * dd[k2] * Q2[b2][
        k2];
      var D = X2.map(function (r, i) { return Math.sqrt(Math.max(Eps, 1) /
        r[i]); });
      X = X2.map(function (r, i) { return r.map(function (v, j) { return v *
        D[i] * D[j]; }); });
    }
    for (var z = 0; z < n; z++) X[z][z] = 1;
    return { mat: X, iterations: it };
  }

  /* ------------------------------------------------------------------ */
  /* 11. \uC704\uACC4\uC801 \uD68C\uADC0 \u00B7 \uC870\uC808 \u00B7
    \uB9E4\uAC1C (PROCESS Model 1, 4\uC640 \uAC19\uC740 OLS \uC815\uC758)  
    */
  /* ------------------------------------------------------------------ */

  // blocks: [[cols...], [cols...]] \uB204\uC801 \uD22C\uC785. \uBAA8\uB4E0
  // \uB2E8\uACC4\uB294 \uAC19\uC740 \uC0AC\uB840(\uBAA9\uB85D\uBCC4
  // \uC81C\uAC70)
  function hierarchicalRegression(yin, blocks, blockNames, opts) {
    opts = opts || {};
    var all = [yin]; blocks.forEach(function (b) { all = all.concat(b); });
    var rows = completeRows(all), sub = function (c) { return rows.map(
      function (i) { return c[i]; }); };
    var y = sub(yin), cum = [], cumNames = [], models = [];
    blocks.forEach(function (b, k) {
      cum = cum.concat(b.map(sub)); cumNames = cumNames.concat(blockNames[
        k]);
      if (opts.logistic) models.push(logisticRegression(y, cum, cumNames,
        opts));
      else models.push(linearRegression(y, cum, cumNames));
    });
    var steps = models.map(function (m, k) {
      if (opts.logistic) {
        var prevDev = k ? models[k - 1].deviance : models[0].nullDeviance,
          prevDf = k ? models[k - 1].dfM : 0;
        var chi = prevDev - m.deviance, df = m.dfM - prevDf;
        return { model: m, blockChi2: chi, blockDf: df, blockP: pchisqUpper(
          chi, df) };
      }
      var prevR2 = k ? models[k - 1].R2 : 0, df1 = m.dfM - (k ? models[k -
        1].dfM : 0), df2 = m.dfE;
      var dR2 = m.R2 - prevR2, F = (dR2 / df1) / ((1 - m.R2) / df2);
      return { model: m, dR2: dR2, dF: F, df1: df1, df2: df2, dP: pfUpper(F,
        df1, df2) };
    });
    return { n: rows.length, steps: steps };
  }

  function olsFit(y, Xc) {
    // \uB0B4\uBD80\uC6A9: \uACC4\uC218, \uACF5\uBD84\uC0B0,
    // \uC790\uC720\uB3C4
    var n = y.length, p = Xc.length + 1;
    var X = y.map(function (_, r) { return [1].concat(Xc.map(function (c) {
      return c[r]; })); });
    var fit = qrLeastSquares(X, y), b = fit.beta, sse = 0, my = mean(y), sst
      = 0;
    for (var i = 0; i < n; i++) { var yh = 0; for (var j = 0; j < p; j++) yh
      += X[i][j] * b[j]; sse += (y[i] - yh) * (y[i] - yh); sst += (y[i] -
      my) * (y[i] - my); }
    var mse = sse / (n - p);
    return { b: b, cov: fit.XtXinv.map(function (r) { return r.map(function
      (v) { return v * mse; }); }), dfE: n - p, R2: 1 - sse / sst, mse: mse,
      sse: sse };
  }
  function coefTable(fit, names, conf) {
    var tc = qt(1 - (1 - (conf || 0.95)) / 2, fit.dfE);
    return fit.b.map(function (b, j) {
      var se = Math.sqrt(fit.cov[j][j]), t = b / se;
      return { name: j ? names[j - 1] : '(\uC808\uD3B8)', b: b, se: se, t:
        t, p: ptTwoSided(t, fit.dfE), ciLow: b - tc * se, ciHigh: b + tc *
        se };
    });
  }

  // \uC870\uC808\uBD84\uC11D (PROCESS Model 1): Y = b0 + b1 X + b2 W + b3
  // XW + \uACF5\uBCC0\uC778
  function moderation(yin, xin, win, covs, opts) {
    opts = opts || {};
    covs = covs || [];
    var rows = completeRows([yin, xin, win].concat(covs)), sub = function (
      c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), w = sub(win), cv = covs.map(sub), n =
      y.length;
    var mx = opts.center ? mean(x) : 0, mw = opts.center ? mean(w) : 0;
    var xc = x.map(function (v) { return v - mx; }), wc = w.map(function (v)
      { return v - mw; });
    var xw = xc.map(function (v, i) { return v * wc[i]; });
    var full = olsFit(y, [xc, wc, xw].concat(cv)), red = olsFit(y, [xc,
      wc].concat(cv));
    var df1 = 1, F = ((full.R2 - red.R2) / df1) / ((1 - full.R2) /
      full.dfE);
    var names = ['X', 'W', 'X\u00D7W'].concat((opts.covNames || []));
    var coefs = coefTable(full, names);
    // \uB2E8\uC21C\uAE30\uC6B8\uAE30: \u03B8(W) = b1 + b3 W
    var b1 = full.b[1], b3 = full.b[3], v11 = full.cov[1][1], v33 =
      full.cov[3][3], v13 = full.cov[1][3], tc = qt(0.975, full.dfE);
    function slopeAt(wv) {
      // wv: (\uC911\uC2EC\uD654\uB41C \uCC99\uB3C4\uC5D0\uC11C\uC758) W
      // \uAC12
      var est = b1 + b3 * wv, se = Math.sqrt(v11 + 2 * wv * v13 + wv * wv *
        v33), t = est / se;
      return { w: wv + mw, est: est, se: se, t: t, p: ptTwoSided(t,
        full.dfE), ciLow: est - tc * se, ciHigh: est + tc * se };
    }
    var wvals, isBinary = ordLevels(w).length === 2;
    if (isBinary) wvals = ordLevels(w);
    else if (opts.probe === 'percentile') wvals = [quantile(w, 0.16),
      quantile(w, 0.5), quantile(w, 0.84)];
    else { var m = mean(w), s = sd(w); wvals = [m - s, m, m + s]; }
    var slopes = wvals.map(function (v) { return slopeAt(v - mw); });
    // Johnson-Neyman: (b1 + b3 w)^2 = tc^2 (v11 + 2 w v13 + w^2 v33)
    var A2 = b3 * b3 - tc * tc * v33, B2 = 2 * (b1 * b3 - tc * tc * v13), C2
      = b1 * b1 - tc * tc * v11, disc = B2 * B2 - 4 * A2 * C2, jn = [];
    if (!isBinary && disc >= 0 && A2 !== 0) {
      [(-B2 - Math.sqrt(disc)) / (2 * A2), (-B2 + Math.sqrt(disc)) / (2 *
        A2)].forEach(function (r0) {
        var wr = r0 + mw; if (wr >= Math.min.apply(null, w) && wr <=
          Math.max.apply(null, w)) jn.push(wr);
      });
    }
    var wmin = Math.min.apply(null, w), wmax = Math.max.apply(null, w),
      sigBelow = null;
    if (jn.length) { var probe = slopeAt((jn[0] + wmin) / 2 - mw); sigBelow
      = probe.p < 0.05; }
    return { n: n, coefs: coefs, R2: full.R2, dR2: full.R2 - red.R2, F: F,
      df1: df1, df2: full.dfE, p: pfUpper(F, df1, full.dfE),
      slopes: slopes, jn: jn, jnSigBelow: sigBelow, wRange: [wmin, wmax],
        centered: !!opts.center, meanX: mean(x), meanW: mean(w), sdX: sd(x),
        sdW: sd(w),
      b: full.b, xMean: mx, wMean: mw, binaryW: isBinary, covMeans: cv.map(
        mean), xRange: [Math.min.apply(null, x), Math.max.apply(null, x)] };
  }

  // \uB9E4\uAC1C\uBD84\uC11D (PROCESS Model 4, \uBCD1\uB82C \uB9E4\uAC1C):
  // X \u2192 M1..Mk \u2192 Y, \uACF5\uBCC0\uC778 \uD3EC\uD568,
  // \uBC31\uBD84\uC704 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9
  function mediationFit(y, x, ms, cv) {
    var a = ms.map(function (m) { var f = olsFit(m, [x].concat(cv));
      return { fit: f, a: f.b[1] }; });
    var fy = olsFit(y, [x].concat(ms, cv)), ft = olsFit(y, [x].concat(cv));
    var b = ms.map(function (_, k) { return fy.b[2 + k]; });
    var ind = a.map(function (ak, k) { return ak.a * b[k]; });
    return { a: a, fy: fy, ft: ft, b: b, ind: ind, total: ft.b[1], direct:
      fy.b[1], totalInd: sum(ind) };
  }
  function mediation(yin, xin, msIn, covs, opts) {
    opts = opts || {};
    covs = covs || [];
    var rows = completeRows([yin, xin].concat(msIn, covs)), sub = function (
      c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), ms = msIn.map(sub), cv = covs.map(sub),
      n = y.length;
    var est = mediationFit(y, x, ms, cv), k = ms.length;
    var sdx = sd(x), sdy = sd(y);
    var res = { n: n, k: k, est: est, sdx: sdx, sdy: sdy };
    // Sobel (\uB2E8\uC77C \uB9E4\uAC1C, 1\uCC28 \uADFC\uC0AC)
    res.sobel = est.a.map(function (ak, j) {
      var sa = Math.sqrt(ak.fit.cov[1][1]), sb = Math.sqrt(est.fy.cov[2 +
        j][2 + j]), se = Math.sqrt(ak.a * ak.a * sb * sb + est.b[j] * est.b[
        j] * sa * sa), z = est.ind[j] / se;
      return { se: se, z: z, p: 2 * pnormUpper(Math.abs(z)) };
    });
    var B = opts.boot === undefined ? 5000 : opts.boot;
    if (B > 0) {
      var rand = rng(opts.seed || 1), boots = [], totalB = [], contrast = [
        ];
      for (var bI = 0; bI < B; bI++) {
        var idx = []; for (var i = 0; i < n; i++) idx.push(Math.floor(rand()
          * n));
        var pick = function (c) { return idx.map(function (q) { return c[q];
          }); };
        try {
          var e = mediationFit(pick(y), pick(x), ms.map(pick), cv.map(
            pick));
          boots.push(e.ind); totalB.push(e.totalInd);
        } catch (er) { /* \uD2B9\uC774 \uC7AC\uD45C\uBCF8 \uC0DD\uB7B5 */ }
      }
      var ci = function (arr) { return [quantile(arr, 0.025), quantile(arr,
        0.975)]; };
      res.boot = { B: boots.length, ind: est.ind.map(function (_, j) { var
        col = boots.map(function (r) { return r[j]; }); return { se: sd(
        col), ci: ci(col) }; }),
        total: { se: sd(totalB), ci: ci(totalB) } };
    }
    return res;
  }

  /*
   * \uC870\uAC74\uBD80 \uACFC\uC815 \uBAA8\uD615 (Hayes, 2022\uC758 PROCESS
  \uBAA8\uD615 \uBC88\uD638\uB97C \uB530\uB984; OLS \uBC29\uC815\uC2DD +
  \uBC31\uBD84\uC704 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9)
   *  6: \uC21C\uCC28 \uB9E4\uAC1C M1 \u2192 M2 \u2192 \u2026 (k = 2\u20134)
   *  7: W\uAC00 X\u2192M (a) \uACBD\uB85C \uC870\uC808        8: 7 +
  W\uAC00 X\u2192Y (c\u2032) \uC870\uC808
   * 14: W\uAC00 M\u2192Y (b) \uACBD\uB85C \uC870\uC808        15: 14 +
  W\uAC00 X\u2192Y (c\u2032) \uC870\uC808
   * 7/8/14/15\uB294 \uB9E4\uAC1C\uBCC0\uC218\uAC00 \uC5EC\uB7EC
  \uAC1C\uBA74 \uBCD1\uB82C\uB85C \uAC01\uAC01 \uC870\uC808\uB41C\uB2E4.
   */
  function processModel(yin, xin, msIn, win, covs, opts) {
    opts = opts || {};
    var model = opts.model, k = msIn.length, hasW = [7, 8, 14, 15].indexOf(
      model) >= 0;
    if ([6, 7, 8, 14, 15].indexOf(model) < 0) throw new Error(
      ('\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBAA8\uD615 \uBC88'
      + '\uD638\uC785\uB2C8\uB2E4.'));
    if (model === 6 && (k < 2 || k > 4)) throw new Error(
      ('\uC21C\uCC28 \uB9E4\uAC1C(Model 6)\uB294 \uB9E4\uAC1C'
      + '\uBCC0\uC218 2\u20134\uAC1C\uAC00 \uD544\uC694\uD569\uB2C8'
      + '\uB2E4.'));
    if (hasW && !win) throw new Error(
      ('\uC870\uC808\uBCC0\uC218 W\uAC00 \uD544\uC694\uD569\uB2C8'
      + '\uB2E4.'));
    covs = covs || [];
    var all = [yin, xin].concat(msIn, hasW ? [win] : [], covs);
    var rows = completeRows(all), sub = function (c) { return rows.map(
      function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), ms = msIn.map(sub), w = hasW ? sub(win)
      : null, cv = covs.map(sub), n = y.length;
    var cX = opts.center ? mean(x) : 0, cW = hasW && opts.center ? mean(w) :
      0, cM = ms.map(function (m) { return opts.center ? mean(m) : 0; });
    var wvals = null, binaryW = false;
    if (hasW) {
      binaryW = ordLevels(w).length === 2;
      if (binaryW) wvals = ordLevels(w);
      else if (opts.probe === 'percentile') wvals = [quantile(w, 0.16),
        quantile(w, 0.5), quantile(w, 0.84)];
      else { var mw = mean(w), sw = sd(w); wvals = [mw - sw, mw, mw + sw]; }
    }
    var mod = function (a, c0) { return a.map(function (v) { return v - c0;
      }); };
    var prod = function (a, ca, b, cb) { return a.map(function (v, i) {
      return (v - ca) * (b[i] - cb); }); };

    // \uD55C \uBC88 \uC801\uD569 \u2192 { eqs,
    // effects(\uC774\uB984\u2192\uAC12) }
    function fitOnce(y, x, ms, w, cv) {
      var eqs = [], eff = {}, xx = mod(x, cX), Xw = hasW ? prod(x, cX, w,
        cW) : null, ww = hasW ? mod(w, cW) : null;
      var mEq = [];
      for (var j = 0; j < k; j++) {
        var pred, names;
        if (model === 6) { pred = [xx].concat(ms.slice(0, j).map(function (
          m, q) { return mod(m, cM[q]); })); names = ['X'].concat(ms.slice(
          0, j).map(function (_, q) { return 'M' + (q + 1); })); }
        else if (model === 7 || model === 8) { pred = [xx, ww, Xw]; names =
          ['X', 'W', 'X\u00D7W']; }
        else { pred = [xx]; names = ['X']; }
        var f = olsFit(ms[j], pred.concat(cv));
        mEq.push(f); eqs.push({ outcome: 'M' + (j + 1), fit: f, names:
          names, nPred: pred.length + cv.length });
      }
      var yPred = [xx], yNames = ['X'];
      ms.forEach(function (m, j) { yPred.push(mod(m, cM[j])); yNames.push(
        'M' + (j + 1)); });
      if (model === 8) { yPred.push(ww, Xw); yNames.push('W', 'X\u00D7W'); }
      if (model === 14 || model === 15) {
        yPred.push(ww); yNames.push('W');
        ms.forEach(function (m, j) { yPred.push(prod(m, cM[j], w, cW));
          yNames.push('M' + (j + 1) + '\u00D7W'); });
        if (model === 15) { yPred.push(Xw); yNames.push('X\u00D7W'); }
      }
      var fy = olsFit(y, yPred.concat(cv));
      eqs.push({ outcome: 'Y', fit: fy, names: yNames, nPred: yPred.length +
        cv.length });
      var bIdx = function (j) { return 2 + j; };
        // Y\uC2DD\uC5D0\uC11C M_j \uACC4\uC218 \uC704\uCE58
        // (\uC808\uD3B8=0, X=1)
      if (model === 6) {
        // \uC21C\uC11C\uB97C \uC9C0\uD0A4\uB294 \uBAA8\uB4E0 \uB9E4\uAC1C
        // \uBD80\uBD84\uC9D1\uD569 \uACBD\uB85C
        for (var mask = 1; mask < (1 << k); mask++) {
          var path = []; for (var q = 0; q < k; q++) if (mask & (1 << q))
            path.push(q);
          var e = mEq[path[0]].b[1];
          for (var t = 1; t < path.length; t++) e *= mEq[path[t]].b[2 +
            path[t - 1]];
            // M_t \uC2DD\uC5D0\uC11C M_{s} \uACC4\uC218: \uC808\uD3B8, X,
            // M1.. \uC21C\uC11C
          e *= fy.b[bIdx(path[path.length - 1])];
          eff['ind:' + path.join('-')] = e;
        }
      } else {
        for (var j2 = 0; j2 < k; j2++) {
          var bj = fy.b[bIdx(j2)];
          if (model === 7 || model === 8) {
            var a1 = mEq[j2].b[1], a3 = mEq[j2].b[3];
            eff['imm:' + j2] = a3 * bj;
            wvals.forEach(function (wv, wi) { eff['cond:' + j2 + ':' + wi] =
              (a1 + a3 * (wv - cW)) * bj; });
          } else {
            var a = mEq[j2].b[1], b1 = bj, b3 = fy.b[2 + k + 1 + j2];
            eff['imm:' + j2] = a * b3;
            wvals.forEach(function (wv, wi) { eff['cond:' + j2 + ':' + wi] =
              a * (b1 + b3 * (wv - cW)); });
          }
        }
      }
      return { eqs: eqs, eff: eff };
    }

    var est = fitOnce(y, x, ms, w, cv);
    // \uCD1D\uD6A8\uACFC (Model 6\uC5D0\uC11C\uB9CC \uC758\uBBF8
    // \uC788\uAC8C \uBD84\uD574: c = c\u2032 + \u03A3\uAC04\uC811)
    var total = null;
    if (model === 6) { var ft = olsFit(y, [mod(x, cX)].concat(cv)); total =
      { fit: ft }; }
    // \uC9C1\uC811\uD6A8\uACFC
    var fy = est.eqs[k].fit, tc = qt(0.975, fy.dfE), direct = [];
    if (model === 8 || model === 15) {
      var xwPos = est.eqs[k].names.indexOf('X\u00D7W') + 1, c1 = fy.b[1], c3
        = fy.b[xwPos];
      wvals.forEach(function (wv) {
        var wc = wv - cW, e = c1 + c3 * wc, se = Math.sqrt(fy.cov[1][1] + 2
          * wc * fy.cov[1][xwPos] + wc * wc * fy.cov[xwPos][xwPos]), t = e /
          se;
        direct.push({ w: wv, est: e, se: se, t: t, p: ptTwoSided(t, fy.dfE),
          ciLow: e - tc * se, ciHigh: e + tc * se });
      });
    } else {
      var se0 = Math.sqrt(fy.cov[1][1]), t0 = fy.b[1] / se0;
      direct.push({ w: null, est: fy.b[1], se: se0, t: t0, p: ptTwoSided(t0,
        fy.dfE), ciLow: fy.b[1] - tc * se0, ciHigh: fy.b[1] + tc * se0 });
    }
    var keys = Object.keys(est.eff), boot = null, B = opts.boot ===
      undefined ? 5000 : opts.boot;
    if (B > 0) {
      var rand = rng(opts.seed || 1), draws = keys.map(function () {
        return []; }), ok = 0;
      for (var bI = 0; bI < B; bI++) {
        var idx = []; for (var i = 0; i < n; i++) idx.push(Math.floor(rand()
          * n));
        var pk = function (c) { return idx.map(function (q) { return c[q];
          }); };
        try {
          var e2 = fitOnce(pk(y), pk(x), ms.map(pk), hasW ? pk(w) : null,
            cv.map(pk)).eff;
          keys.forEach(function (kk, q) { draws[q].push(e2[kk]); }); ok++;
        } catch (er) { /* \uD2B9\uC774 \uC7AC\uD45C\uBCF8 \uC0DD\uB7B5 */ }
      }
      boot = { B: ok, stats: {} };
      // Model 6 \uCD1D \uAC04\uC811\uD6A8\uACFC
      if (model === 6) { var tot = draws[0].map(function (_, r) {
        return sum(draws.map(function (d) { return d[r]; })); });
        boot.stats.totalInd = { se: sd(tot), ci: [quantile(tot, 0.025),
        quantile(tot, 0.975)] }; }
      keys.forEach(function (kk, q) { boot.stats[kk] = { se: sd(draws[q]),
        ci: [quantile(draws[q], 0.025), quantile(draws[q], 0.975)] }; });
    }
    var eqOut = est.eqs.map(function (e) {
      var R2 = e.fit.R2, dfM = e.nPred, F = (R2 / dfM) / ((1 - R2) /
        e.fit.dfE);
      return { outcome: e.outcome, names: e.names, coefs: coefTable(e.fit,
        e.names.concat((opts.covNames || []))), R2: R2, F: F, dfM: dfM, dfE:
        e.fit.dfE, p: pfUpper(F, dfM, e.fit.dfE) };
    });
    return { model: model, n: n, k: k, eqs: eqOut, effects: est.eff,
      totalInd: model === 6 ? sum(keys.map(function (kk) { return est.eff[
      kk]; })) : null,
      total: total ? coefTable(total.fit, ['X'])[1] : null, direct: direct,
        boot: boot, wvals: wvals, binaryW: binaryW, centered: !!opts.center,
        sdx: sd(x), sdy: sd(y) };
  }

  /* ------------------------------------------------------------------ */
  /* 12. \uB2E4\uBCC0\uB7C9: \uC77C\uC6D0 MANOVA \u00B7
    \uC120\uD615\uD310\uBCC4\uBD84\uC11D                              */
  /* ------------------------------------------------------------------ */

  // \uC9D1\uB2E8\uBCC4 \uC790\uB8CC \uC900\uBE44:
  // cols(\uC885\uC18D\uBCC0\uC218\uB4E4), g(\uC9D1\uB2E8) \u2192
  // \uBAA9\uB85D\uBCC4 \uC81C\uAC70
  function groupData(cols, gin) {
    var rows = [];
    for (var i = 0; i < gin.length; i++) {
      var gv = gin[i];
      if (gv === null || gv === undefined || gv === '' || (typeof gv ===
        'number' && !isFinite(gv))) continue;
      var ok = true; for (var j = 0; j < cols.length; j++) if (!isNum(cols[
        j][i])) { ok = false; break; }
      if (ok) rows.push(i);
    }
    var labels = []; rows.forEach(function (i) { var l = String(gin[i]); if
      (labels.indexOf(l) < 0) labels.push(l); });
    labels.sort(function (a, b) { var x = Number(a), y = Number(b); return (
      !isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
    var X = rows.map(function (i) { return cols.map(function (c) { return c[
      i]; }); });
    var gi = rows.map(function (i) { return labels.indexOf(String(gin[i]));
      });
    return { X: X, g: gi, labels: labels, rows: rows };
  }
  function sscp(X, g, G) {
    // \uC804\uCCB4\uD3C9\uADE0, \uC9D1\uB2E8\uD3C9\uADE0, E(\uC9D1\uB2E8
    // \uB0B4), H(\uC9D1\uB2E8 \uAC04)
    var n = X.length, p = X[0].length, cnt = new Array(G).fill(0), gm =
      zeros(G, p), m = new Array(p).fill(0);
    X.forEach(function (r, i) { cnt[g[i]]++; for (var j = 0; j < p; j++) {
      gm[g[i]][j] += r[j]; m[j] += r[j]; } });
    for (var k = 0; k < G; k++) for (var j2 = 0; j2 < p; j2++) gm[k][j2] /=
      cnt[k];
    for (var j3 = 0; j3 < p; j3++) m[j3] /= n;
    var E = zeros(p, p), H = zeros(p, p);
    X.forEach(function (r, i) { var mu = gm[g[i]]; for (var a = 0; a < p;
      a++) for (var b = 0; b < p; b++) E[a][b] += (r[a] - mu[a]) * (r[b] -
      mu[b]); });
    for (var k2 = 0; k2 < G; k2++) for (var a2 = 0; a2 < p; a2++) for (var
      b2 = 0; b2 < p; b2++) H[a2][b2] += cnt[k2] * (gm[k2][a2] - m[a2]) * (
      gm[k2][b2] - m[b2]);
    return { n: n, p: p, G: G, cnt: cnt, gm: gm, m: m, E: E, H: H };
  }
  // E^-1 H\uC758 \uACE0\uC720\uAC12\u00B7\uACE0\uC720\uBCA1\uD130 (E = L
  // L^T, A = L^-1 H L^-T)
  function genEigen(H, E) {
    var L = cholesky(E);
    if (!L) throw new Error(
      ('\uC9D1\uB2E8 \uB0B4 \uACF5\uBD84\uC0B0 \uD589\uB82C\uC774 '
      + '\uD2B9\uC774\uD569\uB2C8\uB2E4. \uC885\uC18D\uBCC0\uC218 '
      + '\uAC04 \uC644\uC804\uD55C \uC911\uBCF5\uC774 \uC788\uB294'
      + '\uC9C0, \uC9D1\uB2E8\uBCC4 \uC0AC\uB840 \uC218\uAC00 '
      + '\uCDA9\uBD84\uD55C\uC9C0 \uD655\uC778\uD558\uC138\uC694.'));
    var Li = inverse(L), A = matmul(matmul(Li, H), transpose(Li));
    for (var i = 0; i < A.length; i++) for (var j = i + 1; j < A.length;
      j++) { var v = (A[i][j] + A[j][i]) / 2; A[i][j] = A[j][i] = v; }
    var e = eigenSym(A), LiT = transpose(Li);
    return { values: e.values.map(function (v) { return Math.max(v, 0); }),
      vectors: matmul(LiT, e.vectors) };
      // \uC5F4 k: E^-1 H \uC758 \uACE0\uC720\uBCA1\uD130
  }

  // R stats:::summary.manova\uC640 \uAC19\uC740 \uADFC\uC0AC F
  function manovaTests(eig, q, dfRes) {
    var p = eig.length, s = Math.min(p, q), m = 0.5 * (Math.abs(p - q) - 1),
      nn = 0.5 * (dfRes - p - 1), out = {};
    var V = sum(eig.map(function (e) { return e / (1 + e); }));
    var t1 = 2 * m + s + 1, t2 = 2 * nn + s + 1;
    out.pillai = { stat: V, F: (t2 / t1 * V) / (s - V), df1: s * t1, df2: s
      * t2 };
    var Lam = eig.reduce(function (a, e) { return a / (1 + e); }, 1);
    var w1 = dfRes - 0.5 * (p - q + 1), w2 = (p * q - 2) / 4, w3 = p * p + q
      * q - 5;
    w3 = w3 > 0 ? Math.sqrt(((p * q) * (p * q) - 4) / w3) : 1;
    out.wilks = { stat: Lam, F: ((Math.pow(Lam, -1 / w3) - 1) * (w1 * w3 - 2
      * w2)) / p / q, df1: p * q, df2: w1 * w3 - 2 * w2 };
    var HL = sum(eig), h2 = 2 * (s * nn + 1);
    out.hotelling = { stat: HL, F: (h2 * HL) / s / s / t1, df1: s * t1, df2:
      h2 };
    var roy = Math.max.apply(null, eig), r1 = Math.max(p, q), r2 = dfRes -
      r1 + q;
    out.roy = { stat: roy, F: (r2 * roy) / r1, df1: r1, df2: r2 };
    Object.keys(out).forEach(function (k) { var o = out[k]; o.p = pfUpper(
      o.F, o.df1, o.df2); });
    // \uB2E4\uBCC0\uB7C9 \uBD80\uBD84 \u03B7\u00B2 (SPSS \uC815\uC758)
    out.pillai.eta2 = V / s;
    out.wilks.eta2 = 1 - Math.pow(Lam, 1 / s);
    out.hotelling.eta2 = (HL / s) / (1 + HL / s);
    out.roy.eta2 = roy / (1 + roy);
    return out;
  }

  // Box\uC758 M \uAC80\uC815 (Box, 1949): \u03C7\u00B2 \uBC0F F
  // \uADFC\uC0AC
  function boxM(X, g, G) {
    var p = X[0].length, n = X.length, cnt = new Array(G).fill(0), groups =
      [];
    for (var k = 0; k < G; k++) groups.push([]);
    X.forEach(function (r, i) { groups[g[i]].push(r); cnt[g[i]]++; });
    if (cnt.some(function (c) { return c <= p; })) return { M: NaN, note:
      ('\uC5B4\uB5A4 \uC9D1\uB2E8\uC758 \uC0AC\uB840 \uC218\uAC00 '
      + '\uC885\uC18D\uBCC0\uC218 \uC218 \uC774\uD558\uB77C Box'
      + '\uC758 M\uC744 \uACC4\uC0B0\uD560 \uC218 \uC5C6\uC2B5'
      + '\uB2C8\uB2E4.') };
    var Sp = zeros(p, p), logdets = 0;
    groups.forEach(function (gr) {
      var cs = []; for (var j = 0; j < p; j++) cs.push(gr.map(function (r) {
        return r[j]; }));
      var Si = covMatrix(cs);
      for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) Sp[a][b] += (
        gr.length - 1) * Si[a][b];
      logdets += (gr.length - 1) * logdetPD(Si);
    });
    for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Sp[a2][b2]
      /= (n - G);
    var M = (n - G) * logdetPD(Sp) - logdets;
    var sInv = sum(cnt.map(function (c) { return 1 / (c - 1); })), sInv2 =
      sum(cnt.map(function (c) { return 1 / ((c - 1) * (c - 1)); }));
    var c1 = (sInv - 1 / (n - G)) * (2 * p * p + 3 * p - 1) / (6 * (p + 1) *
      (G - 1));
    var df1 = p * (p + 1) * (G - 1) / 2, chi = M * (1 - c1);
    var c2 = (p - 1) * (p + 2) / (6 * (G - 1)) * (sInv2 - 1 / ((n - G) * (n
      - G))), F, df2;
    if (c2 - c1 * c1 > 0) { df2 = (df1 + 2) / (c2 - c1 * c1); var bb = df1 /
      (1 - c1 - df1 / df2); F = M / bb; }
    else { df2 = (df1 + 2) / (c1 * c1 - c2); var b3 = df2 / (1 - c1 + 2 /
      df2); F = df2 * M / (df1 * (b3 - M)); }
    return { M: M, chi2: chi, df: df1, pChi: pchisqUpper(chi, df1), F: F,
      df1: df1, df2: df2, pF: pfUpper(F, df1, df2) };
  }

  function manova(cols, gin, names) {
    var gd = groupData(cols, gin), G = gd.labels.length, p = cols.length;
    if (G < 2) throw new Error(
      ('\uC9D1\uB2E8\uC774 2\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C '
      + '\uD569\uB2C8\uB2E4.'));
    var ss = sscp(gd.X, gd.g, G), dfRes = ss.n - G, q = G - 1;
    if (dfRes < p) throw new Error(
      ('\uC0AC\uB840 \uC218\uAC00 \uB108\uBB34 \uC801\uC2B5\uB2C8'
      + '\uB2E4.'));
    var ge = genEigen(ss.H, ss.E);
    var tests = manovaTests(ge.values, q, dfRes);
    var uni = names.map(function (nm, j) {
      var ssb = ss.H[j][j], ssw = ss.E[j][j], F = (ssb / q) / (ssw / dfRes);
      return { name: nm, ssb: ssb, ssw: ssw, df1: q, df2: dfRes, F: F, p:
        pfUpper(F, q, dfRes), eta2: ssb / (ssb + ssw) };
    });
    var desc = gd.labels.map(function (l, k) {
      var idx = []; gd.g.forEach(function (gg, i) { if (gg === k) idx.push(
        i); });
      return { label: l, n: ss.cnt[k], means: names.map(function (_, j) {
        return mean(idx.map(function (i) { return gd.X[i][j]; })); }),
        sds: names.map(function (_, j) { return sd(idx.map(function (i) {
          return gd.X[i][j]; })); }) };
    });
    return { n: ss.n, p: p, G: G, labels: gd.labels, tests: tests, eig:
      ge.values, univariate: uni, desc: desc, boxM: boxM(gd.X, gd.g, G),
      levene: names.map(function (_, j) { var grs = gd.labels.map(function (
        _, k) { return gd.X.filter(function (_, i) { return gd.g[i] === k;
        }).map(function (r) { return r[j]; }); }); return leveneTest(grs,
        'mean'); }) };
  }

  /*
   * \uC120\uD615\uD310\uBCC4\uBD84\uC11D (SPSS \uD310\uBCC4\uBD84\uC11D /
  MASS::lda\uC640 \uAC19\uC740 \uC815\uC758)
   * \uBE44\uD45C\uC900\uD654 \uACC4\uC218: \uC9D1\uB2E8 \uB0B4
  \uD569\uB3D9\uACF5\uBD84\uC0B0 W\uC5D0 \uB300\uD574 a'Wa = 1 \uB85C
  \uC815\uADDC\uD654
   */
  function discriminant(cols, gin, names, opts) {
    opts = opts || {};
    var gd = groupData(cols, gin), G = gd.labels.length, p = cols.length;
    if (G < 2) throw new Error(
      ('\uC9D1\uB2E8\uC774 2\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C '
      + '\uD569\uB2C8\uB2E4.'));
    var ss = sscp(gd.X, gd.g, G), n = ss.n, dfW = n - G;
    var W = ss.E.map(function (r) { return r.map(function (v) { return v /
      dfW; }); });
    var ge = genEigen(ss.H, ss.E), r = Math.min(p, G - 1);
    var eig = ge.values.slice(0, r), totalEig = sum(eig);
    var A = [];
      // A[k] = \uD310\uBCC4\uD568\uC218 k\uC758 \uBE44\uD45C\uC900\uD654
      // \uACC4\uC218
    for (var k = 0; k < r; k++) {
      var a = ge.vectors.map(function (row) { return row[k]; });
      var Wa = W.map(function (row) { return sum(row.map(function (v, j) {
        return v * a[j]; })); }), s = Math.sqrt(sum(a.map(function (v, j) {
        return v * Wa[j]; })));
      a = a.map(function (v) { return v / s; });
      // \uBD80\uD638 \uADDC\uCE59: \uCCAB \uC9D1\uB2E8 \uC911\uC2EC\uC774
      // \uC74C\uC218\uAC00 \uB418\uB3C4\uB85D (\uD574\uC11D \uD3B8\uC758;
      // \uBD80\uD638\uB294 \uC784\uC758)
      var c0 = sum(a.map(function (v, j) { return v * (ss.gm[0][j] - ss.m[
        j]); }));
      if (c0 > 0) a = a.map(function (v) { return -v; });
      A.push(a);
    }
    var funcs = A.map(function (a, k) {
      var Wa = W.map(function (row) { return sum(row.map(function (v, j) {
        return v * a[j]; })); });
      return {
        eigen: eig[k], pctVar: eig[k] / totalEig, canCor: Math.sqrt(eig[k] /
          (1 + eig[k])),
        coef: a, constant: -sum(a.map(function (v, j) { return v * ss.m[j];
          })),
        stdCoef: a.map(function (v, j) { return v * Math.sqrt(W[j][j]); }),
        structure: Wa.map(function (v, j) { return v / Math.sqrt(W[j][j]);
          }),
        centroids: ss.gm.map(function (mu) { return sum(a.map(function (v,
          j) { return v * (mu[j] - ss.m[j]); })); })
      };
    });
    // \uC21C\uCC28 Wilks' \u039B (Bartlett \u03C7\u00B2)
    var wilksSeq = [];
    for (var k2 = 0; k2 < r; k2++) {
      var lam = 1; for (var i2 = k2; i2 < r; i2++) lam /= (1 + eig[i2]);
      var chi = -(n - 1 - (p + G) / 2) * Math.log(lam), df = (p - k2) * (G -
        1 - k2);
      wilksSeq.push({ from: k2 + 1, to: r, lambda: lam, chi2: chi, df: df,
        p: pchisqUpper(chi, df) });
    }
    // \uBD84\uB958 (\uC120\uD615 \uBD84\uB958\uD568\uC218)
    var priors = opts.priors === 'proportional' ? ss.cnt.map(function (c) {
      return c / n; }) : ss.cnt.map(function () { return 1 / G; });
    function classifyWith(Winv, gm, pri, x) {
      var sc = gm.map(function (mu, k3) {
        var wm = Winv.map(function (row) { return sum(row.map(function (v,
          j) { return v * mu[j]; })); });
        return sum(x.map(function (v, j) { return v * wm[j]; })) - 0.5 *
          sum(mu.map(function (v, j) { return v * wm[j]; })) + Math.log(pri[
          k3]);
      });
      var mx = Math.max.apply(null, sc), ex = sc.map(function (v) {
        return Math.exp(v - mx); }), se = sum(ex);
      var post = ex.map(function (v) { return v / se; }), best = 0;
      for (var q = 1; q < post.length; q++) if (post[q] > post[best]) best =
        q;
      return { cls: best, post: post };
    }
    var Winv = inverse(W);
    var classFn = ss.gm.map(function (mu, k4) {
      var wm = Winv.map(function (row) { return sum(row.map(function (v, j)
        { return v * mu[j]; })); });
      return { coef: wm, constant: -0.5 * sum(mu.map(function (v, j) {
        return v * wm[j]; })) + Math.log(priors[k4]) };
    });
    var pred = gd.X.map(function (x) { return classifyWith(Winv, ss.gm,
      priors, x); });
    var conf = zeros(G, G); pred.forEach(function (pr, i) { conf[gd.g[i]][
      pr.cls]++; });
    // \uAD50\uCC28\uD0C0\uB2F9\uD654 (\uD558\uB098\uC529 \uBE7C\uAE30):
    // \uD574\uB2F9 \uC0AC\uB840\uB97C \uBE80 \uD3C9\uADE0\u00B7W\uB85C
    // \uC7AC\uBD84\uB958
    var cv = null;
    if (opts.cv !== false) {
      cv = zeros(G, G);
      for (var i3 = 0; i3 < n; i3++) {
        var gi = gd.g[i3], x = gd.X[i3], cnt = ss.cnt.slice(); cnt[gi]--;
        if (cnt[gi] < 1) continue;
        var mu2 = ss.gm.map(function (mu, k5) { return k5 === gi ? mu.map(
          function (v, j) { return (v * ss.cnt[gi] - x[j]) / cnt[gi]; }) :
          mu; });
        // E\uC5D0\uC11C \uC0AC\uB840 i \uC81C\uAC70: E' = E - (n_g/(n_g-1))
        // (x-m_g)(x-m_g)'
        var dlt = x.map(function (v, j) { return v - ss.gm[gi][j]; }), fac =
          ss.cnt[gi] / (ss.cnt[gi] - 1);
        var W2 = ss.E.map(function (row, a2) { return row.map(function (v,
          b2) { return (v - fac * dlt[a2] * dlt[b2]) / (n - 1 - G); }); });
        var pri2 = opts.priors === 'proportional' ? cnt.map(function (c) {
          return c / (n - 1); }) : priors;
        cv[gi][classifyWith(inverse(W2), mu2, pri2, x).cls]++;
      }
    }
    var acc = function (M) { var t = 0; for (var q = 0; q < G; q++) t += M[
      q][q]; return t / n; };
    return { n: n, p: p, G: G, labels: gd.labels, counts: ss.cnt, names:
      names, funcs: funcs, wilksSeq: wilksSeq, priors: priors,
      classFn: classFn, confusion: conf, accuracy: acc(conf), cvConfusion:
        cv, cvAccuracy: cv ? acc(cv) : NaN,
      posteriors: pred.map(function (pr) { return pr.post; }), predicted:
        pred.map(function (pr) { return pr.cls; }),
      scores: gd.X.map(function (x) { return funcs.map(function (fn) {
        return sum(fn.coef.map(function (v, j) { return v * x[j]; })) +
        fn.constant; }); }),
      groupIndex: gd.g, boxM: boxM(gd.X, gd.g, G),
      univariate: names.map(function (nm, j) { var ssb = ss.H[j][j], ssw =
        ss.E[j][j], F = (ssb / (G - 1)) / (ssw / dfW); return { name: nm,
        lambda: ssw / (ssb + ssw), F: F, df1: G - 1, df2: dfW, p: pfUpper(F,
        G - 1, dfW) }; }) };
  }

  /*
   * \uB124\uD2B8\uC6CC\uD06C \uC548\uC815\uC131 (Epskamp, Borsboom & Fried,
  2018; bootnet \uBC29\uC2DD)
   * bootEdgeOnce: \uC0AC\uB840 \uBCF5\uC6D0\uCD94\uCD9C \uD6C4
  \uC7AC\uCD94\uC815 \u2192 \uC5E3\uC9C0 \uBCA1\uD130(\uC0C1\uC0BC\uAC01)
   * caseDropOnce: \uC0AC\uB840\uC758 prop \uBE44\uC728\uC744 \uC81C\uAC70
  \uD6C4 \uC7AC\uCD94\uC815 \u2192 \uC911\uC2EC\uC131
   */
  function subsetCols(cols, idx) { return cols.map(function (c) {
    return idx.map(function (i) { return c[i]; }); }); }
  function upperVec(m) { var v = []; for (var i = 0; i < m.length; i++) for
    (var j = i + 1; j < m.length; j++) v.push(m[i][j]); return v; }
  function bootEdgeOnce(cols, opts, rand) {
    var n = cols[0].length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var net = estimateNetwork(subsetCols(cols, idx), opts).network;
    return { edges: upperVec(net), centrality: centrality(net) };
  }
  function caseDropOnce(cols, opts, prop, rand) {
    var n = cols[0].length, keep = Math.round(n * (1 - prop)), idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    for (var k = n - 1; k > 0; k--) { var r = Math.floor(rand() * (k + 1)),
      t = idx[k]; idx[k] = idx[r]; idx[r] = t; }
    idx = idx.slice(0, keep).sort(function (a, b) { return a - b; });
    return centrality(estimateNetwork(subsetCols(cols, idx), opts).network);
  }
  // CS \uACC4\uC218: \uC0C1\uAD00 \u2265 cor \uC778 \uD45C\uBCF8\uC774
  // certainty \uC774\uC0C1\uC778 \uCD5C\uB300 \uC81C\uAC70\uBE44\uC728
  function csCoefficient(props, corrsByProp, cor, certainty) {
    cor = cor || 0.7; certainty = certainty || 0.95;
    var cs = 0;
    props.forEach(function (p, i) {
      var arr = corrsByProp[i].filter(isNum);
      if (!arr.length) return;
      var ok = arr.filter(function (r) { return r >= cor; }).length /
        arr.length;
      if (ok >= certainty) cs = Math.max(cs, p);
    });
    return cs;
  }

  G.PsyStats = {
    // \uBD84\uD3EC
    lgamma: lgamma, ibeta: ibeta, gammaP: gammaP, gammaQ: gammaQ,
    pnorm: pnorm, qnorm: qnorm, pt: pt, ptTwoSided: ptTwoSided, qt: qt,
      pfUpper: pfUpper, qf: qf,
    pchisq: pchisq, pchisqUpper: pchisqUpper, qchisq: qchisq, ptukey:
      ptukey,
    // \uD589\uB82C
    inverse: inverse, cholesky: cholesky, eigenSym: eigenSym, matmul:
      matmul, transpose: transpose, logdetPD: logdetPD,
    // \uAE30\uCD08
    isNum: isNum, clean: clean, mean: mean, sd: sd, variance: variance,
      quantile: quantile, quantileSPSS: quantileSPSS, rank: rank,
    pearson: pearson, completeRows: completeRows, descriptives:
      descriptives, shapiroWilk: shapiroWilk,
    // \uAC80\uC815
    tTestOneSample: tTestOneSample, tTestPaired: tTestPaired,
      tTestIndependent: tTestIndependent, leveneTest: leveneTest,
    anovaOneway: anovaOneway, corTest: corTest, corMatrix: corMatrix,
      crosstab: crosstab, fisherExact2x2: fisherExact2x2,
    linearRegression: linearRegression, logisticRegression:
      logisticRegression, reliability: reliability,
    // \uB124\uD2B8\uC6CC\uD06C
    covMatrix: covMatrix, cov2cor: cov2cor, glasso: glasso, ebicGlasso:
      ebicGlasso, partialCorNetwork: partialCorNetwork,
    wi2net: wi2net, centrality: centrality, zscore: zscore, predictability:
      predictability, estimateNetwork: estimateNetwork,
    layoutFR: layoutFR, rng: rng, upperVec: upperVec, bootEdgeOnce:
      bootEdgeOnce, caseDropOnce: caseDropOnce,
    csCoefficient: csCoefficient,
    // \uB2E4\uBD84\uC0C1\uAD00 \u00B7 \uC704\uACC4\uC801 \uD68C\uADC0
    // \u00B7 \uC870\uC808 \u00B7 \uB9E4\uAC1C
    pbvnorm: pbvnorm, bvnu: bvnu, thresholds: thresholds, polychoric:
      polychoric, polyserial: polyserial,
    isOrdinalAuto: isOrdinalAuto, corAuto: corAuto, nearPD: nearPD,
      fminBrent: fminBrent,
    hierarchicalRegression: hierarchicalRegression, moderation: moderation,
      mediation: mediation, processModel: processModel,
    manova: manova, discriminant: discriminant, boxM: boxM
  };
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ?
  global : this);

/*
 * PsyStat \uD1B5\uACC4 \uC5D4\uC9C4 (stats) \u2014 \uC870\uAC01 3/4:
  \uC7A0\uC7AC\uD504\uB85C\uD30C\uC77C
  \uBD84\uC11D(LPA)\u00B7\uC7A0\uC7AC\uACC4\uCE35\uBD84\uC11D(LCA)
 * \uC678\uBD80 \uB77C\uC774\uBE0C\uB7EC\uB9AC\u00B7\uB124\uD2B8\uC6CC\uD06C
  \uD1B5\uC2E0 \uC5C6\uC74C. \uC21C\uC218 JavaScript.
 * - LPA: \uAC00\uC6B0\uC2DC\uC548 \uD63C\uD569\uBAA8\uD615 (mclust
  \uBAA8\uD615 EEI, VVI, EEE, VVV = tidyLPA \uBAA8\uD615 1, 2(\uBCC0\uD615),
  3, 6\uC5D0 \uD574\uB2F9)
 * - LCA: \uBC94\uC8FC\uD615 \uC9C0\uD45C\uC758
  \uC7A0\uC7AC\uACC4\uCE35\uBAA8\uD615 (poLCA\uC640 \uAC19\uC740
  \uBAA8\uD615)
 * - \uCD94\uC815: EM \uC54C\uACE0\uB9AC\uC998, \uC5EC\uB7EC
  \uBB34\uC791\uC704 \uC2DC\uC791\uAC12 (\uC9E7\uAC8C \uC5EC\uB7EC \uBC88
  \u2192 \uC0C1\uC704 \uBA87 \uAC1C\uB97C \uC218\uB834\uAE4C\uC9C0; Mplus
  STARTS \uBC29\uC2DD)
 * - \uD504\uB85C\uD30C\uC77C \uC218 \uAC80\uC815:
  \uBD80\uD2B8\uC2A4\uD2B8\uB7A9 \uC6B0\uB3C4\uBE44 \uAC80\uC815(BLRT;
  McLachlan, 1987; mclust::mclustBootstrapLRT\uC640 \uAC19\uC740 p\uAC12
  \uC815\uC758)
 */
(function (G) {
  'use strict';
  var St = G.PsyStats;
  if (!St) return;
  var LOG2PI = Math.log(2 * Math.PI);

  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new
    Array(c).fill(0)); return m; }
  function logSumExp(a) { var m = -Infinity; for (var i = 0; i < a.length;
    i++) if (a[i] > m) m = a[i]; if (m === -Infinity) return -Infinity; var
    s = 0; for (var j = 0; j < a.length; j++) s += Math.exp(a[j] - m);
    return m + Math.log(s); }

  /* ---------------- \uACF5\uD1B5: E \uB2E8\uACC4 \uACB0\uACFC\uB85C
    \uC801\uD569\uB3C4 \uACC4\uC0B0 ---------------- */
  function fitStats(LL, npar, n, Z, K) {
    var ent = 0;
    if (K > 1) {
      var e = 0;
      for (var i = 0; i < n; i++) for (var k = 0; k < K; k++) { var p = Z[
        i][k]; if (p > 0) e -= p * Math.log(p); }
      ent = 1 - e / (n * Math.log(K));
    } else ent = 1;
    var cls = Z.map(function (r) { var b = 0; for (var k = 1; k < K; k++) if
      (r[k] > r[b]) b = k; return b; });
    var props = new Array(K).fill(0), counts = new Array(K).fill(0), avgPP =
      zeros(K, K);
    Z.forEach(function (r, i) { counts[cls[i]]++; for (var k = 0; k < K;
      k++) { props[k] += r[k] / n; avgPP[cls[i]][k] += r[k]; } });
    avgPP = avgPP.map(function (row, k) { return row.map(function (v) {
      return counts[k] ? v / counts[k] : NaN; }); });
    return { LL: LL, npar: npar, n: n, aic: -2 * LL + 2 * npar, bic: -2 * LL
      + npar * Math.log(n), sabic: -2 * LL + npar * Math.log((n + 2) / 24),
      caic: -2 * LL + npar * (Math.log(n) + 1), entropy: ent, classes: cls,
        props: props, counts: counts, avgPP: avgPP,
      minProp: Math.min.apply(null, props), minCount: Math.min.apply(null,
        counts) };
  }

  /* ---------------- \uB2E4\uC911 \uC2DC\uC791 EM \uD2C0 ----------------
    */
  // spec: { init(rand) \u2192 state, step(state) \u2192 { state, LL }
  // \uB610\uB294 null(\uD1F4\uD654), finish(state) \u2192 \uACB0\uACFC }
  function multiStart(spec, opts) {
    var rand = St.rng(opts.seed || 1), nStart = opts.starts || 20, nKeep =
      Math.min(opts.keep || 5, nStart), short = opts.shortIter || 30;
    var runs = [];
    for (var s = 0; s < nStart; s++) {
      var st = spec.init(rand), LL = -Infinity, ok = true;
      for (var it = 0; it < short; it++) { var r = spec.step(st); if (!r) {
        ok = false; break; } st = r.state; LL = r.LL; }
      if (ok && isFinite(LL)) runs.push({ st: st, LL: LL });
    }
    if (!runs.length) return null;
    runs.sort(function (a, b) { return b.LL - a.LL; });
    var finals = [];
    runs.slice(0, nKeep).forEach(function (run) {
      var st = run.st, LL = run.LL, prev = -Infinity, conv = false;
      for (var it = 0; it < (opts.maxIter || 20000); it++) {
        var r = spec.step(st); if (!r) { st = null; break; }
        st = r.state; prev = LL; LL = r.LL;
        if (Math.abs(LL - prev) < (opts.tol || 1e-13) * (1 + Math.abs(LL)))
          { conv = true; break; }
      }
      if (st) finals.push({ st: st, LL: LL, conv: conv });
    });
    if (!finals.length) return null;
    finals.sort(function (a, b) { return b.LL - a.LL; });
    var best = finals[0], rep = finals.filter(function (f) {
      return Math.abs(f.LL - best.LL) < 1e-6 * (1 + Math.abs(best.LL));
      }).length;
    var out = spec.finish(best.st);
    out.converged = best.conv; out.replicated = rep; out.finalRuns =
      finals.length; out.startsOk = runs.length; out.starts = nStart;
    out.finalLLs = finals.map(function (f) { return f.LL; });
    return out;
  }

  /* ---------------- LPA (\uAC00\uC6B0\uC2DC\uC548 \uD63C\uD569)
    ---------------- */
  var LPA_MODELS = {
    EEI: { label: '\uBD84\uC0B0 \uAC19\uC74C, \uACF5\uBD84\uC0B0 0', full:
      false, equal: true },
    VVI: { label: '\uBD84\uC0B0 \uB2E4\uB984, \uACF5\uBD84\uC0B0 0', full:
      false, equal: false },
    EEE: { label: '\uBD84\uC0B0\u00B7\uACF5\uBD84\uC0B0 \uAC19\uC74C', full:
      true, equal: true },
    VVV: { label: '\uBD84\uC0B0\u00B7\uACF5\uBD84\uC0B0 \uB2E4\uB984', full:
      true, equal: false }
  };
  function lpaNpar(K, d, model) {
    var m = LPA_MODELS[model], cov = m.full ? d * (d + 1) / 2 : d;
    return K * d + (K - 1) + (m.equal ? cov : K * cov);
  }
  // M \uB2E8\uACC4: Z \u2192 {pi, mu, Sigma[k]}
  function lpaM(X, Z, K, model) {
    var n = X.length, d = X[0].length, m = LPA_MODELS[model], nk = new
      Array(K).fill(0), mu = zeros(K, d);
    for (var i = 0; i < n; i++) for (var k = 0; k < K; k++) { var z = Z[i][
      k]; nk[k] += z; for (var j = 0; j < d; j++) mu[k][j] += z * X[i][j]; }
    for (var k2 = 0; k2 < K; k2++) { if (!(nk[k2] > 1e-8)) return null; for
      (var j2 = 0; j2 < d; j2++) mu[k2][j2] /= nk[k2]; }
    var W = [];
    for (var k3 = 0; k3 < K; k3++) {
      var Wk = zeros(d, d);
      for (var i2 = 0; i2 < n; i2++) {
        var z2 = Z[i2][k3]; if (z2 === 0) continue;
        for (var a = 0; a < d; a++) { var da = X[i2][a] - mu[k3][a]; if (
          !m.full) { Wk[a][a] += z2 * da * da; continue; } for (var b = a; b
          < d; b++) Wk[a][b] += z2 * da * (X[i2][b] - mu[k3][b]); }
      }
      for (var a2 = 0; a2 < d; a2++) for (var b2 = 0; b2 < a2; b2++) Wk[a2][
        b2] = Wk[b2][a2];
      W.push(Wk);
    }
    var Sig = [];
    if (m.equal) {
      var Sp = zeros(d, d);
      W.forEach(function (Wk) { for (var a = 0; a < d; a++) for (var b = 0;
        b < d; b++) Sp[a][b] += Wk[a][b] / n; });
      for (var k4 = 0; k4 < K; k4++) Sig.push(Sp);
    } else W.forEach(function (Wk, k) { Sig.push(Wk.map(function (r) {
      return r.map(function (v) { return v / nk[k]; }); })); });
    return { pi: nk.map(function (v) { return v / n; }), mu: mu, Sigma: Sig
      };
  }
  // E \uB2E8\uACC4: \uAC01 \uC0AC\uB840\u00B7\uD504\uB85C\uD30C\uC77C\uC758
  // \uB85C\uADF8\uBC00\uB3C4, LL, \uC0AC\uD6C4\uD655\uB960
  function lpaE(X, P) {
    var n = X.length, d = X[0].length, K = P.pi.length, pre = [];
    for (var k = 0; k < K; k++) {
      var L = St.cholesky(P.Sigma[k]);
      if (!L) return null;
      var ld = 0; for (var a = 0; a < d; a++) { if (!(L[a][a] > 1e-7))
        return null; ld += 2 * Math.log(L[a][a]); }
      pre.push({ L: L, c: Math.log(P.pi[k]) - 0.5 * (d * LOG2PI + ld) });
    }
    var LL = 0, Z = [], y = new Array(d), lf = new Array(K);
    for (var i = 0; i < n; i++) {
      for (var k2 = 0; k2 < K; k2++) {
        var L2 = pre[k2].L, q = 0;
        for (var a2 = 0; a2 < d; a2++) { var s = X[i][a2] - P.mu[k2][a2];
          for (var b = 0; b < a2; b++) s -= L2[a2][b] * y[b]; y[a2] = s /
          L2[a2][a2]; q += y[a2] * y[a2]; }
        lf[k2] = pre[k2].c - 0.5 * q;
      }
      var lse = logSumExp(lf); LL += lse;
      Z.push(lf.map(function (v) { return Math.exp(v - lse); }));
    }
    return { LL: LL, Z: Z };
  }
  // k-\uD3C9\uADE0++ \uCD08\uAE30 \uBD84\uD560 (\uBB34\uC791\uC704
  // \uC2DC\uC791\uAC12)
  function kmeansZ(X, K, rand) {
    var n = X.length, d = X[0].length, C = [X[Math.floor(rand() * n)].slice(
      )];
    while (C.length < K) {
      var D = X.map(function (x) { var m = Infinity; C.forEach(function (c)
        { var s = 0; for (var j = 0; j < d; j++) s += (x[j] - c[j]) * (x[j]
        - c[j]); if (s < m) m = s; }); return m; });
      var tot = D.reduce(function (a, b) { return a + b; }, 0), r = rand() *
        tot, i = 0;
      while (i < n - 1 && r > D[i]) { r -= D[i]; i++; }
      C.push(X[i].slice());
    }
    var lab = new Array(n).fill(0);
    for (var it = 0; it < 10; it++) {
      lab = X.map(function (x) { var b = 0, bm = Infinity; C.forEach(
        function (c, k) { var s = 0; for (var j = 0; j < d; j++) s += (x[j]
        - c[j]) * (x[j] - c[j]); if (s < bm) { bm = s; b = k; } });
        return b; });
      C = C.map(function (c, k) { var m = new Array(d).fill(0), cnt = 0;
        X.forEach(function (x, i2) { if (lab[i2] === k) { cnt++; for (var j
        = 0; j < d; j++) m[j] += x[j]; } }); return cnt ? m.map(function (v)
        { return v / cnt; }) : c; });
    }
    return X.map(function (_, i3) { var z = new Array(K).fill(0.02 /
      Math.max(1, K - 1)); z[lab[i3]] = 0.98; if (K === 1) z[0] = 1;
      return z; });
  }
  function lpaFitK(X, K, model, opts) {
    var n = X.length, d = X[0].length;
    var spec = {
      init: function (rand) {
        var Z = rand() < 0.7 ? kmeansZ(X, K, rand) : X.map(function () { var
          r = []; for (var k = 0; k < K; k++) r.push(rand() + 0.05); var s =
          r.reduce(function (a, b) { return a + b; }, 0); return r.map(
          function (v) { return v / s; }); });
        return { Z: Z };
      },
      step: function (st) {
        var P = lpaM(X, st.Z, K, model); if (!P) return null;
        var E = lpaE(X, P); if (!E) return null;
        return { state: { Z: E.Z, P: P }, LL: E.LL };
      },
      finish: function (st) {
        var P = lpaM(X, st.Z, K, model), E = lpaE(X, P);
          // \uB9C8\uC9C0\uB9C9 \uC0AC\uD6C4\uD655\uB960\uC5D0 \uB9DE\uCD98
          // \uBAA8\uC218
        var fs = fitStats(E.LL, lpaNpar(K, d, model), n, E.Z, K);
        fs.params = P; fs.Z = E.Z; fs.K = K; fs.model = model; fs.d = d;
        return fs;
      }
    };
    if (K === 1) { var Z1 = X.map(function () { return [1]; }), P1 = lpaM(X,
      Z1, 1, model), E1 = lpaE(X, P1); if (!E1) return null; var f1 =
      fitStats(E1.LL, lpaNpar(1, d, model), n, E1.Z, 1); f1.params = P1;
      f1.Z = E1.Z; f1.K = 1; f1.model = model; f1.d = d; f1.converged =
      true; f1.replicated = 1; f1.starts = 1; f1.finalRuns = 1; f1.startsOk
      = 1; return f1; }
    var r = multiStart(spec, opts);
    if (r) orderClasses(r, function (k) { return r.params.pi[k]; }, function
      (perm) {
      r.params = { pi: perm.map(function (k) { return r.params.pi[k]; }),
        mu: perm.map(function (k) { return r.params.mu[k]; }), Sigma:
        perm.map(function (k) { return r.params.Sigma[k]; }) };
    });
    return r;
  }
  // \uD504\uB85C\uD30C\uC77C \uC21C\uC11C: \uBE44\uC728 \uD070 \uC21C
  // (\uD45C\uC2DC\uC6A9)
  function orderClasses(r, sizeOf, permParams) {
    var K = r.K, perm = []; for (var k = 0; k < K; k++) perm.push(k);
    perm.sort(function (a, b) { return sizeOf(b) - sizeOf(a); });
    var inv = new Array(K); perm.forEach(function (k, i) { inv[k] = i; });
    permParams(perm);
    r.Z = r.Z.map(function (row) { return perm.map(function (k) {
      return row[k]; }); });
    var fs = fitStats(r.LL, r.npar, r.n, r.Z, K);
    ['classes', 'props', 'counts', 'avgPP', 'minProp', 'minCount',
      'entropy'].forEach(function (key) { r[key] = fs[key]; });
  }
  function sampleMVN(mu, L, rand) {
    var d = mu.length, z = [];
    for (var j = 0; j < d; j++) { var u = 1 - rand(), v = rand(); z.push(
      Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); }
    return mu.map(function (m, a) { var s = m; for (var b = 0; b <= a; b++)
      s += L[a][b] * z[b]; return s; });
  }

  /* ---------------- LCA (\uBC94\uC8FC\uD615 \uC9C0\uD45C) ----------------
    */
  // X: n\u00D7J \uC815\uC218 \uCF54\uB4DC (0..C_j\u22121), C: \uAC01
  // \uBB38\uD56D \uBC94\uC8FC \uC218
  function lcaNpar(K, C) { return (K - 1) + K * C.reduce(function (s, c) {
    return s + c - 1; }, 0); }
  function lcaM(X, Z, K, C) {
    var n = X.length, J = C.length, nk = new Array(K).fill(0), rho = [];
    for (var k = 0; k < K; k++) { rho.push(C.map(function (c) { return new
      Array(c).fill(0); })); }
    for (var i = 0; i < n; i++) for (var k2 = 0; k2 < K; k2++) { var z = Z[
      i][k2]; nk[k2] += z; for (var j = 0; j < J; j++) rho[k2][j][X[i][j]]
      += z; }
    for (var k3 = 0; k3 < K; k3++) { if (!(nk[k3] > 1e-8)) return null; for
      (var j2 = 0; j2 < J; j2++) for (var c = 0; c < C[j2]; c++) rho[k3][
      j2][c] /= nk[k3]; }
    return { pi: nk.map(function (v) { return v / n; }), rho: rho };
  }
  function lcaE(X, P) {
    var n = X.length, K = P.pi.length, J = X[0].length, LL = 0, Z = [], lf =
      new Array(K);
    var lr = P.rho.map(function (rk) { return rk.map(function (rj) {
      return rj.map(function (p) { return Math.log(Math.max(p, 1e-300)); });
      }); });
    var lp = P.pi.map(function (p) { return Math.log(p); });
    for (var i = 0; i < n; i++) {
      for (var k = 0; k < K; k++) { var s = lp[k]; for (var j = 0; j < J;
        j++) s += lr[k][j][X[i][j]]; lf[k] = s; }
      var lse = logSumExp(lf); LL += lse; Z.push(lf.map(function (v) {
        return Math.exp(v - lse); }));
    }
    return { LL: LL, Z: Z };
  }
  function lcaFitK(X, K, C, opts) {
    var n = X.length;
    var randRho = function (rand) { var r = []; for (var k = 0; k < K; k++)
      r.push(C.map(function (c) { var v = []; for (var q = 0; q < c; q++)
      v.push(rand() + 0.1); var s = v.reduce(function (a, b) { return a + b;
      }, 0); return v.map(function (x) { return x / s; }); })); return r; };
    var spec = {
      init: function (rand) { var P = { pi: new Array(K).fill(1 / K), rho:
        randRho(rand) }; return { Z: lcaE(X, P).Z }; },
      step: function (st) { var P = lcaM(X, st.Z, K, C); if (!P)
        return null; var E = lcaE(X, P); return { state: { Z: E.Z, P: P },
        LL: E.LL }; },
      finish: function (st) { var P = lcaM(X, st.Z, K, C), E = lcaE(X, P),
        fs = fitStats(E.LL, lcaNpar(K, C), n, E.Z, K); fs.params = P; fs.Z =
        E.Z; fs.K = K; return fs; }
    };
    var r;
    if (K === 1) { var P1 = lcaM(X, X.map(function () { return [1]; }), 1,
      C), E1 = lcaE(X, P1); r = fitStats(E1.LL, lcaNpar(1, C), n, E1.Z, 1);
      r.params = P1; r.Z = E1.Z; r.K = 1; r.converged = true; r.replicated =
      1; r.starts = 1; r.finalRuns = 1; r.startsOk = 1; }
    else r = multiStart(spec, opts);
    if (!r) return null;
    if (K > 1) orderClasses(r, function (k) { return r.params.pi[k]; },
      function (perm) { r.params = { pi: perm.map(function (k) {
      return r.params.pi[k]; }), rho: perm.map(function (k) {
      return r.params.rho[k]; }) }; });
    // \uBC18\uC751 \uD328\uD134 \uC801\uD569\uB3C4 (poLCA\uC640
    // \uAC19\uC740 \uC815\uC758: \uAD00\uCE21\uB41C \uD328\uD134\uC5D0
    // \uB300\uD574 G\u00B2, \u03C7\u00B2; df = min(N, \u220FC \u2212 1)
    // \u2212 \uBAA8\uC218 \uC218)
    var pat = {};
    X.forEach(function (x) { var key = x.join(','); pat[key] = (pat[key] ||
      0) + 1; });
    var G2 = 0, X2 = 0, lr = r.params.rho.map(function (rk) { return rk.map(
      function (rj) { return rj.map(function (p) { return Math.log(Math.max(
      p, 1e-300)); }); }); });
    Object.keys(pat).forEach(function (key) {
      var x = key.split(',').map(Number), lf = r.params.pi.map(function (p,
        k) { var s = Math.log(p); for (var j = 0; j < x.length; j++) s +=
        lr[k][j][x[j]]; return s; });
      var e = n * Math.exp(logSumExp(lf)), o = pat[key];
      G2 += 2 * o * Math.log(o / e); X2 += (o - e) * (o - e) / e;
    });
    var cells = C.reduce(function (a, c) { return a * c; }, 1);
    r.G2 = G2; r.X2 = X2; r.dfPattern = Math.min(n, cells - 1) - r.npar;
      r.patterns = Object.keys(pat).length;
    return r;
  }

  /* ---------------- \uC2E4\uD589 \uC9C4\uC785\uC810 ---------------- */
  // \uACB0\uCE21\uC740 \uBAA9\uB85D\uBCC4 \uC81C\uAC70. LPA: cols =
  // \uC22B\uC790 \uBC30\uC5F4\uB4E4. LCA: cols = \uAC12
  // \uBC30\uC5F4\uB4E4(\uBB38\uC790\u00B7\uC22B\uC790; \uBC94\uC8FC\uB85C
  // \uCC98\uB9AC)
  function prepLPA(cols) {
    var rows = St.completeRows(cols);
    return { rows: rows, X: rows.map(function (i) { return cols.map(function
      (c) { return c[i]; }); }) };
  }
  function prepLCA(cols) {
    var rows = [];
    for (var i = 0; i < cols[0].length; i++) { var ok = true; for (var j =
      0; j < cols.length; j++) { var v = cols[j][i]; if (v === null || v ===
      undefined || v === '' || (typeof v === 'number' && !isFinite(v))) { ok
      = false; break; } } if (ok) rows.push(i); }
    var levels = cols.map(function (c) {
      var lv = []; rows.forEach(function (i) { var s = String(c[i]); if (
        lv.indexOf(s) < 0) lv.push(s); });
      return lv.sort(function (a, b) { var x = Number(a), y = Number(b);
        return (!isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 :
        0); });
    });
    var X = rows.map(function (i) { return cols.map(function (c, j) {
      return levels[j].indexOf(String(c[i])); }); });
    return { rows: rows, X: X, levels: levels, C: levels.map(function (l) {
      return l.length; }) };
  }
  function lpa(cols, opts) {
    opts = opts || {};
    var pr = prepLPA(cols), models = opts.models || ['EEI'], Ks = opts.Ks ||
      [1, 2, 3, 4], out = [];
    if (pr.X.length < 10) throw new Error(
      ('\uC644\uC804 \uC0AC\uB840\uAC00 \uB108\uBB34 \uC801\uC2B5'
      + '\uB2C8\uB2E4.'));
    models.forEach(function (m) { Ks.forEach(function (K) { var r = lpaFitK(
      pr.X, K, m, opts); out.push(r ? r : { K: K, model: m, failed: true });
      }); });
    return { kind: 'LPA', rows: pr.rows, X: pr.X, fits: out };
  }
  function lca(cols, opts) {
    opts = opts || {};
    var pr = prepLCA(cols), Ks = opts.Ks || [1, 2, 3, 4], out = [];
    if (pr.X.length < 10) throw new Error(
      ('\uC644\uC804 \uC0AC\uB840\uAC00 \uB108\uBB34 \uC801\uC2B5'
      + '\uB2C8\uB2E4.'));
    if (pr.C.some(function (c) { return c < 2; })) throw new Error(
      ('\uC751\uB2F5\uC774 \uD55C \uAC00\uC9C0\uBFD0\uC778 \uBB38'
      + '\uD56D\uC774 \uC788\uC2B5\uB2C8\uB2E4.'));
    if (pr.C.some(function (c) { return c > 10; })) throw new Error(
      ('\uBC94\uC8FC\uAC00 10\uAC1C\uB97C \uB118\uB294 \uBB38'
      + '\uD56D\uC774 \uC788\uC2B5\uB2C8\uB2E4. LCA\uC5D0\uB294 '
      + '\uBC94\uC8FC\uD615 \uC9C0\uD45C\uB97C \uC4F0\uC138\uC694('
      + '\uC5F0\uC18D \uC810\uC218\uB294 LPA).'));
    Ks.forEach(function (K) { var r = lcaFitK(pr.X, K, pr.C, opts);
      out.push(r ? r : { K: K, failed: true }); });
    return { kind: 'LCA', rows: pr.rows, X: pr.X, levels: pr.levels, C:
      pr.C, fits: out };
  }

  // BLRT 1\uD68C: \uADC0\uBB34(K\u22121) \uBAA8\uD615\uC5D0\uC11C
  // \uC790\uB8CC\uB97C \uC0DD\uC131\uD574 K\u22121, K \uBAA8\uD615\uC744
  // \uC801\uD569 \u2192 LRT
  function blrtOnce(res, fit0, K, rand, opts) {
    var n = res.X.length, Xb = [], p = fit0.params;
    var cum = []; p.pi.reduce(function (a, v, k) { cum[k] = a + v; return a
      + v; }, 0);
    var draw = function () { var u = rand(), k = 0; while (k < cum.length -
      1 && u > cum[k]) k++; return k; };
    if (res.kind === 'LPA') {
      var Ls = p.Sigma.map(function (S) { return St.cholesky(S); });
      for (var i = 0; i < n; i++) { var k = draw(); Xb.push(sampleMVN(p.mu[
        k], Ls[k], rand)); }
    } else {
      for (var i2 = 0; i2 < n; i2++) {
        var k2 = draw();
        Xb.push(p.rho[k2].map(function (rj) { var u = rand(), c = 0, acc =
          rj[0]; while (c < rj.length - 1 && u > acc) { c++; acc += rj[c]; }
          return c; }));
      }
    }
    var o = { starts: opts.starts || 10, keep: opts.keep || 3, seed:
      Math.floor(rand() * 1e9), tol: 1e-8, maxIter: 1000 };
    var f0 = res.kind === 'LPA' ? lpaFitK(Xb, K - 1, fit0.model, o) :
      lcaFitK(Xb, K - 1, res.C, o);
    var f1 = res.kind === 'LPA' ? lpaFitK(Xb, K, fit0.model, o) : lcaFitK(
      Xb, K, res.C, o);
    if (!f0 || !f1) return null;
    return Math.max(0, 2 * (f1.LL - f0.LL));
  }

  /* ---------------- 3\uB2E8\uACC4: BCH \uC6D0\uAC70\uB9AC
    \uACB0\uACFC\uBCC0\uC218 (Bolck, Croon, & Hagenaars, 2004; Vermunt,
    2010; Bakk et al., 2013) ---------------- */
  // \uBD84\uB958\uC624\uB958\uD589\uB82C D[s][t] = P(\uBC30\uC815 = t |
  // \uC2E4\uC81C = s) = \u03A3_i p_is\u00B71(w_i = t) / \u03A3_i p_is
  function classificationError(Z, cls) {
    var K = Z[0].length, D = zeros(K, K), tot = new Array(K).fill(0);
    Z.forEach(function (r, i) { for (var s = 0; s < K; s++) { D[s][cls[i]]
      += r[s]; tot[s] += r[s]; } });
    return D.map(function (row, s) { return row.map(function (v) { return v
      / tot[s]; }); });
  }
  // BCH \uAC00\uC911\uCE58: \uBC30\uC815 \uC9D1\uB2E8\uC774 t\uC778
  // \uC0AC\uB840\uC758 \uC9D1\uB2E8 s \uAC00\uC911\uCE58 =
  // (D\u207B\u00B9)[t][s]
  function bchWeights(Z, cls) {
    var K = Z[0].length, used = new Array(K).fill(0); cls.forEach(function (
      c) { used[c]++; });
    if (used.some(function (u) { return u === 0; })) throw new Error(
      ('\uCD5C\uBE48 \uBC30\uC815\uC73C\uB85C \uC0AC\uB840\uAC00 '
      + '\uD55C \uBA85\uB3C4 \uBC30\uC815\uB418\uC9C0 \uC54A\uC740 '
      + '\uC9D1\uB2E8\uC774 \uC788\uC5B4 BCH\uB97C \uACC4\uC0B0'
      + '\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC9D1\uB2E8 '
      + '\uC218\uB97C \uC904\uC774\uAC70\uB098 \uB2E4\uB978 \uD574'
      + '\uB97C \uACE0\uB974\uC138\uC694.'));
    var D = classificationError(Z, cls), H;
    try { H = St.inverse(D); } catch (e) { throw new Error(
      ('\uBD84\uB958\uC624\uB958\uD589\uB82C\uC774 \uD2B9\uC774'
      + '\uD574 BCH\uB97C \uACC4\uC0B0\uD560 \uC218 \uC5C6\uC2B5'
      + '\uB2C8\uB2E4(\uC9D1\uB2E8 \uAD6C\uBD84\uC774 \uB9E4\uC6B0 '
      + '\uC57D\uD568).')); }
    return { D: D, H: H, W: cls.map(function (t) { return H[t].slice(); })
      };
  }
  function waldTest(est, V, C) {
    // C: \uB300\uBE44\uD589\uB82C (\uD589 = \uC81C\uC57D)
    var Ce = C.map(function (c) { return c.reduce(function (s, v, j) {
      return s + v * est[j]; }, 0); });
    var CV = C.map(function (c) { return V[0].map(function (_, j) {
      return c.reduce(function (s, v, a) { return s + v * V[a][j]; }, 0);
      }); });
    var CVC = CV.map(function (row) { return C.map(function (c) {
      return row.reduce(function (s, v, j) { return s + v * c[j]; }, 0); });
      });
    var Inv = St.inverse(CVC), chi = 0;
    for (var a = 0; a < Ce.length; a++) for (var b = 0; b < Ce.length; b++)
      chi += Ce[a] * Inv[a][b] * Ce[b];
    return { chi2: chi, df: C.length, p: St.pchisqUpper(chi, C.length) };
  }
  // fit: lpa/lca \uACB0\uACFC\uC758 \uD574 (Z, classes), y: \uB2E8\uACC4 1
  // \uC0AC\uB840 \uC21C\uC11C\uC640 \uAC19\uC740 \uAE38\uC774 (\uACB0\uCE21
  // \uAC00\uB2A5), type: 'continuous' | 'categorical'
  function bchDistal(fit, y, type) {
    var K = fit.K, bw = bchWeights(fit.Z, fit.classes), warn = [];
    var idx = []; y.forEach(function (v, i) { if (v !== null && v !==
      undefined && v !== '' && !(typeof v === 'number' && !isFinite(v)))
      idx.push(i); });
    if (idx.length < K + 2) throw new Error(
      ('\uACB0\uACFC\uBCC0\uC218\uC758 \uC720\uD6A8 \uC0AC\uB840'
      + '\uAC00 \uB108\uBB34 \uC801\uC2B5\uB2C8\uB2E4.'));
    var condD = 0; bw.H.forEach(function (r) { r.forEach(function (v) {
      condD = Math.max(condD, Math.abs(v)); }); });
    if (condD > 10) warn.push(
      ('\uBD84\uB958\uC624\uB958\uD589\uB82C\uC774 \uBD88\uC548'
      + '\uC815\uD569\uB2C8\uB2E4(D\u207B\u00B9 \uC6D0\uC18C \uCD5C'
      + '\uB300 ') + condD.toFixed(1) +
      ('). \uC9D1\uB2E8 \uAD6C\uBD84\uC774 \uC57D\uD574 BCH \uCD94'
      + '\uC815\uC774 \uBD88\uC548\uC815\uD560 \uC218 \uC788\uC2B5'
      + '\uB2C8\uB2E4.'));
    var negShare = idx.filter(function (i) { return bw.W[i].some(function (
      w) { return w < 0; }); }).length / idx.length;
    var Ws = []; for (var s = 0; s < K; s++) Ws.push(idx.reduce(function (a,
      i) { return a + bw.W[i][s]; }, 0));
    if (Ws.some(function (w) { return !(w > 1); })) throw new Error(
      ('BCH \uAC00\uC911\uCE58 \uD569\uC774 \uB108\uBB34 \uC791'
      + '\uC740 \uC9D1\uB2E8\uC774 \uC788\uC5B4 \uCD94\uC815\uD560 '
      + '\uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'));
    var out = { K: K, n: idx.length, D: bw.D, weightN: Ws, negWeightShare:
      negShare, warnings: warn, type: type };
    // \uBE44\uAD50\uC6A9: \uCD5C\uBE48 \uBC30\uC815(\uBCF4\uC815
    // \uC5C6\uC74C)
    var naiveN = new Array(K).fill(0); idx.forEach(function (i) { naiveN[
      fit.classes[i]]++; });
    if (type === 'continuous') {
      var mu = [], sdv = [];
      for (var s2 = 0; s2 < K; s2++) {
        var m = idx.reduce(function (a, i) { return a + bw.W[i][s2] * y[i];
          }, 0) / Ws[s2];
        var v = idx.reduce(function (a, i) { return a + bw.W[i][s2] * (y[i]
          - m) * (y[i] - m); }, 0) / Ws[s2];
        mu.push(m); sdv.push(Math.sqrt(Math.max(v, 0))); if (v < 0)
          warn.push('\uC9D1\uB2E8 ' + (s2 + 1) +
          ('\uC758 \uAC00\uC911 \uBD84\uC0B0\uC774 \uC74C\uC218'
          + '\uC785\uB2C8\uB2E4(\uC74C\uC218 \uAC00\uC911\uCE58'
          + '\uC758 \uC601\uD5A5).'));
      }
      // \uC0CC\uB4DC\uC704\uCE58 \uACF5\uBD84\uC0B0: \u03C8_is = w_is (y_i
      // \u2212 \u03BC_s) / W_s
      var V = zeros(K, K);
      idx.forEach(function (i) { var ps = mu.map(function (m, s3) {
        return bw.W[i][s3] * (y[i] - m) / Ws[s3]; }); for (var a = 0; a < K;
        a++) for (var b = 0; b < K; b++) V[a][b] += ps[a] * ps[b]; });
      var C = []; for (var k = 1; k < K; k++) { var c = new Array(K).fill(
        0); c[0] = 1; c[k] = -1; C.push(c); }
      out.means = mu; out.sds = sdv; out.se = V.map(function (r, s4) {
        return Math.sqrt(r[s4]); }); out.V = V;
      out.overall = K > 1 ? waldTest(mu, V, C) : null;
      out.pairs = [];
      for (var a2 = 0; a2 < K; a2++) for (var b2 = a2 + 1; b2 < K; b2++) {
        var c2 = new Array(K).fill(0); c2[a2] = 1; c2[b2] = -1;
        var wt = waldTest(mu, V, [c2]), se = Math.sqrt(V[a2][a2] + V[b2][b2]
          - 2 * V[a2][b2]);
        out.pairs.push({ a: a2, b: b2, diff: mu[a2] - mu[b2], se: se, chi2:
          wt.chi2, p: wt.p });
      }
      out.naiveMeans = []; for (var s5 = 0; s5 < K; s5++) { var g =
        idx.filter(function (i) { return fit.classes[i] === s5; }).map(
        function (i) { return y[i]; }); out.naiveMeans.push(g.length ?
        St.mean(g) : NaN); }
      out.naiveN = naiveN;
    } else {
      var levels = []; idx.forEach(function (i) { var l = String(y[i]); if (
        levels.indexOf(l) < 0) levels.push(l); });
      levels.sort(function (p1, p2) { var x = Number(p1), z = Number(p2);
        return (!isNaN(x) && !isNaN(z)) ? x - z : (p1 < p2 ? -1 : p1 > p2 ?
        1 : 0); });
      var L = levels.length;
      if (L < 2) throw new Error(
        ('\uBC94\uC8FC\uD615 \uACB0\uACFC\uBCC0\uC218\uC758 \uC751'
        + '\uB2F5\uC774 \uD55C \uAC00\uC9C0\uBFD0\uC785\uB2C8\uB2E4'
        + '.'));
      if (L > 15) throw new Error(
        ('\uBC94\uC8FC\uAC00 15\uAC1C\uB97C \uB118\uC2B5\uB2C8'
        + '\uB2E4. \uC5F0\uC18D\uD615\uC73C\uB85C \uBD84\uC11D'
        + '\uD558\uC138\uC694.'));
      var yl = y.map(function (v) { return levels.indexOf(String(v)); });
      var P = []; for (var s6 = 0; s6 < K; s6++) P.push(levels.map(function
        (_, l) { return idx.reduce(function (a, i) { return a + bw.W[i][s6]
        * (yl[i] === l ? 1 : 0); }, 0) / Ws[s6]; }));
      if (P.some(function (r) { return r.some(function (p) { return p < 0 ||
        p > 1; }); })) warn.push(
        ('\uC77C\uBD80 \uCD94\uC815 \uBE44\uC728\uC774 0\u20131 '
        + '\uBC94\uC704\uB97C \uBC97\uC5B4\uB0AC\uC2B5\uB2C8\uB2E4('
        + '\uC74C\uC218 \uAC00\uC911\uCE58\uC758 \uC601\uD5A5). '
        + '\uD574\uB2F9 \uC9D1\uB2E8\uC774 \uC791\uAC70\uB098 '
        + '\uBD84\uB958\uAC00 \uBD88\uD655\uC2E4\uD560 \uB54C '
        + '\uC0DD\uAE30\uBA70, \uD574\uC11D\uC5D0 \uC8FC\uC758'
        + '\uD558\uC138\uC694.'));
      // \uBAA8\uC218: \uAC01 \uC9D1\uB2E8\uC758 \uC55E L\u22121\uAC1C
      // \uBC94\uC8FC \uBE44\uC728, \u03C8 = w_is(1(y=l) \u2212 p_sl)/W_s
      var q = K * (L - 1), V2 = zeros(q, q), est = [];
      for (var s7 = 0; s7 < K; s7++) for (var l2 = 0; l2 < L - 1; l2++)
        est.push(P[s7][l2]);
      idx.forEach(function (i) {
        var ps = []; for (var s8 = 0; s8 < K; s8++) for (var l3 = 0; l3 < L
          - 1; l3++) ps.push(bw.W[i][s8] * ((yl[i] === l3 ? 1 : 0) - P[s8][
          l3]) / Ws[s8]);
        for (var a3 = 0; a3 < q; a3++) { if (ps[a3] === 0) continue; for (
          var b3 = 0; b3 < q; b3++) V2[a3][b3] += ps[a3] * ps[b3]; }
      });
      var cmat = function (sa, sb) { var rows = []; for (var l4 = 0; l4 < L
        - 1; l4++) { var c3 = new Array(q).fill(0); c3[sa * (L - 1) + l4] =
        1; c3[sb * (L - 1) + l4] = -1; rows.push(c3); } return rows; };
      var Call = []; for (var k2 = 1; k2 < K; k2++) Call = Call.concat(cmat(
        0, k2));
      out.levels = levels; out.props = P;
      out.se = P.map(function (r, s9) { return r.map(function (_, l5) { if (
        l5 === L - 1) { var c4 = new Array(q).fill(0); for (var m2 = 0; m2 <
        L - 1; m2++) c4[s9 * (L - 1) + m2] = 1; var vv = 0; for (var a4 = 0;
        a4 < q; a4++) for (var b4 = 0; b4 < q; b4++) vv += c4[a4] * V2[a4][
        b4] * c4[b4]; return Math.sqrt(vv); } var j = s9 * (L - 1) + l5;
        return Math.sqrt(V2[j][j]); }); });
      out.overall = K > 1 ? waldTest(est, V2, Call) : null;
      out.pairs = [];
      for (var a5 = 0; a5 < K; a5++) for (var b5 = a5 + 1; b5 < K; b5++) {
        var wt2 = waldTest(est, V2, cmat(a5, b5)); out.pairs.push({ a: a5,
        b: b5, chi2: wt2.chi2, df: wt2.df, p: wt2.p }); }
      out.naiveProps = []; for (var s10 = 0; s10 < K; s10++) { var g2 =
        idx.filter(function (i) { return fit.classes[i] === s10; });
        out.naiveProps.push(levels.map(function (_, l6) { return g2.length ?
        g2.filter(function (i) { return yl[i] === l6; }).length / g2.length
        : NaN; })); }
      out.naiveN = naiveN;
    }
    return out;
  }

  // \uC6D0\uB798 \uD574\uC758 \uBAA8\uC218\uC5D0\uC11C \uC2DC\uC791\uD574
  // \uC7AC\uCD94\uC815 (\uBD80\uD2B8\uC2A4\uD2B8\uB7A9\uC6A9; \uC9D1\uB2E8
  // \uBC88\uD638\uAC00 \uC6D0\uB798 \uD574\uC640 \uAC19\uAC8C
  // \uC720\uC9C0\uB428)
  function refitFrom(kind, X, fit, C) {
    var P = fit.params, LL = -Infinity, E = null;
    for (var it = 0; it < 500; it++) {
      E = kind === 'LPA' ? lpaE(X, P) : lcaE(X, P);
      if (!E) return null;
      if (Math.abs(E.LL - LL) < 1e-8 * (1 + Math.abs(E.LL))) break;
      LL = E.LL;
      P = kind === 'LPA' ? lpaM(X, E.Z, fit.K, fit.model) : lcaM(X, E.Z,
        fit.K, C);
      if (!P) return null;
    }
    var cls = E.Z.map(function (r) { var b = 0; for (var k = 1; k <
      r.length; k++) if (r[k] > r[b]) b = k; return b; });
    return { K: fit.K, Z: E.Z, classes: cls };
  }
  // 3\uB2E8\uACC4 \uC804\uCCB4 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9: \uC0AC\uB840
  // \uC7AC\uD45C\uC9D1 \u2192 \uB2E8\uACC4 1 \uC7AC\uCD94\uC815 \u2192
  // D\u00B7\uAC00\uC911\uCE58 \u2192 \uB2E8\uACC4 3. \uB2E8\uACC4 1
  // \uBD88\uD655\uC2E4\uC131\uC744 \uD45C\uC900\uC624\uCC28\uC5D0
  // \uBC18\uC601
  // outcomes: [{ y, type, levels }] \u2014
  // \uC7AC\uD45C\uC9D1\u00B7\uC7AC\uCD94\uC815 1\uBC88\uC73C\uB85C
  // \uC5EC\uB7EC \uACB0\uACFC\uBCC0\uC218\uB97C \uD568\uAED8 \uACC4\uC0B0.
  // \uBC18\uD658: \uACB0\uACFC\uBCC0\uC218\uBCC4 \uCD94\uC815\uCE58
  // \uBCA1\uD130(\uC2E4\uD328 \uC2DC null)
  function bchBootstrapOnce(res, fit, outcomes, rand) {
    var n = res.X.length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var f2 = refitFrom(res.kind, idx.map(function (q) { return res.X[q]; }),
      fit, res.C);
    return outcomes.map(function (o) {
      if (!f2) return null;
      try {
        var b = bchDistal(f2, idx.map(function (q) { return o.y[q]; }),
          o.type);
        if (o.type === 'continuous') return b.means;
        if (o.levels && b.levels.join('|') !== o.levels.join('|'))
          return null;
          // \uC7AC\uD45C\uC9D1\uC5D0\uC11C \uBC94\uC8FC\uAC00
          // \uBE60\uC9C0\uBA74 \uC0DD\uB7B5
        var est = []; b.props.forEach(function (r) { for (var l = 0; l <
          r.length - 1; l++) est.push(r[l]); }); return est;
      } catch (e) { return null; }
    });
  }
  // \uBD80\uD2B8\uC2A4\uD2B8\uB7A9 \uACB0\uACFC\uB85C
  // \uD45C\uC900\uC624\uCC28\uC640 Wald \uAC80\uC815\uC744 \uB2E4\uC2DC
  // \uACC4\uC0B0
  function bchApplyBootstrap(out, draws) {
    var q = draws[0].length, m = new Array(q).fill(0), V = zeros(q, q), B =
      draws.length;
    draws.forEach(function (d) { for (var a = 0; a < q; a++) m[a] += d[a] /
      B; });
    draws.forEach(function (d) { for (var a = 0; a < q; a++) for (var b = 0;
      b < q; b++) V[a][b] += (d[a] - m[a]) * (d[b] - m[b]) / (B - 1); });
    var K = out.K, bo = { B: B, V: V };
    if (out.type === 'continuous') {
      var C = []; for (var k = 1; k < K; k++) { var c = new Array(K).fill(
        0); c[0] = 1; c[k] = -1; C.push(c); }
      bo.se = V.map(function (r, s) { return Math.sqrt(r[s]); });
      bo.overall = waldTest(out.means, V, C);
      bo.pairs = out.pairs.map(function (p) { var c2 = new Array(K).fill(0);
        c2[p.a] = 1; c2[p.b] = -1; var w = waldTest(out.means, V, [c2]);
        return { a: p.a, b: p.b, se: Math.sqrt(V[p.a][p.a] + V[p.b][p.b] - 2
        * V[p.a][p.b]), chi2: w.chi2, p: w.p }; });
    } else {
      var L = out.levels.length, est = []; out.props.forEach(function (r) {
        for (var l = 0; l < L - 1; l++) est.push(r[l]); });
      var cm = function (sa, sb) { var rows = []; for (var l2 = 0; l2 < L -
        1; l2++) { var c3 = new Array(q).fill(0); c3[sa * (L - 1) + l2] = 1;
        c3[sb * (L - 1) + l2] = -1; rows.push(c3); } return rows; };
      var Call = []; for (var k2 = 1; k2 < K; k2++) Call = Call.concat(cm(0,
        k2));
      bo.se = out.props.map(function (r, s) { return r.map(function (_, l) {
        var c4 = new Array(q).fill(0); if (l === L - 1) { for (var m2 = 0;
        m2 < L - 1; m2++) c4[s * (L - 1) + m2] = 1; } else c4[s * (L - 1) +
        l] = 1; var vv = 0; for (var a = 0; a < q; a++) for (var b = 0; b <
        q; b++) vv += c4[a] * V[a][b] * c4[b]; return Math.sqrt(vv); }); });
      bo.overall = waldTest(est, V, Call);
      bo.pairs = out.pairs.map(function (p) { var w = waldTest(est, V, cm(
        p.a, p.b)); return { a: p.a, b: p.b, chi2: w.chi2, df: w.df, p: w.p
        }; });
    }
    out.boot = bo;
    return out;
  }

  /* ---------------- \uB2E4\uD56D \uB85C\uC9C0\uC2A4\uD2F1 \uD68C\uADC0
    (\uAE30\uC900 \uBC94\uC8FC \uB300\uBE44; \uAD00\uCE21 \uBC18\uC751
    \uB610\uB294 \uBD84\uB958\uC624\uB958 \uACE0\uC815 ML 3\uB2E8\uACC4)
    ---------------- */
  // X: n\u00D7p \uC124\uACC4\uD589\uB82C(\uC808\uD3B8 \uD3EC\uD568), R:
  // n\u00D7K \uBC18\uC751 \uAC00\uC911\uCE58 (\uAD00\uCE21
  // \uBC94\uC8FC\uBA74 \uC6D0-\uD56B, EM \uB2E8\uACC4\uC5D0\uC11C\uB294
  // \uC0AC\uD6C4\uD655\uB960), ref: \uAE30\uC900 \uBC94\uC8FC
  function mnProbs(X, beta, K, ref) {
    // beta: (K\u22121) \u00D7 p (\uAE30\uC900 \uC81C\uC678 \uC21C\uC11C)
    return X.map(function (x) {
      var eta = [], b = 0;
      for (var k = 0; k < K; k++) { if (k === ref) { eta.push(0); continue;
        } var e = 0, row = beta[b++]; for (var j = 0; j < x.length; j++) e
        += row[j] * x[j]; eta.push(e); }
      var lse = logSumExp(eta); return eta.map(function (v) {
        return Math.exp(v - lse); });
    });
  }
  // \uAC00\uC911 \uB2E4\uD56D \uB85C\uC9C0\uC2A4\uD2F1 M \uB2E8\uACC4:
  // \u03A3_i \u03A3_k R_ik log \u03C0_ik \uCD5C\uB300\uD654
  // (\uB274\uD134-\uB7A9\uC2A8, \uB2E8\uACC4 \uBC18\uAC10)
  function mnFitWeighted(X, R, K, ref, beta0, maxit) {
    var n = X.length, p = X[0].length, q = (K - 1) * p, beta = beta0 ?
      beta0.map(function (r) { return r.slice(); }) : [];
    if (!beta0) for (var k = 0; k < K - 1; k++) beta.push(new Array(p).fill(
      0));
    var others = []; for (var k1 = 0; k1 < K; k1++) if (k1 !== ref)
      others.push(k1);
    var obj = function (bt) { var P = mnProbs(X, bt, K, ref), s = 0; for (
      var i = 0; i < n; i++) for (var k = 0; k < K; k++) if (R[i][k]) s +=
      R[i][k] * Math.log(Math.max(P[i][k], 1e-300)); return s; };
    var cur = obj(beta);
    for (var it = 0; it < (maxit || 100); it++) {
      var P = mnProbs(X, beta, K, ref), g = new Array(q).fill(0), H = zeros(
        q, q);
      for (var i = 0; i < n; i++) {
        var w = 0; for (var k2 = 0; k2 < K; k2++) w += R[i][k2];
        for (var a = 0; a < K - 1; a++) {
          var ka = others[a], ra = R[i][ka] - w * P[i][ka];
          for (var j = 0; j < p; j++) g[a * p + j] += ra * X[i][j];
          for (var b2 = 0; b2 < K - 1; b2++) {
            var kb = others[b2], h = w * P[i][ka] * ((a === b2 ? 1 : 0) - P[
              i][kb]);
            for (var j1 = 0; j1 < p; j1++) for (var j2 = 0; j2 < p; j2++) H[
              a * p + j1][b2 * p + j2] += h * X[i][j1] * X[i][j2];
          }
        }
      }
      var step; try { var Hi = St.inverse(H); step = Hi.map(function (r) {
        return r.reduce(function (s, v, j) { return s + v * g[j]; }, 0); });
        } catch (e) { return { beta: beta, ll: cur, singular: true }; }
      var lam = 1, nb, nv;
      for (var h2 = 0; h2 < 30; h2++) { nb = beta.map(function (r, a) {
        return r.map(function (v, j) { return v + lam * step[a * p + j]; });
        }); nv = obj(nb); if (nv >= cur - 1e-12) break; lam /= 2; }
      var dl = nv - cur; beta = nb; cur = nv;
      if (Math.abs(dl) < 1e-12 * (1 + Math.abs(cur)) && Math.max.apply(null,
        step.map(Math.abs)) * lam < 1e-9) break;
    }
    return { beta: beta, ll: cur, H: null };
  }
  // ML 3\uB2E8\uACC4 \uC6B0\uB3C4: \u03A3_i log \u03A3_s \u03C0_is(z)
  // D[s][w_i]
  function ml3LL(X, beta, K, ref, D, w) {
    var P = mnProbs(X, beta, K, ref), s = 0;
    for (var i = 0; i < X.length; i++) { var t = 0; for (var k = 0; k < K;
      k++) t += P[i][k] * D[k][w[i]]; s += Math.log(Math.max(t, 1e-300)); }
    return s;
  }
  // \uAD00\uCE21 \uC815\uBCF4\uD589\uB82C(\uC218\uCE58 2\uCC28
  // \uBBF8\uBD84) \u2192 \uD45C\uC900\uC624\uCC28
  function numericHessianSE(f, beta) {
    var p = beta[0].length, q = beta.length * p, flat = [].concat.apply([],
      beta), H = zeros(q, q);
    var unflat = function (v) { var r = []; for (var a = 0; a < beta.length;
      a++) r.push(v.slice(a * p, (a + 1) * p)); return r; };
    var f0 = f(beta);
    for (var a2 = 0; a2 < q; a2++) {
      var ha = 1e-4 * Math.max(1, Math.abs(flat[a2]));
      for (var b = a2; b < q; b++) {
        var hb = 1e-4 * Math.max(1, Math.abs(flat[b]));
        var v = function (da, db) { var t = flat.slice(); t[a2] += da; t[b]
          += db; return f(unflat(t)); };
        var val = a2 === b ? (v(ha, 0) - 2 * f0 + v(-ha, 0)) / (ha * ha) : (
          v(ha, hb) - v(ha, -hb) - v(-ha, hb) + v(-ha, -hb)) / (4 * ha *
          hb);
        H[a2][b] = H[b][a2] = -val;
      }
    }
    var V; try { V = St.inverse(H); } catch (e) { V = null; }
    return { V: V, se: V ? V.map(function (r, i) { return Math.sqrt(
      Math.max(r[i], 0)); }) : flat.map(function () { return NaN; }) };
  }
  // \uC124\uACC4\uD589\uB82C: \uC808\uD3B8 + \uACF5\uBCC0\uC778 \uC5F4
  function design(cols, rows) { return rows.map(function (i) { return [
    1].concat(cols.map(function (c) { return c[i]; })); }); }

  // \uC77C\uBC18 \uB2E4\uD56D \uB85C\uC9C0\uC2A4\uD2F1 \uD68C\uADC0
  // (\uAD00\uCE21\uB41C \uBC94\uC8FC\uD615 \uC885\uC18D\uBCC0\uC218)
  function multinomialLogistic(yin, Xcols, names, opts) {
    opts = opts || {};
    var rows = [];
    for (var i = 0; i < yin.length; i++) {
      var v = yin[i]; if (v === null || v === undefined || v === '' || (
        typeof v === 'number' && !isFinite(v))) continue;
      var ok = true; for (var j = 0; j < Xcols.length; j++) if (!St.isNum(
        Xcols[j][i])) { ok = false; break; }
      if (ok) rows.push(i);
    }
    var levels = []; rows.forEach(function (i2) { var s = String(yin[i2]);
      if (levels.indexOf(s) < 0) levels.push(s); });
    levels.sort(function (a, b) { var x = Number(a), y = Number(b); return (
      !isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
    var K = levels.length; if (K < 2) throw new Error(
      ('\uC885\uC18D\uBCC0\uC218\uC758 \uBC94\uC8FC\uAC00 2\uAC1C '
      + '\uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.'));
    if (K > 15) throw new Error(
      ('\uBC94\uC8FC\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4(1'
      + '5\uAC1C \uCD08\uACFC).'));
    var ref = opts.ref !== undefined && levels.indexOf(String(opts.ref)) >=
      0 ? levels.indexOf(String(opts.ref)) : 0;
    var X = design(Xcols, rows), n = X.length, p = X[0].length;
    if (n <= (K - 1) * p) throw new Error(
      ('\uC0AC\uB840 \uC218\uAC00 \uBAA8\uC218 \uC218\uBCF4\uB2E4 '
      + '\uCDA9\uBD84\uD788 \uB9CE\uC544\uC57C \uD569\uB2C8\uB2E4.'));
    var R = rows.map(function (i3) { var r = new Array(K).fill(0); r[
      levels.indexOf(String(yin[i3]))] = 1; return r; });
    var fit = mnFitWeighted(X, R, K, ref, null, 200);
    var llf = function (bt) { var P = mnProbs(X, bt, K, ref), s = 0; for (
      var i4 = 0; i4 < n; i4++) for (var k = 0; k < K; k++) if (R[i4][k]) s
      += Math.log(Math.max(P[i4][k], 1e-300)); return s; };
    var inf = numericHessianSE(llf, fit.beta);
    var counts = levels.map(function (_, k) { return R.reduce(function (s,
      r) { return s + r[k]; }, 0); });
    var ll0 = counts.reduce(function (s, c) { return s + (c ? c * Math.log(c
      / n) : 0); }, 0);
    var chi = 2 * (fit.ll - ll0), dfM = (K - 1) * (p - 1), z975 = St.qnorm(
      0.975);
    var others = []; for (var k1 = 0; k1 < K; k1++) if (k1 !== ref)
      others.push(k1);
    var coefs = [];
    others.forEach(function (k, a) {
      fit.beta[a].forEach(function (b, j) {
        var se = inf.se[a * p + j], zz = b / se;
        coefs.push({ level: levels[k], name: j === 0 ? '(\uC808\uD3B8)' :
          names[j - 1], b: b, se: se, z: zz, wald: zz * zz, p: 2 * St.pnorm(
          -Math.abs(zz)), or: Math.exp(b), orLow: Math.exp(b - z975 * se),
          orHigh: Math.exp(b + z975 * se) });
      });
    });
    // \uC608\uCE21\uBCC0\uC218\uBCC4 \uC6B0\uB3C4\uBE44 \uAC80\uC815
    // (\uADF8 \uC608\uCE21\uBCC0\uC218\uB97C \uBE80 \uBAA8\uD615\uACFC
    // \uBE44\uAD50)
    var lrTests = names.map(function (nm, j) {
      if (!Xcols.length) return null;
      var keep = []; for (var c = 0; c < Xcols.length; c++) if (c !== j)
        keep.push(Xcols[c]);
      var X2 = design(keep, rows), f2 = mnFitWeighted(X2, R, K, ref, null,
        200), ch = 2 * (fit.ll - f2.ll);
      return { name: nm, chi2: ch, df: K - 1, p: St.pchisqUpper(ch, K - 1)
        };
    }).filter(Boolean);
    var P = mnProbs(X, fit.beta, K, ref), conf = zeros(K, K);
    P.forEach(function (pr, i5) { var b = 0; for (var k2 = 1; k2 < K; k2++)
      if (pr[k2] > pr[b]) b = k2; conf[R[i5].indexOf(1)][b]++; });
    var cs = 1 - Math.exp(-chi / n), nag = cs / (1 - Math.exp(2 * ll0 / n));
    var warn = [];
    if (fit.singular || coefs.some(function (c) { return !isFinite(c.se) ||
      c.se > 1e3 || Math.abs(c.b) > 15; })) warn.push(
      ('\uBD84\uB9AC(separation) \uB610\uB294 \uC791\uC740 \uBC94'
      + '\uC8FC \uB54C\uBB38\uC5D0 \uCD94\uC815\uC774 \uBD88\uC548'
      + '\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACC4\uC218'
      + '\u00B7\uD45C\uC900\uC624\uCC28\uAC00 \uBE44\uC815\uC0C1'
      + '\uC801\uC73C\uB85C \uD070\uC9C0 \uD655\uC778\uD558\uC138'
      + '\uC694.'));
    return { n: n, K: K, levels: levels, ref: ref, counts: counts, coefs:
      coefs, ll: fit.ll, ll0: ll0, deviance: -2 * fit.ll, chi2: chi, dfM:
      dfM, p: St.pchisqUpper(chi, dfM),
      aic: -2 * fit.ll + 2 * (K - 1) * p, bic: -2 * fit.ll + Math.log(n) * (
        K - 1) * p, coxSnell: cs, nagelkerke: nag, mcfadden: 1 - fit.ll /
        ll0,
      lrTests: lrTests, confusion: conf, accuracy: conf.reduce(function (s,
        r, k3) { return s + r[k3]; }, 0) / n, warnings: warn, beta:
        fit.beta, V: inf.V };
  }

  /*
   * ML 3\uB2E8\uACC4: \uACF5\uBCC0\uC778 \u2192 \uC7A0\uC7AC\uC9D1\uB2E8
  \uC18C\uC18D (Vermunt, 2010; Bakk, Tekle, & Vermunt, 2013)
   * P(W_i = w | z_i) = \u03A3_s \u03C0_s(z_i) D[s][w], D\uB294 \uB2E8\uACC4
  1\uC5D0\uC11C \uACE0\uC815. EM(\uC0AC\uD6C4\uD655\uB960 \u2192
  \uAC00\uC911 \uB2E4\uD56D \uB85C\uC9C0\uC2A4\uD2F1)\uC73C\uB85C
  \uCD5C\uB300\uD654
   */
  function ml3Fit(D, w, X, K, ref, beta0) {
    var beta = beta0, ll = -Infinity;
    if (!beta) { beta = []; for (var k = 0; k < K - 1; k++) beta.push(new
      Array(X[0].length).fill(0)); }
    for (var it = 0; it < 2000; it++) {
      var P = mnProbs(X, beta, K, ref), Rr = P.map(function (pr, i) { var t
        = 0, q = pr.map(function (v, s) { var u = v * D[s][w[i]]; t += u;
        return u; }); return q.map(function (u) { return u / t; }); });
      var m = mnFitWeighted(X, Rr, K, ref, beta, 3);
      beta = m.beta;
      var nl = ml3LL(X, beta, K, ref, D, w);
      if (Math.abs(nl - ll) < 1e-11 * (1 + Math.abs(nl))) { ll = nl; break;
        }
      ll = nl;
    }
    return { beta: beta, ll: ll };
  }
  // fit: \uB2E8\uACC4 1 \uD574, Zcols: \uACF5\uBCC0\uC778 \uC5F4
  // (\uB2E8\uACC4 1 \uC0AC\uB840 \uC21C\uC11C), names, ref: \uAE30\uC900
  // \uC9D1\uB2E8(0\uBD80\uD130)
  function ml3Step(fit, Zcols, names, opts) {
    opts = opts || {};
    var K = fit.K, ref = opts.ref || 0, rows = [];
    for (var i = 0; i < fit.classes.length; i++) { var ok = true; for (var j
      = 0; j < Zcols.length; j++) if (!St.isNum(Zcols[j][i])) { ok = false;
      break; } if (ok) rows.push(i); }
    if (rows.length < K * (Zcols.length + 2)) throw new Error(
      ('\uACF5\uBCC0\uC778\uC774 \uC788\uB294 \uC0AC\uB840\uAC00 '
      + '\uB108\uBB34 \uC801\uC2B5\uB2C8\uB2E4.'));
    var D = classificationError(fit.Z, fit.classes), X = design(Zcols,
      rows), w = rows.map(function (i2) { return fit.classes[i2]; });
    var used = new Array(K).fill(0); w.forEach(function (t) { used[t]++; });
    if (used.some(function (u) { return u === 0; })) throw new Error(
      ('\uCD5C\uBE48 \uBC30\uC815\uC73C\uB85C \uC0AC\uB840\uAC00 '
      + '\uD55C \uBA85\uB3C4 \uBC30\uC815\uB418\uC9C0 \uC54A\uC740 '
      + '\uC9D1\uB2E8\uC774 \uC788\uC5B4 ML 3\uB2E8\uACC4\uB97C '
      + '\uACC4\uC0B0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'));
    var res = ml3Fit(D, w, X, K, ref, null);
    var inf = numericHessianSE(function (bt) { return ml3LL(X, bt, K, ref,
      D, w); }, res.beta);
    // \uBE44\uAD50\uC6A9: \uCD5C\uBE48 \uBC30\uC815\uC744 \uAD00\uCE21
    // \uBC94\uC8FC\uB85C \uBCF8 \uB2E4\uD56D \uB85C\uC9C0\uC2A4\uD2F1
    // (\uBCF4\uC815 \uC5C6\uC74C)
    var Rn = w.map(function (t) { var r = new Array(K).fill(0); r[t] = 1;
      return r; }), naive = mnFitWeighted(X, Rn, K, ref, null, 200);
    // \uACF5\uBCC0\uC778 \uC804\uCCB4 \uD6A8\uACFC\uC758 \uC6B0\uB3C4\uBE44
    // \uAC80\uC815 (\uAC01 \uACF5\uBCC0\uC778\uC744 \uBE80
    // \uBAA8\uD615\uACFC \uBE44\uAD50)
    var p = X[0].length, z975 = St.qnorm(0.975), others = []; for (var k =
      0; k < K; k++) if (k !== ref) others.push(k);
    var coefs = [];
    others.forEach(function (k2, a) { res.beta[a].forEach(function (b, j2) {
      var se = inf.se[a * p + j2], zz = b / se;
      coefs.push({ cls: k2, name: j2 === 0 ? '(\uC808\uD3B8)' : names[j2 -
        1], b: b, se: se, z: zz, p: 2 * St.pnorm(-Math.abs(zz)), or:
        Math.exp(b), orLow: Math.exp(b - z975 * se), orHigh: Math.exp(b +
        z975 * se), naiveB: naive.beta[a][j2] });
    }); });
    var lr = names.map(function (nm, j3) {
      var keep = []; for (var c = 0; c < Zcols.length; c++) if (c !== j3)
        keep.push(Zcols[c]);
      var r2 = ml3Fit(D, w, design(keep, rows), K, ref, null), ch = 2 * (
        res.ll - r2.ll);
      return { name: nm, chi2: ch, df: K - 1, p: St.pchisqUpper(ch, K - 1)
        };
    });
    var warn = [];
    if (coefs.some(function (c2) { return !isFinite(c2.se) || c2.se > 1e3 ||
      Math.abs(c2.b) > 15; })) warn.push(
      ('\uCD94\uC815\uC774 \uBD88\uC548\uC815\uD569\uB2C8\uB2E4('
      + '\uBD84\uB9AC \uB610\uB294 \uC791\uC740 \uC9D1\uB2E8). '
      + '\uC624\uC988\uBE44\uAC00 \uBE44\uC815\uC0C1\uC801\uC73C'
      + '\uB85C \uD06C\uBA74 \uD574\uC11D\uD558\uC9C0 \uB9C8\uC138'
      + '\uC694.'));
    return { K: K, n: rows.length, ref: ref, D: D, coefs: coefs, ll: res.ll,
      beta: res.beta, V: inf.V, lrTests: lr, warnings: warn, rows: rows };
  }
  // 3\uB2E8\uACC4 \uC804\uCCB4 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9 1\uD68C
  // \u2192 \uACC4\uC218 \uBCA1\uD130
  function ml3BootstrapOnce(res, fit, Zcols, names, ref, rand) {
    var n = res.X.length, idx = [];
    for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    var f2 = refitFrom(res.kind, idx.map(function (q) { return res.X[q]; }),
      fit, res.C);
    if (!f2) return null;
    try { var r = ml3Step(f2, Zcols.map(function (c) { return idx.map(
      function (q) { return c[q]; }); }), names, { ref: ref }); return [
      ].concat.apply([], r.beta); } catch (e) { return null; }
  }
  function ml3ApplyBootstrap(out, draws) {
    var q = draws[0].length, m = new Array(q).fill(0), B = draws.length, sd
      = new Array(q).fill(0);
    draws.forEach(function (d) { for (var a = 0; a < q; a++) m[a] += d[a] /
      B; });
    draws.forEach(function (d) { for (var a = 0; a < q; a++) sd[a] += (d[a]
      - m[a]) * (d[a] - m[a]) / (B - 1); });
    var z975 = St.qnorm(0.975);
    out.coefs.forEach(function (c, a) { var se = Math.sqrt(sd[a]), zz = c.b
      / se; c.bootSE = se; c.bootP = 2 * St.pnorm(-Math.abs(zz));
      c.bootOrLow = Math.exp(c.b - z975 * se); c.bootOrHigh = Math.exp(c.b +
      z975 * se); });
    out.bootB = B;
    return out;
  }

  var api = { lpa: lpa, lca: lca, blrtOnce: blrtOnce, classificationError:
    classificationError, bchWeights: bchWeights, bchDistal: bchDistal,
    multinomialLogistic: multinomialLogistic, ml3Step: ml3Step,
      ml3BootstrapOnce: ml3BootstrapOnce, ml3ApplyBootstrap:
      ml3ApplyBootstrap,
    bchBootstrapOnce: bchBootstrapOnce, bchApplyBootstrap:
      bchApplyBootstrap, refitFrom: refitFrom, lpaFitK: lpaFitK, lcaFitK:
      lcaFitK, lpaNpar: lpaNpar, lcaNpar: lcaNpar, LPA_MODELS: LPA_MODELS };
  Object.keys(api).forEach(function (k) { St[k] = api[k]; });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ?
  global : this);

/*
 * PsyStat \uD1B5\uACC4 \uC5D4\uC9C4 (stats) \u2014 \uC870\uAC01 4/4:
  \uB124\uD2B8\uC6CC\uD06C \uD655\uC7A5
  (\uCEE4\uBBA4\uB2C8\uD2F0\u00B7\uBE0C\uB9AC\uC9C0
  \uC911\uC2EC\uC131\u00B7NCT\u00B7\uBD80\uD2B8\uC2A4\uD2B8\uB7A9
  \uCC28\uC774 \uAC80\uC815)
 * \uC678\uBD80 \uB77C\uC774\uBE0C\uB7EC\uB9AC\u00B7\uB124\uD2B8\uC6CC\uD06C
  \uD1B5\uC2E0 \uC5C6\uC74C. \uC21C\uC218 JavaScript.
 * - \uCEE4\uBBA4\uB2C8\uD2F0: walktrap (Pons & Latapy, 2006;
  igraph::cluster_walktrap\uACFC \uAC19\uC740 \uC808\uCC28: \uC790\uAE30
  \uACE0\uB9AC = \uC5F0\uACB0 \uAC00\uC911\uCE58 \uD3C9\uADE0,
 *   \uAC78\uC74C \uC218 4, \uBAA8\uB4C8\uC131 \uCD5C\uB300 \uBD84\uD560).
  EGA(Golino & Epskamp, 2017)\uB294 EBICglasso \uB124\uD2B8\uC6CC\uD06C
  |\uAC00\uC911\uCE58|\uC5D0 walktrap\uC744 \uC801\uC6A9
 * - \uBE0C\uB9AC\uC9C0 \uC911\uC2EC\uC131 (Jones, Ma, & McNally, 2021):
  \uAC15\uB3C4, \uAE30\uB300\uC601\uD5A5(1\uB2E8\uACC4), \uB9E4\uAC1C,
  \uADFC\uC811 (\uAC70\uB9AC = 1/|w|)
 * - NCT (van Borkulo et al., 2023): \uC21C\uC5F4 \uAC80\uC815\uC73C\uB85C
  \uB450 \uC9D1\uB2E8 \uB124\uD2B8\uC6CC\uD06C\uC758
  \uAD6C\uC870\u00B7\uC804\uCCB4
  \uAC15\uB3C4\u00B7\uC5E3\uC9C0\u00B7\uC911\uC2EC\uC131 \uBE44\uAD50
 */
(function (G) {
  'use strict';
  var St = G.PsyStats;
  if (!St) return;
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new
    Array(c).fill(0)); return m; }

  /* ---------------- \uBAA8\uB4C8\uC131 (igraph::modularity\uC640
    \uAC19\uC740 \uC815\uC758, \uC790\uAE30 \uACE0\uB9AC \uC5C6\uC74C)
    ---------------- */
  function modularity(W, memb) {
    var n = W.length, m = 0, k = new Array(n).fill(0);
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j) {
      k[i] += W[i][j]; if (j > i) m += W[i][j]; }
    if (m === 0) return 0;
    var Q = 0, groups = {};
    memb.forEach(function (c, i2) { (groups[c] = groups[c] || []).push(i2);
      });
    Object.keys(groups).forEach(function (c) {
      var g = groups[c], e = 0, a = 0;
      g.forEach(function (u) { a += k[u]; g.forEach(function (v) { if (u <
        v) e += W[u][v]; }); });
      Q += e / m - (a / (2 * m)) * (a / (2 * m));
    });
    return Q;
  }

  /* ---------------- walktrap ---------------- */
  function walktrap(Win, steps) {
    steps = steps || 4;
    var n = Win.length, W = Win.map(function (r) { return r.map(function (v)
      { return Math.abs(v); }); }), A = W.map(function (r) { return r.slice(
      ); });
    for (var i = 0; i < n; i++) {
      var s = 0, c = 0; for (var j = 0; j < n; j++) if (j !== i && W[i][j] >
        0) { s += W[i][j]; c++; }
      A[i][i] = c ? s / c : 1;
        // \uC790\uAE30 \uACE0\uB9AC: \uC5F0\uACB0 \uAC00\uC911\uCE58
        // \uD3C9\uADE0 (igraph/Pons \uAD6C\uD604\uACFC \uAC19\uC74C)
    }
    var d = A.map(function (r) { return r.reduce(function (a, b) { return a
      + b; }, 0); });
    var P = A.map(function (r, i2) { return r.map(function (v) { return v /
      d[i2]; }); }), Pt = P.map(function (r) { return r.slice(); });
    for (var t = 1; t < steps; t++) Pt = Pt.map(function (r) { return P[
      0].map(function (_, j2) { var acc = 0; for (var k = 0; k < n; k++) acc
      += r[k] * P[k][j2]; return acc; }); });
    var comms = []; for (var i3 = 0; i3 < n; i3++) comms.push({ id: i3,
      members: [i3], P: Pt[i3], size: 1 });
    var memb = []; for (var i4 = 0; i4 < n; i4++) memb.push(i4);
    var best = { Q: modularity(W, memb), memb: memb.slice() }, Qs = [
      best.Q], merges = [], next = n;
    var adj = function (c1, c2) { return c1.members.some(function (a) {
      return c2.members.some(function (b) { return W[a][b] > 0; }); }); };
    while (true) {
      var pick = null;
      for (var a = 0; a < comms.length; a++) for (var b = a + 1; b <
        comms.length; b++) {
        if (!adj(comms[a], comms[b])) continue;
        var r2 = 0; for (var k2 = 0; k2 < n; k2++) { var df = comms[a].P[k2]
          - comms[b].P[k2]; r2 += df * df / d[k2]; }
        var ds = comms[a].size * comms[b].size / (comms[a].size + comms[
          b].size) * r2 / n;
        if (!pick || ds < pick.ds) pick = { a: a, b: b, ds: ds };
      }
      if (!pick) break;
      var c1 = comms[pick.a], c2 = comms[pick.b], sz = c1.size + c2.size;
      merges.push([c1.id, c2.id]);
      var nc = { id: next++, members: c1.members.concat(c2.members), size:
        sz, P: c1.P.map(function (v, k3) { return (c1.size * v + c2.size *
        c2.P[k3]) / sz; }) };
      comms = comms.filter(function (_, q) { return q !== pick.a && q !==
        pick.b; }).concat([nc]);
      // \uD604\uC7AC \uBD84\uD560\uC758 \uBAA8\uB4C8\uC131
      comms.forEach(function (cm, ci) { cm.members.forEach(function (u) {
        memb[u] = ci; }); });
      var Q = modularity(W, memb); Qs.push(Q);
      if (Q > best.Q + 1e-12) best = { Q: Q, memb: memb.slice() };
    }
    // \uBC88\uD638 \uC815\uB9AC: \uCC98\uC74C \uB098\uC624\uB294
    // \uC21C\uC11C\uB300\uB85C 1, 2, \u2026
    var map = {}, lab = 0, out = best.memb.map(function (c3) { if (!(c3 in
      map)) map[c3] = ++lab; return map[c3]; });
    return { membership: out, modularity: best.Q, nComm: lab, merges:
      merges, Qs: Qs };
  }

  /* ---------------- \uBE0C\uB9AC\uC9C0 \uC911\uC2EC\uC131 ----------------
    */
  function bridgeCentrality(net, comm) {
    var n = net.length, str = new Array(n).fill(0), ei = new Array(n).fill(
      0), INF = Infinity;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j &&
      comm[i] !== comm[j]) { str[i] += Math.abs(net[i][j]); ei[i] += net[i][
      j]; }
    // \uCD5C\uB2E8 \uACBD\uB85C (\uAC70\uB9AC 1/|w|): \uBE0C\uB9AC\uC9C0
    // \uADFC\uC811 = \uB2E4\uB978 \uCEE4\uBBA4\uB2C8\uD2F0
    // \uB178\uB4DC\uAE4C\uC9C0 \uD3C9\uADE0 \uAC70\uB9AC\uC758
    // \uC5ED\uC218, \uBE0C\uB9AC\uC9C0 \uB9E4\uAC1C = \uC11C\uB85C
    // \uB2E4\uB978 \uCEE4\uBBA4\uB2C8\uD2F0 \uC30D\uC758 \uCD5C\uB2E8
    // \uACBD\uB85C \uC704\uC5D0 \uB193\uC778
    // \uD69F\uC218(\uACBD\uB85C\uAC00 \uC5EC\uB7EC \uAC1C\uBA74
    // \uBE44\uC728)
    var dist = [], sigma = [], preds = [];
    for (var s = 0; s < n; s++) {
      var D = new Array(n).fill(INF), sg = new Array(n).fill(0), pr = [],
        done = new Array(n).fill(false);
      for (var q = 0; q < n; q++) pr.push([]);
      D[s] = 0; sg[s] = 1;
      for (var step = 0; step < n; step++) {
        var u = -1, bd = INF; for (var c = 0; c < n; c++) if (!done[c] && D[
          c] < bd) { bd = D[c]; u = c; }
        if (u < 0) break; done[u] = true;
        for (var v = 0; v < n; v++) {
          if (v === u || net[u][v] === 0 || done[v]) continue;
          var nd = D[u] + 1 / Math.abs(net[u][v]), tol = 1e-12 * Math.max(1,
            nd);
          if (nd < D[v] - tol) { D[v] = nd; sg[v] = sg[u]; pr[v] = [u]; }
            else if (Math.abs(nd - D[v]) <= tol) { sg[v] += sg[u]; pr[
            v].push(u); }
        }
      }
      dist.push(D); sigma.push(sg); preds.push(pr);
    }
    var clo = [], btw = new Array(n).fill(0);
    for (var i2 = 0; i2 < n; i2++) {
      var ds = []; for (var j2 = 0; j2 < n; j2++) if (comm[j2] !== comm[i2]
        && isFinite(dist[i2][j2])) ds.push(dist[i2][j2]);
      clo.push(ds.length ? 1 / (ds.reduce(function (a, b) { return a + b; },
        0) / ds.length) : NaN);
    }
    // \uC30D (s, t), s < t, \uC11C\uB85C \uB2E4\uB978
    // \uCEE4\uBBA4\uB2C8\uD2F0: \uACBD\uB85C \uC218 \u03C3_st \uC911
    // v\uB97C \uC9C0\uB098\uB294 \uBE44\uC728 = \u03C3_sv \u03C3_vt /
    // \u03C3_st (d_sv + d_vt = d_st)
    for (var s2 = 0; s2 < n; s2++) for (var t2 = s2 + 1; t2 < n; t2++) {
      if (comm[s2] === comm[t2] || !isFinite(dist[s2][t2])) continue;
      for (var v2 = 0; v2 < n; v2++) {
        if (v2 === s2 || v2 === t2) continue;
        var through = dist[s2][v2] + dist[v2][t2];
        if (Math.abs(through - dist[s2][t2]) <= 1e-9 * Math.max(1, dist[s2][
          t2])) btw[v2] += sigma[s2][v2] * sigma[v2][t2] / sigma[s2][t2];
      }
    }
    return { strength: str, expectedInfluence: ei, closeness: clo,
      betweenness: btw };
  }

  /* ---------------- \uACF5\uD1B5: \uD589
    \uBD80\uBD84\uC9D1\uD569\uC73C\uB85C \uB124\uD2B8\uC6CC\uD06C
    \uCD94\uC815 ---------------- */
  function sub(cols, idx) { return cols.map(function (c) { return idx.map(
    function (i) { return c[i]; }); }); }
  function upper(m) { var v = []; for (var i = 0; i < m.length; i++) for (
    var j = i + 1; j < m.length; j++) v.push(m[i][j]); return v; }
  function netStats(n1, n2) {
    var p = n1.length, e1 = upper(n1), e2 = upper(n2), M = 0, gs1 = 0, gs2 =
      0, ed = [];
    for (var k = 0; k < e1.length; k++) { var dd = Math.abs(e1[k] - e2[k]);
      ed.push(dd); if (dd > M) M = dd; gs1 += Math.abs(e1[k]); gs2 +=
      Math.abs(e2[k]); }
    var c1 = St.centrality(n1), c2 = St.centrality(n2);
    return { M: M, gs1: gs1, gs2: gs2, S: Math.abs(gs1 - gs2), edgeDiff: ed,
      strDiff: c1.strength.map(function (v, i) { return Math.abs(v -
        c2.strength[i]); }), eiDiff: c1.expectedInfluence.map(function (v,
        i) { return Math.abs(v - c2.expectedInfluence[i]); }) };
  }

  /* ---------------- NCT ---------------- */
  // cols: \uD569\uCE5C \uC790\uB8CC(\uD589 = \uC0AC\uB840), g: 0/1
  // \uC9D1\uB2E8, opts: estimateNetwork \uC635\uC158
  function nctObserved(cols, g, opts) {
    var i1 = [], i2 = []; g.forEach(function (v, i) { (v === 0 ? i1 :
      i2).push(i); });
    var n1 = St.estimateNetwork(sub(cols, i1), opts).network, n2 =
      St.estimateNetwork(sub(cols, i2), opts).network;
    return { net1: n1, net2: n2, stats: netStats(n1, n2), n1: i1.length, n2:
      i2.length };
  }
  // \uC21C\uC5F4 1\uD68C: \uC9D1\uB2E8 \uD45C\uC9C0\uB97C
  // \uC11E\uB294\uB2E4(perm\uC744 \uC8FC\uBA74 \uADF8 \uBC30\uC815
  // \uC0AC\uC6A9 \u2014 \uAC80\uC99D\uC6A9)
  function nctPermOnce(cols, g, opts, rand, perm) {
    var n = g.length, lab = perm;
    if (!lab) { lab = g.slice(); for (var k = n - 1; k > 0; k--) { var r =
      Math.floor(rand() * (k + 1)), t = lab[k]; lab[k] = lab[r]; lab[r] = t;
      } }
    var i1 = [], i2 = []; lab.forEach(function (v, i) { (v === 0 ? i1 :
      i2).push(i); });
    try { return netStats(St.estimateNetwork(sub(cols, i1), opts).network,
      St.estimateNetwork(sub(cols, i2), opts).network); } catch (e) {
      return null; }
  }
  // \uC21C\uC5F4 \uACB0\uACFC\uB85C p\uAC12 (Phipson & Smyth, 2010: (1 +
  // #{T* \u2265 T}) / (B + 1))
  function nctSummarize(obs, perms, adjust) {
    var B = perms.length, pv = function (o, arr) { var ge = 0; arr.forEach(
      function (v) { if (v >= o - 1e-12) ge++; }); return (1 + ge) / (B +
      1); };
    var out = { B: B, structure: { M: obs.M, p: pv(obs.M, perms.map(function
      (x) { return x.M; })) },
      strength: { gs1: obs.gs1, gs2: obs.gs2, S: obs.S, p: pv(obs.S,
        perms.map(function (x) { return x.S; })) } };
    out.edgeP = obs.edgeDiff.map(function (o, k) { return pv(o, perms.map(
      function (x) { return x.edgeDiff[k]; })); });
    out.strP = obs.strDiff.map(function (o, k) { return pv(o, perms.map(
      function (x) { return x.strDiff[k]; })); });
    out.eiP = obs.eiDiff.map(function (o, k) { return pv(o, perms.map(
      function (x) { return x.eiDiff[k]; })); });
    var adj = function (ps) { return adjust === 'holm' ? holm(ps) : adjust
      === 'BH' ? bh(ps) : ps.slice(); };
    out.edgePadj = adj(out.edgeP); out.strPadj = adj(out.strP); out.eiPadj =
      adj(out.eiP); out.adjust = adjust || 'none';
    return out;
  }
  function holm(ps) { var m = ps.length, o = ps.map(function (p, i) {
    return [p, i]; }).sort(function (a, b) { return a[0] - b[0]; }), r = new
    Array(m), run = 0; o.forEach(function (x, k) { run = Math.max(run,
    Math.min(1, (m - k) * x[0])); r[x[1]] = run; }); return r; }
  function bh(ps) { var m = ps.length, o = ps.map(function (p, i) { return [
    p, i]; }).sort(function (a, b) { return b[0] - a[0]; }), r = new Array(
    m), run = 1; o.forEach(function (x, k) { run = Math.min(run, Math.min(1,
    x[0] * m / (m - k))); r[x[1]] = run; }); return r; }

  /* ---------------- \uBD80\uD2B8\uC2A4\uD2B8\uB7A9 \uCC28\uC774
    \uAC80\uC815 (bootnet differenceTest\uC640 \uAC19\uC740 \uBC29\uC2DD:
    \uCC28\uC774\uC758 \uBC31\uBD84\uC704 \uAD6C\uAC04\uC774 0\uC744
    \uD3EC\uD568\uD558\uB294\uC9C0) ---------------- */
  function diffTest(samples, i, j, alpha) {
    alpha = alpha || 0.05;
    var d = samples.map(function (s) { return s[i] - s[j]; }).sort(function
      (a, b) { return a - b; });
    var lo = St.quantile(d, alpha / 2), hi = St.quantile(d, 1 - alpha / 2);
    return { lo: lo, hi: hi, sig: lo > 0 || hi < 0 };
  }
  // \uC9C0\uC815\uD55C \uC0AC\uB840 \uBC88\uD638\uB85C
  // \uC7AC\uD45C\uC9D1\uD574 \uB124\uD2B8\uC6CC\uD06C \uCD94\uC815
  // (\uAC80\uC99D\uC6A9; \uC77C\uBC18 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9\uC740
  // PsyStats.bootEdgeOnce)
  function bootWithIndex(cols, opts, idx) { var net = St.estimateNetwork(
    sub(cols, idx), opts).network; return { edges: upper(net), centrality:
    St.centrality(net), net: net }; }

  var api = { walktrap: walktrap, modularity: modularity, bridgeCentrality:
    bridgeCentrality, nctObserved: nctObserved, nctPermOnce: nctPermOnce,
    nctSummarize: nctSummarize,
    diffTest: diffTest, bootWithIndex: bootWithIndex, holm: holm, bh: bh,
      upperTri: upper };
  Object.keys(api).forEach(function (k) { St[k] = api[k]; });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ?
  global : this);

/*
 * PsyStat \uAD6C\uC870\uBC29\uC815\uC2DD \uC5D4\uC9C4 (sem.js)
 * - lavaan \uBB38\uBC95\uC758 \uBD80\uBD84\uC9D1\uD569: =~, ~, ~~, :=,
  \uB77C\uBCA8(a*x), \uACE0\uC815\uAC12(1*x), \uD574\uC81C(NA*x)
 * - lavaan::sem()/cfa() \uAE30\uBCF8\uAC12\uC744 \uB530\uB984: \uCCAB
  \uC9C0\uD45C \uC801\uC7AC\uB7C9 1 \uACE0\uC815, fixed.x = TRUE,
 *   \uC678\uC0DD \uC7A0\uC7AC\uBCC0\uC218 \uAC04 \uACF5\uBD84\uC0B0,
  \uC21C\uC218 \uACB0\uACFC\uBCC0\uC218 \uAC04
  \uC794\uCC28\uACF5\uBD84\uC0B0 \uC790\uB3D9 \uCD94\uAC00
 * - \uCD94\uC815: ML (Fisher scoring), \uD45C\uC900\uC624\uCC28:
  \uAE30\uB300\uC815\uBCF4(ML) / Huber-White \uC0CC\uB4DC\uC704\uCE58(MLR,
  \uAD00\uCE21\uC815\uBCF4)
 * - \uAC80\uC815: \u03C7\u00B2 = N\u00B7F_ML, MLR\uC740 Yuan-Bentler(Mplus
  \uBC29\uC2DD) \uCC99\uB3C4\uD654
 * - RAM \uD45C\uAE30: \u03A3 = F (I \u2212 A)\u207B\u00B9 S (I \u2212
  A)\u207B\u1D40 F\u1D40
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports =
    factory(require('./stats.js'));
  else root.PsySEM = factory(root.PsyStats);
})(typeof self !== 'undefined' ? self : this, function (St) {
  'use strict';

  /* ---------------- \uD589\uB82C \uB3C4\uC6B0\uBBF8 ---------------- */
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(new
    Array(c).fill(0)); return m; }
  function mm(A, B) {
    var r = A.length, k = B.length, c = B[0].length, C = zeros(r, c);
    for (var i = 0; i < r; i++) for (var l = 0; l < k; l++) { var a = A[i][
      l]; if (a === 0) continue; var Bl = B[l], Ci = C[i]; for (var j = 0; j
      < c; j++) Ci[j] += a * Bl[j]; }
    return C;
  }
  function tr(A) { var s = 0; for (var i = 0; i < A.length; i++) s += A[i][
    i]; return s; }
  function T(A) { return St.transpose(A); }
  function trProd(A, B) { var s = 0, n = A.length; for (var i = 0; i < n;
    i++) for (var j = 0; j < n; j++) s += A[i][j] * B[j][i]; return s; }

  /* ---------------- 1. \uBB38\uBC95 \uD574\uC11D ---------------- */
  function parseModel(text) {
    var out = [], defs = [], lines = text.replace(/\r/g, '').split(/[\n;]/);
    lines.forEach(function (raw, ln) {
      var line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      var m = /^(.+?)\s*(=~|~~|:=|~)\s*(.+)$/.exec(line);
      if (!m) throw new Error((ln + 1) +
        ('\uBC88\uC9F8 \uC904\uC744 \uD574\uC11D\uD560 \uC218 '
        + '\uC5C6\uC2B5\uB2C8\uB2E4: "') + line + '"');
      var lhs = m[1].trim(), op = m[2], rhs = m[3].trim();
      if (op === ':=') { defs.push({ name: lhs, expr: rhs, fn: compileExpr(
        rhs) }); return; }
      if (!/^[A-Za-z\uAC00-\uD7A3_.][A-Za-z0-9\uAC00-\uD7A3_.]*$/.test(lhs))
        throw new Error((ln + 1) +
        ('\uBC88\uC9F8 \uC904\uC758 \uC67C\uCABD \uBCC0\uC218 '
        + '\uC774\uB984\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5'
        + '\uB2C8\uB2E4: "') + lhs + '"');
      rhs.split('+').forEach(function (term) {
        term = term.trim(); if (!term) return;
        var label = null, fixed = null, freeForce = false, name = term, mm2
          = /^(.+?)\s*\*\s*(.+)$/.exec(term);
        if (mm2) {
          var mod = mm2[1].trim(); name = mm2[2].trim();
          if (/^NA$/i.test(mod)) freeForce = true;
          else if (!isNaN(Number(mod))) fixed = Number(mod);
          else if (
            /^[A-Za-z\uAC00-\uD7A3_.][A-Za-z0-9\uAC00-\uD7A3_.]*$/.test(
            mod)) label = mod;
          else throw new Error((ln + 1) +
            ('\uBC88\uC9F8 \uC904\uC758 \uC218\uC815\uC790\uB97C '
            + '\uD574\uC11D\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ' + '"')
            + mod + '"');
        }
        if (name === '1') throw new Error(
          ('\uC808\uD3B8(~ 1)\uC740 \uD604\uC7AC \uC9C0\uC6D0'
          + '\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'));
        if (!/^[A-Za-z\uAC00-\uD7A3_.][A-Za-z0-9\uAC00-\uD7A3_.]*$/.test(
          name)) throw new Error((ln + 1) +
          ('\uBC88\uC9F8 \uC904\uC758 \uBCC0\uC218 \uC774\uB984'
          + '\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8'
          + '\uB2E4: "') + name + '"');
        out.push({ lhs: lhs, op: op, rhs: name, label: label, fixed: fixed,
          freeForce: freeForce, user: true });
      });
    });
    return { pt: out, defs: defs };
  }

  // := \uC218\uC2DD \uCEF4\uD30C\uC77C (+ \u2212 * / ^, \uAD04\uD638,
  // \uB77C\uBCA8, \uC22B\uC790)
  function compileExpr(src) {
    // (\uC804\uC1A1\uC6A9 \uC904 \uAE38\uC774 \uC81C\uD55C
    // \uB54C\uBB38\uC5D0 \uC815\uADDC\uC2DD\uC744 \uBB38\uC790\uC5F4\uB85C
    // \uB098\uB220 \uB9CC\uB4E6; \uB0B4\uC6A9\uC740 \uAC19\uC74C)
    var TOK_RE = new RegExp(
      '\\s*([A-Za-z\uAC00-\uD7A3_.][A-Za-z0-9\uAC00-\uD7A3_.]*|' +
      '\\d*\\.?\\d+(?:[eE][-+]?\\d+)?|[-+*/^()])\\s*', 'g');
    var toks = src.match(TOK_RE);
    if (!toks || toks.join('').replace(/\s/g, '') !== src.replace(/\s/g,
      '')) throw new Error(
      ('\uC815\uC758 \uC218\uC2DD\uC744 \uD574\uC11D\uD560 \uC218 '
      + '\uC5C6\uC2B5\uB2C8\uB2E4: "') + src + '"');
    toks = toks.map(function (t) { return t.trim(); });
    var i = 0, names = [];
    function peek() { return toks[i]; }
    function expr() { var n = term(); while (peek() === '+' || peek() ===
      '-') { var o = toks[i++], r = term(); n = { o: o, a: n, b: r }; }
      return n; }
    function term() { var n = power(); while (peek() === '*' || peek() ===
      '/') { var o = toks[i++], r = power(); n = { o: o, a: n, b: r }; }
      return n; }
    function power() { var n = unary(); if (peek() === '^') { i++; n = { o:
      '^', a: n, b: power() }; } return n; }
    function unary() { if (peek() === '-') { i++; return { o: 'neg', a:
      unary() }; } if (peek() === '+') { i++; return unary(); } return atom(
      ); }
    function atom() {
      var t = toks[i++];
      if (t === '(') { var n = expr(); if (toks[i++] !== ')') throw new
        Error(('\uAD04\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'
        + ': "') + src + '"'); return n; }
      if (t === undefined) throw new Error(
        ('\uC218\uC2DD\uC774 \uB05D\uB098\uC9C0 \uC54A\uC558\uC2B5'
        + '\uB2C8\uB2E4: "') + src + '"');
      if (!isNaN(Number(t))) return { v: Number(t) };
      if (names.indexOf(t) < 0) names.push(t);
      return { name: t };
    }
    var tree = expr();
    if (i !== toks.length) throw new Error(
      ('\uC218\uC2DD\uC744 \uD574\uC11D\uD560 \uC218 \uC5C6\uC2B5'
      + '\uB2C8\uB2E4: "') + src + '"');
    function ev(n, env) {
      if (n.v !== undefined) return n.v;
      if (n.name !== undefined) { if (!(n.name in env)) throw new Error(
        '\uC815\uC758 \uC218\uC2DD\uC758 \uB77C\uBCA8 "' + n.name +
        ('"\uC774(\uAC00) \uBAA8\uD615\uC5D0 \uC5C6\uC2B5\uB2C8'
        + '\uB2E4.')); return env[n.name]; }
      if (n.o === 'neg') return -ev(n.a, env);
      var a = ev(n.a, env), b = ev(n.b, env);
      return n.o === '+' ? a + b : n.o === '-' ? a - b : n.o === '*' ? a * b
        : n.o === '/' ? a / b : Math.pow(a, b);
    }
    var fn = function (env) { return ev(tree, env); };
    fn.names = names;
    return fn;
  }

  /* ---------------- 2. \uBAA8\uD615 \uAD6C\uC131 (lavaan
    \uAE30\uBCF8\uAC12) ---------------- */
  function buildModel(parsed, dataNames) {
    var pt = parsed.pt.map(function (p) { return Object.assign({}, p); });
    var latents = [];
    pt.forEach(function (p) { if (p.op === '=~' && latents.indexOf(p.lhs) <
      0) latents.push(p.lhs); });
    var all = [];
    pt.forEach(function (p) { [p.lhs, p.rhs].forEach(function (v) { if (
      all.indexOf(v) < 0) all.push(v); }); });
    var observed = all.filter(function (v) { return latents.indexOf(v) < 0;
      });
    observed.forEach(function (v) { if (dataNames.indexOf(v) < 0) throw new
      Error('\uBCC0\uC218 "' + v +
      ('"\uC774(\uAC00) \uC790\uB8CC\uC5D0 \uC5C6\uC2B5\uB2C8'
      + '\uB2E4. \uC7A0\uC7AC\uBCC0\uC218\uB77C\uBA74 =~ \uB85C '
      + '\uC815\uC758\uD558\uC138\uC694.')); });
    // \uAD00\uCE21\uBCC0\uC218 \uC21C\uC11C: \uC790\uB8CC \uC21C\uC11C
    observed.sort(function (a, b) { return dataNames.indexOf(a) -
      dataNames.indexOf(b); });
    var isLat = function (v) { return latents.indexOf(v) >= 0; };
    var depReg = {}, predReg = {}, indicator = {};
    pt.forEach(function (p) {
      if (p.op === '~') { depReg[p.lhs] = true; predReg[p.rhs] = true; }
      if (p.op === '=~') indicator[p.rhs] = true;
    });
    // \uC678\uC0DD \uAD00\uCE21\uBCC0\uC218 (fixed.x): \uD68C\uADC0\uC758
    // \uC608\uCE21\uBCC0\uC218\uB85C\uB9CC \uC4F0\uC774\uACE0,
    // \uC885\uC18D\u00B7\uC9C0\uD45C\uAC00 \uC544\uB2C8\uBA70 ~~
    // \uC0AC\uC6A9\uC790 \uC9C0\uC815\uB3C4 \uC5C6\uB294
    // \uAD00\uCE21\uBCC0\uC218
    var userCov = {};
    pt.forEach(function (p) { if (p.op === '~~') { userCov[p.lhs] = true;
      userCov[p.rhs] = true; } });
    var xObs = observed.filter(function (v) { return predReg[v] && !depReg[
      v] && !indicator[v] && !userCov[v]; });
    var has = function (op, a, b) { return pt.some(function (p) {
      return p.op === op && ((p.lhs === a && p.rhs === b) || (op === '~~' &&
      p.lhs === b && p.rhs === a)); }); };
    // \uCCAB \uC9C0\uD45C \uACE0\uC815
    latents.forEach(function (f) {
      var first = pt.filter(function (p) { return p.op === '=~' && p.lhs ===
        f; })[0];
      if (first && first.fixed === null && !first.freeForce && !first.label)
        first.fixed = 1;
    });
    var add = function (p) { p.user = false; p.label = null; p.fixed = null;
      p.freeForce = false; pt.push(p); };
    // \uBD84\uC0B0
    observed.forEach(function (v) { if (xObs.indexOf(v) < 0 && !has('~~', v,
      v)) add({ lhs: v, op: '~~', rhs: v }); });
    latents.forEach(function (v) { if (!has('~~', v, v)) add({ lhs: v, op:
      '~~', rhs: v }); });
    // \uC678\uC0DD \uC7A0\uC7AC\uBCC0\uC218 \uAC04 \uACF5\uBD84\uC0B0
    var exoLat = latents.filter(function (v) { return !depReg[v]; });
    for (var i = 0; i < exoLat.length; i++) for (var j = i + 1; j <
      exoLat.length; j++) if (!has('~~', exoLat[i], exoLat[j])) add({ lhs:
      exoLat[i], op: '~~', rhs: exoLat[j] });
    // \uC21C\uC218 \uACB0\uACFC\uBCC0\uC218(\uC885\uC18D\uC774\uBA74\uC11C
    // \uC608\uCE21\uBCC0\uC218\uAC00 \uC544\uB2CC \uBCC0\uC218) \uAC04
    // \uC794\uCC28\uACF5\uBD84\uC0B0
    var pureY = all.filter(function (v) { return depReg[v] && !predReg[v];
      });
    for (var a = 0; a < pureY.length; a++) for (var b = a + 1; b <
      pureY.length; b++) if (!has('~~', pureY[a], pureY[b])) add({ lhs:
      pureY[a], op: '~~', rhs: pureY[b] });
    // \uBAA8\uC218 \uBC88\uD638 (\uAC19\uC740 \uB77C\uBCA8 = \uAC19\uC740
    // \uBAA8\uC218)
    var labelIdx = {}, nFree = 0;
    pt.forEach(function (p) {
      if (p.fixed !== null) { p.free = -1; return; }
      if (p.label) { if (!(p.label in labelIdx)) labelIdx[p.label] =
        nFree++; p.free = labelIdx[p.label]; }
      else p.free = nFree++;
    });
    var vars = observed.concat(latents), idx = {};
    vars.forEach(function (v, k) { idx[v] = k; });
    return { pt: pt, latents: latents, observed: observed, xObs: xObs, vars:
      vars, idx: idx, nFree: nFree, defs: parsed.defs, labelIdx: labelIdx };
  }

  /* ---------------- 3. \uBAA8\uD615 \uACF5\uBD84\uC0B0 ---------------- */
  function matrices(model, theta, Sx) {
    var nv = model.vars.length, A = zeros(nv, nv), S = zeros(nv, nv), id =
      model.idx;
    model.pt.forEach(function (p) {
      var v = p.free >= 0 ? theta[p.free] : p.fixed;
      if (p.op === '=~') A[id[p.rhs]][id[p.lhs]] = v;
      else if (p.op === '~') A[id[p.lhs]][id[p.rhs]] = v;
      else if (p.op === '~~') { S[id[p.lhs]][id[p.rhs]] = v; S[id[p.rhs]][
        id[p.lhs]] = v; }
    });
    // fixed.x: \uC678\uC0DD \uAD00\uCE21\uBCC0\uC218 \uBE14\uB85D\uC740
    // \uD45C\uBCF8\uAC12 \uACE0\uC815
    model.xObs.forEach(function (a) { model.xObs.forEach(function (b) { S[
      id[a]][id[b]] = Sx[a + '|' + b]; }); });
    var IA = zeros(nv, nv);
    for (var i = 0; i < nv; i++) for (var j = 0; j < nv; j++) IA[i][j] = (i
      === j ? 1 : 0) - A[i][j];
    var B = St.inverse(IA), BS = mm(B, S), Sf = mm(BS, T(B));
    var p = model.observed.length, Sigma = zeros(p, p);
    for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Sigma[a2][
      b2] = Sf[a2][b2];
    return { A: A, S: S, B: B, Sf: Sf, Sigma: Sigma };
  }

  // \u2202\u03A3/\u2202\u03B8_k (\uAD00\uCE21 \uBE14\uB85D) \uBAA9\uB85D
  function derivs(model, M) {
    var nv = model.vars.length, p = model.observed.length, id = model.idx, D
      = [];
    for (var k = 0; k < model.nFree; k++) D.push(zeros(p, p));
    var B = M.B, Sf = M.Sf;
    model.pt.forEach(function (q) {
      if (q.free < 0) return;
      var Dk = D[q.free], r, c;
      if (q.op === '~~') {
        r = id[q.lhs]; c = id[q.rhs];
        for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) {
          var v = B[a][r] * B[b][c] + (r !== c ? B[a][c] * B[b][r] : 0);
          Dk[a][b] += v;
        }
      } else {
        // A[r][c] \uC6D0\uC18C: \u2202Sf = B E_rc Sf + (B E_rc Sf)\u1D40
        if (q.op === '=~') { r = id[q.rhs]; c = id[q.lhs]; } else { r = id[
          q.lhs]; c = id[q.rhs]; }
        for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Dk[
          a2][b2] += B[a2][r] * Sf[c][b2] + B[b2][r] * Sf[c][a2];
      }
    });
    return D;
  }

  function mlF(Sigma, Sinv, S, logdetS) {
    var ld = St.logdetPD(Sigma);
    if (!isFinite(ld)) return Infinity;
    return ld + trProd(S, Sinv) - logdetS - S.length;
  }

  /* ---------------- 4. \uCD94\uC815 ---------------- */
  function startValues(model, S) {
    var theta = new Array(model.nFree).fill(0), id = model.idx, set = {};
    var sv = function (v) { return S[id[v]] ? S[id[v]][id[v]] : 1; };
    model.pt.forEach(function (p) {
      if (p.free < 0 || set[p.free]) return;
      var val = 0;
      if (p.op === '=~') {
        var ind = model.pt.filter(function (q) { return q.op === '=~' &&
          q.lhs === p.lhs; }), marker = ind[0].rhs;
        if (marker === p.rhs) val = 1;
        else { var cm = S[id[marker]][id[p.rhs]], others = ind.filter(
          function (q) { return q.rhs !== marker && q.rhs !== p.rhs; });
          var ref = others.length ? others.reduce(function (s, q) { return s
            + S[id[marker]][id[q.rhs]]; }, 0) / others.length : S[id[
            marker]][id[marker]] * 0.5;
          val = Math.abs(ref) > 1e-8 ? cm / ref * (Math.abs(cm) > 0 ? 1 : 0)
            : 1; if (!isFinite(val) || Math.abs(val) > 10) val = 1; }
      } else if (p.op === '~~') {
        if (p.lhs === p.rhs) {
          if (model.latents.indexOf(p.lhs) >= 0) {
            var ind2 = model.pt.filter(function (q) { return q.op === '=~'
              && q.lhs === p.lhs; });
            val = ind2.length ? Math.max(0.05, 0.5 * sv(ind2[0].rhs)) :
              0.05;
          } else val = 0.5 * sv(p.lhs);
        } else val = 0;
      }
      theta[p.free] = val; set[p.free] = true;
    });
    return theta;
  }

  function fitML(model, S, Sx, opts) {
    opts = opts || {};
    var theta = opts.start ? opts.start.slice() : startValues(model, S),
      logdetS = St.logdetPD(S), q = model.nFree;
    var ev = function (th) {
      var M; try { M = matrices(model, th, Sx); } catch (e) { return { F:
        Infinity }; }
      var Si; try { Si = St.inverse(M.Sigma); } catch (e2) { return { F:
        Infinity }; }
      var F = mlF(M.Sigma, Si, S, logdetS);
      return { M: M, Si: Si, F: F };
    };
    var cur = ev(theta), it, converged = false;
    if (!isFinite(cur.F)) throw new Error(
      ('\uC2DC\uC791\uAC12\uC5D0\uC11C \uBAA8\uD615 \uACF5\uBD84'
      + '\uC0B0\uC774 \uC591\uC815\uCE58\uAC00 \uC544\uB2D9\uB2C8'
      + '\uB2E4. \uBAA8\uD615 \uC9C0\uC815\uC744 \uD655\uC778\uD558'
      + '\uC138\uC694.'));
    for (it = 1; it <= (opts.maxit || 500); it++) {
      var D = derivs(model, cur.M), Si = cur.Si, Rm = mm(mm(Si, S), Si);
      var W = Si.map(function (r, i) { return r.map(function (v, j) {
        return v - Rm[i][j]; }); });
        // \u03A3\u207B\u00B9 \u2212 \u03A3\u207B\u00B9S\u03A3\u207B\u00B9
      var g = D.map(function (Dk) { return trProd(W, Dk); });
      var MK = D.map(function (Dk) { return mm(Si, Dk); }), H = zeros(q, q);
      for (var a = 0; a < q; a++) for (var b = a; b < q; b++) { H[a][b] = H[
        b][a] = trProd(MK[a], MK[b]); }
      var step;
      try { var Hi = St.inverse(H); step = Hi.map(function (r) {
        return -r.reduce(function (s, v, j) { return s + v * g[j]; }, 0);
        }); }
      catch (e) { throw new Error(
        ('\uC815\uBCF4\uD589\uB82C\uC774 \uD2B9\uC774\uD569\uB2C8'
        + '\uB2E4. \uBAA8\uD615\uC774 \uC2DD\uBCC4\uB418\uC9C0 '
        + '\uC54A\uC558\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4('
        + '\uC790\uC720\uB3C4, \uC7A0\uC7AC\uBCC0\uC218 \uCC99'
        + '\uB3C4 \uC9C0\uC815, \uC911\uBCF5 \uACBD\uB85C \uD655'
        + '\uC778).')); }
      var lam = 1, nxt, nt;
      for (var h = 0; h < 30; h++) {
        nt = theta.map(function (v, k) { return v + lam * step[k]; });
        nxt = ev(nt);
        if (isFinite(nxt.F) && nxt.F <= cur.F + 1e-12) break;
        lam /= 2;
      }
      if (!isFinite(nxt.F)) break;
      var maxStep = Math.max.apply(null, step.map(function (v) {
        return Math.abs(v * lam); }));
      var dF = cur.F - nxt.F;
      theta = nt; cur = nxt;
      var gmax = Math.max.apply(null, g.map(Math.abs));
      if (maxStep < (opts.tol || 1e-11) || (gmax < 1e-12 && maxStep < 1e-8))
        { converged = true; break; }
    }
    return { theta: theta, F: cur.F, M: cur.M, Si: cur.Si, iterations: it,
      converged: converged };
  }

  /* ---------------- 5. \uD45C\uC900\uC624\uCC28 \u00B7 \uAC80\uC815
    ---------------- */
  function gradF(model, theta, S, Sx) {
    var M = matrices(model, theta, Sx), Si = St.inverse(M.Sigma), D =
      derivs(model, M), Rm = mm(mm(Si, S), Si);
    var W = Si.map(function (r, i) { return r.map(function (v, j) { return v
      - Rm[i][j]; }); });
    return D.map(function (Dk) { return trProd(W, Dk); });
  }

  // vech \uC778\uB371\uC2A4
  function vechIdx(p) { var o = []; for (var j = 0; j < p; j++) for (var i =
    j; i < p; i++) o.push([i, j]); return o; }

  function inference(model, fit, S, Sx, Xc, N, estimator) {
    var q = model.nFree, M = fit.M, Si = fit.Si, D = derivs(model, M), p =
      S.length;
    var MK = D.map(function (Dk) { return mm(Si, Dk); }), Hexp = zeros(q,
      q);
    for (var a = 0; a < q; a++) for (var b = a; b < q; b++) Hexp[a][b] =
      Hexp[b][a] = trProd(MK[a], MK[b]);
    var Aexp = Hexp.map(function (r) { return r.map(function (v) { return v
      / 2; }); }); // \uC0AC\uB840\uB2F9 \uAE30\uB300\uC815\uBCF4
    var res = { Aexp: Aexp };
    if (estimator === 'ML') {
      var Ai = St.inverse(Aexp);
      res.vcov = Ai.map(function (r) { return r.map(function (v) { return v
        / N; }); });
      return res;
    }
    // MLR: \uAD00\uCE21\uC815\uBCF4 (\uD574\uC11D\uC801
    // \uAE30\uC6B8\uAE30\uC758 \uC911\uC2EC\uCC28\uBD84)
    var Hobs = zeros(q, q);
    for (var k = 0; k < q; k++) {
      var hk = 1e-5 * Math.max(1, Math.abs(fit.theta[k]));
      var tp = fit.theta.slice(), tm = fit.theta.slice(); tp[k] += hk; tm[k]
        -= hk;
      var gp = gradF(model, tp, S, Sx), gm = gradF(model, tm, S, Sx);
      for (var l = 0; l < q; l++) Hobs[k][l] = (gp[l] - gm[l]) / (2 * hk);
    }
    for (var a2 = 0; a2 < q; a2++) for (var b2 = a2 + 1; b2 < q; b2++) { var
      v = (Hobs[a2][b2] + Hobs[b2][a2]) / 2; Hobs[a2][b2] = Hobs[b2][a2] =
      v; }
    var Aobs = Hobs.map(function (r) { return r.map(function (v2) {
      return v2 / 2; }); });
    // \uC0AC\uB840\uBCC4 \uC810\uC218: s_ik = \u2212\u00BD
    // tr(\u03A3\u207B\u00B9\u2202\u03A3_k) + \u00BD z\u1D62'\u2202\u03A3_k
    // z\u1D62
    var trk = MK.map(tr), Bm = zeros(q, q), vi = vechIdx(p), ps = vi.length,
      B1 = zeros(ps, ps), Sinv = St.inverse(S);
    for (var i = 0; i < N; i++) {
      var x = Xc[i], z = Si.map(function (r) { return r.reduce(function (s2,
        w, j) { return s2 + w * x[j]; }, 0); });
      var zs = Sinv.map(function (r) { return r.reduce(function (s2, w, j) {
        return s2 + w * x[j]; }, 0); });
      var sc = D.map(function (Dk, kk) { var quad = 0; for (var r = 0; r <
        p; r++) { var zr = z[r]; if (zr === 0) continue; for (var c = 0; c <
        p; c++) quad += zr * Dk[r][c] * z[c]; } return -0.5 * trk[kk] + 0.5
        * quad; });
      for (var a3 = 0; a3 < q; a3++) for (var b3 = a3; b3 < q; b3++) Bm[a3][
        b3] += sc[a3] * sc[b3];
      // \uD3EC\uD654\uBAA8\uD615 \uC810\uC218 (vech \u03A3): \uB300\uAC01
      // \u00BD(z_k\u00B2 \u2212 \u03A3\u207B\u00B9_kk), \uBE44\uB300\uAC01
      // z_k z_l \u2212 \u03A3\u207B\u00B9_kl
      var s1 = vi.map(function (pr) { return pr[0] === pr[1] ? 0.5 * (zs[pr[
        0]] * zs[pr[0]] - Sinv[pr[0]][pr[0]]) : zs[pr[0]] * zs[pr[1]] -
        Sinv[pr[0]][pr[1]]; });
      for (var a4 = 0; a4 < ps; a4++) { var sa = s1[a4]; if (sa === 0)
        continue; var row = B1[a4]; for (var b4 = a4; b4 < ps; b4++) row[b4]
        += sa * s1[b4]; }
    }
    for (var a5 = 0; a5 < q; a5++) for (var b5 = a5; b5 < q; b5++) { Bm[a5][
      b5] /= N; Bm[b5][a5] = Bm[a5][b5]; }
    for (var a6 = 0; a6 < ps; a6++) for (var b6 = a6; b6 < ps; b6++) { B1[
      a6][b6] /= N; B1[b6][a6] = B1[a6][b6]; }
    var Aoi = St.inverse(Aobs), V = mm(mm(Aoi, Bm), Aoi);
    res.vcov = V.map(function (r) { return r.map(function (v3) { return v3 /
      N; }); });
    res.Aobs = Aobs; res.B0 = Bm;
    // \uD3EC\uD654\uBAA8\uD615 \uC815\uBCF4 (lavaan yuan.bentler.mplus:
    // h1.information = "unstructured", \uC989 \u03A3 = S\uC5D0\uC11C
    // \uD3C9\uAC00)
    var Si0 = Si; Si = Sinv;
    var P = Sinv, A1 = zeros(ps, ps);
    var e = function (pr) { return pr[0] === pr[1] ? [[pr[0], pr[1], 1]] : [
      [pr[0], pr[1], 1], [pr[1], pr[0], 1]]; };
    for (var a7 = 0; a7 < ps; a7++) for (var b7 = a7; b7 < ps; b7++) {
      var Ea = e(vi[a7]), Eb = e(vi[b7]), t1 = 0, t2 = 0;
      Ea.forEach(function (ea) { Eb.forEach(function (eb) {
        // tr(\u03A3\u207B\u00B9 E_ij \u03A3\u207B\u00B9 E_kl) =
        // \u03A3\u207B\u00B9[j][k] \u03A3\u207B\u00B9[l][i];  tr(P E_ij
        // \u03A3\u207B\u00B9 E_kl) = \u03A3\u207B\u00B9[j][k] P[l][i]
        t1 += Si[ea[1]][eb[0]] * Si[eb[1]][ea[0]];
        t2 += Si[ea[1]][eb[0]] * P[eb[1]][ea[0]];
      }); });
      A1[a7][b7] = A1[b7][a7] = 0.5 * (-t1 + 2 * t2);
    }
    Si = Si0;
    // fixed.x: \uB450 \uBCC0\uC218 \uBAA8\uB450 \uC678\uC0DD
    // \uAD00\uCE21\uBCC0\uC218\uC778 \uC6D0\uC18C\uB294 \uC81C\uC678
    var xi = model.xObs.map(function (v) { return model.idx[v]; }), keep = [
      ];
    vi.forEach(function (pr, k2) { if (!(xi.indexOf(pr[0]) >= 0 &&
      xi.indexOf(pr[1]) >= 0)) keep.push(k2); });
    res.A1 = keep.map(function (a8) { return keep.map(function (b8) {
      return A1[a8][b8]; }); });
    res.B1 = keep.map(function (a8) { return keep.map(function (b8) {
      return B1[a8][b8]; }); });
    return res;
  }

  // \uBE44\uC911\uC2EC \u03C7\u00B2 \uB204\uC801\uD655\uB960
  function pnchisq(x, df, ncp) {
    if (ncp <= 0) return St.pchisq(x, df);
    var lam = ncp / 2, j0 = Math.floor(lam), s = 0;
    var logp0 = -lam + j0 * Math.log(lam) - St.lgamma(j0 + 1);
    for (var dir = 0; dir < 2; dir++) {
      for (var j = dir ? j0 - 1 : j0; dir ? j >= 0 : true; j += dir ? -1 :
        1) {
        var lp = -lam + j * Math.log(lam) - St.lgamma(j + 1), w = Math.exp(
          lp);
        s += w * St.pchisq(x, df + 2 * j);
        if (w < 1e-16 && Math.abs(j - j0) > 5) break;
        if (!dir && j > j0 + 10000) break;
      }
    }
    return Math.min(1, s);
  }
  function rmseaCI(X2, df, N) {
    if (df <= 0) return [NaN, NaN];
    var find = function (target) {
      if (pnchisq(X2, df, 0) < target) return 0;
      var lo = 0, hi = Math.max(10, X2 * 3);
      while (pnchisq(X2, df, hi) > target) hi *= 2;
      for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (pnchisq(
        X2, df, mid) > target) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    return [Math.sqrt(find(0.95) / (N * df)), Math.sqrt(find(0.05) / (N *
      df))];
  }

  /* ---------------- 6. \uC804\uCCB4 \uC2E4\uD589 ---------------- */
  function covN(cols) { // N \uBD84\uBAA8 \uACF5\uBD84\uC0B0
    var k = cols.length, n = cols[0].length, m = cols.map(function (c) {
      return c.reduce(function (s, v) { return s + v; }, 0) / n; }), S =
      zeros(k, k);
    for (var i = 0; i < k; i++) for (var j = i; j < k; j++) { var s = 0; for
      (var r = 0; r < n; r++) s += (cols[i][r] - m[i]) * (cols[j][r] - m[
      j]); S[i][j] = S[j][i] = s / n; }
    return { S: S, means: m };
  }

  function prepare(model, data) { // data: {name: array}
    var cols = model.observed.map(function (v) { return data[v]; });
    var rows = St.completeRows(cols), n = rows.length;
    var X = cols.map(function (c) { return rows.map(function (i) { return c[
      i]; }); });
    return { X: X, rows: rows, n: n };
  }
  function moments(model, X) {
    var cs = covN(X), S = cs.S, Sx = {}, id = model.idx;
    model.xObs.forEach(function (a) { model.xObs.forEach(function (b) { Sx[a
      + '|' + b] = S[id[a]][id[b]]; }); });
    return { S: S, Sx: Sx, means: cs.means };
  }

  function baselineFit(model, S, N) {
    // \uB3C5\uB9BD\uBAA8\uD615: \uB300\uAC01\uB9CC (fixed.x \uBE14\uB85D
    // \uACF5\uBD84\uC0B0\uC740 \uACE0\uC815 \uD3EC\uD568)
    var p = S.length, xi = model.xObs.map(function (v) { return model.idx[
      v]; });
    var Sig = zeros(p, p);
    for (var i = 0; i < p; i++) Sig[i][i] = S[i][i];
    xi.forEach(function (a) { xi.forEach(function (b) { Sig[a][b] = S[a][b];
      }); });
    var F = mlF(Sig, St.inverse(Sig), S, St.logdetPD(S));
    var nx = xi.length, df = p * (p - 1) / 2 - nx * (nx - 1) / 2;
    return { chisq: N * F, df: df, Sigma: Sig };
  }

  // \uAE30\uC800\uBAA8\uD615 \uAC1D\uCCB4: \uAC01 (\uBE44\uC678\uC0DD)
  // \uAD00\uCE21\uBCC0\uC218\uC758 \uBD84\uC0B0\uB9CC \uC790\uC720, fixed.x
  // \uBE14\uB85D\uC740 \uACE0\uC815
  function baselineModel(model) {
    var pt = [], k = 0;
    model.observed.forEach(function (v) { if (model.xObs.indexOf(v) < 0)
      pt.push({ lhs: v, op: '~~', rhs: v, free: k++, fixed: null, user:
      false }); });
    var idx = {}; model.observed.forEach(function (v, i) { idx[v] = i; });
    return { pt: pt, latents: [], observed: model.observed, xObs:
      model.xObs, vars: model.observed, idx: idx, nFree: k, defs: [],
      labelIdx: {} };
  }

  function standardize(model, M, theta) {
    var Sf = M.Sf, id = model.idx, sd = Sf.map(function (r, i) {
      return Math.sqrt(r[i]); });
    var resVar = function (v) { return M.S[id[v]][id[v]]; };
    return model.pt.map(function (p) {
      var est = p.free >= 0 ? theta[p.free] : p.fixed;
      if (p.op === '=~') return est * sd[id[p.lhs]] / sd[id[p.rhs]];
      if (p.op === '~') return est * sd[id[p.rhs]] / sd[id[p.lhs]];
      if (p.lhs === p.rhs) return est / Sf[id[p.lhs]][id[p.lhs]];
      var a = resVar(p.lhs), b = resVar(p.rhs);
      return est / Math.sqrt(a * b);
    });
  }

  function evalDefs(model, theta) {
    var env = {};
    Object.keys(model.labelIdx).forEach(function (l) { env[l] = theta[
      model.labelIdx[l]]; });
    return model.defs.map(function (d) { return d.fn(env); });
  }

  function fitSEM(text, data, opts) {
    opts = opts || {};
    var estimator = opts.estimator === 'MLR' ? 'MLR' : 'ML';
    var parsed = parseModel(text);
    if (!parsed.pt.length) throw new Error(
      ('\uBAA8\uD615 \uBB38\uBC95\uC774 \uBE44\uC5B4 \uC788\uC2B5'
      + '\uB2C8\uB2E4.'));
    var model = buildModel(parsed, Object.keys(data));
    var pre = prepare(model, data), N = pre.n, p = model.observed.length;
    if (N < p + 1) throw new Error('\uC644\uC804 \uC0AC\uB840 \uC218(' + N +
      (')\uAC00 \uAD00\uCE21\uBCC0\uC218 \uC218\uBCF4\uB2E4 \uB9CE'
      + '\uC544\uC57C \uD569\uB2C8\uB2E4.'));
    var mo = moments(model, pre.X), S = mo.S;
    if (!St.cholesky(S)) throw new Error(
      ('\uD45C\uBCF8 \uACF5\uBD84\uC0B0 \uD589\uB82C\uC774 \uC591'
      + '\uC815\uCE58\uAC00 \uC544\uB2D9\uB2C8\uB2E4 (\uC911\uBCF5 '
      + '\uBCC0\uC218 \uB610\uB294 \uC0AC\uB840 \uBD80\uC871).'));
    var fit = fitML(model, S, mo.Sx);
    var nx = model.xObs.length, pstar = p * (p + 1) / 2 - nx * (nx + 1) / 2;
    var df = pstar - model.nFree, chisq = N * fit.F;
    var Xc = []; for (var i = 0; i < N; i++) Xc.push(pre.X.map(function (c,
      j) { return c[i] - mo.means[j]; }));
    var inf = inference(model, fit, S, mo.Sx, Xc, N, estimator);
    var se = inf.vcov.map(function (r, i2) { return Math.sqrt(Math.max(r[
      i2], 0)); });
    var base = baselineFit(model, S, N);
    var out = { model: model, N: N, estimator: estimator, converged:
      fit.converged, iterations: fit.iterations, theta: fit.theta, se: se,
      vcov: inf.vcov, M: fit.M, S: S };
    // \uC801\uD569\uB3C4 (ML)
    var cfi = function (X2, d, Xb, db) { var num = Math.max(X2 - d, 0), den
      = Math.max(Xb - db, X2 - d, 0); return den === 0 ? 1 : 1 - num / den;
      };
    var tli = function (X2, d, Xb, db) { return d > 0 ? (Xb / db - X2 / d) /
      (Xb / db - 1) : NaN; };
    var logdetSig = St.logdetPD(fit.M.Sigma), logl = -N / 2 * (p * Math.log(
      2 * Math.PI) + logdetSig + trProd(S, fit.Si));
    if (model.xObs.length) {
      // lavaan: fixed.x\uC774\uBA74 x\uC758 \uC8FC\uBCC0
      // \uB85C\uADF8\uC6B0\uB3C4\uB97C \uBE80 \uC870\uAC74\uBD80
      // \uB85C\uADF8\uC6B0\uB3C4
      var xi2 = model.xObs.map(function (v) { return model.idx[v]; }), Sxx =
        xi2.map(function (a) { return xi2.map(function (b) { return S[a][b];
        }); });
      logl -= -N / 2 * (xi2.length * Math.log(2 * Math.PI) + St.logdetPD(
        Sxx) + xi2.length);
    }
    var ci = rmseaCI(chisq, df, N);
    var srmr = 0, cnt = 0;
    for (var a = 0; a < p; a++) for (var b = 0; b <= a; b++) { var rr = (S[
      a][b] - fit.M.Sigma[a][b]) / Math.sqrt(S[a][a] * S[b][b]); srmr += rr
      * rr; cnt++; }
    out.fit = { chisq: chisq, df: df, pvalue: df > 0 ? St.pchisqUpper(chisq,
      df) : NaN, baseChisq: base.chisq, baseDf: base.df,
      cfi: cfi(chisq, df, base.chisq, base.df), tli: tli(chisq, df,
        base.chisq, base.df),
      rmsea: df > 0 ? Math.sqrt(Math.max(chisq - df, 0) / (N * df)) : NaN,
        rmseaLow: ci[0], rmseaHigh: ci[1],
      rmseaPclose: df > 0 ? 1 - pnchisq(chisq, df, N * df * 0.0025) : NaN,
      srmr: Math.sqrt(srmr / cnt), logl: logl, npar: model.nFree, aic: -2 *
        logl + 2 * model.nFree, bic: -2 * logl + Math.log(N) * model.nFree
        };
    if (estimator === 'MLR' && df > 0) {
      // Yuan-Bentler (Mplus \uBC29\uC2DD): c = [tr(A1\u207B\u00B9B1) \u2212
      // tr(A0\u207B\u00B9B0)] / df
      var tr1 = trProd(St.inverse(inf.A1), inf.B1), tr0 = trProd(St.inverse(
        inf.Aobs), inf.B0);
      var c = (tr1 - tr0) / df;
      out.fit.scalingFactor = c; out.fit.chisqScaled = chisq / c;
        out.fit.pScaled = St.pchisqUpper(chisq / c, df);
      // \uAE30\uC800(\uB3C5\uB9BD)\uBAA8\uD615\uC758 \uCC99\uB3C4\uD654
      // \uACC4\uC218 \u2192 \uAC15\uAC74 CFI/TLI (Brosseau-Liard & Savalei,
      // 2014), \uAC15\uAC74 RMSEA (Brosseau-Liard, Savalei, & Li, 2012)
      var bm = baselineModel(model), bfit = fitML(bm, S, mo.Sx), binf =
        inference(bm, bfit, S, mo.Sx, Xc, N, 'MLR');
      var cb = (trProd(St.inverse(binf.A1), binf.B1) - trProd(St.inverse(
        binf.Aobs), binf.B0)) / base.df;
      var num = Math.max(chisq - c * df, 0), den = Math.max(base.chisq - cb
        * base.df, num, 0);
      out.fit.cfiRobust = den === 0 ? 1 : 1 - num / den;
      out.fit.tliRobust = 1 - ((chisq - c * df) / df) / ((base.chisq - cb *
        base.df) / base.df);
      out.fit.rmseaRobust = Math.sqrt(Math.max(chisq - c * df, 0) / (N *
        df));
      var ciR = rmseaCI(chisq / c, df, N);
        // \uCC99\uB3C4\uD654 \u03C7\u00B2\uC758 \uBE44\uC911\uC2EC
        // \uAD6C\uAC04 \u00D7 \u221Ac
      out.fit.rmseaRobustLow = ciR[0] * Math.sqrt(c);
        out.fit.rmseaRobustHigh = ciR[1] * Math.sqrt(c);
    }
    // \uBAA8\uC218\uD45C
    var std = standardize(model, fit.M, fit.theta), z975 = St.qnorm(0.975);
    out.params = model.pt.map(function (q2, k) {
      var est = q2.free >= 0 ? fit.theta[q2.free] : q2.fixed, s2 = q2.free
        >= 0 ? se[q2.free] : NaN, z = est / s2;
      return { lhs: q2.lhs, op: q2.op, rhs: q2.rhs, label: q2.label, free:
        q2.free >= 0, est: est, se: s2, z: z,
        p: q2.free >= 0 ? 2 * St.pnorm(-Math.abs(z)) : NaN, ciLow: est -
          z975 * s2, ciHigh: est + z975 * s2, std: std[k], user: q2.user };
    });
    // R\u00B2 (\uC885\uC18D\uBCC0\uC218)
    var id = model.idx;
    out.r2 = model.vars.filter(function (v) { return model.pt.some(function
      (q3) { return (q3.op === '~' && q3.lhs === v) || (q3.op === '=~' &&
      q3.rhs === v); }); })
      .map(function (v) { return { name: v, r2: 1 - fit.M.S[id[v]][id[v]] /
        fit.M.Sf[id[v]][id[v]] }; });
    // \uC815\uC758 \uBAA8\uC218 (\uB378\uD0C0 \uBC29\uBC95)
    if (model.defs.length) {
      var d0 = evalDefs(model, fit.theta);
      out.defined = model.defs.map(function (d, j) {
        var grad = fit.theta.map(function (t, k) {
          var h = 1e-6 * Math.max(1, Math.abs(t)), tp = fit.theta.slice(),
            tm = fit.theta.slice(); tp[k] += h; tm[k] -= h;
          return (evalDefs(model, tp)[j] - evalDefs(model, tm)[j]) / (2 *
            h);
        });
        var v = 0; for (var a2 = 0; a2 < grad.length; a2++) for (var b2 = 0;
          b2 < grad.length; b2++) v += grad[a2] * inf.vcov[a2][b2] * grad[
          b2];
        var s3 = Math.sqrt(v), z2 = d0[j] / s3;
        return { name: d.name, expr: d.expr, est: d0[j], se: s3, z: z2, p: 2
          * St.pnorm(-Math.abs(z2)), ciLow: d0[j] - z975 * s3, ciHigh: d0[j]
          + z975 * s3 };
      });
    }
    // \uC2E0\uB8B0\uB3C4: CR(\u03C9), AVE (\uD45C\uC900\uD654
    // \uC801\uC7AC\uB7C9;
    // \uAD50\uCC28\uC801\uC7AC\u00B7\uC624\uCC28\uACF5\uBD84\uC0B0\uC774
    // \uC5C6\uB2E4\uACE0 \uAC00\uC815)
    out.reliability = model.latents.map(function (f) {
      var L = out.params.filter(function (q4) { return q4.op === '=~' &&
        q4.lhs === f; });
      var sl = L.reduce(function (s4, q4) { return s4 + q4.std; }, 0), sl2 =
        L.reduce(function (s4, q4) { return s4 + q4.std * q4.std; }, 0);
      var th = L.reduce(function (s4, q4) { return s4 + (1 - q4.std *
        q4.std); }, 0);
      return { factor: f, k: L.length, cr: sl * sl / (sl * sl + th), ave:
        sl2 / L.length };
    });
    var warn = [];
    if (!fit.converged) warn.push(
      ('\uCD94\uC815\uC774 \uC218\uB834\uD558\uC9C0 \uC54A\uC558'
      + '\uC2B5\uB2C8\uB2E4. \uACB0\uACFC\uB97C \uD574\uC11D\uD558'
      + '\uC9C0 \uB9C8\uC138\uC694.'));
    if (df < 0) warn.push(
      ('\uC790\uC720\uB3C4\uAC00 \uC74C\uC218\uC785\uB2C8\uB2E4: '
      + '\uBAA8\uD615\uC774 \uC2DD\uBCC4\uB418\uC9C0 \uC54A\uC2B5'
      + '\uB2C8\uB2E4.'));
    out.params.forEach(function (q5) { if (q5.op === '~~' && q5.lhs ===
      q5.rhs && q5.est < 0) warn.push('"' + q5.lhs +
      ('"\uC758 (\uC794\uCC28)\uBD84\uC0B0\uC774 \uC74C\uC218'
      + '\uC785\uB2C8\uB2E4(Heywood \uC0AC\uB840). \uBAA8\uD615 '
      + '\uC9C0\uC815\uC774\uB098 \uD45C\uBCF8 \uD06C\uAE30\uB97C '
      + '\uC810\uAC80\uD558\uC138\uC694.')); });
    if (!St.cholesky(fit.M.Sf.map(function (r) { return r.slice(); })))
      warn.push(('\uBAA8\uD615\uC774 \uCD94\uC815\uD55C \uC7A0\uC7AC\uBCC0'
      + '\uC218 \uACF5\uBD84\uC0B0 \uD589\uB82C\uC774 \uC591\uC815'
      + '\uCE58\uAC00 \uC544\uB2D9\uB2C8\uB2E4(\uC0C1\uAD00 > 1 '
      + '\uAC00\uB2A5\uC131).'));
    out.warnings = warn;
    out._ctx = { parsedText: text, X: pre.X, estimator: estimator };
    return out;
  }

  // \uC815\uC758 \uBAA8\uC218 \uBD80\uD2B8\uC2A4\uD2B8\uB7A9 (\uC0AC\uB840
  // \uC7AC\uD45C\uC9D1, \uBC31\uBD84\uC704) \u2014 \uBE44\uB3D9\uAE30
  // \uC9C4\uD589\uC740 \uD638\uCD9C \uCE21\uC5D0\uC11C chunk
  // \uB2E8\uC704\uB85C
  function bootstrapOnce(res, rand) {
    var model = res.model, X = res._ctx.X, N = res.N, idx = [];
    for (var i = 0; i < N; i++) idx.push(Math.floor(rand() * N));
    var Xb = X.map(function (c) { return idx.map(function (r) { return c[r];
      }); });
    var mo = moments(model, Xb);
    if (!St.cholesky(mo.S)) return null;
    try {
      var f = fitML(model, mo.S, mo.Sx, { start: res.theta, maxit: 300, tol:
        1e-8 });
      if (!f.converged) return null;
      return { theta: f.theta, defined: evalDefs(model, f.theta) };
    } catch (e) { return null; }
  }

  return { parseModel: parseModel, buildModel: buildModel, fitSEM: fitSEM,
    bootstrapOnce: bootstrapOnce, pnchisq: pnchisq, compileExpr: compileExpr
    };
});
