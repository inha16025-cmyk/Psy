// 범주별 오즈비 추세 그림 + 선형 추세 검정 E2E: node tests/e2e_trend.js
// 가상 자료(연령대 20대~50대, 우울, 반응)를 만들어 화면 결과를 R glm 결과(tests/reference_trend.json)와 대조한다.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
function makeData() {
  let s = 11; const r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ages = ['20대', '30대', '40대', '50대'], rows = [['연령대', '우울', '반응']];
  for (let i = 0; i < 400; i++) {
    const k = Math.floor(r() * 4), d = 1 + r() * 4, eta = -1.6 + 0.35 * k + 0.25 * d;
    rows.push([ages[k], d.toFixed(2), r() < 1 / (1 + Math.exp(-eta)) ? '예' : '아니오']);
  }
  return rows.map(x => x.join(',')).join('\n');
}
module.exports = { makeData };
if (require.main === module) (async () => {
  const outDir = process.env.SHOT_DIR || path.join(__dirname, '..', 'dist', 'screens');
  const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference_trend.json'), 'utf8'));
  const b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + (process.env.PSY_HTML || path.join(__dirname, '..', 'dist', 'PsyStat.html')));
  await page.evaluate(t => { const N = window.__PsyAppNS; N.setData(N.parseDelimited(t), 'trend'); }, makeData());
  let fails = 0; const check = (n, c, x) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : '')); if (!c) fails++; };
  const sel = async (id, label) => { await page.selectOption('#' + id, { label }); await page.dispatchEvent('#' + id, 'change'); };
  const pick = async (id, names) => { for (const n of names) await page.locator(`#${id} label`, { hasText: n }).first().locator('input').check(); };
  await page.click('nav.side a[data-id="logit"]'); await sel('y', '반응'); await page.selectOption('#evv', { label: '예' }); await pick('x', ['연령대', '우울']);
  await page.click('#runBtn'); await page.waitForTimeout(300);
  const card = page.locator('#results .card').first();
  check('추세 그림 생성', await card.locator('.trend-plot svg').count() === 1);
  check('x축 순서 기본값', (await card.locator('[data-act=order]').inputValue()) === '20대, 30대, 40대, 50대');
  // 표의 OR이 R과 같은지 (더미 모형)
  const tab = await card.locator('table').nth(1).innerText();
  ['30대', '40대', '50대'].forEach(l => {
    const row = tab.split('\n').find(x => x.startsWith('연령대[' + l + ']')).split('\t');
    check('더미 OR ' + l + ' = R', Math.abs(Number(row[5]) - ref.dummyOR[l]) < 0.0015, row[5] + ' vs ' + ref.dummyOR[l].toFixed(4));
  });
  // 선형 추세 검정이 R과 같은지
  const tt = await card.locator('.trend-test').innerText();
  const m = /OR = ([\d.]+) \[([\d.]+), ([\d.]+)\], B = ([−\d.]+)/.exec(tt);
  check('추세 OR = R', m && Math.abs(Number(m[1]) - ref.trend.or) < 0.006, m ? m[1] + ' vs ' + ref.trend.or.toFixed(4) : tt.slice(0, 80));
  check('추세 B = R', m && Math.abs(Number(m[4].replace('−', '-')) - ref.trend.b) < 0.0006, m ? m[4] + ' vs ' + ref.trend.b.toFixed(4) : '');
  const pm = /p (= |< )([.\d]+)/.exec(tt);
  check('추세 p = R', pm && (pm[1] === '< ' ? ref.trend.p < 0.001 : Math.abs(Number(pm[2]) - ref.trend.p) < 0.0006), pm ? pm[0] + ' vs ' + ref.trend.p : '');
  await card.locator('.trend-box').screenshot({ path: path.join(outDir, 'trend_logit.png') });
  // 순서 바꾸기 → 추세 점수도 바뀜 (50대, 40대, 30대, 20대면 B 부호가 반대)
  await card.locator('[data-act=order]').fill('50대, 40대, 30대, 20대'); await card.locator('[data-act=order]').dispatchEvent('change'); await page.waitForTimeout(150);
  const tt2 = await card.locator('.trend-test').innerText(), m2 = /B = ([−\d.]+)/.exec(tt2);
  check('순서를 뒤집으면 추세 B 부호 반대', m2 && Math.abs(Number(m2[1].replace('−', '-')) + ref.trend.b) < 0.0006, m2 && m2[1]);
  // 잘못된 순서 입력 → 안내
  await card.locator('[data-act=order]').fill('20대, 30대'); await card.locator('[data-act=order]').dispatchEvent('change'); await page.waitForTimeout(150);
  check('범주 누락 안내', (await card.locator('.trend-plot .warn').count()) === 1);
  // 선형 y축
  await card.locator('[data-act=order]').fill('20대, 30대, 40대, 50대'); await card.locator('[data-act=order]').dispatchEvent('change');
  await card.locator('[data-act=log]').uncheck(); await page.waitForTimeout(150);
  check('선형 y축 전환', (await card.locator('.trend-plot svg').textContent()).includes('오즈비') && !(await card.locator('.trend-plot svg').textContent()).includes('로그 척도'));
  // 다항 로지스틱: 여러 선(범례)
  await page.click('nav.side a[data-id="mlogit"]'); await sel('y', '연령대'); await pick('x', ['우울']);
  await page.click('#runBtn'); await page.waitForTimeout(300);
  check('다항: 범주형 예측변수 없으면 추세 그림 없음', await page.locator('#results .card').first().locator('.trend-box').count() === 0);
  check('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(fails ? fails + '개 실패' : '추세 그림 테스트 통과');
  await b.close(); process.exit(fails ? 1 : 0);
})();
