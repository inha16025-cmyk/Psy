/* PsyStat 화면(UI) 코드 — 조각 6/7: 메뉴 분류 체계·해석 가이드·다항 로지스틱 회귀
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다. */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  var S = NS.S, state = NS.state, $ = NS.$, esc = NS.esc, f = NS.f, fp = NS.fp, fr = NS.fr, fb = NS.fb, table = NS.table, rcode = NS.rcode, rname = NS.rname;
  var selectField = NS.selectField, multiField = NS.multiField, getMulti = NS.getMulti, getSel = NS.getSel, need = NS.need, addCard = NS.addCard;
  var designColumns = NS.designColumns, levelsOf = NS.levelsOf, A = NS.A;

  /* ---------------- 메뉴 분류 ---------------- */
  NS.NAV = [
    ['기초 분석', ['desc', 'cor', 'chisq', 'alpha']],
    ['집단 비교', ['ttest', 'anova', 'manova']],
    ['회귀', ['lm', 'hier', 'logit', 'mlogit']],
    ['매개·조절', ['moderation', 'mediation', 'process']],
    ['분류·잠재집단', ['lda', 'lpa']],
    ['잠재변수 모형', ['sem']],
    ['네트워크', ['network']]
  ];
  if (A.logit) A.logit.title = '로지스틱 회귀 (이분형)';

  /* ---------------- 해석 가이드 ----------------
   * 행: [지표, 의미, 흔히 쓰는 기준, 근거]. 기준은 관례이며 연구 맥락에 따라 달라진다.
   */
  var COHEN_D = ['Cohen의 d / Hedges의 g', '두 평균 차이를 표준편차 단위로 나타낸 효과크기. g는 작은 표본의 편향을 보정한 값.', '.20 작음, .50 중간, .80 큼', 'Cohen (1988)'];
  var ETA = ['η² · ω² · 부분 η²', '종속변수 변동 중 집단(요인)이 설명하는 비율. ω²는 η²의 과대추정을 줄인 값.', '.01 작음, .06 중간, .14 큼', 'Cohen (1988)'];
  var PVAL = ['p값', '귀무가설이 참일 때 이만큼 또는 더 극단적인 결과가 나올 확률. 효과의 크기나 중요성을 뜻하지 않는다.', '관례적으로 .05 미만이면 유의. 효과크기·신뢰구간과 함께 보고', 'Wasserstein & Lazar (2016)'];
  var CI = ['95% 신뢰구간 (CI)', '모수가 있을 법한 범위. 같은 절차를 반복하면 구간의 95%가 참값을 포함한다.', '차이·계수는 0, 오즈비는 1을 포함하지 않으면 p < .05와 같은 판단', 'Cumming (2014)'];
  var GUIDES = {
    desc: [
      ['왜도 (G1)', '분포의 좌우 비대칭. 0이면 대칭, 양수면 오른쪽 꼬리가 김.', '표본 50–300명: |왜도/SE| < 3.29. 300명 초과: |왜도| < 2', 'Kim (2013); West, Finch, & Curran (1995)'],
      ['첨도 (G2, 초과첨도)', '꼬리의 두께. 정규분포 = 0, 양수면 꼬리가 두꺼움.', '표본 50–300명: |첨도/SE| < 3.29. 300명 초과: |첨도| < 7', 'Kim (2013); West et al. (1995)'],
      ['Shapiro-Wilk W, p', '자료가 정규분포에서 왔다는 가설의 검정.', 'p < .05면 정규성 기각. 표본이 크면 사소한 이탈에도 유의하므로 왜도·첨도·그림과 함께 판단', 'Kim (2013)']],
    ttest: [
      ['Levene 검정 p', '두 집단 분산이 같은지 검정.', 'p < .05면 등분산 가정 위배 → Welch 결과 보고. 최근에는 항상 Welch를 쓰자는 권고', 'Delacre, Lakens, & Leys (2017)'],
      PVAL, COHEN_D, CI],
    anova: [
      ['F, p', '집단 간 변동 / 집단 내 변동. 평균이 모두 같다는 가설의 검정.', 'p < .05면 적어도 한 쌍의 평균이 다름 → 사후검정으로 어느 쌍인지 확인', ''],
      ['Levene 검정 · Welch ANOVA', '등분산 가정 점검과 그 가정이 필요 없는 F 검정.', 'Levene p < .05면 Welch ANOVA와 Games-Howell 사후검정을 보고', 'Delacre et al. (2017)'],
      ETA,
      ['사후검정 (Tukey · Games-Howell · Bonferroni)', '여러 쌍을 비교할 때 1종 오류를 통제한 p값.', '등분산: Tukey, 이분산: Games-Howell, 계획된 소수 비교: Bonferroni', '']],
    manova: [
      ["Box's M", '집단별 공분산 행렬이 같은지 검정. 정규성 위반과 큰 표본에 매우 민감.', 'p < .001일 때 위배로 봄. 위배되거나 집단 크기가 다르면 Pillai의 V 보고', 'Tabachnick & Fidell (2019)'],
      ["Pillai의 V · Wilks의 Λ", '여러 종속변수를 묶었을 때 집단 차이의 검정. Pillai가 가정 위반에 가장 강건.', 'p < .05면 다변량 집단 차이 있음 → 후속 단변량 분석(Bonferroni)이나 판별분석', 'Tabachnick & Fidell (2019)'],
      ['다변량 부분 η²', '다변량 효과의 상대적 크기(0–1).', '고정된 기준 없음. 단변량 η²의 기준을 그대로 적용하지 않도록 주의', '']],
    lda: [
      ['고유값 · 정준상관', '판별함수가 집단을 얼마나 잘 구분하는지. 정준상관의 제곱은 함수가 설명하는 집단 간 분산 비율.', '클수록 구분이 잘 됨. 첫 함수가 대부분을 설명하는 경우가 많음', ''],
      ["Wilks의 Λ (함수 검정)", '해당 함수(와 그 뒤 함수들)가 집단을 유의하게 구분하는지.', 'p < .05인 함수만 해석', ''],
      ['구조행렬 계수', '변수와 판별함수의 상관. 함수의 의미를 해석하는 근거.', '관행적으로 |.30|–|.40| 이상을 의미 있게 봄', '관행'],
      ['정분류율', '판별함수로 집단을 맞힌 비율. 교차타당화 값이 더 정직한 추정.', '비례 우연 기준(표의 주에 표시)보다 25% 이상 높으면 실용적 의미가 있다고 보는 관행', 'Hair et al. (2019)']],
    cor: [
      ['r (상관계수)', '두 변수의 선형 관련 정도(−1–1). Spearman ρ는 순위 기준.', '|r| .10 작음, .30 중간, .50 큼', 'Cohen (1988)'],
      PVAL, CI,
      ['다분상관 (cor_auto)', '리커트·이분 문항 뒤에 연속 잠재변수가 있다고 보고 추정한 상관.', 'Pearson보다 크게 나오는 경향. 유의확률 대신 크기로 해석', 'Olsson (1979)']],
    chisq: [
      ['χ², p', '두 범주형 변수가 독립이라는 가설의 검정.', 'p < .05면 관련 있음', ''],
      ['기대빈도', '독립일 때 기대되는 셀 빈도.', '기대빈도 5 미만인 셀이 20%를 넘으면 χ² 근사가 부정확 → Fisher 정확검정(2×2) 또는 범주 병합', 'Cochran (1954)'],
      ["Cramér의 V · φ", '연관성의 크기(0–1).', '2×2(φ): .10 작음, .30 중간, .50 큼. 표가 클수록(자유도↑) 같은 V라도 더 큰 연관', 'Cohen (1988)']],
    alpha: [
      ['Cronbach α', '문항들이 같은 것을 일관되게 재는 정도(내적 일관성).', '.70 이상(탐색적 연구), .80 이상(기초 연구), .90 이상(임상적 개인 판단)', 'Nunnally (1978), Lance, Butts, & Michels (2006)에서 재인용'],
      ['수정된 문항-총점 r', '해당 문항과 나머지 문항 합의 상관.', '관행적으로 .30 미만이면 문항 검토', '관행'],
      ['문항 삭제 시 α', '그 문항을 뺐을 때의 α.', '전체 α보다 뚜렷이 크면 그 문항이 척도와 맞지 않을 수 있음(내용 타당도와 함께 판단)', ''],
      ['α의 가정', 'α는 모든 문항의 요인부하가 같다고(타우 동등) 가정.', '가정이 깨지면 신뢰도를 과소추정할 수 있어 ω 보고가 권장됨', 'McNeish (2018)']],
    lm: [
      ['R² · 수정 R²', '예측변수들이 설명하는 종속변수 분산의 비율.', 'f² = R²/(1−R²): .02 작음, .15 중간, .35 큼', 'Cohen (1988)'],
      ['B · β', 'B는 원점수 단위의 기울기, β는 표준화 기울기(변수 간 상대 비교용).', '다중공선성이 있으면 β 비교가 불안정', ''],
      ['VIF', '다른 예측변수들로 그 예측변수가 얼마나 설명되는지(다중공선성).', '10 초과면 심각, 5 초과면 주의라는 관행. 기계적 적용은 경계', "O'Brien (2007)"],
      ['Durbin-Watson', '잔차의 자기상관. 2에 가까우면 자기상관 없음.', '1 미만이나 3 초과면 우려(시간 순서가 있는 자료에서 중요)', 'Field (2018)'],
      CI],
    hier: [
      ['ΔR², ΔF', '새 블록을 넣었을 때 추가로 설명된 분산과 그 검정.', 'ΔF의 p < .05면 그 블록이 유의한 추가 설명력을 가짐. ΔR² 자체(효과크기)를 함께 보고', 'Cohen (1988)'],
      ['블록 χ² (로지스틱)', '블록 추가로 줄어든 −2LL.', 'p < .05면 유의한 개선', '']],
    logit: [
      ['모형 χ²', '예측변수가 없는 모형 대비 −2LL 감소.', 'p < .05면 예측변수들이 유의하게 기여', ''],
      ['Nagelkerke · Cox-Snell R²', '최소제곱 R²를 흉내 낸 의사 R².', '최소제곱 R²처럼 해석하지 말 것. 모형 간 비교용', 'Hosmer, Lemeshow, & Sturdivant (2013)'],
      ['Hosmer-Lemeshow', '예측 확률과 관측 비율의 일치(보정).', 'p > .05면 적합 양호. 표본이 크면 과민하므로 AUC 등과 함께', 'Hosmer et al. (2013)'],
      ['AUC', '무작위로 고른 사건·비사건 한 쌍을 올바르게 순서 짓는 확률(판별력).', '.70–.80 수용, .80–.90 우수, .90 이상 탁월', 'Hosmer et al. (2013)'],
      ['오즈비 (OR)', '예측변수가 1 증가할 때 사건 오즈의 배수.', '1보다 크면 증가, 작으면 감소. CI가 1을 포함하지 않으면 p < .05', '']],
    moderation: [
      ['상호작용 계수 · ΔR²', 'X의 효과가 W에 따라 달라지는 정도.', '상호작용 p < .05면 조절효과 있음. 조절효과의 ΔR²는 대개 매우 작음(중앙값 f² ≈ .002라는 보고)', 'Aguinis et al. (2005)'],
      ['단순기울기', 'W의 특정 값에서 X의 효과.', '어느 W 수준에서 효과가 유의한지 해석. 탐색 지점(±1SD 등)은 임의적', 'Hayes (2022)'],
      ['Johnson-Neyman 구간', 'X의 효과가 유의해지는 W의 경계값.', '관측 범위 안의 경계만 해석', 'Hayes (2022)']],
    mediation: [
      ['간접효과 (a×b)', 'X가 M을 거쳐 Y에 미치는 효과.', '부트스트랩 95% CI가 0을 포함하지 않으면 유의. Sobel 검정보다 부트스트랩 권장', 'Hayes (2022); Preacher & Hayes (2008)'],
      ["직접효과 (c′) · 총효과 (c)", 'M을 통제한 X의 효과와 전체 효과.', '총효과가 유의하지 않아도 간접효과는 있을 수 있음', 'Hayes (2022)'],
      ['완전표준화 간접효과', '표준편차 단위의 간접효과.', '고정된 크기 기준은 권장되지 않음', 'Hayes (2022)']],
    process: [
      ['조절된 매개 지수', '간접효과가 W에 따라 선형으로 변하는 정도.', '부트스트랩 CI가 0을 포함하지 않으면 조절된 매개 있음. 조건부 간접효과가 각각 유의한 것만으로는 부족', 'Hayes (2015)'],
      ['조건부 간접효과', 'W의 특정 값에서의 간접효과.', 'CI가 0을 포함하지 않는 W 수준에서 간접효과 있음', 'Hayes (2022)'],
      ['순차 매개의 특정 간접효과', '정해진 순서의 매개 경로를 거친 효과.', '각 경로별 부트스트랩 CI로 판단', 'Hayes (2022)']],
    sem: [
      ['χ²', '모형이 자료와 완전히 맞는다는 가설의 검정.', '표본이 크면 거의 항상 유의하므로 근사 적합도와 함께 판단', 'Hu & Bentler (1999)'],
      ['CFI · TLI', '독립모형 대비 개선 정도.', '.95 이상 좋음, .90 이상 수용(관행)', 'Hu & Bentler (1999); Lance et al. (2006)'],
      ['RMSEA [90% CI]', '자유도당 근사 오차.', '.05 이하 좋음, .08 이하 수용, .10 초과 나쁨', 'MacCallum, Browne, & Sugawara (1996)'],
      ['SRMR', '표준화 잔차의 평균 크기.', '.08 이하', 'Hu & Bentler (1999)'],
      ['표준화 요인적재량 (β)', '지표가 요인을 반영하는 정도.', '.50 이상, 이상적으로는 .70 이상', 'Hair et al. (2019)'],
      ['CR · AVE · √AVE', '개념신뢰도, 평균분산추출, 판별타당도.', 'CR ≥ .70, AVE ≥ .50, √AVE가 다른 요인과의 상관보다 크면 판별타당도', 'Fornell & Larcker (1981)'],
      ['적합도 기준의 한계', '절단값은 특정 조건의 시뮬레이션에서 나온 값.', '기계적 적용 대신 여러 지수와 이론을 종합', 'Hu & Bentler (1999); Lance et al. (2006)']],
    network: [
      ['엣지 (편상관)', '다른 모든 노드를 통제한 두 노드의 관련.', 'EBICglasso에서 0은 정규화로 제거된 엣지', 'Epskamp & Fried (2018)'],
      ['강도 · 기대영향 중심성', '노드에 연결된 엣지 가중치의 합(절댓값/부호 포함).', 'CS 계수로 안정성을 확인한 뒤 해석', 'Epskamp, Borsboom, & Fried (2018)'],
      ['CS 계수', '사례를 지워도 중심성 순위가 유지되는 최대 비율.', '.25 이상이어야 하며 .50 이상이 바람직', 'Epskamp et al. (2018)'],
      ['근접 · 매개 중심성', '최단 경로 기반 중심성.', '심리 네트워크에서는 불안정한 경우가 많아 신중하게', 'Bringmann et al. (2019)']],
    lpa: [
      ['BIC · SABIC · AIC', '모형 적합과 복잡성의 균형. 작을수록 좋음.', 'BIC가 가장 일관적인 지표로 보고됨. 지표마다 다른 수를 가리키면 종합 판단', 'Nylund, Asparouhov, & Muthén (2007)'],
      ['BLRT p', 'K개 모형이 K−1개보다 유의하게 나은지.', 'p < .05면 K개 지지. 처음으로 유의하지 않은 K의 바로 앞이 후보', 'Nylund et al. (2007)'],
      ['엔트로피', '분류의 명확성(0–1).', '관행적으로 .80 이상이면 분류가 명확. 집단 수 결정 기준으로 쓰지는 않음', '관행; Spurk et al. (2020)'],
      ['최소 집단 비율', '가장 작은 집단의 크기.', '관행적으로 5% 미만(또는 매우 적은 사례)이면 해석·재현이 어려움', '관행; Spurk et al. (2020)'],
      ['최고 LL 반복', '여러 시작값에서 최고 우도가 재현된 횟수.', '2회 이상 재현되어야 국소해가 아님을 어느 정도 확신', 'Hipp & Bauer (2006)']],
    lpaDetail: [
      ['평균 사후확률', '배정된 집단에 실제로 속할 확률의 평균.', '각 집단 .70 이상', 'Nagin (2005)'],
      ['프로파일 평균 (z)', '전체 평균 대비 표준편차 단위의 위치.', '|z| .5 이상 차이를 의미 있는 특징으로 해석하는 경우가 많음(관행)', '관행'],
      ['소속 저장 후 분석', '분류 오류를 무시한 분석.', '엔트로피가 낮을수록 효과 과소추정 → BCH·ML 3단계 권장', 'Bakk, Tekle, & Vermunt (2013)']],
    bch: [
      ['분류오류행렬 D 대각선', '실제 집단이 그대로 배정될 확률.', '1에 가까울수록 보정이 안정적. 낮으면 BCH 추정이 불안정', 'Vermunt (2010)'],
      ['BCH 평균 · 비율', '분류 오류를 보정한 집단별 결과변수 추정치.', '보정 없는 값과 차이가 크면 분류 오류의 영향이 큼', 'Bakk & Vermunt (2016)'],
      ['Wald χ²', '집단 간 평균(분포)이 같다는 가설의 검정.', 'p < .05면 차이 있음. 쌍별 비교는 다중비교 보정 고려', ''],
      ['부트스트랩 표준오차', '단계 1 불확실성을 포함한 표준오차.', '샌드위치보다 부트스트랩 권장. 엔트로피 .60 미만이면 BCH도 한계', 'Bakk, Oberski, & Vermunt (2014)']],
    ml3: [
      ['오즈비 (기준 집단 대비)', '공변인이 1 증가할 때 기준 집단 대신 해당 집단에 속할 오즈의 배수.', '1보다 크면 해당 집단 소속 증가. CI가 1을 포함하지 않으면 유의', 'Vermunt (2010)'],
      ['우도비 검정 (공변인별)', '그 공변인을 뺐을 때의 우도 감소.', 'p < .05면 공변인이 집단 소속을 유의하게 예측', ''],
      ['보정 없는 B와의 비교', '최빈 배정 결과로 추정한 계수.', '보정 없는 계수는 0 쪽으로 줄어드는 경향', 'Bakk et al. (2013)'],
      ['직접효과 가정', '공변인이 지표에 직접 영향을 주지 않는다는 가정.', '위배되면 3단계 방법 전체가 편향될 수 있음', 'Janssen et al. (2019)']],
    mlogit: [
      ['모형 χ² · 우도비 검정', '절편만 있는 모형 대비 개선, 그리고 각 예측변수를 뺀 모형과의 비교.', 'p < .05면 유의. 예측변수 효과는 개별 Wald보다 우도비 검정을 우선', 'Hosmer et al. (2013)'],
      ['오즈비 (기준 범주 대비)', '예측변수가 1 증가할 때 기준 범주 대신 해당 범주일 오즈의 배수.', '1보다 크면 해당 범주 쪽. 기준 범주를 바꾸면 계수가 달라지므로 해석에 맞는 기준 선택', 'Hosmer et al. (2013)'],
      ['의사 R²', 'Nagelkerke·McFadden 등.', '최소제곱 R²처럼 해석하지 말 것', 'Hosmer et al. (2013)']]
  };
  NS.GUIDES = GUIDES;
  NS.appendGuide = function (card, id) {
    var rows = GUIDES[id];
    if (!rows || card.querySelector('details.guide')) return;
    var h = '<details class="guide"><summary>해석 가이드: 주요 수치의 의미와 판단 기준</summary><table class="guide-t"><thead><tr><th>지표</th><th>의미</th><th>흔히 쓰는 기준</th><th>근거</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td class="note">' + esc(r[3] || '—') + '</td></tr>'; }).join('') +
      '</tbody></table><p class="note">기준값은 연구 관례이며 절대적이지 않습니다. 연구 분야·표본·목적에 따라 달라질 수 있으니 투고할 학술지와 선행연구의 관행을 함께 확인하세요. 근거 문헌은 [도움말·참고문헌]에 있습니다.</p></details>';
    var anchor = card.querySelector('details:not(.guide)');
    if (anchor) anchor.insertAdjacentHTML('beforebegin', h); else card.insertAdjacentHTML('beforeend', h);
  };

  /* ---------------- 다항 로지스틱 회귀 ---------------- */
  A.mlogit = {
    group: '회귀', title: '다항 로지스틱 회귀',
    desc: '범주가 3개 이상인 종속변수(예: 진단 유형, 프로파일): 기준 범주 대비 B·SE·Wald·오즈비, 모형 χ², 예측변수별 우도비 검정, 의사 R², 분류표. 문자형 예측변수는 자동 더미코딩.',
    form: function () {
      return selectField('y', '종속변수 (범주형)', 'any') + '<div class="field" id="mref" style="display:none"><label for="refv">기준 범주</label><select id="refv"></select></div>' +
        multiField('x', '예측변수', 'any', '문자형 변수는 첫 범주를 기준으로 더미코딩됩니다. 숫자로 코딩된 범주형 예측변수는 [데이터]에서 "문자"로 바꾸세요.');
    },
    wire: function () {
      $('#y').onchange = function () {
        var i = getSel('y'); if (i < 0) { $('#mref').style.display = 'none'; return; }
        $('#refv').innerHTML = levelsOf(i).map(function (l, k) { return '<option value="' + k + '">' + esc(l) + '</option>'; }).join('');
        $('#mref').style.display = '';
      };
    },
    run: function () {
      var y = getSel('y'), x = getMulti('x').filter(function (i) { return i !== y; }); need(y >= 0 && x.length, '종속변수와 예측변수를 선택하세요.');
      var lv = levelsOf(y); need(lv.length >= 2, '종속변수의 범주가 2개 이상이어야 합니다.');
      var dc = designColumns(x), refLv = levelsOf(y)[Number($('#refv').value)];
      var m = S.multinomialLogistic(state.cols[y], dc.cols, dc.names, { ref: refLv }), yn = state.names[y];
      var html = (m.warnings.length ? '<div class="warn">' + m.warnings.map(esc).join('<br>') + '</div>' : '') +
        table(['N', '−2LL', '모형 χ²', 'df', 'p', 'Cox-Snell R²', 'Nagelkerke R²', 'McFadden R²', 'AIC', 'BIC'], [[m.n, f(m.deviance, 3), f(m.chi2, 3), m.dfM, fp(m.p), fr(m.coxSnell), fr(m.nagelkerke), fr(m.mcfadden), f(m.aic, 2), f(m.bic, 2)]],
          { title: '모형 적합 (종속변수: ' + yn + ')' }) +
        (m.lrTests.length ? table(['예측변수', 'χ²', 'df', 'p'], m.lrTests.map(function (t) { return [esc(t.name), f(t.chi2, 3), t.df, fp(t.p)]; }), { left: [0], title: '우도비 검정', note: '각 예측변수를 뺀 모형과 비교한 χ² (더미코딩된 범주형 변수는 더미별로 표시).' }) : '') +
        table([yn + ' (기준: ' + esc(m.levels[m.ref]) + ')', '예측변수', 'B', 'SE', 'Wald χ²', 'p', 'OR', 'OR 95% CI'], m.coefs.map(function (c, i) {
          var first = i === 0 || m.coefs[i - 1].level !== c.level;
          return [first ? esc(c.level) : '', esc(c.name), fb(c.b, 3), fb(c.se, 3), f(c.wald, 3), fp(c.p), f(c.or, 3), '[' + f(c.orLow, 3) + ', ' + f(c.orHigh, 3) + ']'];
        }), { left: [0, 1], title: '회귀계수 (기준 범주 대비)' }) +
        table(['관측 \\ 예측'].concat(m.levels.map(esc)).concat(['정확도']), m.levels.map(function (l, a) {
          var tot = m.confusion[a].reduce(function (s, v) { return s + v; }, 0);
          return [esc(l)].concat(m.confusion[a]).concat([tot ? f(100 * m.confusion[a][a] / tot, 1) + '%' : '—']);
        }).concat([['전체'].concat(m.levels.map(function () { return ''; })).concat([f(100 * m.accuracy, 1) + '%'])]), { left: [0], title: '분류표' }) +
        (dc.notes.length ? '<p class="note">더미코딩 — ' + esc(dc.notes.join('; ')) + '</p>' : '') +
        '<p class="note">N = ' + m.n + ' (목록별 제거). 계수·표준오차·로그우도는 R의 nnet::multinom과 같습니다(bfi 자료로 대조, 오차 < 3e-5). 표준오차는 관측정보행렬로 계산했습니다.</p>' +
        rcode('library(nnet)\ndf$y <- relevel(factor(df$' + rname(yn) + '), ref = "' + refLv + '")\nm <- multinom(y ~ ' + x.map(function (i) { return rname(state.names[i]); }).join(' + ') + ', data = df, Hess = TRUE)\nsummary(m); exp(coef(m))');
      addCard('다항 로지스틱 회귀: ' + yn, html, x.length + '개 예측변수, ' + m.K + '개 범주');
    }
  };

  NS.extraRefs = (NS.extraRefs || []).concat([
    ['Aguinis, H., Beaty, J. C., Boik, R. J., & Pierce, C. A. (2005). Effect size and power in assessing moderating effects of categorical variables using multiple regression: A 30-year review. Journal of Applied Psychology, 90(1), 94–107.', 'https://doi.org/10.1037/0021-9010.90.1.94'],
    ['Cochran, W. G. (1954). Some methods for strengthening the common χ² tests. Biometrics, 10(4), 417–451.', 'https://doi.org/10.2307/3001616'],
    ['Cohen, J. (1988). Statistical power analysis for the behavioral sciences (2nd ed.). Lawrence Erlbaum.', 'https://doi.org/10.4324/9780203771587'],
    ['Cumming, G. (2014). The new statistics: Why and how. Psychological Science, 25(1), 7–29.', 'https://doi.org/10.1177/0956797613504966'],
    ['Field, A. (2018). Discovering statistics using IBM SPSS Statistics (5th ed.). SAGE.', ''],
    ['Hair, J. F., Black, W. C., Babin, B. J., & Anderson, R. E. (2019). Multivariate data analysis (8th ed.). Cengage.', ''],
    ['Janssen, J. H. M., van Laar, S., de Rooij, M. J., Kuha, J., & Bakk, Z. (2019). The detection and modeling of direct effects in latent class analysis. Structural Equation Modeling, 26(2), 280–290.', 'https://doi.org/10.1080/10705511.2018.1541745'],
    ['Kim, H.-Y. (2013). Statistical notes for clinical researchers: Assessing normal distribution (2) using skewness and kurtosis. Restorative Dentistry & Endodontics, 38(1), 52–54.', 'https://doi.org/10.5395/rde.2013.38.1.52'],
    ['Lance, C. E., Butts, M. M., & Michels, L. C. (2006). The sources of four commonly reported cutoff criteria: What did they really say? Organizational Research Methods, 9(2), 202–220.', 'https://doi.org/10.1177/1094428105284919'],
    ['MacCallum, R. C., Browne, M. W., & Sugawara, H. M. (1996). Power analysis and determination of sample size for covariance structure modeling. Psychological Methods, 1(2), 130–149.', 'https://doi.org/10.1037/1082-989X.1.2.130'],
    ["O'Brien, R. M. (2007). A caution regarding rules of thumb for variance inflation factors. Quality & Quantity, 41(5), 673–690.", 'https://doi.org/10.1007/s11135-006-9018-6'],
    ['Nylund-Gibson, K., Grimm, R. P., & Masyn, K. E. (2019). Prediction from latent classes: A demonstration of different approaches to include distal outcomes in mixture models. Structural Equation Modeling, 26(6), 967–985.', 'https://doi.org/10.1080/10705511.2019.1590146'],
    ['Wasserstein, R. L., & Lazar, N. A. (2016). The ASA statement on p-values: Context, process, and purpose. The American Statistician, 70(2), 129–133.', 'https://doi.org/10.1080/00031305.2016.1154108']
  ]);
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
