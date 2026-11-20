// 빌드: node build.js
//  1) dist/PsyStat.html                     — 단일 파일판 (모든 코드 포함)
//  2) dist/split/PsyStat.html + PsyStat-engine.js — 분할판 (자료 전송 크기 제한 대응; 두 파일을 같은 폴더에 둠)
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var VERSION = '0.6.1';
var ENGINE = 'PsyStat-engine.js';
var src = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };
// 조각 파일 (각 60KB 이하): 메일 등 전송 시스템이 큰 <script> 블록을 손상시키는 문제 대응
var STATS_PARTS = ['stats/stats-1.js', 'stats/stats-2.js'];
var APP_PARTS = ['app/app-1.js', 'app/app-2.js', 'app/app-3.js', 'app/app-4.js'];
var MAX_BLOCK = 60 * 1024;
var tags = function (parts) { return parts.map(function (p) { return '<script>' + src(p) + '</script>'; }).join('\n'); };
var allSrc = function (parts) { return parts.map(src).join('\n'); };
var sha256 = function (s) { return crypto.createHash('sha256').update(s).digest('hex'); };
var bodyHash = sha256(allSrc(STATS_PARTS) + src('sem.js') + allSrc(APP_PARTS));

function fill(html, sizeNote) {
  html = html.replace('__SHA__', '(스크립트 본문) ' + bodyHash).replace('__SIZENOTE__', sizeNote || '').replace('__BYTES__', '@@@@@@@@@@');
  var num = Buffer.byteLength(html).toLocaleString('en-US'); // 자리표시자 10자 = 숫자 10자 → 크기 불변
  while (num.length < 10) num = ' ' + num;
  return html.replace('@@@@@@@@@@', num);
}
/*
 * 자가 점검 스크립트: 각 블록(<style>, 인라인 <script>)의 길이·전체 지문과
 * 앞/뒤에서 2,000자마다의 지문(FNV-1a)을 넣어 두고, 열 때 실제 내용과 비교해
 * 어느 블록의 어느 구간이 원본과 다른지 화면에 표시한다. 외부 통신 없음.
 */
var CH = 2000;
function fnv(t) { var h = 0x811c9dc5; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
function addChecker(html) {
  var re = /<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, m, E = [];
  while ((m = re.exec(html))) {
    if (m[2] && /src=/.test(m[2])) continue;
    var t = m[3].replace(/\r\n?/g, '\n'), nm = m[1] === 'style' ? '서식(style)' : (/조각 (\d+\/\d+)/.exec(t.slice(0, 300)) ? (/통계 엔진/.test(t.slice(0, 300)) ? '통계 엔진 ' : '화면 코드 ') + /조각 (\d+\/\d+)/.exec(t.slice(0, 300))[1] : /구조방정식 엔진/.test(t.slice(0, 200)) ? '구조방정식 엔진' : '보조 스크립트 ' + (E.length + 1));
    var A = [], Z = [];
    for (var a = 0; (a + 1) * CH <= t.length; a++) A.push(fnv(t.slice(a * CH, (a + 1) * CH)));
    for (var z = 0; (z + 1) * CH <= t.length; z++) Z.push(fnv(t.slice(t.length - (z + 1) * CH, t.length - z * CH)));
    // 꼬리 식별자: 조각마다 같은 마지막 포장 줄을 피해, 끝에서 200~100자 구간을 쓴다
    E.push({ n: nm, L: t.length, f: fnv(t), h: t.slice(0, 40), t: t.length > 400 ? t.slice(-200, -100) : t.slice(-40), te: t.length > 400 ? 100 : 0, A: A, Z: Z });
  }
  E.forEach(function (x, i) { E.forEach(function (y, j) { if (i !== j && (x.h === y.h || x.t === y.t)) throw new Error('자가 점검 식별자가 겹침: ' + x.n + ' / ' + y.n); }); });
  var data = JSON.stringify(E).replace(/</g, '\\u003c');
  var code = '<script>/* PsyStat 자가 점검: 블록이 원본과 같은지 확인 (외부 통신 없음) */\n(function () {\n' +
    '  var E = ' + data + ', CH = ' + CH + ';\n' +
    '  function fnv(t) { var h = 0x811c9dc5; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }\n' +
    '  var me = document.currentScript;\n' +
    '  document.addEventListener(\'DOMContentLoaded\', function () {\n' +
    '  var els = [].slice.call(document.querySelectorAll(\'style, script\')).filter(function (e) { return e !== me && !e.src; });\n' +
    '  var act = els.map(function (e) { return e.textContent.replace(/\\r\\n?/g, \'\\n\'); }), rows = [], bad = 0, used = {};\n' +
    '  E.forEach(function (x) {\n' +
    '    var t = null, i, k = -1;\n' +
    '    for (i = 0; i < act.length && k < 0; i++) if (!used[i] && act[i].slice(0, x.h.length) === x.h) k = i;\n' +
    '    for (i = 0; i < act.length && k < 0; i++) if (!used[i] && act[i].length >= x.t.length + x.te && act[i].slice(act[i].length - x.te - x.t.length, act[i].length - x.te) === x.t) k = i;\n' +
    '    if (k >= 0) { used[k] = true; t = act[k]; }\n' +
    '    if (t === null) { bad++; rows.push(x.n + \': 블록을 찾지 못함 (앞부분과 뒷부분이 모두 원본과 다름 또는 블록 없음), 원본 \' + x.L + \'자\'); return; }\n' +
    '    if (t.length === x.L && fnv(t) === x.f) { rows.push(x.n + \': 정상 (\' + x.L + \'자)\'); return; }\n' +
    '    bad++;\n' +
    '    var a = 0, z = 0;\n' +
    '    while (a < x.A.length && (a + 1) * CH <= t.length && fnv(t.slice(a * CH, (a + 1) * CH)) === x.A[a]) a++;\n' +
    '    while (z < x.Z.length && (z + 1) * CH <= t.length && fnv(t.slice(t.length - (z + 1) * CH, t.length - z * CH)) === x.Z[z]) z++;\n' +
    '    var head = a * CH, tail = z * CH, line = t.slice(0, head).split(\'\\n\').length;\n' +
    '    rows.push(x.n + \': 원본과 다름 — 원본 \' + x.L + \'자, 도착 \' + t.length + \'자 (차이 \' + (t.length - x.L) + \'자). 앞에서 \' + head + \'자, 뒤에서 \' + tail + \'자까지 일치 → 블록의 약 \' + line + \'행부터 달라짐. 그 지점의 도착 내용: "\' + t.slice(head, head + 70).replace(/\\s+/g, \' \') + \'"\');\n' +
    '  });\n' +
    '  if (act.length !== E.length) { bad++; rows.push(\'블록 수: 원본 \' + E.length + \'개, 도착 \' + act.length + \'개\'); }\n' +
    '  window.__psyIntegrity = { bad: bad, rows: rows };\n' +
    '  if (!bad) return;\n' +
    '  var box = document.getElementById(\'jsfail\'), out = document.getElementById(\'jserr\');\n' +
    '  if (!box || !out) return;\n' +
    '  box.style.display = \'\'; out.style.display = \'\';\n' +
    '  box.firstElementChild.textContent = \'파일 점검 결과: 원본과 다른 부분이 있습니다. 아래 내용을 사진으로 보내 주세요.\';\n' +
    '  out.textContent += \'[파일 자가 점검 · v' + VERSION + ']\\n\' + rows.join(\'\\n\') + \'\\n\';\n' +
    '  });\n})();\n</script>';
  // 파일 끝이 잘려도 동작하도록 본문 맨 앞(안내 상자 다음)에 둔다
  if (html.indexOf('<header class="top">') < 0) throw new Error('header 위치를 찾지 못함');
  return html.replace('<header class="top">', code + '\n<header class="top">');
}
function checkUrls(html) {
  if (/https?:\/\/(?!doi\.org|arxiv\.org|psycnet\.apa\.org|www\.w3\.org|schemas\.openxmlformats\.org|www\.guilford\.com|www\.pearson\.com)/.test(html)) console.warn('경고: 허용 목록 밖의 URL 문자열이 포함되어 있습니다.');
}
var base = src('index.template.html').replace('__VERSION__', VERSION).replace('/*__CSS__*/', function () { return src('style.css'); });

// 1) 단일 파일판
var single = fill(addChecker(base
  .replace('<script>/*__STATS__*/</script>', function () { return tags(STATS_PARTS); })
  .replace('/*__SEM__*/', function () { return src('sem.js'); })
  .replace('<script>/*__APP__*/</script>', function () { return tags(APP_PARTS); })), '');
checkUrls(single);
fs.mkdirSync(path.join(__dirname, 'dist', 'split'), { recursive: true });
function checkBlocks(name, html) {
  var re = /<(script|style)[^>]*>([\s\S]*?)<\/\1>/g, m, k = 0, max = 0;
  while ((m = re.exec(html))) { var b = Buffer.byteLength(m[2]); k++; max = Math.max(max, b); if (b > MAX_BLOCK) throw new Error(name + ': ' + m[1] + ' 블록 ' + b + '바이트 > 한도 ' + MAX_BLOCK); }
  console.log('  ' + name + ': 블록 ' + k + '개, 가장 큰 블록 ' + max.toLocaleString('en-US') + '바이트 (한도 ' + MAX_BLOCK.toLocaleString('en-US') + ')');
}
checkBlocks('단일 파일판', single);
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat.html'), single);

// 2) 분할판: 엔진(stats.js + sem.js)은 별도 파일, CSP는 같은 폴더의 로컬 스크립트만 추가 허용('self'). 외부 통신은 여전히 차단.
var engine = '/* PsyStat ' + VERSION + ' 계산 엔진 — PsyStat.html과 같은 폴더에 두세요 */\n' + allSrc(STATS_PARTS) + '\n' + src('sem.js');
var splitHtml = base
  .replace("script-src 'unsafe-inline';", "script-src 'unsafe-inline' 'self';")
  .replace('<script>/*__STATS__*/</script>\n<script>/*__SEM__*/</script>',
    '<script src="' + ENGINE + '"></script>\n<script>if (!window.PsyStats || !window.PsySEM) { var b = document.getElementById(\'jsfail\'); b.style.display = \'\'; ' +
    'b.firstElementChild.textContent = \'계산 엔진 파일(' + ENGINE + ')을 찾지 못했습니다. PsyStat.html과 같은 폴더에 두었는지, 파일이 잘리지 않았는지(크기 ' +
    Buffer.byteLength(engine).toLocaleString('en-US') + '바이트) 확인하세요.\'; window.__psyEngineMissing = true; }</script>')
  .replace('<script>/*__APP__*/</script>', function () { return tags(APP_PARTS); });
if (splitHtml.indexOf(ENGINE) < 0) throw new Error('분할판 생성 실패: 템플릿 자리표시자를 찾지 못함');
splitHtml = fill(addChecker(splitHtml), ' (분할판: ' + ENGINE + ' ' + Buffer.byteLength(engine).toLocaleString('en-US') + '바이트도 같은 폴더에 있어야 함)');
checkUrls(splitHtml); checkBlocks('분할판 HTML', splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', 'PsyStat.html'), splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', ENGINE), engine);

var sums = [['PsyStat.html', single], ['split/PsyStat.html', splitHtml], ['split/' + ENGINE, engine]]
  .map(function (x) { return sha256(x[1]) + '  ' + x[0]; }).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'dist', 'SHA256SUMS.txt'), sums);
[['단일 파일판 dist/PsyStat.html', single], ['분할판 dist/split/PsyStat.html', splitHtml], ['분할판 dist/split/' + ENGINE, engine]].forEach(function (x) {
  console.log('빌드 완료:', x[0], Buffer.byteLength(x[1]).toLocaleString('en-US') + ' 바이트');
});
console.log('SHA-256:\n' + sums);
