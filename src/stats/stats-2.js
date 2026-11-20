/*
 * PsyStat 통계 엔진 (stats) — 조각 2/2: 네트워크·다분상관·조절·매개·다변량·안정성
 * 외부 라이브러리·네트워크 통신 없음. 순수 JavaScript.
 * 조각들은 G.__PsyStatsNS 로 함수를 공유하며, 마지막 조각이 G.PsyStats 를 만든다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 계산 코드는 분할 전과 동일)
 */
(function (G) {
  'use strict';
  var NS = G.__PsyStatsNS || (G.__PsyStatsNS = {});
  // 앞 조각에서 가져오기
  var lgamma = NS.lgamma, ibeta = NS.ibeta, gammaP = NS.gammaP, gammaQ = NS.gammaQ, pnorm = NS.pnorm, pnormUpper = NS.pnormUpper, qnorm = NS.qnorm, pt = NS.pt;
  var ptTwoSided = NS.ptTwoSided, pfUpper = NS.pfUpper, pchisqUpper = NS.pchisqUpper, pchisq = NS.pchisq, qt = NS.qt, qchisq = NS.qchisq, qf = NS.qf, ptukey = NS.ptukey;
  var zeros = NS.zeros, identity = NS.identity, transpose = NS.transpose, matmul = NS.matmul, copyM = NS.copyM, cholesky = NS.cholesky, logdetPD = NS.logdetPD, inverse = NS.inverse;
  var eigenSym = NS.eigenSym, qrLeastSquares = NS.qrLeastSquares, isNum = NS.isNum, clean = NS.clean, sum = NS.sum, mean = NS.mean, variance = NS.variance, sd = NS.sd;
  var quantile = NS.quantile, quantileSPSS = NS.quantileSPSS, rank = NS.rank, pearson = NS.pearson, shapiroWilk = NS.shapiroWilk, descriptives = NS.descriptives, leveneTest = NS.leveneTest, tTestOneSample = NS.tTestOneSample;
  var tTestPaired = NS.tTestPaired, tTestIndependent = NS.tTestIndependent, anovaOneway = NS.anovaOneway, corTest = NS.corTest, corMatrix = NS.corMatrix, completeRows = NS.completeRows, fisherExact2x2 = NS.fisherExact2x2, crosstab = NS.crosstab;
  var linearRegression = NS.linearRegression, logisticRegression = NS.logisticRegression, reliability = NS.reliability;
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
    var S;
    if (opts.cor === 'auto') {
      var ca = corAuto(cols, { ordinal: opts.ordinal });
      S = ca.R;
      if (!cholesky(S)) { S = nearPD(S).mat; if (opts.onNearPD) opts.onNearPD(); }
    } else S = covMatrix(opts.cor === 'spearman' ? cols.map(rank) : cols);
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

  /* ------------------------------------------------------------------ */
  /* 10. 이변량 정규분포 · 다분/다계열 상관 (lavaan::lavCor two-step 방식) */
  /* ------------------------------------------------------------------ */

  // P(X > dh, Y > dk), 상관 r (Genz, 2004; bvnu)
  var GL = {
    3: { w: [0.1713244923791705, 0.3607615730481384, 0.4679139345726904], x: [-0.9324695142031522, -0.6612093864662647, -0.2386191860831970] },
    6: { w: [.04717533638651177, .1069393259953183, .1600783285433464, .2031674267230659, .2334925365383547, .2491470458134029],
      x: [-.9815606342467191, -.9041172563704750, -.7699026741943050, -.5873179542866171, -.3678314989981802, -.1252334085114692] },
    10: { w: [.01761400713915212, .04060142980038694, .06267204833410906, .08327674157670475, .1019301198172404, .1181945319615184, .1316886384491766, .1420961093183821, .1491729864726037, .1527533871307259],
      x: [-.9931285991850949, -.9639719272779138, -.9122344282513259, -.8391169718222188, -.7463319064601508, -.6360536807265150, -.5108670019508271, -.3737060887154196, -.2277858511416451, -.07652652113349733] }
  };
  function bvnu(dh, dk, r) {
    if (dh === Infinity || dk === Infinity) return 0;
    if (dh === -Infinity) return dk === -Infinity ? 1 : pnorm(-dk);
    if (dk === -Infinity) return pnorm(-dh);
    if (r === 0) return pnorm(-dh) * pnorm(-dk);
    var tp = 2 * Math.PI, h = dh, k = dk, hk = h * k, bvn = 0, g = Math.abs(r) < 0.3 ? GL[3] : Math.abs(r) < 0.75 ? GL[6] : GL[10];
    var w = g.w.concat(g.w), x = g.x.map(function (v) { return 1 - v; }).concat(g.x.map(function (v) { return 1 + v; }));
    var i;
    if (Math.abs(r) < 0.925) {
      var hs = (h * h + k * k) / 2, asr = Math.asin(r) / 2;
      for (i = 0; i < x.length; i++) { var sn = Math.sin(asr * x[i]); bvn += w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn)); }
      bvn = bvn * asr / tp + pnorm(-h) * pnorm(-k);
    } else {
      if (r < 0) { k = -k; hk = -hk; }
      if (Math.abs(r) < 1) {
        var as = 1 - r * r, a = Math.sqrt(as), bs = (h - k) * (h - k), c = (4 - hk) / 8, d = (12 - hk) / 80;
        var asr2 = -(bs / as + hk) / 2;
        if (asr2 > -100) bvn = a * Math.exp(asr2) * (1 - c * (bs - as) * (1 - d * bs) / 3 + c * d * as * as);
        if (hk > -100) { var b = Math.sqrt(bs), sp = Math.sqrt(tp) * pnorm(-b / a); bvn -= Math.exp(-hk / 2) * sp * b * (1 - c * bs * (1 - d * bs) / 3); }
        a = a / 2;
        var acc = 0;
        for (i = 0; i < x.length; i++) {
          var xs = (a * x[i]) * (a * x[i]), asr3 = -(bs / xs + hk) / 2;
          if (asr3 > -100) {
            var sp2 = 1 + c * xs * (1 + 5 * d * xs), rs = Math.sqrt(1 - xs), ep = Math.exp(-(hk / 2) * xs / ((1 + rs) * (1 + rs))) / rs;
            acc += Math.exp(asr3) * (sp2 - ep) * w[i];
          }
        }
        bvn = (a * acc - bvn) / tp;
      }
      if (r > 0) bvn += pnorm(-Math.max(h, k));
      else if (h >= k) bvn = -bvn;
      else { var L = h < 0 ? pnorm(k) - pnorm(h) : pnorm(-h) - pnorm(-k); bvn = L - bvn; }
    }
    return Math.max(0, Math.min(1, bvn));
  }
  // 하측 누적 P(X <= h, Y <= k)
  function pbvnorm(h, k, r) { return bvnu(-h, -k, r); }

  // 브렌트 1차원 최소화 (Brent, 1973)
  function fminBrent(fn, a, b, tol) {
    tol = tol || 1e-10;
    var gr = 0.3819660112501051, x = a + gr * (b - a), w = x, v = x, fx = fn(x), fw = fx, fv = fx, d = 0, e = 0;
    for (var it = 0; it < 200; it++) {
      var m = 0.5 * (a + b), tol1 = tol * Math.abs(x) + 1e-12, tol2 = 2 * tol1;
      if (Math.abs(x - m) <= tol2 - 0.5 * (b - a)) break;
      var useGolden = true;
      if (Math.abs(e) > tol1) {
        var r = (x - w) * (fx - fv), q = (x - v) * (fx - fw), p = (x - v) * q - (x - w) * r;
        q = 2 * (q - r); if (q > 0) p = -p; q = Math.abs(q);
        if (Math.abs(p) < Math.abs(0.5 * q * e) && p > q * (a - x) && p < q * (b - x)) {
          e = d; d = p / q; var u0 = x + d;
          if (u0 - a < tol2 || b - u0 < tol2) d = x < m ? tol1 : -tol1;
          useGolden = false;
        }
      }
      if (useGolden) { e = (x < m ? b : a) - x; d = gr * e; }
      var u = Math.abs(d) >= tol1 ? x + d : x + (d > 0 ? tol1 : -tol1), fu = fn(u);
      if (fu <= fx) { if (u < x) b = x; else a = x; v = w; fv = fw; w = x; fw = fx; x = u; fx = fu; }
      else {
        if (u < x) a = u; else b = u;
        if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; } else if (fu <= fv || v === x || v === w) { v = u; fv = fu; }
      }
    }
    return { x: x, f: fx };
  }

  function ordLevels(x) { var lv = []; x.forEach(function (v) { if (isNum(v) && lv.indexOf(v) < 0) lv.push(v); }); return lv.sort(function (a, b) { return a - b; }); }
  // 일변량 역치: 해당 변수의 모든 관측값 사용 (lavaan 방식)
  function thresholds(x) {
    var lv = ordLevels(x), n = 0, cnt = lv.map(function () { return 0; });
    x.forEach(function (v) { if (isNum(v)) { cnt[lv.indexOf(v)]++; n++; } });
    var th = [], cum = 0;
    for (var i = 0; i < lv.length - 1; i++) { cum += cnt[i]; th.push(qnorm(cum / n)); }
    return { levels: lv, tau: th };
  }

  // 다분상관(polychoric)/사분상관(tetrachoric): 역치 고정, ρ만 최대우도 추정
  function polychoric(xin, yin, tx, ty) {
    tx = tx || thresholds(xin); ty = ty || thresholds(yin);
    var I = tx.levels.length, J = ty.levels.length, T = zeros(I, J), n = 0;
    for (var r = 0; r < xin.length; r++) if (isNum(xin[r]) && isNum(yin[r])) { T[tx.levels.indexOf(xin[r])][ty.levels.indexOf(yin[r])]++; n++; }
    if (I < 2 || J < 2) return { rho: NaN, n: n, table: T };
    // lavaan 규칙 (zero.add = c(0.5, 0), zero.keep.margins = TRUE): 2×2 표에서만 처리
    var zeroCells = 0;
    if (I === 2 && J === 2) {
      var zs = [];
      for (var a0 = 0; a0 < 2; a0++) for (var b0 = 0; b0 < 2; b0++) if (T[a0][b0] === 0) zs.push([a0, b0]);
      zeroCells = zs.length;
      if (zs.length >= 2) return { rho: T[0][0] > 0 ? 1 : -1, n: n, table: T, zeroCells: zeroCells };
      if (zs.length === 1) {
        var sgn = zs[0][0] === zs[0][1] ? 1 : -1; // 대각 칸이 비면 대각 +0.5, 비대각 −0.5 (주변합 유지)
        T[0][0] += 0.5 * sgn; T[1][1] += 0.5 * sgn; T[0][1] -= 0.5 * sgn; T[1][0] -= 0.5 * sgn;
      }
      if (T[0][0] * T[1][1] === T[0][1] * T[1][0]) return { rho: 0, n: n, table: T, zeroCells: zeroCells };
    }
    var ta = [-Infinity].concat(tx.tau, [Infinity]), tb = [-Infinity].concat(ty.tau, [Infinity]);
    function nll(rho) {
      var ll = 0;
      for (var i = 0; i < I; i++) for (var j = 0; j < J; j++) {
        if (!T[i][j]) continue;
        var p = pbvnorm(ta[i + 1], tb[j + 1], rho) - pbvnorm(ta[i], tb[j + 1], rho) - pbvnorm(ta[i + 1], tb[j], rho) + pbvnorm(ta[i], tb[j], rho);
        ll += T[i][j] * Math.log(Math.max(p, 1e-300));
      }
      return -ll;
    }
    var opt = fminBrent(nll, -0.9999, 0.9999, 1e-12);
    return { rho: opt.x, n: n, table: T, zeroCells: zeroCells };
  }

  // 다계열상관(polyserial): 연속변수 x(평균·SD 고정), 순서형 y(역치 고정)에서 ρ 최대우도
  function polyserial(xin, yin, ty) {
    ty = ty || thresholds(yin);
    var xs = clean(xin), m = mean(xs), s = Math.sqrt(variance(xs) * (xs.length - 1) / xs.length); // ML(N) 분산
    var z = [], k = [];
    for (var r = 0; r < xin.length; r++) if (isNum(xin[r]) && isNum(yin[r])) { z.push((xin[r] - m) / s); k.push(ty.levels.indexOf(yin[r])); }
    var tb = [-Infinity].concat(ty.tau, [Infinity]);
    function nll(rho) {
      var sq = Math.sqrt(1 - rho * rho), ll = 0;
      for (var i = 0; i < z.length; i++) {
        var p = pnorm((tb[k[i] + 1] - rho * z[i]) / sq) - pnorm((tb[k[i]] - rho * z[i]) / sq);
        ll += Math.log(Math.max(p, 1e-300));
      }
      return -ll;
    }
    return { rho: fminBrent(nll, -0.9999, 0.9999, 1e-12).x, n: z.length };
  }

  // qgraph::cor_auto 판정 규칙: 정수이고 고유값 수(결측 NA 포함) ≤ 7 이면 순서형
  function isOrdinalAuto(x, maxLevels) {
    maxLevels = maxLevels || 7;
    var vals = clean(x);
    if (!vals.every(function (v) { return v % 1 === 0; })) return false;
    var nl = ordLevels(x).length + (vals.length < x.length ? 1 : 0);
    return nl <= maxLevels;
  }

  // 혼합 상관행렬 (lavaan::lavCor(estimator = "two.step", missing = "pairwise")와 같은 규칙)
  function corAuto(cols, opts) {
    opts = opts || {};
    var p = cols.length, R = identity(p), ord = cols.map(function (c, i) { return opts.ordinal ? opts.ordinal[i] : isOrdinalAuto(c); });
    var th = cols.map(function (c, i) { return ord[i] ? thresholds(c) : null; });
    var kinds = zeros(p, p).map(function (r) { return r.map(function () { return ''; }); }), notes = [];
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) {
      var r;
      if (ord[i] && ord[j]) { var pc = polychoric(cols[i], cols[j], th[i], th[j]); r = pc.rho; kinds[i][j] = th[i].levels.length === 2 && th[j].levels.length === 2 ? 'tetrachoric' : 'polychoric'; if (pc.zeroCells) notes.push(i + ',' + j); }
      else if (ord[i]) { r = polyserial(cols[j], cols[i], th[i]).rho; kinds[i][j] = 'polyserial'; }
      else if (ord[j]) { r = polyserial(cols[i], cols[j], th[j]).rho; kinds[i][j] = 'polyserial'; }
      else { r = corTest(cols[i], cols[j], 'pearson').r; kinds[i][j] = 'pearson'; }
      R[i][j] = R[j][i] = r; kinds[j][i] = kinds[i][j];
    }
    return { R: R, ordinal: ord, kinds: kinds, zeroCellPairs: notes };
  }

  // 가장 가까운 양정치 상관행렬 (Higham, 2002; Matrix::nearPD(corr = TRUE, keepDiag = TRUE)와 같은 절차)
  function nearPD(x, opts) {
    opts = opts || {};
    var eigTol = 1e-6, convTol = 1e-7, posdTol = 1e-8, n = x.length;
    var X = copyM(x), DS = zeros(n, n), it = 0, conv = Infinity;
    function normInf(M) { return Math.max.apply(null, M.map(function (r) { return r.reduce(function (s, v) { return s + Math.abs(v); }, 0); })); }
    while (it < 100 && conv > convTol) {
      var Y = X, R = Y.map(function (r, i) { return r.map(function (v, j) { return v - DS[i][j]; }); });
      var e = eigenSym(R), thr = eigTol * e.values[0], Q = e.vectors, d = e.values;
      X = zeros(n, n);
      for (var k = 0; k < n; k++) if (d[k] > thr) for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) X[a][b] += Q[a][k] * d[k] * Q[b][k];
      DS = X.map(function (r, i) { return r.map(function (v, j) { return v - R[i][j]; }); });
      for (var q = 0; q < n; q++) X[q][q] = 1;
      conv = normInf(Y.map(function (r, i) { return r.map(function (v, j) { return v - X[i][j]; }); })) / normInf(Y);
      it++;
    }
    var e2 = eigenSym(X), Eps = posdTol * Math.abs(e2.values[0]);
    if (e2.values[n - 1] < Eps) {
      var dd = e2.values.map(function (v) { return Math.max(v, Eps); }), Q2 = e2.vectors, X2 = zeros(n, n);
      for (var k2 = 0; k2 < n; k2++) for (var a2 = 0; a2 < n; a2++) for (var b2 = 0; b2 < n; b2++) X2[a2][b2] += Q2[a2][k2] * dd[k2] * Q2[b2][k2];
      var D = X2.map(function (r, i) { return Math.sqrt(Math.max(Eps, 1) / r[i]); });
      X = X2.map(function (r, i) { return r.map(function (v, j) { return v * D[i] * D[j]; }); });
    }
    for (var z = 0; z < n; z++) X[z][z] = 1;
    return { mat: X, iterations: it };
  }

  /* ------------------------------------------------------------------ */
  /* 11. 위계적 회귀 · 조절 · 매개 (PROCESS Model 1, 4와 같은 OLS 정의)   */
  /* ------------------------------------------------------------------ */

  // blocks: [[cols...], [cols...]] 누적 투입. 모든 단계는 같은 사례(목록별 제거)
  function hierarchicalRegression(yin, blocks, blockNames, opts) {
    opts = opts || {};
    var all = [yin]; blocks.forEach(function (b) { all = all.concat(b); });
    var rows = completeRows(all), sub = function (c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), cum = [], cumNames = [], models = [];
    blocks.forEach(function (b, k) {
      cum = cum.concat(b.map(sub)); cumNames = cumNames.concat(blockNames[k]);
      if (opts.logistic) models.push(logisticRegression(y, cum, cumNames, opts));
      else models.push(linearRegression(y, cum, cumNames));
    });
    var steps = models.map(function (m, k) {
      if (opts.logistic) {
        var prevDev = k ? models[k - 1].deviance : models[0].nullDeviance, prevDf = k ? models[k - 1].dfM : 0;
        var chi = prevDev - m.deviance, df = m.dfM - prevDf;
        return { model: m, blockChi2: chi, blockDf: df, blockP: pchisqUpper(chi, df) };
      }
      var prevR2 = k ? models[k - 1].R2 : 0, df1 = m.dfM - (k ? models[k - 1].dfM : 0), df2 = m.dfE;
      var dR2 = m.R2 - prevR2, F = (dR2 / df1) / ((1 - m.R2) / df2);
      return { model: m, dR2: dR2, dF: F, df1: df1, df2: df2, dP: pfUpper(F, df1, df2) };
    });
    return { n: rows.length, steps: steps };
  }

  function olsFit(y, Xc) { // 내부용: 계수, 공분산, 자유도
    var n = y.length, p = Xc.length + 1;
    var X = y.map(function (_, r) { return [1].concat(Xc.map(function (c) { return c[r]; })); });
    var fit = qrLeastSquares(X, y), b = fit.beta, sse = 0, my = mean(y), sst = 0;
    for (var i = 0; i < n; i++) { var yh = 0; for (var j = 0; j < p; j++) yh += X[i][j] * b[j]; sse += (y[i] - yh) * (y[i] - yh); sst += (y[i] - my) * (y[i] - my); }
    var mse = sse / (n - p);
    return { b: b, cov: fit.XtXinv.map(function (r) { return r.map(function (v) { return v * mse; }); }), dfE: n - p, R2: 1 - sse / sst, mse: mse, sse: sse };
  }
  function coefTable(fit, names, conf) {
    var tc = qt(1 - (1 - (conf || 0.95)) / 2, fit.dfE);
    return fit.b.map(function (b, j) {
      var se = Math.sqrt(fit.cov[j][j]), t = b / se;
      return { name: j ? names[j - 1] : '(절편)', b: b, se: se, t: t, p: ptTwoSided(t, fit.dfE), ciLow: b - tc * se, ciHigh: b + tc * se };
    });
  }

  // 조절분석 (PROCESS Model 1): Y = b0 + b1 X + b2 W + b3 XW + 공변인
  function moderation(yin, xin, win, covs, opts) {
    opts = opts || {};
    covs = covs || [];
    var rows = completeRows([yin, xin, win].concat(covs)), sub = function (c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), w = sub(win), cv = covs.map(sub), n = y.length;
    var mx = opts.center ? mean(x) : 0, mw = opts.center ? mean(w) : 0;
    var xc = x.map(function (v) { return v - mx; }), wc = w.map(function (v) { return v - mw; });
    var xw = xc.map(function (v, i) { return v * wc[i]; });
    var full = olsFit(y, [xc, wc, xw].concat(cv)), red = olsFit(y, [xc, wc].concat(cv));
    var df1 = 1, F = ((full.R2 - red.R2) / df1) / ((1 - full.R2) / full.dfE);
    var names = ['X', 'W', 'X×W'].concat((opts.covNames || []));
    var coefs = coefTable(full, names);
    // 단순기울기: θ(W) = b1 + b3 W
    var b1 = full.b[1], b3 = full.b[3], v11 = full.cov[1][1], v33 = full.cov[3][3], v13 = full.cov[1][3], tc = qt(0.975, full.dfE);
    function slopeAt(wv) { // wv: (중심화된 척도에서의) W 값
      var est = b1 + b3 * wv, se = Math.sqrt(v11 + 2 * wv * v13 + wv * wv * v33), t = est / se;
      return { w: wv + mw, est: est, se: se, t: t, p: ptTwoSided(t, full.dfE), ciLow: est - tc * se, ciHigh: est + tc * se };
    }
    var wvals, isBinary = ordLevels(w).length === 2;
    if (isBinary) wvals = ordLevels(w);
    else if (opts.probe === 'percentile') wvals = [quantile(w, 0.16), quantile(w, 0.5), quantile(w, 0.84)];
    else { var m = mean(w), s = sd(w); wvals = [m - s, m, m + s]; }
    var slopes = wvals.map(function (v) { return slopeAt(v - mw); });
    // Johnson-Neyman: (b1 + b3 w)^2 = tc^2 (v11 + 2 w v13 + w^2 v33)
    var A2 = b3 * b3 - tc * tc * v33, B2 = 2 * (b1 * b3 - tc * tc * v13), C2 = b1 * b1 - tc * tc * v11, disc = B2 * B2 - 4 * A2 * C2, jn = [];
    if (!isBinary && disc >= 0 && A2 !== 0) {
      [(-B2 - Math.sqrt(disc)) / (2 * A2), (-B2 + Math.sqrt(disc)) / (2 * A2)].forEach(function (r0) {
        var wr = r0 + mw; if (wr >= Math.min.apply(null, w) && wr <= Math.max.apply(null, w)) jn.push(wr);
      });
    }
    var wmin = Math.min.apply(null, w), wmax = Math.max.apply(null, w), sigBelow = null;
    if (jn.length) { var probe = slopeAt((jn[0] + wmin) / 2 - mw); sigBelow = probe.p < 0.05; }
    return { n: n, coefs: coefs, R2: full.R2, dR2: full.R2 - red.R2, F: F, df1: df1, df2: full.dfE, p: pfUpper(F, df1, full.dfE),
      slopes: slopes, jn: jn, jnSigBelow: sigBelow, wRange: [wmin, wmax], centered: !!opts.center, meanX: mean(x), meanW: mean(w), sdX: sd(x), sdW: sd(w),
      b: full.b, xMean: mx, wMean: mw, binaryW: isBinary, covMeans: cv.map(mean), xRange: [Math.min.apply(null, x), Math.max.apply(null, x)] };
  }

  // 매개분석 (PROCESS Model 4, 병렬 매개): X → M1..Mk → Y, 공변인 포함, 백분위 부트스트랩
  function mediationFit(y, x, ms, cv) {
    var a = ms.map(function (m) { var f = olsFit(m, [x].concat(cv)); return { fit: f, a: f.b[1] }; });
    var fy = olsFit(y, [x].concat(ms, cv)), ft = olsFit(y, [x].concat(cv));
    var b = ms.map(function (_, k) { return fy.b[2 + k]; });
    var ind = a.map(function (ak, k) { return ak.a * b[k]; });
    return { a: a, fy: fy, ft: ft, b: b, ind: ind, total: ft.b[1], direct: fy.b[1], totalInd: sum(ind) };
  }
  function mediation(yin, xin, msIn, covs, opts) {
    opts = opts || {};
    covs = covs || [];
    var rows = completeRows([yin, xin].concat(msIn, covs)), sub = function (c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), ms = msIn.map(sub), cv = covs.map(sub), n = y.length;
    var est = mediationFit(y, x, ms, cv), k = ms.length;
    var sdx = sd(x), sdy = sd(y);
    var res = { n: n, k: k, est: est, sdx: sdx, sdy: sdy };
    // Sobel (단일 매개, 1차 근사)
    res.sobel = est.a.map(function (ak, j) {
      var sa = Math.sqrt(ak.fit.cov[1][1]), sb = Math.sqrt(est.fy.cov[2 + j][2 + j]), se = Math.sqrt(ak.a * ak.a * sb * sb + est.b[j] * est.b[j] * sa * sa), z = est.ind[j] / se;
      return { se: se, z: z, p: 2 * pnormUpper(Math.abs(z)) };
    });
    var B = opts.boot === undefined ? 5000 : opts.boot;
    if (B > 0) {
      var rand = rng(opts.seed || 1), boots = [], totalB = [], contrast = [];
      for (var bI = 0; bI < B; bI++) {
        var idx = []; for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
        var pick = function (c) { return idx.map(function (q) { return c[q]; }); };
        try {
          var e = mediationFit(pick(y), pick(x), ms.map(pick), cv.map(pick));
          boots.push(e.ind); totalB.push(e.totalInd);
        } catch (er) { /* 특이 재표본 생략 */ }
      }
      var ci = function (arr) { return [quantile(arr, 0.025), quantile(arr, 0.975)]; };
      res.boot = { B: boots.length, ind: est.ind.map(function (_, j) { var col = boots.map(function (r) { return r[j]; }); return { se: sd(col), ci: ci(col) }; }),
        total: { se: sd(totalB), ci: ci(totalB) } };
    }
    return res;
  }

  /*
   * 조건부 과정 모형 (Hayes, 2022의 PROCESS 모형 번호를 따름; OLS 방정식 + 백분위 부트스트랩)
   *  6: 순차 매개 M1 → M2 → … (k = 2–4)
   *  7: W가 X→M (a) 경로 조절        8: 7 + W가 X→Y (c′) 조절
   * 14: W가 M→Y (b) 경로 조절        15: 14 + W가 X→Y (c′) 조절
   * 7/8/14/15는 매개변수가 여러 개면 병렬로 각각 조절된다.
   */
  function processModel(yin, xin, msIn, win, covs, opts) {
    opts = opts || {};
    var model = opts.model, k = msIn.length, hasW = [7, 8, 14, 15].indexOf(model) >= 0;
    if ([6, 7, 8, 14, 15].indexOf(model) < 0) throw new Error('지원하지 않는 모형 번호입니다.');
    if (model === 6 && (k < 2 || k > 4)) throw new Error('순차 매개(Model 6)는 매개변수 2–4개가 필요합니다.');
    if (hasW && !win) throw new Error('조절변수 W가 필요합니다.');
    covs = covs || [];
    var all = [yin, xin].concat(msIn, hasW ? [win] : [], covs);
    var rows = completeRows(all), sub = function (c) { return rows.map(function (i) { return c[i]; }); };
    var y = sub(yin), x = sub(xin), ms = msIn.map(sub), w = hasW ? sub(win) : null, cv = covs.map(sub), n = y.length;
    var cX = opts.center ? mean(x) : 0, cW = hasW && opts.center ? mean(w) : 0, cM = ms.map(function (m) { return opts.center ? mean(m) : 0; });
    var wvals = null, binaryW = false;
    if (hasW) {
      binaryW = ordLevels(w).length === 2;
      if (binaryW) wvals = ordLevels(w);
      else if (opts.probe === 'percentile') wvals = [quantile(w, 0.16), quantile(w, 0.5), quantile(w, 0.84)];
      else { var mw = mean(w), sw = sd(w); wvals = [mw - sw, mw, mw + sw]; }
    }
    var mod = function (a, c0) { return a.map(function (v) { return v - c0; }); };
    var prod = function (a, ca, b, cb) { return a.map(function (v, i) { return (v - ca) * (b[i] - cb); }); };

    // 한 번 적합 → { eqs, effects(이름→값) }
    function fitOnce(y, x, ms, w, cv) {
      var eqs = [], eff = {}, xx = mod(x, cX), Xw = hasW ? prod(x, cX, w, cW) : null, ww = hasW ? mod(w, cW) : null;
      var mEq = [];
      for (var j = 0; j < k; j++) {
        var pred, names;
        if (model === 6) { pred = [xx].concat(ms.slice(0, j).map(function (m, q) { return mod(m, cM[q]); })); names = ['X'].concat(ms.slice(0, j).map(function (_, q) { return 'M' + (q + 1); })); }
        else if (model === 7 || model === 8) { pred = [xx, ww, Xw]; names = ['X', 'W', 'X×W']; }
        else { pred = [xx]; names = ['X']; }
        var f = olsFit(ms[j], pred.concat(cv));
        mEq.push(f); eqs.push({ outcome: 'M' + (j + 1), fit: f, names: names, nPred: pred.length + cv.length });
      }
      var yPred = [xx], yNames = ['X'];
      ms.forEach(function (m, j) { yPred.push(mod(m, cM[j])); yNames.push('M' + (j + 1)); });
      if (model === 8) { yPred.push(ww, Xw); yNames.push('W', 'X×W'); }
      if (model === 14 || model === 15) {
        yPred.push(ww); yNames.push('W');
        ms.forEach(function (m, j) { yPred.push(prod(m, cM[j], w, cW)); yNames.push('M' + (j + 1) + '×W'); });
        if (model === 15) { yPred.push(Xw); yNames.push('X×W'); }
      }
      var fy = olsFit(y, yPred.concat(cv));
      eqs.push({ outcome: 'Y', fit: fy, names: yNames, nPred: yPred.length + cv.length });
      var bIdx = function (j) { return 2 + j; }; // Y식에서 M_j 계수 위치 (절편=0, X=1)
      if (model === 6) {
        // 순서를 지키는 모든 매개 부분집합 경로
        for (var mask = 1; mask < (1 << k); mask++) {
          var path = []; for (var q = 0; q < k; q++) if (mask & (1 << q)) path.push(q);
          var e = mEq[path[0]].b[1];
          for (var t = 1; t < path.length; t++) e *= mEq[path[t]].b[2 + path[t - 1]]; // M_t 식에서 M_{s} 계수: 절편, X, M1.. 순서
          e *= fy.b[bIdx(path[path.length - 1])];
          eff['ind:' + path.join('-')] = e;
        }
      } else {
        for (var j2 = 0; j2 < k; j2++) {
          var bj = fy.b[bIdx(j2)];
          if (model === 7 || model === 8) {
            var a1 = mEq[j2].b[1], a3 = mEq[j2].b[3];
            eff['imm:' + j2] = a3 * bj;
            wvals.forEach(function (wv, wi) { eff['cond:' + j2 + ':' + wi] = (a1 + a3 * (wv - cW)) * bj; });
          } else {
            var a = mEq[j2].b[1], b1 = bj, b3 = fy.b[2 + k + 1 + j2];
            eff['imm:' + j2] = a * b3;
            wvals.forEach(function (wv, wi) { eff['cond:' + j2 + ':' + wi] = a * (b1 + b3 * (wv - cW)); });
          }
        }
      }
      return { eqs: eqs, eff: eff };
    }

    var est = fitOnce(y, x, ms, w, cv);
    // 총효과 (Model 6에서만 의미 있게 분해: c = c′ + Σ간접)
    var total = null;
    if (model === 6) { var ft = olsFit(y, [mod(x, cX)].concat(cv)); total = { fit: ft }; }
    // 직접효과
    var fy = est.eqs[k].fit, tc = qt(0.975, fy.dfE), direct = [];
    if (model === 8 || model === 15) {
      var xwPos = est.eqs[k].names.indexOf('X×W') + 1, c1 = fy.b[1], c3 = fy.b[xwPos];
      wvals.forEach(function (wv) {
        var wc = wv - cW, e = c1 + c3 * wc, se = Math.sqrt(fy.cov[1][1] + 2 * wc * fy.cov[1][xwPos] + wc * wc * fy.cov[xwPos][xwPos]), t = e / se;
        direct.push({ w: wv, est: e, se: se, t: t, p: ptTwoSided(t, fy.dfE), ciLow: e - tc * se, ciHigh: e + tc * se });
      });
    } else {
      var se0 = Math.sqrt(fy.cov[1][1]), t0 = fy.b[1] / se0;
      direct.push({ w: null, est: fy.b[1], se: se0, t: t0, p: ptTwoSided(t0, fy.dfE), ciLow: fy.b[1] - tc * se0, ciHigh: fy.b[1] + tc * se0 });
    }
    var keys = Object.keys(est.eff), boot = null, B = opts.boot === undefined ? 5000 : opts.boot;
    if (B > 0) {
      var rand = rng(opts.seed || 1), draws = keys.map(function () { return []; }), ok = 0;
      for (var bI = 0; bI < B; bI++) {
        var idx = []; for (var i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
        var pk = function (c) { return idx.map(function (q) { return c[q]; }); };
        try {
          var e2 = fitOnce(pk(y), pk(x), ms.map(pk), hasW ? pk(w) : null, cv.map(pk)).eff;
          keys.forEach(function (kk, q) { draws[q].push(e2[kk]); }); ok++;
        } catch (er) { /* 특이 재표본 생략 */ }
      }
      boot = { B: ok, stats: {} };
      // Model 6 총 간접효과
      if (model === 6) { var tot = draws[0].map(function (_, r) { return sum(draws.map(function (d) { return d[r]; })); }); boot.stats.totalInd = { se: sd(tot), ci: [quantile(tot, 0.025), quantile(tot, 0.975)] }; }
      keys.forEach(function (kk, q) { boot.stats[kk] = { se: sd(draws[q]), ci: [quantile(draws[q], 0.025), quantile(draws[q], 0.975)] }; });
    }
    var eqOut = est.eqs.map(function (e) {
      var R2 = e.fit.R2, dfM = e.nPred, F = (R2 / dfM) / ((1 - R2) / e.fit.dfE);
      return { outcome: e.outcome, names: e.names, coefs: coefTable(e.fit, e.names.concat((opts.covNames || []))), R2: R2, F: F, dfM: dfM, dfE: e.fit.dfE, p: pfUpper(F, dfM, e.fit.dfE) };
    });
    return { model: model, n: n, k: k, eqs: eqOut, effects: est.eff, totalInd: model === 6 ? sum(keys.map(function (kk) { return est.eff[kk]; })) : null,
      total: total ? coefTable(total.fit, ['X'])[1] : null, direct: direct, boot: boot, wvals: wvals, binaryW: binaryW, centered: !!opts.center, sdx: sd(x), sdy: sd(y) };
  }

  /* ------------------------------------------------------------------ */
  /* 12. 다변량: 일원 MANOVA · 선형판별분석                              */
  /* ------------------------------------------------------------------ */

  // 집단별 자료 준비: cols(종속변수들), g(집단) → 목록별 제거
  function groupData(cols, gin) {
    var rows = [];
    for (var i = 0; i < gin.length; i++) {
      var gv = gin[i];
      if (gv === null || gv === undefined || gv === '' || (typeof gv === 'number' && !isFinite(gv))) continue;
      var ok = true; for (var j = 0; j < cols.length; j++) if (!isNum(cols[j][i])) { ok = false; break; }
      if (ok) rows.push(i);
    }
    var labels = []; rows.forEach(function (i) { var l = String(gin[i]); if (labels.indexOf(l) < 0) labels.push(l); });
    labels.sort(function (a, b) { var x = Number(a), y = Number(b); return (!isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
    var X = rows.map(function (i) { return cols.map(function (c) { return c[i]; }); });
    var gi = rows.map(function (i) { return labels.indexOf(String(gin[i])); });
    return { X: X, g: gi, labels: labels, rows: rows };
  }
  function sscp(X, g, G) { // 전체평균, 집단평균, E(집단 내), H(집단 간)
    var n = X.length, p = X[0].length, cnt = new Array(G).fill(0), gm = zeros(G, p), m = new Array(p).fill(0);
    X.forEach(function (r, i) { cnt[g[i]]++; for (var j = 0; j < p; j++) { gm[g[i]][j] += r[j]; m[j] += r[j]; } });
    for (var k = 0; k < G; k++) for (var j2 = 0; j2 < p; j2++) gm[k][j2] /= cnt[k];
    for (var j3 = 0; j3 < p; j3++) m[j3] /= n;
    var E = zeros(p, p), H = zeros(p, p);
    X.forEach(function (r, i) { var mu = gm[g[i]]; for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) E[a][b] += (r[a] - mu[a]) * (r[b] - mu[b]); });
    for (var k2 = 0; k2 < G; k2++) for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) H[a2][b2] += cnt[k2] * (gm[k2][a2] - m[a2]) * (gm[k2][b2] - m[b2]);
    return { n: n, p: p, G: G, cnt: cnt, gm: gm, m: m, E: E, H: H };
  }
  // E^-1 H의 고유값·고유벡터 (E = L L^T, A = L^-1 H L^-T)
  function genEigen(H, E) {
    var L = cholesky(E);
    if (!L) throw new Error('집단 내 공분산 행렬이 특이합니다. 종속변수 간 완전한 중복이 있는지, 집단별 사례 수가 충분한지 확인하세요.');
    var Li = inverse(L), A = matmul(matmul(Li, H), transpose(Li));
    for (var i = 0; i < A.length; i++) for (var j = i + 1; j < A.length; j++) { var v = (A[i][j] + A[j][i]) / 2; A[i][j] = A[j][i] = v; }
    var e = eigenSym(A), LiT = transpose(Li);
    return { values: e.values.map(function (v) { return Math.max(v, 0); }), vectors: matmul(LiT, e.vectors) }; // 열 k: E^-1 H 의 고유벡터
  }

  // R stats:::summary.manova와 같은 근사 F
  function manovaTests(eig, q, dfRes) {
    var p = eig.length, s = Math.min(p, q), m = 0.5 * (Math.abs(p - q) - 1), nn = 0.5 * (dfRes - p - 1), out = {};
    var V = sum(eig.map(function (e) { return e / (1 + e); }));
    var t1 = 2 * m + s + 1, t2 = 2 * nn + s + 1;
    out.pillai = { stat: V, F: (t2 / t1 * V) / (s - V), df1: s * t1, df2: s * t2 };
    var Lam = eig.reduce(function (a, e) { return a / (1 + e); }, 1);
    var w1 = dfRes - 0.5 * (p - q + 1), w2 = (p * q - 2) / 4, w3 = p * p + q * q - 5;
    w3 = w3 > 0 ? Math.sqrt(((p * q) * (p * q) - 4) / w3) : 1;
    out.wilks = { stat: Lam, F: ((Math.pow(Lam, -1 / w3) - 1) * (w1 * w3 - 2 * w2)) / p / q, df1: p * q, df2: w1 * w3 - 2 * w2 };
    var HL = sum(eig), h2 = 2 * (s * nn + 1);
    out.hotelling = { stat: HL, F: (h2 * HL) / s / s / t1, df1: s * t1, df2: h2 };
    var roy = Math.max.apply(null, eig), r1 = Math.max(p, q), r2 = dfRes - r1 + q;
    out.roy = { stat: roy, F: (r2 * roy) / r1, df1: r1, df2: r2 };
    Object.keys(out).forEach(function (k) { var o = out[k]; o.p = pfUpper(o.F, o.df1, o.df2); });
    // 다변량 부분 η² (SPSS 정의)
    out.pillai.eta2 = V / s;
    out.wilks.eta2 = 1 - Math.pow(Lam, 1 / s);
    out.hotelling.eta2 = (HL / s) / (1 + HL / s);
    out.roy.eta2 = roy / (1 + roy);
    return out;
  }

  // Box의 M 검정 (Box, 1949): χ² 및 F 근사
  function boxM(X, g, G) {
    var p = X[0].length, n = X.length, cnt = new Array(G).fill(0), groups = [];
    for (var k = 0; k < G; k++) groups.push([]);
    X.forEach(function (r, i) { groups[g[i]].push(r); cnt[g[i]]++; });
    if (cnt.some(function (c) { return c <= p; })) return { M: NaN, note: '어떤 집단의 사례 수가 종속변수 수 이하라 Box의 M을 계산할 수 없습니다.' };
    var Sp = zeros(p, p), logdets = 0;
    groups.forEach(function (gr) {
      var cs = []; for (var j = 0; j < p; j++) cs.push(gr.map(function (r) { return r[j]; }));
      var Si = covMatrix(cs);
      for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) Sp[a][b] += (gr.length - 1) * Si[a][b];
      logdets += (gr.length - 1) * logdetPD(Si);
    });
    for (var a2 = 0; a2 < p; a2++) for (var b2 = 0; b2 < p; b2++) Sp[a2][b2] /= (n - G);
    var M = (n - G) * logdetPD(Sp) - logdets;
    var sInv = sum(cnt.map(function (c) { return 1 / (c - 1); })), sInv2 = sum(cnt.map(function (c) { return 1 / ((c - 1) * (c - 1)); }));
    var c1 = (sInv - 1 / (n - G)) * (2 * p * p + 3 * p - 1) / (6 * (p + 1) * (G - 1));
    var df1 = p * (p + 1) * (G - 1) / 2, chi = M * (1 - c1);
    var c2 = (p - 1) * (p + 2) / (6 * (G - 1)) * (sInv2 - 1 / ((n - G) * (n - G))), F, df2;
    if (c2 - c1 * c1 > 0) { df2 = (df1 + 2) / (c2 - c1 * c1); var bb = df1 / (1 - c1 - df1 / df2); F = M / bb; }
    else { df2 = (df1 + 2) / (c1 * c1 - c2); var b3 = df2 / (1 - c1 + 2 / df2); F = df2 * M / (df1 * (b3 - M)); }
    return { M: M, chi2: chi, df: df1, pChi: pchisqUpper(chi, df1), F: F, df1: df1, df2: df2, pF: pfUpper(F, df1, df2) };
  }

  function manova(cols, gin, names) {
    var gd = groupData(cols, gin), G = gd.labels.length, p = cols.length;
    if (G < 2) throw new Error('집단이 2개 이상이어야 합니다.');
    var ss = sscp(gd.X, gd.g, G), dfRes = ss.n - G, q = G - 1;
    if (dfRes < p) throw new Error('사례 수가 너무 적습니다.');
    var ge = genEigen(ss.H, ss.E);
    var tests = manovaTests(ge.values, q, dfRes);
    var uni = names.map(function (nm, j) {
      var ssb = ss.H[j][j], ssw = ss.E[j][j], F = (ssb / q) / (ssw / dfRes);
      return { name: nm, ssb: ssb, ssw: ssw, df1: q, df2: dfRes, F: F, p: pfUpper(F, q, dfRes), eta2: ssb / (ssb + ssw) };
    });
    var desc = gd.labels.map(function (l, k) {
      var idx = []; gd.g.forEach(function (gg, i) { if (gg === k) idx.push(i); });
      return { label: l, n: ss.cnt[k], means: names.map(function (_, j) { return mean(idx.map(function (i) { return gd.X[i][j]; })); }),
        sds: names.map(function (_, j) { return sd(idx.map(function (i) { return gd.X[i][j]; })); }) };
    });
    return { n: ss.n, p: p, G: G, labels: gd.labels, tests: tests, eig: ge.values, univariate: uni, desc: desc, boxM: boxM(gd.X, gd.g, G),
      levene: names.map(function (_, j) { var grs = gd.labels.map(function (_, k) { return gd.X.filter(function (_, i) { return gd.g[i] === k; }).map(function (r) { return r[j]; }); }); return leveneTest(grs, 'mean'); }) };
  }

  /*
   * 선형판별분석 (SPSS 판별분석 / MASS::lda와 같은 정의)
   * 비표준화 계수: 집단 내 합동공분산 W에 대해 a'Wa = 1 로 정규화
   */
  function discriminant(cols, gin, names, opts) {
    opts = opts || {};
    var gd = groupData(cols, gin), G = gd.labels.length, p = cols.length;
    if (G < 2) throw new Error('집단이 2개 이상이어야 합니다.');
    var ss = sscp(gd.X, gd.g, G), n = ss.n, dfW = n - G;
    var W = ss.E.map(function (r) { return r.map(function (v) { return v / dfW; }); });
    var ge = genEigen(ss.H, ss.E), r = Math.min(p, G - 1);
    var eig = ge.values.slice(0, r), totalEig = sum(eig);
    var A = []; // A[k] = 판별함수 k의 비표준화 계수
    for (var k = 0; k < r; k++) {
      var a = ge.vectors.map(function (row) { return row[k]; });
      var Wa = W.map(function (row) { return sum(row.map(function (v, j) { return v * a[j]; })); }), s = Math.sqrt(sum(a.map(function (v, j) { return v * Wa[j]; })));
      a = a.map(function (v) { return v / s; });
      // 부호 규칙: 첫 집단 중심이 음수가 되도록 (해석 편의; 부호는 임의)
      var c0 = sum(a.map(function (v, j) { return v * (ss.gm[0][j] - ss.m[j]); }));
      if (c0 > 0) a = a.map(function (v) { return -v; });
      A.push(a);
    }
    var funcs = A.map(function (a, k) {
      var Wa = W.map(function (row) { return sum(row.map(function (v, j) { return v * a[j]; })); });
      return {
        eigen: eig[k], pctVar: eig[k] / totalEig, canCor: Math.sqrt(eig[k] / (1 + eig[k])),
        coef: a, constant: -sum(a.map(function (v, j) { return v * ss.m[j]; })),
        stdCoef: a.map(function (v, j) { return v * Math.sqrt(W[j][j]); }),
        structure: Wa.map(function (v, j) { return v / Math.sqrt(W[j][j]); }),
        centroids: ss.gm.map(function (mu) { return sum(a.map(function (v, j) { return v * (mu[j] - ss.m[j]); })); })
      };
    });
    // 순차 Wilks' Λ (Bartlett χ²)
    var wilksSeq = [];
    for (var k2 = 0; k2 < r; k2++) {
      var lam = 1; for (var i2 = k2; i2 < r; i2++) lam /= (1 + eig[i2]);
      var chi = -(n - 1 - (p + G) / 2) * Math.log(lam), df = (p - k2) * (G - 1 - k2);
      wilksSeq.push({ from: k2 + 1, to: r, lambda: lam, chi2: chi, df: df, p: pchisqUpper(chi, df) });
    }
    // 분류 (선형 분류함수)
    var priors = opts.priors === 'proportional' ? ss.cnt.map(function (c) { return c / n; }) : ss.cnt.map(function () { return 1 / G; });
    function classifyWith(Winv, gm, pri, x) {
      var sc = gm.map(function (mu, k3) {
        var wm = Winv.map(function (row) { return sum(row.map(function (v, j) { return v * mu[j]; })); });
        return sum(x.map(function (v, j) { return v * wm[j]; })) - 0.5 * sum(mu.map(function (v, j) { return v * wm[j]; })) + Math.log(pri[k3]);
      });
      var mx = Math.max.apply(null, sc), ex = sc.map(function (v) { return Math.exp(v - mx); }), se = sum(ex);
      var post = ex.map(function (v) { return v / se; }), best = 0;
      for (var q = 1; q < post.length; q++) if (post[q] > post[best]) best = q;
      return { cls: best, post: post };
    }
    var Winv = inverse(W);
    var classFn = ss.gm.map(function (mu, k4) {
      var wm = Winv.map(function (row) { return sum(row.map(function (v, j) { return v * mu[j]; })); });
      return { coef: wm, constant: -0.5 * sum(mu.map(function (v, j) { return v * wm[j]; })) + Math.log(priors[k4]) };
    });
    var pred = gd.X.map(function (x) { return classifyWith(Winv, ss.gm, priors, x); });
    var conf = zeros(G, G); pred.forEach(function (pr, i) { conf[gd.g[i]][pr.cls]++; });
    // 교차타당화 (하나씩 빼기): 해당 사례를 뺀 평균·W로 재분류
    var cv = null;
    if (opts.cv !== false) {
      cv = zeros(G, G);
      for (var i3 = 0; i3 < n; i3++) {
        var gi = gd.g[i3], x = gd.X[i3], cnt = ss.cnt.slice(); cnt[gi]--;
        if (cnt[gi] < 1) continue;
        var mu2 = ss.gm.map(function (mu, k5) { return k5 === gi ? mu.map(function (v, j) { return (v * ss.cnt[gi] - x[j]) / cnt[gi]; }) : mu; });
        // E에서 사례 i 제거: E' = E - (n_g/(n_g-1)) (x-m_g)(x-m_g)'
        var dlt = x.map(function (v, j) { return v - ss.gm[gi][j]; }), fac = ss.cnt[gi] / (ss.cnt[gi] - 1);
        var W2 = ss.E.map(function (row, a2) { return row.map(function (v, b2) { return (v - fac * dlt[a2] * dlt[b2]) / (n - 1 - G); }); });
        var pri2 = opts.priors === 'proportional' ? cnt.map(function (c) { return c / (n - 1); }) : priors;
        cv[gi][classifyWith(inverse(W2), mu2, pri2, x).cls]++;
      }
    }
    var acc = function (M) { var t = 0; for (var q = 0; q < G; q++) t += M[q][q]; return t / n; };
    return { n: n, p: p, G: G, labels: gd.labels, counts: ss.cnt, names: names, funcs: funcs, wilksSeq: wilksSeq, priors: priors,
      classFn: classFn, confusion: conf, accuracy: acc(conf), cvConfusion: cv, cvAccuracy: cv ? acc(cv) : NaN,
      posteriors: pred.map(function (pr) { return pr.post; }), predicted: pred.map(function (pr) { return pr.cls; }),
      scores: gd.X.map(function (x) { return funcs.map(function (fn) { return sum(fn.coef.map(function (v, j) { return v * x[j]; })) + fn.constant; }); }),
      groupIndex: gd.g, boxM: boxM(gd.X, gd.g, G),
      univariate: names.map(function (nm, j) { var ssb = ss.H[j][j], ssw = ss.E[j][j], F = (ssb / (G - 1)) / (ssw / dfW); return { name: nm, lambda: ssw / (ssb + ssw), F: F, df1: G - 1, df2: dfW, p: pfUpper(F, G - 1, dfW) }; }) };
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

  G.PsyStats = {
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
    csCoefficient: csCoefficient,
    // 다분상관 · 위계적 회귀 · 조절 · 매개
    pbvnorm: pbvnorm, bvnu: bvnu, thresholds: thresholds, polychoric: polychoric, polyserial: polyserial,
    isOrdinalAuto: isOrdinalAuto, corAuto: corAuto, nearPD: nearPD, fminBrent: fminBrent,
    hierarchicalRegression: hierarchicalRegression, moderation: moderation, mediation: mediation, processModel: processModel,
    manova: manova, discriminant: discriminant, boxM: boxM
  };
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
