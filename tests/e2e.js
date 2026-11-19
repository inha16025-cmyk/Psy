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
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'PsyStat.html'));
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

  // 실제 데이터(bfi) 붙여넣기 → 네트워크 결과가 qgraph와 같은지 화면 경로로 확인
  const N = ref.network, items = Object.keys(N.data);
  const tsv = [items.join('\t')].concat(N.data[items[0]].map((_, r) => items.map(k => N.data[k][r]).join('\t'))).join('\n');
  await nav('data'); await page.fill('#pastebox', tsv); await page.click('#pasteGo');
  check('붙여넣기 (TSV)', (await page.textContent('#datainfo')).includes(N.n + '행'));
  await nav('network'); await page.click('[data-all="v"]'); await run();
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
  const errCards = await page.locator('#results .card h3', { hasText: '오류' }).count();
  check('오류 카드 없음', errCards === 0);
  await browser.close();
  console.log(fails ? `\n${fails}개 실패` : '\n모든 E2E 테스트 통과');
  process.exit(fails ? 1 : 0);
})();
