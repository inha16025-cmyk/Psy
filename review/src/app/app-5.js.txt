/* PsyStat 화면(UI) 코드 — 조각 5/5: 잠재프로파일(LPA)·잠재계층(LCA) 분석
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다. */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  // 앞 조각에서 가져오기
  var S = NS.S, state = NS.state, $ = NS.$, $$ = NS.$$, esc = NS.esc, f = NS.f, fp = NS.fp, fr = NS.fr;
  var table = NS.table, rcode = NS.rcode, rvec = NS.rvec, rname = NS.rname, varOptions = NS.varOptions, multiField = NS.multiField;
  var getMulti = NS.getMulti, need = NS.need, addCard = NS.addCard, flash = NS.flash, updateInfo = NS.updateInfo, A = NS.A, svgDownload = NS.svgDownload;

  var MODEL_INFO = { EEI: { tidy: 1, ko: '분산 같음·공분산 0' }, VVI: { tidy: 2, ko: '분산 다름·공분산 0' }, EEE: { tidy: 3, ko: '분산·공분산 같음' }, VVV: { tidy: 6, ko: '분산·공분산 다름' } };
  var COLORS = ['#2b5fc7', '#c8372d', '#2f9e44', '#b8860b', '#8e44ad', '#16a085', '#d35400', '#555555'];

  function fitLabel(res, fit) { return res.kind === 'LPA' ? fit.model + ' · ' + fit.K + '개 프로파일' : fit.K + '개 계층'; }

  // 프로파일 그림: LPA = 지표별 표준화 평균, LCA = 문항별 가장 높은 범주의 응답확률
  function profilePlotSVG(res, fit, names) {
    var d = names.length, K = fit.K, W = Math.max(460, 130 + d * 70), H = 300, L = 50, R = 150, T = 20, B = 60;
    var vals, ylab, lo, hi;
    if (res.kind === 'LPA') {
      var X = res.X, m = names.map(function (_, j) { return S.mean(X.map(function (x) { return x[j]; })); }), s = names.map(function (_, j) { return S.sd(X.map(function (x) { return x[j]; })); });
      vals = fit.params.mu.map(function (mu) { return mu.map(function (v, j) { return (v - m[j]) / s[j]; }); });
      ylab = '표준화 평균 (z)'; lo = Math.min(-1, Math.min.apply(null, [].concat.apply([], vals))) - 0.2; hi = Math.max(1, Math.max.apply(null, [].concat.apply([], vals))) + 0.2;
    } else {
      vals = fit.params.rho.map(function (rk) { return rk.map(function (rj) { return rj[rj.length - 1]; }); });
      ylab = 'P(가장 높은 범주)'; lo = 0; hi = 1;
    }
    var X0 = function (j) { return L + (d === 1 ? (W - L - R) / 2 : j * (W - L - R) / (d - 1)); }, Y0 = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var s2 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">';
    s2 += '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="#8a94a6"/><line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '" stroke="#8a94a6"/>';
    (res.kind === 'LPA' ? [-1, 0, 1] : [0, 0.5, 1]).forEach(function (t) {
      s2 += '<line x1="' + L + '" y1="' + Y0(t) + '" x2="' + (W - R) + '" y2="' + Y0(t) + '" stroke="#8a94a6" stroke-width="0.5" stroke-dasharray="2 3"/><text x="' + (L - 6) + '" y="' + (Y0(t) + 4) + '" text-anchor="end">' + t + '</text>';
    });
    names.forEach(function (nm, j) { s2 += '<text x="' + X0(j) + '" y="' + (H - B + 16) + '" text-anchor="end" transform="rotate(-30 ' + X0(j) + ' ' + (H - B + 16) + ')">' + esc(nm.length > 10 ? nm.slice(0, 10) + '…' : nm) + '</text>'; });
    s2 += '<text x="14" y="' + ((T + H - B) / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + ((T + H - B) / 2) + ')">' + ylab + '</text>';
    vals.forEach(function (row, k) {
      var c = COLORS[k % COLORS.length], pts = row.map(function (v, j) { return X0(j).toFixed(1) + ',' + Y0(v).toFixed(1); });
      s2 += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2"' + (k >= 4 ? ' stroke-dasharray="5 3"' : '') + '/>';
      row.forEach(function (v, j) { s2 += '<circle cx="' + X0(j).toFixed(1) + '" cy="' + Y0(v).toFixed(1) + '" r="3.2" fill="' + c + '"/>'; });
      s2 += '<line x1="' + (W - R + 10) + '" y1="' + (T + 10 + k * 18) + '" x2="' + (W - R + 30) + '" y2="' + (T + 10 + k * 18) + '" stroke="' + c + '" stroke-width="2"/><text x="' + (W - R + 34) + '" y="' + (T + 14 + k * 18) + '">' + (res.kind === 'LPA' ? '프로파일 ' : '계층 ') + (k + 1) + ' (' + f(100 * fit.props[k], 1) + '%)</text>';
    });
    return s2 + '</svg>';
  }

  function detailCard(res, fit, names, varIdx) {
    var K = fit.K, unit = res.kind === 'LPA' ? '프로파일' : '계층';
    var html = table([unit, 'n', '%', '평균 사후확률'], fit.counts.map(function (c, k) { return [unit + ' ' + (k + 1), c, f(100 * c / fit.n, 1), fr(fit.avgPP[k][k])]; }),
      { title: unit + '별 크기와 분류 정확도', note: 'n은 가장 높은 사후확률로 배정한 사례 수. 평균 사후확률은 그 ' + unit + '에 배정된 사례들의 해당 ' + unit + ' 사후확률 평균으로, .80 이상이면 분류가 양호하다고 본다(Nagin, 2005).' });
    if (K > 1) html += table(['배정 \\ 사후확률'].concat(fit.avgPP.map(function (_, k) { return unit + ' ' + (k + 1); })), fit.avgPP.map(function (row, k) {
      return [unit + ' ' + (k + 1)].concat(row.map(function (v, j) { return j === k ? '<b>' + fr(v) + '</b>' : fr(v); }));
    }), { left: [0], title: '평균 사후확률 행렬', note: '대각선이 1에 가까울수록 ' + unit + '이 잘 구분된다.' });
    if (res.kind === 'LPA') {
      var X = res.X, gm = names.map(function (_, j) { return S.mean(X.map(function (x) { return x[j]; })); }), gs = names.map(function (_, j) { return S.sd(X.map(function (x) { return x[j]; })); });
      html += table(['지표'].concat(fit.params.mu.map(function (_, k) { return '프로파일 ' + (k + 1) + ' M'; })).concat(['전체 M', '전체 SD']), names.map(function (nm, j) {
        return [esc(nm)].concat(fit.params.mu.map(function (mu) { return f(mu[j], 2) + ' <span class="note">(' + f((mu[j] - gm[j]) / gs[j], 2) + ')</span>'; })).concat([f(gm[j], 2), f(gs[j], 2)]);
      }), { left: [0], title: '프로파일별 지표 평균', note: '괄호 안은 전체 평균·표준편차 기준 표준화 점수(z). 모형 ' + fit.model + '(' + MODEL_INFO[fit.model].ko + ')의 추정 평균.' });
      var Sig = fit.params.Sigma;
      html += table(['지표'].concat(Sig.length > 1 && fit.model.charAt(0) === 'V' ? Sig.map(function (_, k) { return '프로파일 ' + (k + 1) + ' 분산'; }) : ['분산 (모든 프로파일 공통)']), names.map(function (nm, j) {
        return [esc(nm)].concat((fit.model.charAt(0) === 'V' ? Sig : [Sig[0]]).map(function (Sk) { return f(Sk[j][j], 3); }));
      }), { left: [0], title: '프로파일 내 분산' });
    } else {
      var rows = [];
      names.forEach(function (nm, j) {
        res.levels[j].forEach(function (lv, c) { rows.push([c === 0 ? esc(nm) : '', esc(lv)].concat(fit.params.rho.map(function (rk) { return fr(rk[j][c]); }))); });
      });
      html += table(['문항', '응답'].concat(fit.params.rho.map(function (_, k) { return '계층 ' + (k + 1); })), rows, { left: [0, 1], title: '계층별 문항 응답확률', note: '각 계층 안에서 문항별 응답 범주 확률(열마다 문항 안에서 합 = 1).' });
    }
    html += '<div class="lp-plot">' + profilePlotSVG(res, fit, names) + '</div>' +
      '<div class="inline" style="margin:6px 0"><button class="btn small" data-act="save-class">소속 ' + unit + '을 데이터에 변수로 추가</button><button class="btn small" data-act="save-png">그림 PNG 저장</button></div>' +
      '<p class="note">변수로 추가한 뒤 [일원분산분석]·[교차분석] 등에서 집단변수로 쓰면 ' + unit + ' 간 비교를 할 수 있습니다. 단, 이 방법은 분류 오류를 무시하므로 엔트로피가 낮을수록 차이가 과소추정됩니다. 아래 BCH 분석은 분류 오류를 보정합니다.</p>' +
      (K > 1 ? bchForm(fit.entropy) : '') +
      rcode(res.kind === 'LPA'
        ? 'library(mclust)\nd <- na.omit(df[, ' + rvec(names) + '])\nfit <- Mclust(d, G = ' + K + ', modelNames = "' + fit.model + '")\nsummary(fit, parameters = TRUE)\n# tidyLPA: estimate_profiles(d, n_profiles = ' + K + ', models = ' + MODEL_INFO[fit.model].tidy + ')'
        : 'library(poLCA)\nd <- na.omit(df[, ' + rvec(names) + '])\nd[] <- lapply(d, function(x) as.integer(factor(x)))\nfit <- poLCA(cbind(' + names.map(rname).join(', ') + ') ~ 1, data = d, nclass = ' + K + ', nrep = 20)');
    var card = addCard((res.kind === 'LPA' ? '잠재프로파일 해: ' : '잠재계층 해: ') + fitLabel(res, fit), html, 'N = ' + fit.n);
    if (K > 1) card.querySelector('[data-act=bch]').onclick = function () { runBCH(card, res, fit, unit); };
    NS.wireMulti && NS.wireMulti();
    card.querySelector('[data-act=save-png]').onclick = function () { svgDownload(card.querySelector('.lp-plot svg'), res.kind === 'LPA' ? 'lpa_profiles' : 'lca_classes', true); };
    card.querySelector('[data-act=save-class]').onclick = function () {
      var base = (res.kind === 'LPA' ? 'LPA_' + fit.model + '_' : 'LCA_') + K, nm = base, k2 = 2;
      while (state.names.indexOf(nm) >= 0) nm = base + '_' + k2++;
      var col = new Array(state.nrows).fill(null);
      res.rows.forEach(function (r, i) { col[r] = fit.classes[i] + 1; });
      state.names.push(nm); state.cols.push(col); state.types.push('num');
      updateInfo();
      flash('"' + nm + '" 변수를 추가했습니다 (' + unit + ' 1–' + K + ', 분석에서 제외된 사례는 결측). 분석 메뉴에서 집단변수로 고르세요.');
    };
  }

  var bchSeq = 0;
  function bchForm(entropy) {
    var id = ++bchSeq;
    return '<div class="bchbox" data-id="' + id + '" style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">' +
      '<h4 style="margin-top:0">3단계 BCH: ' + '결과변수의 집단 간 비교 (분류 오류 보정)</h4>' +
      (entropy < 0.6 ? '<div class="warn">엔트로피가 ' + fr(entropy) + '로 낮습니다. 시뮬레이션에서 엔트로피 .55 정도에서는 BCH도 편향이 남고 신뢰구간이 좁게 나왔습니다(포함률 약 85–90%). 결과를 신중하게 해석하세요.</div>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + multiField('bchc' + id, '연속형 결과변수', 'num') + multiField('bchk' + id, '범주형 결과변수', 'any') + '</div>' +
      '<div class="inline"><label>부트스트랩 <input type="number" class="bchB" value="200" min="0" step="100" style="width:80px"> 회</label><label>시드 <input type="number" class="bchSeed" value="1234" style="width:70px"></label>' +
      '<button class="btn small primary" data-act="bch">BCH 분석</button><span class="note bchprog"></span></div>' +
      '<div class="hint">부트스트랩은 사례를 재표집해 단계 1(' + '프로파일 추정)부터 다시 하므로 단계 1의 불확실성이 표준오차에 반영됩니다(권장, 200회 이상). 0이면 샌드위치 표준오차만 계산하며, 이는 단계 1 불확실성을 무시해 표준오차를 과소추정할 수 있습니다(Bakk, Oberski, & Vermunt, 2014).</div></div>';
  }

  function runBCH(card, res, fit, unit) {
    var box = card.querySelector('.bchbox'), id = box.dataset.id, ci = getMulti('bchc' + id), ki = getMulti('bchk' + id);
    if (!ci.length && !ki.length) { flash('결과변수를 하나 이상 고르세요.'); return; }
    var B = Math.max(0, Math.floor(Number(box.querySelector('.bchB').value) || 0)), seed = Number(box.querySelector('.bchSeed').value) || 1;
    var align = function (vi) { return res.rows.map(function (r) { var v = state.cols[vi][r]; return v === undefined ? null : v; }); };
    var jobs = [];
    try {
      ci.forEach(function (vi) { var y = align(vi); jobs.push({ name: state.names[vi], y: y, type: 'continuous', out: S.bchDistal(fit, y, 'continuous') }); });
      ki.forEach(function (vi) { var y = align(vi); var o = S.bchDistal(fit, y, 'categorical'); jobs.push({ name: state.names[vi], y: y, type: 'categorical', out: o, levels: o.levels }); });
    } catch (e) { flash('BCH 오류: ' + e.message); return; }
    var prog = box.querySelector('.bchprog'), btn = box.querySelector('[data-act=bch]');
    if (!B) { renderBCH(res, fit, unit, jobs, 0, seed); return; }
    var rand = S.rng(seed + 991), draws = jobs.map(function () { return []; }), done = 0, t0 = Date.now();
    btn.disabled = true;
    (function step() {
      var until = Date.now() + 150;
      while (done < B && Date.now() < until) {
        var o = S.bchBootstrapOnce(res, fit, jobs.map(function (j) { return { y: j.y, type: j.type, levels: j.levels }; }), rand);
        o.forEach(function (v, k) { if (v) draws[k].push(v); }); done++;
      }
      prog.textContent = ' 부트스트랩 ' + done + '/' + B + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + '초)';
      if (done < B) { setTimeout(step, 0); return; }
      jobs.forEach(function (j, k) { if (draws[k].length > 10) S.bchApplyBootstrap(j.out, draws[k]); });
      btn.disabled = false; prog.textContent = '';
      renderBCH(res, fit, unit, jobs, B, seed);
    })();
  }

  function renderBCH(res, fit, unit, jobs, B, seed) {
    var K = fit.K, U = function (k) { return unit + ' ' + (k + 1); }, html = '', z = 1.959963984540054, warns = [];
    var cont = jobs.filter(function (j) { return j.type === 'continuous'; }), cat = jobs.filter(function (j) { return j.type === 'categorical'; });
    var seOf = function (o, k, l) { return o.boot ? (l === undefined ? o.boot.se[k] : o.boot.se[k][l]) : (l === undefined ? o.se[k] : o.se[k][l]); };
    var seName = B ? '부트스트랩' : '샌드위치';
    jobs.forEach(function (j) { j.out.warnings.forEach(function (w) { warns.push(j.name + ': ' + w); }); if (B && !j.out.boot) warns.push(j.name + ': 성공한 부트스트랩이 너무 적어 샌드위치 표준오차를 표시합니다.'); });
    if (cont.length) {
      var rows = [];
      cont.forEach(function (j) { j.out.means.forEach(function (m, k) { var se = seOf(j.out, k); rows.push([k === 0 ? esc(j.name) : '', U(k), f(j.out.weightN[k], 1), f(m, 2), f(j.out.sds[k], 2), f(se, 3), '[' + f(m - z * se, 2) + ', ' + f(m + z * se, 2) + ']', f(j.out.naiveMeans[k], 2)]); }); });
      html += table(['결과변수', unit, '가중 n', 'M (BCH)', 'SD', 'SE', '95% CI', 'M (보정 없음)'], rows, { left: [0, 1], title: unit + '별 결과변수 평균 (BCH)', note: 'SE = ' + seName + ' 표준오차. "보정 없음"은 최빈 배정 후 단순 평균으로, 분류 오류 때문에 ' + unit + ' 간 차이가 줄어드는 방향으로 편향된다. 가중 n은 BCH 가중치의 합.' });
      var trows = [];
      cont.forEach(function (j) {
        var o = j.out, ov = o.boot ? o.boot.overall : o.overall, pr = o.boot ? o.boot.pairs : o.pairs;
        trows.push([esc(j.name), '전체 (모든 ' + unit + ' 같음)', '', '', f(ov.chi2, 2), ov.df, fp(ov.p)]);
        pr.forEach(function (p, q) { trows.push(['', U(p.a) + ' − ' + U(p.b), f(o.pairs[q].diff, 2), f(p.se, 3), f(p.chi2, 2), 1, fp(p.p)]); });
      });
      html += table(['결과변수', '비교', '평균 차이', 'SE', 'Wald χ²', 'df', 'p'], trows, { left: [0, 1], title: '평균 차이 검정 (Wald)', note: '쌍별 비교는 다중비교 보정을 하지 않았다. 필요하면 p값에 Bonferroni 보정(비교 수만큼 곱하기)을 적용한다.' });
    }
    cat.forEach(function (j) {
      var o = j.out, L = o.levels.length, rows2 = [];
      o.props.forEach(function (r, k) { rows2.push([U(k), f(o.weightN[k], 1)].concat(r.map(function (p, l) { return f(100 * p, 1) + ' <span class="note">(' + f(100 * seOf(o, k, l), 1) + ')</span><br><span class="note">보정 없음 ' + f(100 * o.naiveProps[k][l], 1) + '</span>'; }))); });
      html += table([unit, '가중 n'].concat(o.levels.map(function (l) { return esc(l) + ' %'; })), rows2, { left: [0], title: esc(j.name) + ': ' + unit + '별 응답 비율 (BCH)', note: '셀 = BCH 추정 비율 % (' + seName + ' SE), 아래는 보정 없는 비율.' });
      var ov = o.boot ? o.boot.overall : o.overall, pr = o.boot ? o.boot.pairs : o.pairs;
      html += table(['비교', 'Wald χ²', 'df', 'p'], [['전체 (모든 ' + unit + ' 분포 같음)', f(ov.chi2, 2), ov.df, fp(ov.p)]].concat(pr.map(function (p) { return [U(p.a) + ' − ' + U(p.b), f(p.chi2, 2), p.df, fp(p.p)]; })),
        { left: [0], title: esc(j.name) + ': 분포 차이 검정 (Wald)' });
    });
    var D = S.classificationError(fit.Z, fit.classes);
    html += table(['실제 \\ 배정'].concat(D.map(function (_, k) { return U(k); })), D.map(function (r, s) { return [U(s)].concat(r.map(function (v, t) { return s === t ? '<b>' + fr(v) + '</b>' : fr(v); })); }), { left: [0], title: '분류오류행렬 D', note: 'D[s][t] = 실제 ' + unit + ' s인 사례가 t로 배정될 확률(사후확률로 추정). BCH 가중치는 D의 역행렬로 만든다.' });
    html = (warns.length ? '<div class="warn">' + warns.map(esc).join('<br>') + '</div>' : '') + html +
      '<p class="note">BCH 방법(Bolck, Croon, & Hagenaars, 2004; Vermunt, 2010; Bakk, Tekle, & Vermunt, 2013): 단계 1의 사후확률로 분류오류행렬 D를 구하고, 각 사례에 D⁻¹의 행을 가중치로 주어 ' + unit + '별 평균·비율을 추정했다. 결과변수에 결측이 있는 사례는 그 변수에서만 제외했다. ' +
      (B ? '표준오차와 검정은 3단계 전체 부트스트랩(' + B + '회, 시드 ' + seed + ')으로 계산해 단계 1 불확실성을 반영했다.' : '표준오차는 샌드위치 추정량으로, 단계 1 불확실성을 무시하므로 과소추정될 수 있다(Bakk, Oberski, & Vermunt, 2014).') +
      ' 검증: 계산식은 R 독립 구현과 일치(오차 < 1e-13). 몬테카를로 시뮬레이션에서 엔트로피 .75 조건은 편향이 거의 없고 부트스트랩 95% CI 포함률이 .96이었으며, 엔트로피 .55 조건에서는 편향이 남고 포함률이 .85–.90으로 낮았다. 외부 소프트웨어(Mplus·Latent GOLD)와는 대조하지 못했다.</p>';
    addCard('3단계 BCH: ' + jobs.map(function (j) { return j.name; }).join(', '), html, fitLabel(res, fit) + ', N = ' + jobs[0].out.n);
  }

  A.lpa = {
    group: '잠재집단', title: '잠재프로파일·잠재계층',
    desc: '잠재프로파일 분석(LPA, 연속 지표; mclust·tidyLPA와 같은 모형)과 잠재계층분석(LCA, 범주형 지표; poLCA와 같은 모형). 여러 무작위 시작값, AIC·BIC·SABIC·엔트로피, BLRT.',
    form: function () {
      return '<div class="field"><div class="lab">분석 종류</div><div class="inline"><label><input type="radio" name="lk" value="LPA" checked>잠재프로파일 (연속 지표)</label><label><input type="radio" name="lk" value="LCA">잠재계층 (범주형 지표)</label></div></div>' +
        '<div id="lp_lpa">' + multiField('vl', '지표 변수 (연속)', 'num') +
        '<div class="field"><div class="lab">모형 (분산·공분산 구조)</div><div class="varlist" style="max-height:none">' + Object.keys(MODEL_INFO).map(function (m) {
          return '<label><input type="checkbox" name="lm" value="' + m + '"' + (m === 'EEI' ? ' checked' : '') + '>' + m + ' — ' + MODEL_INFO[m].ko + '<span class="vt">tidyLPA ' + MODEL_INFO[m].tidy + '</span></label>';
        }).join('') + '</div><div class="hint">EEI(tidyLPA 모형 1)가 가장 흔히 쓰이는 기본 모형입니다. 복잡한 모형(VVV)은 모수가 많아 표본이 커야 합니다.</div></div></div>' +
        '<div id="lp_lca" style="display:none">' + multiField('vc', '지표 변수 (범주형: 예/아니오, 리커트 문항 등)', 'any') + '</div>' +
        '<div class="field"><label for="kmax">프로파일(계층) 수: 1부터</label><select id="kmax">' + [2, 3, 4, 5, 6, 7, 8].map(function (k) { return '<option' + (k === 5 ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>까지</div>' +
        '<div class="field"><div class="inline"><label>무작위 시작값 <input type="number" id="nst" value="50" min="5" step="10" style="width:70px"></label><label>최종 반복 <input type="number" id="nkp" value="10" min="1" style="width:55px"></label><label>시드 <input type="number" id="seed" value="1234" style="width:70px"></label></div>' +
        '<div class="hint">시작값마다 짧게 추정한 뒤 우도가 높은 상위 몇 개를 끝까지 추정합니다(Mplus STARTS 방식). 최고 우도가 여러 번 반복되어야 믿을 만한 해입니다.</div></div>' +
        '<div class="field"><div class="inline"><label>BLRT 부트스트랩 <input type="number" id="nbl" value="0" min="0" step="50" style="width:70px"> 회</label></div><div class="hint">0이면 생략. K개 대 K−1개를 비교합니다. 100–500회 권장, 시간이 오래 걸릴 수 있습니다.</div></div>';
    },
    wire: function () {
      $$('input[name=lk]').forEach(function (r) { r.onchange = function () { var k = $('input[name=lk]:checked').value; $('#lp_lpa').style.display = k === 'LPA' ? '' : 'none'; $('#lp_lca').style.display = k === 'LCA' ? '' : 'none'; }; });
    },
    run: function () {
      var kind = $('input[name=lk]:checked').value, idx = getMulti(kind === 'LPA' ? 'vl' : 'vc');
      need(idx.length >= (kind === 'LPA' ? 1 : 2), kind === 'LPA' ? '지표 변수를 하나 이상 선택하세요.' : '범주형 지표를 2개 이상 선택하세요.');
      var models = $$('input[name=lm]:checked').map(function (c) { return c.value; });
      if (kind === 'LPA') need(models.length, '모형을 하나 이상 선택하세요.');
      var Kmax = Number($('#kmax').value), Ks = []; for (var k = 1; k <= Kmax; k++) Ks.push(k);
      var opts = { Ks: Ks, models: models, starts: Math.max(5, Number($('#nst').value) || 50), keep: Math.max(1, Number($('#nkp').value) || 10), seed: Number($('#seed').value) || 1 };
      var names = idx.map(function (i) { return state.names[i]; }), cols = idx.map(function (i) { return state.cols[i]; });
      var res = kind === 'LPA' ? S.lpa(cols, opts) : S.lca(cols, opts);
      var fits = res.fits.filter(function (x) { return !x.failed; }), unit = kind === 'LPA' ? '프로파일' : '계층';
      var bestBic = {}; fits.forEach(function (x) { var key = x.model || 'LCA'; if (!bestBic[key] || x.bic < bestBic[key].bic) bestBic[key] = x; });
      var head = (kind === 'LPA' ? ['모형'] : []).concat(['K', 'LL', '모수', 'AIC', 'BIC', 'SABIC', '엔트로피', '최소 ' + unit + ' (%)', '최고 LL 반복']).concat(kind === 'LCA' ? ['G²', 'df'] : []).concat(['BLRT p']);
      var rows = res.fits.map(function (x, i) {
        if (x.failed) return (kind === 'LPA' ? [x.model] : []).concat([x.K, '추정 실패 (퇴화하거나 수렴하지 않음)']).concat(new Array(head.length - (kind === 'LPA' ? 3 : 2)).fill(''));
        var isBest = bestBic[x.model || 'LCA'] === x, bic = f(x.bic, 2);
        return (kind === 'LPA' ? [x.model] : []).concat([x.K, f(x.LL, 2), x.npar, f(x.aic, 2), isBest ? '<b>' + bic + '</b>' : bic, f(x.sabic, 2), x.K > 1 ? fr(x.entropy) : '—',
          f(100 * x.minProp, 1) + (x.minProp < 0.05 && x.K > 1 ? ' ⚠' : ''), x.replicated + '/' + x.finalRuns])
          .concat(kind === 'LCA' ? [f(x.G2, 2), x.dfPattern] : []).concat(['<span class="blrt" data-i="' + i + '">' + (x.K > 1 ? '—' : '') + '</span>']);
      });
      var warn = fits.filter(function (x) { return x.K > 1 && x.replicated < 2; }).map(function (x) { return fitLabel(res, x); });
      var html = (warn.length ? '<div class="warn">최고 우도가 한 번만 나온 해: ' + esc(warn.join(', ')) + '. 국소해일 수 있으니 시작값 수를 늘려 다시 확인하세요.</div>' : '') +
        table(head, rows, { title: (kind === 'LPA' ? '잠재프로파일' : '잠재계층') + ' 모형 비교', note: 'LL = 로그우도, SABIC = 표본크기 조정 BIC. 굵게 = 모형별 최소 BIC. ⚠ = 가장 작은 ' + unit + '이 5% 미만. "최고 LL 반복"은 끝까지 추정한 시작값 중 최고 우도에 도달한 수. ' + unit + ' 수는 BIC·BLRT 같은 지표와 함께 이론적 해석 가능성, 최소 ' + unit + ' 크기, 엔트로피를 종합해 정한다(Nylund, Asparouhov, & Muthén, 2007; Spurk et al., 2020).' + (kind === 'LCA' ? ' G²는 관측된 반응 패턴 기준(poLCA와 같은 정의)이며, 희소한 패턴이 많으면 χ² 근사가 부정확하다.' : '') }) +
        '<div class="field" style="margin-top:8px"><label>자세히 볼 해</label><div class="inline"><select class="pick">' + fits.map(function (x, i) {
          var j = res.fits.indexOf(x); return '<option value="' + j + '"' + (x === (bestBic[models[0]] || bestBic.LCA) ? ' selected' : '') + '>' + esc(fitLabel(res, x)) + '</option>';
        }).join('') + '</select><button class="btn small primary" data-act="detail">해 보기</button></div></div>' +
        '<p class="note">N = ' + res.X.length + ' (목록별 제거). LPA 모형의 모수·우도는 R mclust와, LCA는 flexmix(이분 문항)와 대조 검증했습니다. 여러 시작값을 쓰므로 mclust의 단일 초기값보다 더 높은 우도의 해를 찾는 경우가 있으며, 그 해들은 mclust의 EM으로도 같은 값에 수렴함을 확인했습니다.</p>';
      var card = addCard((kind === 'LPA' ? '잠재프로파일 분석' : '잠재계층분석') + ': ' + names.join(', '), html, unit + ' 1–' + Kmax);
      card.querySelector('[data-act=detail]').onclick = function () { detailCard(res, res.fits[Number(card.querySelector('.pick').value)], names, idx); };
      var B = Math.max(0, Math.floor(Number($('#nbl').value) || 0));
      if (B) runBLRT(card, res, B, opts.seed); else $$('.blrt', card).forEach(function (e) { if (e.textContent === '—') e.textContent = '—'; });
    }
  };

  function runBLRT(card, res, B, seed) {
    var rand = S.rng(seed + 77), jobs = [];
    res.fits.forEach(function (x, i) {
      if (x.failed || x.K < 2) return;
      var prev = res.fits.filter(function (y) { return !y.failed && y.K === x.K - 1 && (y.model || 'LCA') === (x.model || 'LCA'); })[0];
      if (prev) jobs.push({ i: i, f0: prev, K: x.K, obs: 2 * (x.LL - prev.LL), ge: 0, ok: 0, done: 0 });
    });
    var ji = 0, t0 = Date.now(), total = jobs.length * B;
    function step() {
      var until = Date.now() + 150;
      while (ji < jobs.length && Date.now() < until) {
        var j = jobs[ji], l = S.blrtOnce(res, j.f0, j.K, rand, {});
        j.done++; if (l !== null) { j.ok++; if (l >= j.obs) j.ge++; }
        if (j.done >= B) {
          var p = (1 + j.ge) / (j.ok + 1), cell = card.querySelector('.blrt[data-i="' + j.i + '"]');
          if (cell) cell.innerHTML = fp(p) + (j.ok < B ? ' <span class="note">(' + j.ok + '/' + B + ')</span>' : '');
          ji++;
        }
      }
      var done = jobs.slice(0, ji).length * B + (ji < jobs.length ? jobs[ji].done : 0);
      if (ji < jobs.length) {
        var cell2 = card.querySelector('.blrt[data-i="' + jobs[ji].i + '"]');
        if (cell2) cell2.textContent = '계산 중 ' + Math.round(100 * done / total) + '%';
        setTimeout(step, 0); return;
      }
      var note = card.querySelector('.apa-note');
      if (note) note.insertAdjacentHTML('beforeend', ' BLRT: 부트스트랩 ' + B + '회, K개 대 K−1개, p = (1 + #{LRT* ≥ LRT}) / (B + 1) (mclust::mclustBootstrapLRT와 같은 정의), 시드 = ' + seed + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + '초).');
    }
    setTimeout(step, 30);
  }

  // 참고문헌 추가 (도움말 화면)
  NS.extraRefs = (NS.extraRefs || []).concat([
    ['Asparouhov, T., & Muthén, B. (2014). Auxiliary variables in mixture modeling: Three-step approaches using Mplus. Structural Equation Modeling, 21(3), 329–341.', 'https://doi.org/10.1080/10705511.2014.915181'],
    ['Bakk, Z., Oberski, D. L., & Vermunt, J. K. (2014). Relating latent class assignments to external variables: Standard errors for correct inference. Political Analysis, 22(4), 520–540.', 'https://doi.org/10.1093/pan/mpu003'],
    ['Bakk, Z., & Vermunt, J. K. (2016). Robustness of stepwise latent class modeling with continuous distal outcomes. Structural Equation Modeling, 23(1), 20–31.', 'https://doi.org/10.1080/10705511.2014.955104'],
    ['Bolck, A., Croon, M., & Hagenaars, J. (2004). Estimating latent structure models with categorical variables: One-step versus three-step estimators. Political Analysis, 12(1), 3–27.', 'https://doi.org/10.1093/pan/mph001'],
    ['Vermunt, J. K. (2010). Latent class modeling with covariates: Two improved three-step approaches. Political Analysis, 18(4), 450–469.', 'https://doi.org/10.1093/pan/mpq025'],
    ['Bakk, Z., Tekle, F. B., & Vermunt, J. K. (2013). Estimating the association between latent class membership and external variables using bias-adjusted three-step approaches. Sociological Methodology, 43(1), 272–311.', 'https://doi.org/10.1177/0081175012470644'],
    ['Hipp, J. R., & Bauer, D. J. (2006). Local solutions in the estimation of growth mixture models. Psychological Methods, 11(1), 36–53.', 'https://doi.org/10.1037/1082-989X.11.1.36'],
    ['McLachlan, G. J. (1987). On bootstrapping the likelihood ratio test statistic for the number of components in a normal mixture. Applied Statistics, 36(3), 318–324.', 'https://doi.org/10.2307/2347790'],
    ['Nagin, D. S. (2005). Group-based modeling of development. Harvard University Press.', 'https://doi.org/10.4159/9780674041318'],
    ['Nylund, K. L., Asparouhov, T., & Muthén, B. O. (2007). Deciding on the number of classes in latent class analysis and growth mixture modeling: A Monte Carlo simulation study. Structural Equation Modeling, 14(4), 535–569.', 'https://doi.org/10.1080/10705510701575396'],
    ['Scrucca, L., Fop, M., Murphy, T. B., & Raftery, A. E. (2016). mclust 5: Clustering, classification and density estimation using Gaussian finite mixture models. The R Journal, 8(1), 289–317.', 'https://doi.org/10.32614/RJ-2016-021'],
    ['Spurk, D., Hirschi, A., Wang, M., Valero, D., & Kauffeld, S. (2020). Latent profile analysis: A review and "how to" guide of its application within vocational behavior research. Journal of Vocational Behavior, 120, 103445.', 'https://doi.org/10.1016/j.jvb.2020.103445']
  ]);
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
