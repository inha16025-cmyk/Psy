// 더미코딩 기준 범주 지정 E2E: node tests/e2e_ref.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + (process.env.PSY_HTML || require('path').join(__dirname, '..', 'dist', 'PsyStat.html')));
  await page.click('#exBtn');
  const sel = async (id, label) => { await page.selectOption('#' + id, { label }); await page.dispatchEvent('#' + id, 'change'); };
  const pick = async (id, names) => { for (const n of names) await page.locator(`#${id} label`, { hasText: n }).first().locator('input').check(); };
  const coefs = async () => {
    const card = page.locator('#results .card').first(); const txt = await card.innerText(), all = await card.textContent();
    const o = {}; txt.split('\n').forEach(l => { const m = /^(집단\[[^\]]+\]|우울1)\t(\S+)/.exec(l); if (m) o[m[1]] = Number(m[2].replace('−', '-')); });
    return { o, note: (/더미코딩 — [^\n]*/.exec(txt) || [''])[0], r: (/relevel[^\n]*/.exec(all) || ['(relevel 없음)'])[0] };
  };
  const runLogit = async () => { await page.click('nav.side a[data-id="logit"]'); await sel('y', '치료반응'); await pick('x', ['우울1', '집단']); await page.click('#runBtn'); await page.waitForTimeout(300); return coefs(); };
  const a = await runLogit(); console.log('기본  ', JSON.stringify(a.o), '|', a.note, '|', a.r);
  // 데이터 화면에서 집단의 기준 범주를 '통제'로
  await page.click('nav.side a[data-id="data"]');
  const gi = await page.evaluate(() => window.__PsyAppNS.state.names.indexOf('집단'));
  const opts = await page.locator(`select[data-ref="${gi}"] option`).allInnerTexts(); console.log('기준 선택지:', opts.join(', '));
  await page.selectOption(`select[data-ref="${gi}"]`, { label: '통제' });
  const c = await runLogit(); console.log('통제  ', JSON.stringify(c.o), '|', c.note, '|', c.r);
  // 대수적 관계 확인: 기준을 바꾸면 B[치료A] = −B_old[통제], B[치료B] = B_old[치료B] − B_old[통제], 우울1은 그대로
  const T = a.o['집단[통제]'], B = a.o['집단[치료B]'];
  const ok = Math.abs(c.o['집단[치료A]'] + T) < 0.0015 && Math.abs(c.o['집단[치료B]'] - (B - T)) < 0.0015 && c.o['우울1'] === a.o['우울1'];
  console.log('대수 관계 일치:', ok);
  // 선형회귀에도 같은 설정이 적용되는지
  await page.click('nav.side a[data-id="lm"]'); await sel('y', '우울2'); await pick('x', ['집단']); await page.click('#runBtn'); await page.waitForTimeout(300);
  console.log('선형회귀:', (await coefs()).note);
  // 형식을 숫자→문자로 바꾸면 선택 칸이 생기는지 (성별)
  await page.click('nav.side a[data-id="data"]');
  console.log('errors', errs.length, errs.slice(0, 2)); await b.close();
})();
