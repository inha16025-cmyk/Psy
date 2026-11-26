// 오즈비 숲 그림 E2E: node tests/e2e_forest.js  (그림은 SHOT_DIR 또는 dist/screens 에 저장)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const outDir = process.env.SHOT_DIR || path.join(__dirname, '..', 'dist', 'screens');
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + (process.env.PSY_HTML || path.join(__dirname, '..', 'dist', 'PsyStat.html')));
  await page.click('#exBtn');
  let fails = 0; const check = (n, c, x) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : '')); if (!c) fails++; };
  const sel = async (id, label) => { await page.selectOption('#' + id, { label }); await page.dispatchEvent('#' + id, 'change'); };
  const pick = async (id, names) => { for (const n of names) await page.locator(`#${id} label`, { hasText: n }).first().locator('input').check(); };

  // 이분형 로지스틱: 연속(우울1, 사회적지지) + 범주(집단)
  await page.click('nav.side a[data-id="logit"]'); await sel('y', '치료반응'); await pick('x', ['우울1', '사회적지지', '집단']);
  await page.click('#runBtn'); await page.waitForTimeout(300);
  const card = page.locator('#results .card').first();
  const svg = card.locator('.or-plot svg');
  check('로지스틱 숲 그림 생성', await svg.count() === 1);
  const txt = (await svg.textContent());
  check('기준 범주 행 표시', txt.includes('(기준)') && txt.includes('1 (기준)'));
  // 그림 속 OR 글자가 표의 OR과 같은지 (집단[치료B])
  const tableTxt = await card.locator('table').nth(1).innerText();
  const row = tableTxt.split('\n').find(l => l.startsWith('집단[치료B]')).split('\t');
  const orTab = Number(row[5]);
  check('그림 OR = 표 OR (집단[치료B])', txt.includes(orTab.toFixed(2)), 'OR=' + orTab);
  await card.locator('.or-plot-box').screenshot({ path: path.join(outDir, 'forest_logit.png') });
  // 연속 예측변수 숨기기
  await card.locator('[data-act=cont]').uncheck(); await page.waitForTimeout(100);
  const txt2 = await card.locator('.or-plot svg').textContent();
  check('연속 예측변수 숨기기', !txt2.includes('우울1 (1단위)') && txt2.includes('치료B'));
  await card.locator('.or-plot-box').screenshot({ path: path.join(outDir, 'forest_logit_cat.png') });

  // 다항 로지스틱: 패널이 (범주 수 − 1)개
  await page.click('nav.side a[data-id="mlogit"]'); await sel('y', '집단'); await page.selectOption('#refv', { label: '통제' }); await pick('x', ['우울1', '성별']);
  await page.click('#runBtn'); await page.waitForTimeout(300);
  const c2 = page.locator('#results .card').first(), t3 = await c2.locator('.or-plot svg').textContent();
  check('다항 로지스틱 숲 그림 패널', t3.includes('치료A vs 통제(기준)') && t3.includes('치료B vs 통제(기준)'));
  await c2.locator('.or-plot-box').screenshot({ path: path.join(outDir, 'forest_mlogit.png') });

  // 저장 버튼 (SVG) 동작
  const [dl] = await Promise.all([page.waitForEvent('download'), c2.locator('[data-act=svg]').click()]);
  check('SVG 저장', /multinomial_OR\.svg$/.test(dl.suggestedFilename()));
  check('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(fails ? fails + '개 실패' : '숲 그림 테스트 통과');
  await b.close(); process.exit(fails ? 1 : 0);
})();
