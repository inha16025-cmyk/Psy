// 빌드: node build.js
//  1) dist/PsyStat.html                     — 단일 파일판, 전송용 7비트 ASCII (한글은 이스케이프)
//     dist/PsyStat-readable.html            — 같은 내용의 원문(한글 그대로), 검토용
//  2) dist/split/PsyStat.html + PsyStat-engine.js — 분할판 (자료 전송 크기 제한 대응; 두 파일을 같은 폴더에 둠)
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var VERSION = '0.9.6';
var ENGINE = 'PsyStat-engine.js';
var src = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };
// 조각 파일 (각 60KB 이하): 메일 등 전송 시스템이 큰 <script> 블록을 손상시키는 문제 대응
var STATS_PARTS = ['stats/stats-1.js', 'stats/stats-2.js', 'stats/stats-3.js', 'stats/stats-4.js'];
var APP_PARTS = ['app/app-1.js', 'app/app-2.js', 'app/app-3.js', 'app/app-4.js', 'app/app-5.js', 'app/app-6.js', 'app/app-7.js', 'app/app-8.js'];
// 0.6.0에서 '큰 블록이 손상된다'는 가설로 60KB 한도를 두었으나, 실제 원인은 quoted-printable 복원 실패로 확인됨(0.9.1).
// 조각 구조는 유지하고, 이스케이프·줄 나누기로 늘어난 전송판 크기를 감안해 한도를 72KB로 둔다(점검용).
var MAX_BLOCK = 72 * 1024;
var tags = function (parts) { return parts.map(function (p) { return '<script>' + src(p) + '</script>'; }).join('\n'); };
var allSrc = function (parts) { return parts.map(src).join('\n'); };
var sha256 = function (s) { return crypto.createHash('sha256').update(s).digest('hex'); };
var bodyHash = sha256(allSrc(STATS_PARTS) + src('sem.js') + allSrc(APP_PARTS));

/*
 * ASCII 전용 변환 (전송용): 메일 프로그램은 한글이 섞인 텍스트 첨부를 quoted-printable(=EB=84=A4 …)로 바꾸는데,
 * 받는 쪽에서 복원이 중간에 멈춰 파일이 손상되는 사례가 있었다. 한글 등 비ASCII 문자를 문맥에 맞는 이스케이프로 바꿔
 * 파일 전체를 7비트 ASCII로 만든다. 브라우저가 실행 시 같은 문자로 되돌리므로 화면·기능은 같다.
 *   <script> 안: \uXXXX   <style> 안: \XXXX (뒤에 공백)   그 밖의 HTML: &#xXXXX;
 */
function hex4(c) { return ('000' + c.toString(16).toUpperCase()).slice(-4); }
function jsEsc(t) { return t.replace(/[^\x00-\x7f]/g, function (ch) { return '\\u' + hex4(ch.charCodeAt(0)); }); }
function cssEsc(t) { return t.replace(/[^\x00-\x7f]/g, function (ch) { return '\\' + ch.charCodeAt(0).toString(16).toUpperCase() + ' '; }); }
function htmlEsc(t) { return t.replace(/[^\x00-\x7f]/g, function (ch) { return '&#x' + ch.charCodeAt(0).toString(16).toUpperCase() + ';'; }); }
/*
 * 긴 줄 나누기 (tools/wrap76.js): 메일 프로그램은 줄이 길면(대개 76–78자 초과) 파일을 quoted-printable 등으로 변환하므로,
 * 의미가 바뀌지 않는 지점에서만 줄을 나눈다.
 *  - JS: 문자열·정규식·주석 밖의 ", " 뒤 또는 " + " 앞 (토큰 사이 줄바꿈은 의미 불변)
 *  - HTML 텍스트: 태그 밖의 공백
 */
var W76 = require('./tools/wrap76.js'), wrapJs = W76.wrapJs, wrapHtml = W76.wrapHtml, wrapCss = W76.wrapCss;
function assertLines(name, text) {
  var bad = []; text.split('\n').forEach(function (l, k) { if (Buffer.byteLength(l) > W76.LIM) bad.push((k + 1) + '행 ' + Buffer.byteLength(l) + '자: ' + l.slice(0, 100)); });
  if (bad.length) throw new Error(name + ': ' + W76.LIM + '자 초과 ' + bad.length + '줄\n' + bad.slice(0, 30).join('\n'));
}
function asciiSafe(html) {
  var out = '', i = 0, re = /<(script|style)\b[^>]*>/gi, m;
  while ((m = re.exec(html))) {
    var tag = m[1].toLowerCase(), endTag = '</' + tag + '>', j = html.indexOf(endTag, re.lastIndex);
    if (j < 0) throw new Error('닫는 태그를 찾지 못함: ' + tag);
    var body = html.slice(re.lastIndex, j); if (body.length && body[0] !== '\n') body = '\n' + body; // 여는 태그 뒤에서 줄을 바꿔 첫 줄 길이 확보
    var wb = tag === 'script' ? wrapJs(jsEsc(body)) : wrapCss(cssEsc(body));
    if ((wb.slice(wb.lastIndexOf('\n') + 1) + endTag).length > W76.LIM) wb += '\n';
    out += wrapHtml(htmlEsc(html.slice(i, m.index))) + m[0] + wb + endTag;
    i = j + endTag.length; re.lastIndex = i;
  }
  return out + wrapHtml(htmlEsc(html.slice(i)));
}
function assertAscii(name, text) { var m = /[^\x00-\x7f]/.exec(text); if (m) throw new Error(name + ': 비ASCII 문자가 남음 (위치 ' + m.index + ')'); }

function fill(html, sizeNote, ascii) {
  html = html.replace('__SHA__', '(스크립트 본문) ' + bodyHash).replace('__SIZENOTE__', sizeNote || '').replace('__BYTES__', '@@@@@@@@@@');
  if (ascii) html = asciiSafe(html);
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
    var t = m[3].replace(/\r\n?/g, '\n');
    // 이름은 이스케이프(\uXXXX)를 되돌린 머리말로 정한다
    var u = t.slice(0, 1200).replace(/\\u([0-9A-Fa-f]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
    var nm = m[1] === 'style' ? '서식(style)' : (/조각 (\d+\/\d+)/.exec(u.slice(0, 300)) ? (/통계 엔진/.test(u.slice(0, 300)) ? '통계 엔진 ' : '화면 코드 ') + /조각 (\d+\/\d+)/.exec(u.slice(0, 300))[1] : /구조방정식 엔진/.test(u.slice(0, 200)) ? '구조방정식 엔진' : '보조 스크립트 ' + (E.length + 1));
    var A = [], Z = [];
    for (var a = 0; (a + 1) * CH <= t.length; a++) A.push(fnv(t.slice(a * CH, (a + 1) * CH)));
    for (var z = 0; (z + 1) * CH <= t.length; z++) Z.push(fnv(t.slice(t.length - (z + 1) * CH, t.length - z * CH)));
    // 꼬리 식별자: 조각마다 같은 마지막 포장 줄을 피해, 끝에서 200~100자 구간을 쓴다
    E.push({ n: nm, L: t.length, f: fnv(t), h: t.slice(0, 160), t: t.length > 400 ? t.slice(-200, -100) : t.slice(-40), te: t.length > 400 ? 100 : 0, A: A, Z: Z });
  }
  E.forEach(function (x, i) { E.forEach(function (y, j) { if (i !== j && (x.h === y.h || x.t === y.t)) throw new Error('자가 점검 식별자가 겹침: ' + x.n + ' / ' + y.n); }); });
  var chunk = function (a) { var r = []; for (var q = 0; q < a.length; q += 5) r.push(a.slice(q, q + 5).map(function (v) { return JSON.stringify(v); }).join(', ')); return '[' + r.join(',\n      ') + ']'; };
  var data = '[\n' + E.map(function (x) { return '    {"n": ' + JSON.stringify(x.n) + ', "L": ' + x.L + ', "f": "' + x.f + '", "te": ' + x.te + ',\n     "h":' + JSON.stringify(x.h) + ',\n     "t":' + JSON.stringify(x.t) + ',\n     "A":' + chunk(x.A) + ',\n     "Z":' + chunk(x.Z) + '}'; }).join(',\n') + '\n  ]';
  data = data.replace(/</g, '\\u003c');
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
var assembled = base
  .replace('<script>/*__STATS__*/</script>', function () { return tags(STATS_PARTS); })
  .replace('/*__SEM__*/', function () { return src('sem.js'); })
  .replace('<script>/*__APP__*/</script>', function () { return tags(APP_PARTS); });
var readable = fill(addChecker(assembled), '');                 // 원문(한글 그대로) — 검토용
var single = fill(addChecker(asciiSafe(assembled)), '', true);   // 전송용 — 7비트 ASCII
assertAscii('단일 파일판', single); assertLines('단일 파일판', single);
checkUrls(single);
fs.mkdirSync(path.join(__dirname, 'dist', 'split'), { recursive: true });
function checkBlocks(name, html) {
  var re = /<(script|style)[^>]*>([\s\S]*?)<\/\1>/g, m, k = 0, max = 0;
  while ((m = re.exec(html))) { var b = Buffer.byteLength(m[2]); k++; max = Math.max(max, b); if (b > MAX_BLOCK) throw new Error(name + ': ' + m[1] + ' 블록 ' + b + '바이트 > 한도 ' + MAX_BLOCK); }
  console.log('  ' + name + ': 블록 ' + k + '개, 가장 큰 블록 ' + max.toLocaleString('en-US') + '바이트 (한도 ' + MAX_BLOCK.toLocaleString('en-US') + ')');
}
checkBlocks('단일 파일판', single);
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat.html'), single);
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat-readable.html'), readable);

// 2) 분할판: 엔진(stats.js + sem.js)은 별도 파일, CSP는 같은 폴더의 로컬 스크립트만 추가 허용('self'). 외부 통신은 여전히 차단.
var engine = jsEsc('/* PsyStat ' + VERSION + ' 계산 엔진 — PsyStat.html과 같은 폴더에 두세요 */\n' + allSrc(STATS_PARTS) + '\n' + src('sem.js'));
engine = wrapJs(engine);
assertAscii('엔진 파일', engine); assertLines('엔진 파일', engine);
var splitHtml = base
  .replace("script-src 'unsafe-inline';", "script-src 'unsafe-inline' 'self';")
  .replace('<script>/*__STATS__*/</script>\n<script>/*__SEM__*/</script>',
    '<script src="' + ENGINE + '"></script>\n<script>if (!window.PsyStats || !window.PsySEM) { var b = document.getElementById(\'jsfail\'); b.style.display = \'\'; ' +
    'b.firstElementChild.textContent = \'계산 엔진 파일(' + ENGINE + ')을 찾지 못했습니다. PsyStat.html과 같은 폴더에 두었는지, 파일이 잘리지 않았는지(크기 ' +
    Buffer.byteLength(engine).toLocaleString('en-US') + '바이트) 확인하세요.\'; window.__psyEngineMissing = true; }</script>')
  .replace('<script>/*__APP__*/</script>', function () { return tags(APP_PARTS); });
splitHtml = asciiSafe(splitHtml);
if (splitHtml.indexOf(ENGINE) < 0) throw new Error('분할판 생성 실패: 템플릿 자리표시자를 찾지 못함');
splitHtml = fill(addChecker(splitHtml), ' (분할판: ' + ENGINE + ' ' + Buffer.byteLength(engine).toLocaleString('en-US') + '바이트도 같은 폴더에 있어야 함)', true);
assertAscii('분할판 HTML', splitHtml); assertLines('분할판 HTML', splitHtml);
checkUrls(splitHtml); checkBlocks('분할판 HTML', splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', 'PsyStat.html'), splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', ENGINE), engine);

var sums = [['PsyStat.html', single], ['PsyStat-readable.html', readable], ['split/PsyStat.html', splitHtml], ['split/' + ENGINE, engine]]
  .map(function (x) { return sha256(x[1]) + '  ' + x[0]; }).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'dist', 'SHA256SUMS.txt'), sums);
[['단일 파일판 (전송용, ASCII) dist/PsyStat.html', single], ['읽기용 원문 dist/PsyStat-readable.html', readable], ['분할판 dist/split/PsyStat.html', splitHtml], ['분할판 dist/split/' + ENGINE, engine]].forEach(function (x) {
  console.log('빌드 완료:', x[0], Buffer.byteLength(x[1]).toLocaleString('en-US') + ' 바이트');
});
console.log('SHA-256:\n' + sums);
