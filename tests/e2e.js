// 브라우저 E2E 테스트: node tests/e2e.js  (Playwright + Chromium 필요)
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ref = require('./reference.json');

(async () => {
  const outDir = process.env.SHOT_DIR || path.join(__dirname, '..', 'dist', 'screens');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await page.goto('file://' + (process.env.PSY_HTML || path.join(__dirname, '..', 'dist', 'PsyStat.html')));
  let fails = 0;
  const check = (name, cond, extra) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? ' ' + extra : '')); if (!cond) fails++; };

  await page.click('#exBtn');
  check('예시 데이터 로드', (await page.textContent('#datainfo')).includes('300행'));
  await page.screenshot({ path: path.join(outDir, '01_data.png') });

  const pick = async (id, names) => { for (const n of names) await page.locator(`#${id} label`, { hasText: n }).first().locator('input').check(); };
  const sel = async (id, label) => { await page.selectOption('#' + id, { label }); await page.dispatchEvent('#' + id, 'change'); };
  const run = async () => { await page.click('#runBtn'); await page.waitForTimeout(300); };
  const lastCard = async () => page.locator('#results .card').first().innerText();
  const nav = async (id) => page.click(`nav.side a[data-id="${id}"]`);

  await nav('desc'); await pick('v', ['우울1', '수면', '스트레스']); await run();
  check('기술통계', (await lastCard()).includes('S-W W'));

  await nav('ttest'); await pick('dv', ['수면']); await sel('g', '성별'); await run();
  check('독립 t', (await lastCard()).includes('Welch'));
  await page.check('input[name=tt][value=pair]'); await sel('p1', '수면'); await sel('p2', '스트레스'); await run();
  check('대응 t', (await lastCard()).includes('대응표본'));

  await nav('anova'); await pick('dv', ['스트레스']); await sel('g', '집단'); await run();
  check('ANOVA', (await lastCard()).includes('Games-Howell'));

  await nav('cor'); await page.click('[data-all="v"]'); await run();
  check('상관', (await lastCard()).includes('Pearson'));

  await nav('chisq'); await sel('r', '집단'); await sel('c', '성별'); await run();
  check('교차분석', (await lastCard()).includes('Cramér'));
  await nav('chisq'); await sel('r', '성별'); await sel('c', '치료반응'); await run();
  check('교차분석 2x2 Fisher', (await lastCard()).includes('Fisher'));

  await nav('lm'); await sel('y', '스트레스'); await pick('x', ['수면', '사회적지지', '집단']); await run();
  const lmTxt = await lastCard();
  check('선형회귀 + 더미', lmTxt.includes('집단[통제]') && lmTxt.includes('VIF'));

  await nav('logit'); await sel('y', '치료반응'); await pick('x', ['우울1', '사회적지지', '집단']); await run();
  const lg = await lastCard();
  check('로지스틱', lg.includes('Nagelkerke') && lg.includes('Hosmer') && lg.includes('AUC'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '03_logistic.png') });

  await nav('alpha'); await pick('v', ['우울1', '우울2', '우울3']); await run();
  check('신뢰도', (await lastCard()).includes('Cronbach'));

  await nav('network');
  await pick('v', ['우울1', '우울2', '우울3', '불안1', '불안2', '불안3', '수면', '스트레스', '사회적지지']);
  await page.fill('#nb', '100'); await page.fill('#nc', '100');
  await run();
  await page.waitForSelector('#results .card .bootbox h4:has-text("결과")', { timeout: 120000 });
  const nt = await lastCard();
  check('네트워크 + 부트스트랩', nt.includes('EBICglasso') && nt.includes('CS 계수'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '02_network.png') });
  await page.screenshot({ path: path.join(outDir, '04_overview.png') });

  // 편상관 네트워크
  await nav('network'); await page.click('[data-all="v"]');
  await page.locator('#v label', { hasText: 'ID' }).locator('input').uncheck();
  await page.selectOption('#est', 'pcor'); await page.dispatchEvent('#est', 'change'); await run();
  check('편상관 네트워크', (await lastCard()).includes('예측력'));

  // 다분상관 (예시 자료의 리커트 문항)
  await nav('cor'); await pick('v', ['우울1', '우울2', '불안1', '수면']); await page.check('input[name=cm][value=auto]'); await run();
  const pc = await lastCard();
  check('다분상관 자동', pc.includes('cor_auto') && pc.includes('다분') && pc.includes('다계열'));

  // 위계적 회귀 (선형 / 로지스틱)
  await nav('hier'); await sel('y', '스트레스'); await pick('b1', ['연령', '성별']); await pick('b2', ['수면', '사회적지지']); await run();
  const hr = await lastCard();
  check('위계적 선형회귀', hr.includes('ΔR²') && hr.includes('단계 2 계수') && hr.includes('성별[여]'));
  await nav('hier'); await page.check('#htype_log'); await page.dispatchEvent('#htype_log', 'change'); await sel('y', '치료반응');
  await pick('b1', ['연령']); await pick('b2', ['우울1', '사회적지지']); await run();
  check('위계적 로지스틱', (await lastCard()).includes('블록 χ²'));

  // 조절
  await nav('moderation'); await sel('y', '스트레스'); await sel('x', '수면'); await sel('w', '사회적지지'); await pick('cv', ['연령']); await run();
  const mo = await lastCard();
  check('조절분석', mo.includes('Johnson-Neyman') && mo.includes('단순기울기'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '05_moderation.png') });

  // 매개 (병렬 2개)
  await nav('mediation'); await sel('y', '스트레스'); await sel('x', '사회적지지'); await pick('m', ['수면', '우울1']); await page.fill('#nb', '1000'); await run();
  const me = await lastCard();
  check('매개분석', me.includes('Boot CI') && me.includes('총 간접효과'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '06_mediation.png') });

  // 조건부 과정 모형
  await nav('process'); await page.selectOption('#pm', '6'); await page.dispatchEvent('#pm', 'change');
  await sel('y', '스트레스'); await sel('x', '사회적지지'); await sel('m1', '우울1'); await sel('m2', '불안1'); await sel('m3', '수면'); await page.fill('#nb', '500'); await run();
  const p6 = await lastCard();
  check('순차 매개 (Model 6, M 3개)', p6.includes('총 간접효과') && p6.includes('우울1 → 불안1 → 수면'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '07_serial.png') });
  await nav('process'); await page.selectOption('#pm', '7'); await page.dispatchEvent('#pm', 'change');
  await sel('y', '스트레스'); await sel('x', '우울1'); await sel('m1', '수면'); await sel('w', '사회적지지'); await page.fill('#nb', '500'); await run();
  const p7 = await lastCard();
  check('조절된 매개 (Model 7)', p7.includes('조절된 매개 지수') && p7.includes('조건부 간접효과'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '08_modmed.png') });
  await nav('process'); await page.selectOption('#pm', '15'); await page.dispatchEvent('#pm', 'change');
  await sel('y', '스트레스'); await sel('x', '우울1'); await sel('m1', '수면'); await sel('m2', '불안2'); await sel('w', '치료반응'); await page.fill('#nb', '300'); await run();
  const p15 = await lastCard();
  check('조절된 매개 (Model 15, 이분 W, 병렬 M)', p15.includes('조건부 직접효과') && p15.includes('두 집단'));

  // MANOVA · 판별분석
  await nav('manova'); await pick('dv', ['수면', '스트레스', '사회적지지']); await sel('g', '집단'); await run();
  const mv = await lastCard();
  check('MANOVA', mv.includes('Pillai') && mv.includes('Box') && mv.includes('후속 단변량'));
  await nav('lda'); await pick('v', ['수면', '스트레스', '사회적지지', '우울1']); await sel('g', '집단'); await run();
  const ld = await lastCard();
  check('판별분석', ld.includes('구조행렬') && ld.includes('교차타당화') && ld.includes('정준상관'));
  const ldHead = await page.evaluate(() => [...document.querySelectorAll('#results .card thead')].map(t => t.innerHTML).join('|'));
  check('집단 이름(치료B)은 기울이지 않음', !ldHead.includes('치료<i>B</i>') && ldHead.includes('<i>df</i>1'));
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '09_lda.png') });

  // APA 표: 번호·제목·주, 기울임, 복사 내용
  const apa = await page.evaluate(() => {
    const card = document.querySelector('#results .card');
    const first = card.querySelector('.apa');
    first.querySelector('.apa-copy').click();
    const c = window.__lastApaCopy || {};
    return { num: first.querySelector('.apa-num').textContent, title: first.querySelector('.apa-title').textContent,
      html: c.html || '', text: c.text || '', italF: !!card.querySelector('thead i') };
  });
  check('APA 표 번호·제목', apa.num === '표 1' && apa.title.length > 3, apa.num + ' / ' + apa.title);
  check('APA 복사 HTML (서식 인라인)', apa.html.includes('border-top:1pt solid') && apa.html.includes('font-style:italic') && apa.html.includes('<i>F</i>'));
  check('APA 복사 텍스트 (엑셀용 탭, 일반 마이너스)', apa.text.includes('\t') && !apa.text.includes('−'));
  check('APA 통계 기호 기울임', apa.italF);
  await nav('desc'); await pick('v', ['수면']); await run();
  const swh = await page.evaluate(() => [...document.querySelector('#results .card thead').querySelectorAll('th')].map(t => t.innerHTML).join('|'));
  check('S-W 의 S·W는 기울이지 않고 W 통계량만 기울임', swh.includes('S-W <i>W</i>') && swh.includes('<i>M</i>') && swh.includes('<i>SD</i>'), swh);
  await nav('cor'); await pick('v', ['수면', '스트레스', '사회적지지']); await run();
  const cn = await page.evaluate(() => document.querySelector('#results .card .apa-note').innerHTML);
  check('상관표 주석 (*p < .05)', cn.includes('<i>p</i> &lt; .05'), cn);

  // 구조방정식: 예시 자료로 잠재 매개 틀 + 부트스트랩
  await nav('sem'); await page.click('#tplMed');
  await page.fill('#syn', 'X =~ 우울1 + 우울2 + 우울3\nM =~ 불안1 + 불안2 + 불안3\nY ~ b*M + c*X\nM ~ a*X\nY =~ 수면 + 스트레스 + 사회적지지\nind := a*b');
  await page.fill('#nb', '200'); await run();
  await page.waitForFunction(() => { const c = document.querySelector('#results .card .bootci'); return c && c.textContent.startsWith('['); }, null, { timeout: 120000 });
  const sm = await lastCard();
  check('SEM 잠재 매개 + 부트스트랩', sm.includes('모형 적합도') && sm.includes('측정모형') && sm.includes('경로계수') && sm.includes('ind') && sm.includes('CR'));
  check('SEM 경로도', await page.locator('#results .card .sem-plot svg ellipse').count() === 3);
  await page.locator('#results .card').first().screenshot({ path: path.join(outDir, '10_sem.png') });

  // 실제 자료(HolzingerSwineford1939) CFA: 화면 χ² = lavaan
  const H = require('./reference5.json').hs;
  const hk = Object.keys(H.data);
  const htsv = [hk.join('\t')].concat(H.data[hk[0]].map((_, r) => hk.map(k => H.data[k][r]).join('\t'))).join('\n');
  await nav('data'); await page.fill('#pastebox', htsv); await page.click('#pasteGo');
  await nav('sem'); await page.fill('#syn', H.cfa.model); await page.check('input[name=est][value=MLR]'); await run();
  const hc = await lastCard();
  const chiML = H.cfa.mlr.fit.chisq.toFixed(2), chiS = H.cfa.mlr.fit['chisq.scaled'].toFixed(2), cfiR = H.cfa.mlr.fit['cfi.robust'].toFixed(3).replace(/^0/, '');
  check('HS CFA 화면값 = lavaan (χ², 척도화 χ², 강건 CFI)', hc.includes(chiML) && hc.includes(chiS) && hc.includes(cfiR), chiML + ' / ' + chiS + ' / ' + cfiR);
  // 문법 오류 메시지
  await nav('sem'); await page.fill('#syn', 'F1 =~ x1 + 없는변수'); await run();
  check('SEM 문법 오류 안내', (await lastCard()).includes('자료에 없습니다'));
  await page.locator('#results .card').first().locator('[data-act=del]').click();

  // 실제 데이터(bfi) 붙여넣기 → 네트워크 결과가 qgraph와 같은지 화면 경로로 확인
  const N = ref.network, items = Object.keys(N.data);
  const tsv = [items.join('\t')].concat(N.data[items[0]].map((_, r) => items.map(k => N.data[k][r]).join('\t'))).join('\n');
  await nav('data'); await page.fill('#pastebox', tsv); await page.click('#pasteGo');
  check('붙여넣기 (TSV)', (await page.textContent('#datainfo')).includes(N.n + '행'));
  await nav('network'); await page.click('[data-all="v"]'); await page.check('input[name=cr][value=pearson]'); await run();
  const w = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#results .card')][0].querySelectorAll('table.res');
    return t[t.length - 1].innerText;
  });
  const sumAbs = N.net.flat().reduce((a, b) => a + Math.abs(b), 0) / 2;
  const nums = w.split('\n').slice(1).map(l => l.split('\t').slice(1)).flat().map(s => Number(s.replace('−', '-').replace(/^(-?)\./, '$10.'))).filter(x => !isNaN(x));
  const got = nums.reduce((a, b) => a + Math.abs(b), 0) / 2;
  check('bfi 네트워크 화면값 = qgraph', Math.abs(got - sumAbs) < 0.01, `(Σ|w| 화면 ${got.toFixed(3)} vs R ${sumAbs.toFixed(3)})`);

  // 파일 열기: xlsx, CP949 CSV
  await page.setInputFiles('#file', path.join(__dirname, 'fixtures', 'sample.xlsx'));
  await page.waitForTimeout(800);
  check('XLSX 읽기', (await page.textContent('#datainfo')).includes('240행'), await page.textContent('#datainfo'));
  await page.setInputFiles('#file', path.join(__dirname, 'fixtures', 'sample_cp949.csv'));
  await page.waitForTimeout(500);
  const info = await page.textContent('#datainfo'), grid = await page.textContent('.datagrid');
  check('CP949 CSV 읽기 (한글)', info.includes('30행') && grid.includes('참가자1') && grid.includes('집단'));

  // 결과 저장 (다운로드)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveBtn')]);
  check('결과 HTML 저장', /PsyStat_.*\.html$/.test(dl.suggestedFilename()), dl.suggestedFilename());

  // 좁은 화면
  await page.setViewportSize({ width: 390, height: 844 });
  await nav('network');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('모바일 폭 가로스크롤 없음', sw <= 392, 'scrollWidth=' + sw);

  check('JS 오류 없음', errors.length === 0, errors.join(' | '));
  check('외부 네트워크 요청 없음', requests.length === 0, requests.join(' '));
  const errCards = await page.locator('#results .card h3', { hasText: '오류' }).count(); // 의도한 문법 오류 카드는 위에서 삭제함
  check('오류 카드 없음', errCards === 0);
  await browser.close();
  console.log(fails ? `\n${fails}개 실패` : '\n모든 E2E 테스트 통과');
  process.exit(fails ? 1 : 0);
})();
