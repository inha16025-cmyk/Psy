/* PsyStat 화면(UI) 코드 — 조각 2/7: 상관~조건부 과정 모형
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 코드는 분할 전과 동일) */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  // 앞 조각에서 가져오기
  var S = NS.S, state = NS.state, $ = NS.$, $$ = NS.$$, esc = NS.esc, f = NS.f, fp = NS.fp, fr = NS.fr;
  var star = NS.star, table = NS.table, rcode = NS.rcode, rvec = NS.rvec, rname = NS.rname, levelsOf = NS.levelsOf, selectField = NS.selectField, multiField = NS.multiField;
  var getMulti = NS.getMulti, getSel = NS.getSel, need = NS.need, designColumns = NS.designColumns, addCard = NS.addCard, A = NS.A;
  function select() { return NS.select.apply(this, arguments); } // 뒤 조각에 정의됨 (호출 시점에 연결)
  A.cor = {
    group: '관계', title: '상관분석',
    desc: 'Pearson·Spearman 상관행렬, 유의확률, 95% 신뢰구간.',
    form: function () {
      return multiField('v', '변수 (2개 이상)', 'num') + '<div class="field"><div class="lab">방법</div><div class="inline"><label><input type="radio" name="cm" value="pearson" checked>Pearson</label><label><input type="radio" name="cm" value="spearman">Spearman</label><label><input type="radio" name="cm" value="auto">다분상관 자동 (cor_auto)</label></div>' +
        '<div class="hint">다분상관 자동: 정수형이고 수준이 7개 이하인 변수(리커트·이분)를 순서형으로 보고 다분·사분·다계열 상관을 구합니다 (qgraph::cor_auto 규칙, lavaan 방식). 결측은 대응별 처리.</div></div>' +
        '<div class="field"><div class="lab">결측 처리</div><div class="inline"><label><input type="radio" name="mm" value="pairwise" checked>대응별 제거</label><label><input type="radio" name="mm" value="listwise">목록별 제거</label></div></div>';
    },
    run: function () {
      var v = getMulti('v'); need(v.length >= 2, '변수를 2개 이상 선택하세요.');
      var m = $('input[name=cm]:checked').value, mm = $('input[name=mm]:checked').value;
      var cols = v.map(function (i) { return state.cols[i]; }), names = v.map(function (i) { return state.names[i]; });
      if (m === 'auto') { autoCorCard(cols, names); return; }
      var res = S.corMatrix(cols, m, mm);
      // APA 상관표: 변수, M, SD, 상관 (아래 삼각)
      var useRows = mm === 'listwise' ? S.completeRows(cols) : null;
      var msd = cols.map(function (c) { var x = useRows ? useRows.map(function (i) { return c[i]; }) : S.clean(c); return [S.mean(x), S.sd(x)]; });
      var rows = names.map(function (n, a) {
        return [(a + 1) + '. ' + esc(n), f(msd[a][0], 2), f(msd[a][1], 2)].concat(names.map(function (_, b) { return b < a ? fr(res.R[a][b]) + star(res.P[a][b]) : (b === a ? '—' : ''); }));
      });
      var pairs = [];
      for (var a = 0; a < v.length; a++) for (var b = a + 1; b < v.length; b++) {
        var ct = S.corTest(cols[a], cols[b], m);
        if (mm === 'listwise') { var rr = S.completeRows(cols); ct = S.corTest(rr.map(function (r) { return cols[a][r]; }), rr.map(function (r) { return cols[b][r]; }), m); }
        pairs.push([esc(names[a] + ' – ' + names[b]), fr(ct.r), ct.n, f(ct.t, 2), fp(ct.p), '[' + fr(ct.ciLow) + ', ' + fr(ct.ciHigh) + ']']);
      }
      var html = table(['변수', 'M', 'SD'].concat(names.map(function (_, i) { return i + 1; })), rows, { title: '기술통계와 변수 간 ' + (m === 'pearson' ? 'Pearson' : 'Spearman') + ' 상관', note: mm === 'pairwise' ? '결측은 대응별 제거.' : 'N = ' + useRows.length + ' (목록별 제거).' }) +
        '<h4>상관계수와 95% 신뢰구간</h4>' +
        table(['쌍', m === 'pearson' ? 'r' : 'ρ', 'n', 't', 'p', '95% CI (Fisher z)'], pairs) +
        (m === 'spearman' ? '<p class="note">Spearman의 p값은 SPSS와 같은 t 근사입니다. 표본이 작고 동순위가 없으면 R의 cor.test(exact = TRUE)와 약간 다를 수 있습니다.</p>' : '') +
        rcode('psych::corr.test(df[, ' + rvec(names) + '], method = "' + m + '", use = "' + (mm === 'pairwise' ? 'pairwise' : 'complete') + '")');
      addCard((m === 'pearson' ? 'Pearson' : 'Spearman') + ' 상관분석', html, v.length + '개 변수, ' + (mm === 'pairwise' ? '대응별 제거' : '목록별 제거'));
    }
  };

  function autoCorCard(cols, names) {
    var ca = S.corAuto(cols), p = names.length;
    var abbrev = { pearson: 'P', polychoric: '다분', tetrachoric: '사분', polyserial: '다계열' };
    var rows = names.map(function (n, a) { return [(a + 1) + '. ' + esc(n)].concat(names.map(function (_, b) { return b < a ? fr(ca.R[a][b]) : (b === a ? '—' : '<span class="note">' + abbrev[ca.kinds[a][b]] + '</span>'); })); });
    var pd = !!S.cholesky(ca.R);
    var html = table([''].concat(names.map(function (_, i) { return i + 1; })), rows, { title: '다분·사분·다계열 상관 행렬', note: '아래 삼각은 상관계수, 위 삼각은 계산 종류.' }) +
      '<p class="note">아래 삼각: 상관계수. 위 삼각: 계산 종류 (P = Pearson, 다분 = polychoric, 사분 = tetrachoric, 다계열 = polyserial).</p>' +
      '<p class="note">순서형으로 판정된 변수: ' + esc(names.filter(function (_, i) { return ca.ordinal[i]; }).join(', ') || '없음') + '</p>' +
      (pd ? '' : '<div class="warn">이 상관행렬은 양정치가 아닙니다. 네트워크 분석에서는 가장 가까운 양정치 행렬(Higham, 2002)로 자동 보정합니다.</div>') +
      (ca.zeroCellPairs.length ? '<p class="note">빈 칸이 있는 2×2 표: lavaan과 같이 주변합을 유지하며 0.5를 보정했습니다.</p>' : '') +
      '<p class="note">다분상관은 역치를 고정한 뒤 ρ를 최대우도로 추정하는 2단계 방식(Olsson, 1979)으로, lavaan::lavCor(estimator = "two.step")와 같은 값을 냅니다. 유의확률은 제시하지 않습니다.</p>' +
      rcode('qgraph::cor_auto(df[, ' + rvec(names) + '])');
    addCard('다분상관 자동 (cor_auto)', html, p + '개 변수');
  }

  A.chisq = {
    group: '관계', title: '교차분석 (χ²)',
    desc: 'Pearson χ², 우도비 검정, Fisher 정확검정(2×2), Cramér V.',
    form: function () { return selectField('r', '행 변수', 'any') + selectField('c', '열 변수', 'any'); },
    run: function () {
      var r = getSel('r'), c = getSel('c'); need(r >= 0 && c >= 0 && r !== c, '서로 다른 두 변수를 선택하세요.');
      var t = S.crosstab(state.cols[r], state.cols[c]);
      var rows = [];
      t.rows.forEach(function (rl, a) {
        rows.push([esc(rl)].concat(t.O[a].map(function (o, b) { return o + ' <span class="note">(' + f(t.E[a][b], 1) + ')</span><br><span class="note">행 ' + f(100 * o / t.rowSums[a], 1) + '%</span>'; })).concat([t.rowSums[a]]));
      });
      rows.push(['합계'].concat(t.colSums).concat([t.n]));
      var tests = [['Pearson χ²', f(t.chi2, 3), t.df, fp(t.p)], ['우도비 G²', f(t.G2, 3), t.df, fp(t.pG2)]];
      if (t.yates) { tests.push(['연속성 보정 (Yates)', f(t.yates.chi2, 3), 1, fp(t.yates.p)]); tests.push(['Fisher 정확검정 (양측)', '', '', fp(t.fisherP)]); }
      var eff = [['Cramér V', fr(t.cramerV)]];
      if (t.yates) { eff.push(['φ', fr(t.phi)]); eff.push(['오즈비 (OR)', f(t.oddsRatio, 3)]); }
      var html = table([esc(state.names[r]) + ' \\ ' + esc(state.names[c])].concat(t.cols.map(esc)).concat(['합계']), rows, { title: state.names[r] + ' × ' + state.names[c] + ' 교차표', note: '셀 값은 관측빈도, 괄호 안은 기대빈도, 아래는 행 백분율.' }) +
        '<p class="note">셀: 관측빈도 (기대빈도), 행 백분율.</p>' + table(['검정', '값', 'df', 'p'], tests, { left: [0], title: '독립성 검정' }) + table(['효과크기', '값'], eff, { title: '연관성 효과크기' }) +
        (t.lowExpected ? '<div class="warn">기대빈도 5 미만 셀: ' + t.lowExpected + ' / ' + t.cells + '개 (' + f(100 * t.lowExpected / t.cells, 1) + '%). 20%를 넘으면 χ² 근사가 부정확할 수 있습니다' + (t.yates ? ' — Fisher 정확검정을 보고하세요.' : '. 범주 병합을 고려하세요.') + '</div>' : '') +
        rcode('tab <- table(df$' + rname(state.names[r]) + ', df$' + rname(state.names[c]) + ')\nchisq.test(tab, correct = FALSE); fisher.test(tab)');
      addCard('교차분석', html, state.names[r] + ' × ' + state.names[c]);
    }
  };

  A.lm = {
    group: '회귀', title: '선형회귀',
    desc: '다중회귀: B, SE, β, t, p, 95% CI, R², VIF, Durbin-Watson. 문자형 예측변수는 자동 더미코딩.',
    form: function () { return selectField('y', '종속변수', 'num') + multiField('x', '예측변수', 'any', '문자형 변수는 첫 범주를 기준으로 더미코딩됩니다.'); },
    run: function () {
      var y = getSel('y'), x = getMulti('x').filter(function (i) { return i !== y; }); need(y >= 0 && x.length, '종속변수와 예측변수를 선택하세요.');
      var dc = designColumns(x), m = S.linearRegression(state.cols[y], dc.cols, dc.names);
      var html = table(['R', 'R²', '수정 R²', '추정값 SE', 'F', 'df', 'p', 'N'], [[fr(m.R), fr(m.R2), fr(m.adjR2), f(m.see, 3), f(m.F, 2), m.dfM + ', ' + m.dfE, fp(m.p), m.n]], { title: '회귀모형 요약 (종속변수: ' + state.names[y] + ')' }) +
        table(['예측변수', 'B', 'SE', 'β', 't', 'p', '95% CI', 'VIF'], m.coefs.map(function (c) {
          return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.beta, 3), f(c.t, 2), fp(c.p), '[' + f(c.ciLow, 3) + ', ' + f(c.ciHigh, 3) + ']', f(c.vif, 2)];
        }), { title: '다중회귀분석 결과 (종속변수: ' + state.names[y] + ')' }) +
        (dc.notes.length ? '<p class="note">더미코딩 — ' + esc(dc.notes.join('; ')) + '</p>' : '') +
        '<p class="note">Durbin-Watson = ' + f(m.durbinWatson, 3) + '. VIF > 10(보수적으로 > 5)이면 다중공선성을 점검하세요. 계산은 QR 분해 기반 최소제곱으로, R의 lm()과 같은 값을 냅니다.</p>' +
        (m.coefs.some(function (c) { return c.vif > 10; }) ? '<div class="warn">VIF가 10을 넘는 예측변수가 있습니다.</div>' : '') +
        rcode('m <- lm(' + rname(state.names[y]) + ' ~ ' + x.map(function (i) { return rname(state.names[i]); }).join(' + ') + ', data = df)\nsummary(m); car::vif(m); lm.beta::lm.beta(m)');
      addCard('선형회귀: ' + state.names[y], html, x.length + '개 예측변수');
    }
  };

  A.logit = {
    group: '회귀', title: '로지스틱 회귀',
    desc: '이분형 종속변수: B, SE, Wald, p, 오즈비(95% CI), 모형 χ², Nagelkerke R², Hosmer-Lemeshow, 분류표, AUC.',
    form: function () {
      return selectField('y', '종속변수 (두 범주)', 'any') + '<div class="field" id="ev" style="display:none"><label for="evv">사건(=1)으로 볼 범주</label><select id="evv"></select></div>' +
        multiField('x', '예측변수', 'any', '문자형 변수는 첫 범주를 기준으로 더미코딩됩니다.') +
        '<div class="field"><label for="cut">분류 기준 확률</label><input type="number" id="cut" value="0.5" step="0.05" min="0.05" max="0.95"></div>';
    },
    wire: function () {
      $('#y').onchange = function () {
        var i = getSel('y'); if (i < 0) { $('#ev').style.display = 'none'; return; }
        var lv = levelsOf(i);
        $('#evv').innerHTML = lv.map(function (l) { return '<option>' + esc(l) + '</option>'; }).join('');
        $('#evv').selectedIndex = lv.length - 1;
        $('#ev').style.display = '';
        if (lv.length !== 2) $('#ev').insertAdjacentHTML('beforeend', '<div class="hint">주의: 이 변수는 ' + lv.length + '개 범주입니다. 선택한 범주 = 1, 나머지 = 0으로 분석합니다.</div>');
      };
    },
    run: function () {
      var y = getSel('y'), x = getMulti('x').filter(function (i) { return i !== y; }); need(y >= 0 && x.length, '종속변수와 예측변수를 선택하세요.');
      var ev = $('#evv').value, cut = Number($('#cut').value) || 0.5;
      var yy = state.cols[y].map(function (v) { return v === null ? null : (String(v) === ev ? 1 : 0); });
      var dc = designColumns(x), m = S.logisticRegression(yy, dc.cols, dc.names, { cutoff: cut });
      var cl = m.classification;
      var html = (m.warnings.length ? '<div class="warn">' + m.warnings.map(esc).join('<br>') + '</div>' : '') +
        '<h4>모형 적합</h4>' + table(['N', '사건 수', '−2LL', '모형 χ²', 'df', 'p', 'Cox-Snell R²', 'Nagelkerke R²', 'McFadden R²', 'AIC', 'BIC'],
          [[m.n, m.nEvents, f(m.deviance, 3), f(m.chi2, 3), m.dfM, fp(m.pModel), fr(m.coxSnell), fr(m.nagelkerke), fr(m.mcfadden), f(m.aic, 2), f(m.bic, 2)]]) +
        '<h4>회귀계수</h4>' + table(['예측변수', 'B', 'SE', 'Wald χ²', 'p', 'OR', 'OR 95% CI'], m.coefs.map(function (c) {
          return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.wald, 3), fp(c.p), f(c.or, 3), '[' + f(c.orLow, 3) + ', ' + f(c.orHigh, 3) + ']'];
        })) +
        '<h4>Hosmer-Lemeshow 적합도</h4>' + table(['χ²', 'df', 'p', '집단 수'], [[f(m.hl.chi2, 3), m.hl.df, fp(m.hl.p), m.hl.groups]]) +
        '<h4>분류표 (기준 = ' + cut + ')</h4>' + table(['관측 \\ 예측', '0', '1', '정확도'], [
          ['0 (' + esc(levelsOf(y).length === 2 ? levelsOf(y).filter(function (l) { return l !== ev; })[0] : '기타') + ')', cl.tn, cl.fp, f(100 * cl.specificity, 1) + '% (특이도)'],
          ['1 (' + esc(ev) + ')', cl.fn, cl.tp, f(100 * cl.sensitivity, 1) + '% (민감도)'], ['전체', '', '', f(100 * cl.accuracy, 1) + '%']], { left: [0] }) +
        '<p class="note">AUC (ROC 곡선 아래 면적) = ' + fr(m.auc) + '. 반복 ' + m.iterations + '회 (IRLS, ' + (m.converged ? '수렴' : '<b>미수렴</b>') + ').</p>' +
        (dc.notes.length ? '<p class="note">더미코딩 — ' + esc(dc.notes.join('; ')) + '</p>' : '') +
        '<p class="note">Wald χ² = (B/SE)². 계수·SE는 R의 glm(family = binomial)과 같습니다. Hosmer-Lemeshow는 예측확률의 분위수(10분위)로 집단을 나누는 방식(R ResourceSelection::hoslem.test와 동일)이어서, 동점 처리가 다른 SPSS와는 값이 약간 다를 수 있습니다. 표본이 크면 H-L 검정은 과민해지므로 AUC·보정 정도와 함께 보세요(Hosmer, Lemeshow, & Sturdivant, 2013).</p>' +
        rcode('df$y01 <- as.integer(df$' + rname(state.names[y]) + ' == "' + ev + '")\nm <- glm(y01 ~ ' + x.map(function (i) { return rname(state.names[i]); }).join(' + ') + ', data = df, family = binomial)\nsummary(m); exp(cbind(OR = coef(m), confint.default(m)))\nResourceSelection::hoslem.test(m$y, fitted(m), g = 10)');
      addCard('이분형 로지스틱 회귀: ' + state.names[y] + ' = ' + ev, html, x.length + '개 예측변수');
    }
  };

  function binaryDV(yIdx, ev) { return state.cols[yIdx].map(function (v) { return v === null ? null : (String(v) === ev ? 1 : 0); }); }
  function eventPicker() { return '<div class="field" id="ev" style="display:none"><label for="evv">사건(=1)으로 볼 범주</label><select id="evv"></select></div>'; }
  function wireEventPicker() {
    var i = getSel('y'), box = $('#ev');
    if (i < 0 || !$('#htype_log') || !$('#htype_log').checked) { box.style.display = 'none'; return; }
    var lv = levelsOf(i);
    $('#evv').innerHTML = lv.map(function (l) { return '<option>' + esc(l) + '</option>'; }).join('');
    $('#evv').selectedIndex = lv.length - 1; box.style.display = '';
  }

  A.hier = {
    group: '회귀', title: '위계적 회귀',
    desc: '블록별로 예측변수를 누적 투입: 선형(ΔR², ΔF) 또는 로지스틱(블록 χ², Nagelkerke R²). 모든 단계는 같은 사례로 비교합니다.',
    form: function () {
      return '<div class="field"><div class="lab">모형</div><div class="inline"><label><input type="radio" name="htype" id="htype_lin" value="lin" checked>선형</label><label><input type="radio" name="htype" id="htype_log" value="log">이분형 로지스틱</label></div></div>' +
        selectField('y', '종속변수', 'any') + eventPicker() +
        [1, 2, 3, 4].map(function (k) { return multiField('b' + k, '블록 ' + k + (k === 1 ? ' (예: 인구통계 통제변수)' : ' (선택)'), 'any'); }).join('') +
        '<div class="hint">문자형 변수는 첫 범주를 기준으로 더미코딩됩니다. 상호작용항이 필요하면 [조절분석] 메뉴를 쓰세요.</div>';
    },
    wire: function () { $('#y').onchange = wireEventPicker; $$('input[name=htype]').forEach(function (r) { r.onchange = wireEventPicker; }); },
    run: function () {
      var y = getSel('y'), logistic = $('#htype_log').checked; need(y >= 0, '종속변수를 선택하세요.');
      var used = [y], blocks = [], bnames = [], labels = [], notes = [];
      [1, 2, 3, 4].forEach(function (k) {
        var ids = getMulti('b' + k).filter(function (i) { return used.indexOf(i) < 0; });
        if (!ids.length) return;
        used = used.concat(ids);
        var dc = designColumns(ids); blocks.push(dc.cols); bnames.push(dc.names); notes = notes.concat(dc.notes);
        labels.push(ids.map(function (i) { return state.names[i]; }).join(', '));
      });
      need(blocks.length >= 1, '블록 1에 예측변수를 하나 이상 넣으세요.');
      if (!logistic) need(state.types[y] === 'num', '선형 위계적 회귀의 종속변수는 숫자형이어야 합니다.');
      var ev = logistic ? $('#evv').value : null;
      var yv = logistic ? binaryDV(y, ev) : state.cols[y];
      var h = S.hierarchicalRegression(yv, blocks, bnames, { logistic: logistic });
      var html = '<p class="note">분석 사례 N = ' + h.n + ' (모든 블록 변수에 결측이 없는 사례; 단계 간 비교를 위해 동일 표본 사용)</p>';
      if (!logistic) {
        html += '<h4>모형 요약</h4>' + table(['단계', '투입 변수', 'R²', '수정 R²', 'ΔR²', 'ΔF', 'df', 'p (ΔF)', 'F (전체)', 'p'], h.steps.map(function (s, k) {
          return [k + 1, esc(labels[k]), fr(s.model.R2), fr(s.model.adjR2), fr(s.dR2), f(s.dF, 2), s.df1 + ', ' + s.df2, fp(s.dP), f(s.model.F, 2), fp(s.model.p)];
        }), { left: [1] });
        h.steps.forEach(function (s, k) {
          html += '<h4>단계 ' + (k + 1) + ' 계수</h4>' + table(['예측변수', 'B', 'SE', 'β', 't', 'p', '95% CI', 'VIF'], s.model.coefs.map(function (c) {
            return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.beta, 3), f(c.t, 2), fp(c.p), '[' + f(c.ciLow, 3) + ', ' + f(c.ciHigh, 3) + ']', f(c.vif, 2)];
          }));
        });
      } else {
        html += '<h4>모형 요약</h4>' + table(['단계', '투입 변수', '−2LL', '블록 χ²', 'df', 'p', '모형 χ²', 'Nagelkerke R²', 'AUC'], h.steps.map(function (s, k) {
          return [k + 1, esc(labels[k]), f(s.model.deviance, 3), f(s.blockChi2, 3), s.blockDf, fp(s.blockP), f(s.model.chi2, 3), fr(s.model.nagelkerke), fr(s.model.auc)];
        }), { left: [1] });
        h.steps.forEach(function (s, k) {
          html += (s.model.warnings.length ? '<div class="warn">' + s.model.warnings.map(esc).join('<br>') + '</div>' : '') +
            '<h4>단계 ' + (k + 1) + ' 계수</h4>' + table(['예측변수', 'B', 'SE', 'Wald χ²', 'p', 'OR', 'OR 95% CI'], s.model.coefs.map(function (c) {
              return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.wald, 3), fp(c.p), f(c.or, 3), '[' + f(c.orLow, 3) + ', ' + f(c.orHigh, 3) + ']'];
            }));
        });
      }
      if (notes.length) html += '<p class="note">더미코딩 — ' + esc(notes.join('; ')) + '</p>';
      var rf = function (k) { return state.names[y] + ' ~ ' + labels.slice(0, k + 1).join(', ').split(', ').map(rname).join(' + '); };
      html += rcode('d <- na.omit(df[, ' + rvec(used.map(function (i) { return state.names[i]; })) + '])\n' +
        h.steps.map(function (_, k) { return 'm' + (k + 1) + ' <- ' + (logistic ? 'glm(' : 'lm(') + rf(k) + ', data = d' + (logistic ? ', family = binomial' : '') + ')'; }).join('\n') +
        '\nanova(' + h.steps.map(function (_, k) { return 'm' + (k + 1); }).join(', ') + (logistic ? ', test = "Chisq"' : '') + ')');
      addCard('위계적 ' + (logistic ? '로지스틱' : '선형') + ' 회귀: ' + state.names[y] + (logistic ? ' = ' + ev : ''), html, blocks.length + '단계');
    }
  };

  function slopesSVG(md, xName, wName, yName) {
    var W = 520, H = 320, L = 60, Rm = 120, T = 20, B = 46;
    var cvTerm = md.covMeans.reduce(function (s, m, i) { return s + m * md.b[4 + i]; }, 0);
    var x0 = md.xRange[0], x1 = md.xRange[1];
    var pred = function (x, w) { var xc = x - md.xMean, wc = w - md.wMean; return md.b[0] + md.b[1] * xc + md.b[2] * wc + md.b[3] * xc * wc + cvTerm; };
    var lines = md.slopes.map(function (s) { return [pred(x0, s.w), pred(x1, s.w)]; });
    var ys = [].concat.apply([], lines), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.1 || 1;
    y0 -= pad; y1 += pad;
    var X = function (v) { return L + (v - x0) / ((x1 - x0) || 1) * (W - L - Rm); }, Y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };
    var cols = ['#c8372d', '#6b7280', '#2b5fc7'], dash = ['6 4', '2 3', ''];
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">';
    s += '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - Rm) + '" y2="' + (H - B) + '" stroke="#8a94a6"/><line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '" stroke="#8a94a6"/>';
    [0, 0.5, 1].forEach(function (t) {
      var xv = x0 + t * (x1 - x0), yv = y0 + t * (y1 - y0);
      s += '<text x="' + X(xv) + '" y="' + (H - B + 14) + '" text-anchor="middle">' + f(xv, 1) + '</text><text x="' + (L - 6) + '" y="' + (Y(yv) + 4) + '" text-anchor="end">' + f(yv, 1) + '</text>';
    });
    s += '<text x="' + ((L + W - Rm) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(xName) + '</text><text x="14" y="' + ((T + H - B) / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + ((T + H - B) / 2) + ')">' + esc(yName) + '</text>';
    var lab = md.binaryW ? md.slopes.map(function (q) { return wName + ' = ' + f(q.w, 2); }) : ['낮음 (' + f(md.slopes[0].w, 2) + ')', '중간 (' + f(md.slopes[1].w, 2) + ')', '높음 (' + f(md.slopes[2].w, 2) + ')'];
    var ci = md.slopes.length === 2 ? [0, 2] : [0, 1, 2];
    lines.forEach(function (ln, i) {
      var c = ci[i];
      s += '<line x1="' + X(x0) + '" y1="' + Y(ln[0]).toFixed(1) + '" x2="' + X(x1) + '" y2="' + Y(ln[1]).toFixed(1) + '" stroke="' + cols[c] + '" stroke-width="2.2" stroke-dasharray="' + dash[c] + '"/>';
      s += '<line x1="' + (W - Rm + 10) + '" y1="' + (T + 10 + i * 18) + '" x2="' + (W - Rm + 30) + '" y2="' + (T + 10 + i * 18) + '" stroke="' + cols[c] + '" stroke-width="2.2" stroke-dasharray="' + dash[c] + '"/><text x="' + (W - Rm + 34) + '" y="' + (T + 14 + i * 18) + '">' + esc(lab[i]) + '</text>';
    });
    s += '<text x="' + (W - Rm + 10) + '" y="' + (T - 4) + '" font-weight="600">' + esc(wName) + '</text>';
    return s + '</svg>';
  }

  A.moderation = {
    group: '매개·조절', title: '조절분석',
    desc: 'PROCESS Model 1과 같은 OLS 조절모형: 상호작용항, ΔR², 단순기울기, Johnson-Neyman 구간, 상호작용 그림.',
    form: function () {
      return selectField('y', '종속변수 (Y)', 'num') + selectField('x', '독립변수 (X)', 'num') + selectField('w', '조절변수 (W)', 'num', '연속 또는 0/1 이분변수') +
        multiField('cv', '공변인 (선택)', 'any') +
        '<div class="field"><div class="inline"><label><input type="checkbox" id="ctr" checked>X와 W 평균중심화</label></div><div class="hint">평균중심화는 상호작용항의 계수를 바꾸지 않지만, X·W 주효과를 "상대 변수가 평균일 때의 효과"로 해석할 수 있게 해 줍니다.</div></div>' +
        '<div class="field"><div class="lab">단순기울기 지점</div><div class="inline"><label><input type="radio" name="pr" value="sd" checked>M ± 1SD</label><label><input type="radio" name="pr" value="percentile">16·50·84 백분위 (PROCESS 기본)</label></div></div>';
    },
    run: function () {
      var y = getSel('y'), x = getSel('x'), w = getSel('w'); need(y >= 0 && x >= 0 && w >= 0, 'Y, X, W를 모두 선택하세요.');
      need(y !== x && y !== w && x !== w, 'Y, X, W는 서로 다른 변수여야 합니다.');
      var cvIdx = getMulti('cv').filter(function (i) { return [x, y, w].indexOf(i) < 0; }), dc = designColumns(cvIdx);
      var md = S.moderation(state.cols[y], state.cols[x], state.cols[w], dc.cols, { center: $('#ctr').checked, probe: $('input[name=pr]:checked').value, covNames: dc.names });
      var xn = state.names[x], wn = state.names[w], yn = state.names[y];
      md.coefs[1].name = xn; md.coefs[2].name = wn; md.coefs[3].name = xn + ' × ' + wn;
      var html = table(['N', 'R²', '상호작용 ΔR²', 'F (ΔR²)', 'df', 'p'], [[md.n, fr(md.R2), fr(md.dR2), f(md.F, 3), md.df1 + ', ' + md.df2, fp(md.p)]], { title: '모형 요약과 상호작용 검정' }) +
        table(['', 'B', 'SE', 't', 'p', '95% CI'], md.coefs.map(function (c) { return [esc(c.name), f(c.b, 4), f(c.se, 4), f(c.t, 3), fp(c.p), '[' + f(c.ciLow, 4) + ', ' + f(c.ciHigh, 4) + ']']; }), { title: yn + '에 대한 조절모형 회귀계수' }) +
        (md.centered ? '<p class="note">X, W는 평균중심화됨 (M<sub>X</sub> = ' + f(md.meanX, 3) + ', M<sub>W</sub> = ' + f(md.meanW, 3) + '). 상호작용항은 중심화된 X와 W의 곱입니다.</p>' : '') +
        '<h4>단순기울기: W 수준별 X의 조건부 효과</h4>' + table([esc(wn), '효과', 'SE', 't', 'p', '95% CI'], md.slopes.map(function (s) { return [f(s.w, 3), f(s.est, 4), f(s.se, 4), f(s.t, 3), fp(s.p), '[' + f(s.ciLow, 4) + ', ' + f(s.ciHigh, 4) + ']']; }));
      if (!md.binaryW) {
        html += '<h4>Johnson-Neyman 유의성 구간 (α = .05)</h4>' + (md.jn.length
          ? '<p>X의 효과가 유의해지는 경계: ' + esc(wn) + ' = <b>' + md.jn.map(function (v) { return f(v, 3); }).join('</b>, <b>') + '</b> (관측 범위 ' + f(md.wRange[0], 2) + '–' + f(md.wRange[1], 2) + '). ' +
            (md.jn.length === 1 ? 'W가 이 값보다 ' + (md.jnSigBelow ? '<b>낮을</b>' : '<b>높을</b>') + ' 때 X의 효과가 유의합니다.' : '경계 사이와 바깥의 유의성은 단순기울기 표와 함께 확인하세요.') + '</p>'
          : '<p class="note">관측된 W 범위 안에 유의성이 바뀌는 경계점이 없습니다.</p>');
      }
      html += '<div class="mod-plot">' + slopesSVG(md, xn, wn, yn) + '</div>' +
        '<p class="note">계수, SE, 단순기울기는 R의 lm(Y ~ X*W)과 vcov()로 직접 계산한 값과 같고(오차 &lt; 1e-9), PROCESS Model 1(OLS SE)과 같은 정의입니다(Hayes, 2022). 그림의 공변인은 평균값으로 고정했습니다.</p>' +
        rcode('d <- na.omit(df[, ' + rvec([yn, xn, wn].concat(cvIdx.map(function (i) { return state.names[i]; }))) + '])\n' +
          (md.centered ? 'd$xc <- d$' + rname(xn) + ' - mean(d$' + rname(xn) + '); d$wc <- d$' + rname(wn) + ' - mean(d$' + rname(wn) + ')\nm <- lm(' + rname(yn) + ' ~ xc * wc' : 'm <- lm(' + rname(yn) + ' ~ ' + rname(xn) + ' * ' + rname(wn)) +
          cvIdx.map(function (i) { return ' + ' + rname(state.names[i]); }).join('') + ', data = d)\nsummary(m)\n# interactions::sim_slopes(m, pred = ..., modx = ..., johnson_neyman = TRUE)');
      addCard('조절분석: ' + xn + ' × ' + wn + ' → ' + yn, html, 'PROCESS Model 1');
    }
  };

  function mediationSVG(names, me) {
    var k = me.k, W = 560, H = 140 + 70 * k, bx = 110, by = 34, s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">';
    s += '<defs><marker id="ar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3a4152"/></marker></defs>';
    var box = function (cx, cy, t) { return '<rect x="' + (cx - bx / 2) + '" y="' + (cy - by / 2) + '" width="' + bx + '" height="' + by + '" rx="5" fill="#ffffff" stroke="#3a4152"/><text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" style="fill:#1d2433">' + esc(t.length > 12 ? t.slice(0, 12) + '…' : t) + '</text>'; };
    var arrow = function (x1, y1, x2, y2, lab) {
      var lx = (x1 + x2) / 2, ly = (y1 + y2) / 2 + 4;
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#3a4152" stroke-width="1.3" marker-end="url(#ar)"/>' +
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" style="fill:#1d2433">' + lab + '</text>';
    };
    var xc = 80, yc = W - 80, by0 = H - 40, star2 = function (p) { return star(p); };
    var fy = me.est.fy, cdir = fy.b[1], pdir = ptTwoSidedSafe(fy, 1);
    s += box(xc, by0, names.x) + box(yc, by0, names.y);
    s += arrow(xc + bx / 2, by0, yc - bx / 2, by0, "c′ = " + f(cdir, 3) + star2(pdir));
    names.m.forEach(function (mn, j) {
      var mx = W / 2, my = 30 + j * 70, a = me.est.a[j], pa = ptTwoSidedSafe(a.fit, 1), pb = ptTwoSidedSafe(fy, 2 + j);
      s += box(mx, my, mn);
      s += arrow(xc + 10, by0 - by / 2, mx - bx / 2, my + 6, 'a' + (k > 1 ? j + 1 : '') + ' = ' + f(a.a, 3) + star2(pa));
      s += arrow(mx + bx / 2, my + 6, yc - 10, by0 - by / 2, 'b' + (k > 1 ? j + 1 : '') + ' = ' + f(me.est.b[j], 3) + star2(pb));
    });
    return s + '</svg>';
  }
  function ptTwoSidedSafe(fit, j) { var t = fit.b[j] / Math.sqrt(fit.cov[j][j]); return S.ptTwoSided(t, fit.dfE); }

  A.mediation = {
    group: '매개·조절', title: '매개분석',
    desc: 'PROCESS Model 4와 같은 OLS 매개모형 (병렬 매개변수 여러 개 가능): a, b, c, c′ 경로와 부트스트랩 간접효과 신뢰구간.',
    form: function () {
      return selectField('y', '종속변수 (Y)', 'num') + selectField('x', '독립변수 (X)', 'num', '0/1 이분변수도 가능') + multiField('m', '매개변수 (M; 여러 개면 병렬 매개)', 'num') +
        multiField('cv', '공변인 (선택)', 'any') +
        '<div class="field"><div class="inline"><label>부트스트랩 <input type="number" id="nb" value="5000" min="0" step="1000" style="width:90px"> 회</label><label>시드 <input type="number" id="seed" value="1234" style="width:80px"></label></div><div class="hint">PROCESS 기본값과 같이 5,000회 백분위 부트스트랩. 간접효과 검정은 부트스트랩 CI가 0을 포함하는지로 판단합니다(Hayes, 2022).</div></div>';
    },
    run: function () {
      var y = getSel('y'), x = getSel('x'), m = getMulti('m').filter(function (i) { return i !== x && i !== y; });
      need(y >= 0 && x >= 0 && m.length, 'Y, X, 매개변수를 선택하세요.'); need(x !== y, 'X와 Y는 서로 달라야 합니다.');
      var cvIdx = getMulti('cv').filter(function (i) { return [x, y].concat(m).indexOf(i) < 0; }), dc = designColumns(cvIdx);
      var B = Math.max(0, Math.floor(Number($('#nb').value) || 0)), seed = Number($('#seed').value) || 1;
      var me = S.mediation(state.cols[y], state.cols[x], m.map(function (i) { return state.cols[i]; }), dc.cols, { boot: B, seed: seed });
      var xn = state.names[x], yn = state.names[y], mn = m.map(function (i) { return state.names[i]; }), k = m.length;
      var pathRow = function (label, fit, j) {
        var c = fit.b[j] / Math.sqrt(fit.cov[j][j]), se = Math.sqrt(fit.cov[j][j]), tc = S.qt(0.975, fit.dfE);
        return [label, f(fit.b[j], 4), f(se, 4), f(c, 3), fp(S.ptTwoSided(c, fit.dfE)), '[' + f(fit.b[j] - tc * se, 4) + ', ' + f(fit.b[j] + tc * se, 4) + ']'];
      };
      var rows = [];
      me.est.a.forEach(function (a, j) { rows.push(pathRow('a' + (k > 1 ? j + 1 : '') + ': ' + esc(xn + ' → ' + mn[j]), a.fit, 1)); });
      me.est.b.forEach(function (_, j) { rows.push(pathRow('b' + (k > 1 ? j + 1 : '') + ': ' + esc(mn[j] + ' → ' + yn), me.est.fy, 2 + j)); });
      rows.push(pathRow("c′ (직접효과): " + esc(xn + ' → ' + yn), me.est.fy, 1));
      rows.push(pathRow('c (총효과): ' + esc(xn + ' → ' + yn), me.est.ft, 1));
      var std = me.sdx / me.sdy;
      var indRows = me.est.ind.map(function (v, j) {
        var bt = me.boot ? me.boot.ind[j] : null;
        return [esc(xn + ' → ' + mn[j] + ' → ' + yn), f(v, 4), bt ? f(bt.se, 4) : '—', bt ? '[' + f(bt.ci[0], 4) + ', ' + f(bt.ci[1], 4) + ']' : '—', bt ? (bt.ci[0] > 0 || bt.ci[1] < 0 ? '유의' : '유의하지 않음') : '—', f(v * std, 4)];
      });
      if (k > 1) indRows.push(['총 간접효과', f(me.est.totalInd, 4), me.boot ? f(me.boot.total.se, 4) : '—', me.boot ? '[' + f(me.boot.total.ci[0], 4) + ', ' + f(me.boot.total.ci[1], 4) + ']' : '—',
        me.boot ? (me.boot.total.ci[0] > 0 || me.boot.total.ci[1] < 0 ? '유의' : '유의하지 않음') : '—', f(me.est.totalInd * std, 4)]);
      var html = '<div class="med-plot">' + mediationSVG({ x: xn, y: yn, m: mn }, me) + '</div>' +
        '<p class="note">N = ' + me.n + ' (목록별 제거). * p &lt; .05, ** p &lt; .01, *** p &lt; .001.</p>' +
        '<h4>경로계수</h4>' + table(['경로', 'B', 'SE', 't', 'p', '95% CI'], rows) +
        '<h4>간접효과</h4>' + table(['경로', '효과 (a×b)', 'Boot SE', '95% Boot CI', '판단', '완전표준화'], indRows) +
        '<p class="note">부트스트랩 ' + (me.boot ? me.boot.B : 0) + '회, 백분위 구간, 시드 = ' + seed + '. 같은 시드면 같은 결과가 재현되지만, 난수 생성기가 R·SPSS와 달라 구간 끝값은 소수 둘째~셋째 자리에서 조금 다를 수 있습니다. 완전표준화 간접효과 = ab × SD<sub>X</sub>/SD<sub>Y</sub> (X가 이분변수면 부분표준화 ab/SD<sub>Y</sub>를 보고하세요).</p>' +
        (k === 1 ? '<p class="note">참고: Sobel z = ' + f(me.sobel[0].z, 3) + ', p = ' + fp(me.sobel[0].p) + ' (정규성 가정이 강해 부트스트랩 CI를 우선 보고하세요; Preacher & Hayes, 2008).</p>' : '') +
        (k > 1 ? '<p class="note">병렬 매개: 각 간접효과는 다른 매개변수를 통제한 특정 간접효과입니다.</p>' : '') +
        rcode('d <- na.omit(df[, ' + rvec([yn, xn].concat(mn, cvIdx.map(function (i) { return state.names[i]; }))) + '])\n' +
          mn.map(function (q, j) { return 'ma' + (j + 1) + ' <- lm(' + rname(q) + ' ~ ' + rname(xn) + cvIdx.map(function (i) { return ' + ' + rname(state.names[i]); }).join('') + ', data = d)'; }).join('\n') +
          '\nmy <- lm(' + rname(yn) + ' ~ ' + rname(xn) + mn.map(function (q) { return ' + ' + rname(q); }).join('') + cvIdx.map(function (i) { return ' + ' + rname(state.names[i]); }).join('') + ', data = d)\n' +
          '# 또는 lavaan: ind := a*b 정의 후 sem(..., se = "bootstrap", bootstrap = 5000)');
      addCard('매개분석: ' + xn + ' → ' + mn.join(', ') + ' → ' + yn, html, 'PROCESS Model 4' + (k > 1 ? ' (병렬 ' + k + '개)' : ''));
    }
  };

  // 개념 모형 그림 (Hayes 방식): 6 = 순차, 7/8 = a 경로 조절, 14/15 = b 경로 조절
  function processSVG(model, nm) {
    var k = nm.m.length, W = 600, H = model === 6 ? 230 : 120 + 66 * k + 40, bw = 104, bh = 32;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">' +
      '<defs><marker id="ar2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3a4152"/></marker></defs>';
    var box = function (p, t, dashed) { return '<rect x="' + (p[0] - bw / 2) + '" y="' + (p[1] - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="5" fill="#ffffff" stroke="#3a4152"' + (dashed ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle" style="fill:#1d2433">' + esc(t.length > 13 ? t.slice(0, 13) + '…' : t) + '</text>'; };
    // 상자 테두리에서 시작·끝나도록 선분 단축
    var edge = function (a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], ta = Math.min(Math.abs((bw / 2) / (dx || 1e-9)), Math.abs((bh / 2) / (dy || 1e-9))), tb = ta;
      return [[a[0] + dx * ta, a[1] + dy * ta], [b[0] - dx * tb, b[1] - dy * tb]];
    };
    var lines = [], arrow = function (a, b) { var e = edge(a, b); lines.push(e); return '<line x1="' + e[0][0].toFixed(1) + '" y1="' + e[0][1].toFixed(1) + '" x2="' + e[1][0].toFixed(1) + '" y2="' + e[1][1].toFixed(1) + '" stroke="#3a4152" stroke-width="1.3" marker-end="url(#ar2)"/>'; };
    var toMid = function (from, ln) { var mx = (ln[0][0] + ln[1][0]) / 2, my = (ln[0][1] + ln[1][1]) / 2; var e = edge(from, [mx, my]); return '<line x1="' + e[0][0].toFixed(1) + '" y1="' + e[0][1].toFixed(1) + '" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#2b5fc7" stroke-width="1.3" stroke-dasharray="5 3" marker-end="url(#ar2)"/>'; };
    var X = [70, H - 30], Y = [W - 70, H - 30], Mp = [];
    if (model === 6) for (var j = 0; j < k; j++) Mp.push([150 + (W - 300) * (k === 1 ? 0.5 : j / (k - 1)), 40 + (j % 2) * 50]);
    else for (var j2 = 0; j2 < k; j2++) Mp.push([W / 2, 34 + j2 * 66]);
    var body = '';
    var aLines = [], bLines = [], cLine;
    Mp.forEach(function (p) { body += arrow(X, p); aLines.push(lines[lines.length - 1]); });
    if (model === 6) for (var a = 0; a < k; a++) for (var b = a + 1; b < k; b++) body += arrow(Mp[a], Mp[b]);
    Mp.forEach(function (p) { body += arrow(p, Y); bLines.push(lines[lines.length - 1]); });
    body += arrow(X, Y); cLine = lines[lines.length - 1];
    if (model !== 6) {
      var Wp = model === 7 || model === 8 ? [70, 34] : [W - 70, 34];
      (model === 7 || model === 8 ? aLines : bLines).forEach(function (ln) { body += toMid(Wp, ln); });
      if (model === 8 || model === 15) body += toMid(Wp, cLine);
      body += box(Wp, nm.w, true);
    }
    s += body + box(X, nm.x) + box(Y, nm.y);
    Mp.forEach(function (p, i) { s += box(p, nm.m[i]); });
    return s + '</svg>';
  }

  var PROCESS_DESC = {
    6: 'Model 6 · 순차 매개: X → M1 → M2 (→ M3 → M4) → Y',
    7: 'Model 7 · 조절된 매개 (W가 X→M 경로 조절)',
    8: 'Model 8 · 조절된 매개 (W가 X→M과 X→Y 경로 조절)',
    14: 'Model 14 · 조절된 매개 (W가 M→Y 경로 조절)',
    15: 'Model 15 · 조절된 매개 (W가 M→Y와 X→Y 경로 조절)'
  };

  A.process = {
    group: '매개·조절', title: '조절된 매개·순차 매개',
    desc: 'PROCESS Model 6, 7, 8, 14, 15와 같은 조건부 과정 모형: 경로계수, 조절된 매개 지수, 조건부 간접효과, 부트스트랩 신뢰구간.',
    form: function () {
      return '<div class="field"><label for="pm">모형</label><select id="pm">' + Object.keys(PROCESS_DESC).map(function (k) { return '<option value="' + k + '"' + (k === '7' ? ' selected' : '') + '>' + PROCESS_DESC[k] + '</option>'; }).join('') + '</select></div>' +
        '<div id="pmfig" style="margin-bottom:10px"></div>' +
        selectField('y', '종속변수 (Y)', 'num') + selectField('x', '독립변수 (X)', 'num', '0/1 이분변수도 가능') +
        selectField('m1', '매개변수 M1', 'num') + selectField('m2', '매개변수 M2', 'num', '순차 매개에서는 M1 → M2 → … 순서가 곧 인과 순서입니다.') + selectField('m3', '매개변수 M3 (선택)', 'num') + selectField('m4', '매개변수 M4 (선택)', 'num') +
        '<div id="wbox">' + selectField('w', '조절변수 (W)', 'num', '연속 또는 0/1 이분변수') + '</div>' +
        multiField('cv', '공변인 (선택, 모든 방정식에 투입)', 'any') +
        '<div class="field" id="wopts"><div class="inline"><label><input type="checkbox" id="ctr">곱셈항 변수 평균중심화</label></div>' +
        '<div class="lab" style="margin-top:6px">조건부 효과 탐색 지점</div><div class="inline"><label><input type="radio" name="pr" value="sd" checked>M ± 1SD</label><label><input type="radio" name="pr" value="percentile">16·50·84 백분위</label></div>' +
        '<div class="hint">조건부 간접효과와 조절된 매개 지수는 중심화 여부와 관계없이 같습니다. 중심화는 계수 표의 주효과 해석만 바꿉니다.</div></div>' +
        '<div class="field"><div class="inline"><label>부트스트랩 <input type="number" id="nb" value="5000" min="0" step="1000" style="width:90px"> 회</label><label>시드 <input type="number" id="seed" value="1234" style="width:80px"></label></div></div>';
    },
    wire: function () {
      var upd = function () {
        var m = Number($('#pm').value), hasW = m !== 6;
        $('#wbox').style.display = hasW ? '' : 'none'; $('#wopts').style.display = hasW ? '' : 'none';
        $('#pmfig').innerHTML = processSVG(m, { x: 'X', y: 'Y', w: 'W', m: m === 6 ? ['M1', 'M2'] : ['M'] });
      };
      $('#pm').onchange = upd; upd();
    },
    run: function () {
      var model = Number($('#pm').value), hasW = model !== 6;
      var y = getSel('y'), x = getSel('x'), w = hasW ? getSel('w') : -1;
      var mIdx = ['m1', 'm2', 'm3', 'm4'].map(getSel).filter(function (i) { return i >= 0; });
      need(y >= 0 && x >= 0, 'Y와 X를 선택하세요.'); need(mIdx.length >= (model === 6 ? 2 : 1), model === 6 ? '순차 매개는 M1, M2가 필요합니다.' : '매개변수를 하나 이상 선택하세요.');
      if (hasW) need(w >= 0, '조절변수 W를 선택하세요.');
      var used = [y, x].concat(mIdx, hasW ? [w] : []);
      need(used.filter(function (v, i) { return used.indexOf(v) !== i; }).length === 0, 'Y, X, M, W에 같은 변수를 두 번 넣을 수 없습니다.');
      var cvIdx = getMulti('cv').filter(function (i) { return used.indexOf(i) < 0; }), dc = designColumns(cvIdx);
      var B = Math.max(0, Math.floor(Number($('#nb').value) || 0)), seed = Number($('#seed').value) || 1;
      var r = S.processModel(state.cols[y], state.cols[x], mIdx.map(function (i) { return state.cols[i]; }), hasW ? state.cols[w] : null, dc.cols,
        { model: model, center: hasW && $('#ctr').checked, probe: $('input[name=pr]:checked').value, boot: B, seed: seed, covNames: dc.names });
      var xn = state.names[x], yn = state.names[y], wn = hasW ? state.names[w] : '', mn = mIdx.map(function (i) { return state.names[i]; });
      var rename = function (t) { return t.replace(/^X×W$/, xn + ' × ' + wn).replace(/^M(\d)×W$/, function (_, d) { return mn[d - 1] + ' × ' + wn; }).replace(/^X$/, xn).replace(/^W$/, wn).replace(/^M(\d)$/, function (_, d) { return mn[d - 1]; }); };
      var bs = function (key) { return r.boot ? r.boot.stats[key] : null; };
      var ciTxt = function (st) { return st ? '[' + f(st.ci[0], 4) + ', ' + f(st.ci[1], 4) + ']' : '—'; };
      var sig = function (st) { return st ? (st.ci[0] > 0 || st.ci[1] < 0 ? '유의' : '유의하지 않음') : '—'; };
      var html = '<div>' + processSVG(model, { x: xn, y: yn, w: wn, m: mn }) + '</div>' +
        '<p class="note">' + esc(PROCESS_DESC[model]) + ' · N = ' + r.n + ' (목록별 제거)' + (r.centered ? ' · 곱셈항 변수 평균중심화' : '') + (dc.notes.length ? ' · 더미코딩: ' + esc(dc.notes.join('; ')) : '') + '</p>';
      r.eqs.forEach(function (e) {
        var on = e.outcome === 'Y' ? yn : mn[Number(e.outcome.slice(1)) - 1];
        html += table(['R²', 'F', 'df', 'p'], [[fr(e.R2), f(e.F, 3), e.dfM + ', ' + e.dfE, fp(e.p)]], { title: '결과변수 ' + on + ': 모형 요약' }) +
          table(['', 'B', 'SE', 't', 'p', '95% CI'], e.coefs.map(function (c) { return [esc(rename(c.name)), f(c.b, 4), f(c.se, 4), f(c.t, 3), fp(c.p), '[' + f(c.ciLow, 4) + ', ' + f(c.ciHigh, 4) + ']']; }), { title: '결과변수 ' + on + ': 회귀계수' });
      });
      // 직접효과
      html += '<h4>' + (model === 8 || model === 15 ? '조건부 직접효과 (W 수준별)' : '직접효과 (c′)') + '</h4>' +
        table((model === 8 || model === 15 ? [esc(wn)] : []).concat(['효과', 'SE', 't', 'p', '95% CI']), r.direct.map(function (d) {
          return (d.w === null ? [] : [f(d.w, 3)]).concat([f(d.est, 4), f(d.se, 4), f(d.t, 3), fp(d.p), '[' + f(d.ciLow, 4) + ', ' + f(d.ciHigh, 4) + ']']);
        }));
      if (model === 6) {
        var rows = [], keys = Object.keys(r.effects).sort(function (a, b) { // PROCESS와 같은 사전식 경로 순서
          var pa = a.slice(4).split('-').map(Number), pb = b.slice(4).split('-').map(Number);
          for (var q = 0; q < Math.min(pa.length, pb.length); q++) if (pa[q] !== pb[q]) return pa[q] - pb[q];
          return pa.length - pb.length;
        });
        keys.forEach(function (key) {
          var path = key.slice(4).split('-').map(Number), lab = [xn].concat(path.map(function (q) { return mn[q]; }), [yn]).join(' → ');
          var st = bs(key); rows.push([esc(lab), f(r.effects[key], 4), st ? f(st.se, 4) : '—', ciTxt(st), sig(st), f(r.effects[key] * r.sdx / r.sdy, 4)]);
        });
        var tst = r.boot ? r.boot.stats.totalInd : null;
        rows.push(['총 간접효과', f(r.totalInd, 4), tst ? f(tst.se, 4) : '—', ciTxt(tst), sig(tst), f(r.totalInd * r.sdx / r.sdy, 4)]);
        html += '<h4>총효과 (c)</h4>' + table(['효과', 'SE', 't', 'p', '95% CI'], [[f(r.total.b, 4), f(r.total.se, 4), f(r.total.t, 3), fp(r.total.p), '[' + f(r.total.ciLow, 4) + ', ' + f(r.total.ciHigh, 4) + ']']]) +
          '<h4>간접효과</h4>' + table(['경로', '효과', 'Boot SE', '95% Boot CI', '판단', '완전표준화'], rows) +
          '<p class="note">총효과 = 직접효과 + 총 간접효과 (' + f(r.total.b, 4) + ' = ' + f(r.direct[0].est, 4) + ' + ' + f(r.totalInd, 4) + '). 각 경로는 해당 매개변수 순서를 거치는 특정 간접효과입니다.</p>';
      } else {
        mn.forEach(function (m, j) {
          var st = bs('imm:' + j);
          html += '<h4>간접효과: ' + esc(xn + ' → ' + m + ' → ' + yn) + '</h4>' +
            table([esc(wn), '조건부 간접효과', 'Boot SE', '95% Boot CI', '판단'], r.wvals.map(function (wv, wi) {
              var s2 = bs('cond:' + j + ':' + wi); return [f(wv, 3), f(r.effects['cond:' + j + ':' + wi], 4), s2 ? f(s2.se, 4) : '—', ciTxt(s2), sig(s2)];
            })) +
            table(['조절된 매개 지수 (index)', 'Boot SE', '95% Boot CI', '판단'], [[f(r.effects['imm:' + j], 4), st ? f(st.se, 4) : '—', ciTxt(st), sig(st)]], { title: '조절된 매개 지수: ' + xn + ' → ' + m + ' → ' + yn });
        });
        html += '<p class="note">조절된 매개 지수(Hayes, 2015) = ' + (model <= 8 ? 'a<sub>3</sub> × b (W에 따른 a 경로 변화 × b)' : 'a × b<sub>3</sub> (a × W에 따른 b 경로 변화)') + '. 이 지수의 부트스트랩 CI가 0을 포함하지 않으면 간접효과가 W에 따라 달라진다고 해석합니다. ' +
          (r.binaryW ? 'W가 이분변수이므로 지수는 두 집단 간 조건부 간접효과의 차이와 같습니다.' : '탐색 지점: ' + ($('input[name=pr]:checked').value === 'sd' ? 'M − 1SD, M, M + 1SD' : '16·50·84 백분위') + '.') + '</p>';
      }
      html += '<p class="note">부트스트랩 ' + (r.boot ? r.boot.B : 0) + '회, 백분위 구간, 시드 = ' + seed + '. 계수와 점추정치는 R lm()으로 직접 계산한 값과 같습니다(오차 &lt; 1e-14). 부트스트랩 구간은 난수 생성기가 달라 PROCESS·R과 소수 셋째 자리 정도에서 다를 수 있습니다.</p>' +
        rcode(processRcode(model, yn, xn, mn, wn, cvIdx.map(function (i) { return state.names[i]; })));
      addCard('조건부 과정 모형 (Model ' + model + ')', html, mn.length + '개 매개변수' + (hasW ? ', W = ' + wn : ''));
    }
  };

  function processRcode(model, yn, xn, mn, wn, cvs) {
    var cv = cvs.map(function (c) { return ' + ' + rname(c); }).join(''), X = rname(xn), Wv = rname(wn), Y = rname(yn);
    var lines = ['d <- na.omit(df[, ' + rvec([yn, xn].concat(mn, wn ? [wn] : [], cvs)) + '])'];
    mn.forEach(function (m, j) {
      var rhs = model === 6 ? [X].concat(mn.slice(0, j).map(rname)).join(' + ') : (model === 7 || model === 8 ? X + ' * ' + Wv : X);
      lines.push('fm' + (j + 1) + ' <- lm(' + rname(m) + ' ~ ' + rhs + cv + ', data = d)');
    });
    var yr = [X].concat(mn.map(rname));
    if (model === 8) yr.push(Wv, X + ':' + Wv);
    if (model === 14 || model === 15) { yr.push(Wv); mn.forEach(function (m) { yr.push(rname(m) + ':' + Wv); }); if (model === 15) yr.push(X + ':' + Wv); }
    lines.push('fy <- lm(' + Y + ' ~ ' + yr.join(' + ') + cv + ', data = d)');
    lines.push('# 간접효과 부트스트랩: 위 방정식을 boot::boot()로 재표집하거나, PROCESS for R (Hayes) 사용');
    return lines.join('\n');
  }

  // 다음 조각으로 내보내기
  NS.autoCorCard = autoCorCard; NS.binaryDV = binaryDV; NS.eventPicker = eventPicker; NS.wireEventPicker = wireEventPicker; NS.slopesSVG = slopesSVG; NS.mediationSVG = mediationSVG; NS.ptTwoSidedSafe = ptTwoSidedSafe; NS.processSVG = processSVG;
  NS.PROCESS_DESC = PROCESS_DESC; NS.processRcode = processRcode;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
