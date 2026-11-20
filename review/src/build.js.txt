// 빌드: node build.js
//  1) dist/PsyStat.html                     — 단일 파일판 (모든 코드 포함)
//  2) dist/split/PsyStat.html + PsyStat-engine.js — 분할판 (자료 전송 크기 제한 대응; 두 파일을 같은 폴더에 둠)
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var VERSION = '0.5.2';
var ENGINE = 'PsyStat-engine.js';
var src = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };
var sha256 = function (s) { return crypto.createHash('sha256').update(s).digest('hex'); };
var bodyHash = sha256(src('stats.js') + src('sem.js') + src('app.js'));

function fill(html, sizeNote) {
  html = html.replace('__SHA__', '(스크립트 본문) ' + bodyHash).replace('__SIZENOTE__', sizeNote || '').replace('__BYTES__', '@@@@@@@@@@');
  var num = Buffer.byteLength(html).toLocaleString('en-US'); // 자리표시자 10자 = 숫자 10자 → 크기 불변
  while (num.length < 10) num = ' ' + num;
  return html.replace('@@@@@@@@@@', num);
}
function checkUrls(html) {
  if (/https?:\/\/(?!doi\.org|arxiv\.org|psycnet\.apa\.org|www\.w3\.org|schemas\.openxmlformats\.org|www\.guilford\.com|www\.pearson\.com)/.test(html)) console.warn('경고: 허용 목록 밖의 URL 문자열이 포함되어 있습니다.');
}
var base = src('index.template.html').replace('__VERSION__', VERSION).replace('/*__CSS__*/', function () { return src('style.css'); });

// 1) 단일 파일판
var single = fill(base
  .replace('/*__STATS__*/', function () { return src('stats.js'); })
  .replace('/*__SEM__*/', function () { return src('sem.js'); })
  .replace('/*__APP__*/', function () { return src('app.js'); }), '');
checkUrls(single);
fs.mkdirSync(path.join(__dirname, 'dist', 'split'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat.html'), single);

// 2) 분할판: 엔진(stats.js + sem.js)은 별도 파일, CSP는 같은 폴더의 로컬 스크립트만 추가 허용('self'). 외부 통신은 여전히 차단.
var engine = '/* PsyStat ' + VERSION + ' 계산 엔진 — PsyStat.html과 같은 폴더에 두세요 */\n' + src('stats.js') + '\n' + src('sem.js');
var splitHtml = base
  .replace("script-src 'unsafe-inline';", "script-src 'unsafe-inline' 'self';")
  .replace('<script>/*__STATS__*/</script>\n<script>/*__SEM__*/</script>',
    '<script src="' + ENGINE + '"></script>\n<script>if (!window.PsyStats || !window.PsySEM) { var b = document.getElementById(\'jsfail\'); b.style.display = \'\'; ' +
    'b.firstElementChild.textContent = \'계산 엔진 파일(' + ENGINE + ')을 찾지 못했습니다. PsyStat.html과 같은 폴더에 두었는지, 파일이 잘리지 않았는지(크기 ' +
    Buffer.byteLength(engine).toLocaleString('en-US') + '바이트) 확인하세요.\'; window.__psyEngineMissing = true; }</script>')
  .replace('/*__APP__*/', function () { return src('app.js'); });
if (splitHtml.indexOf(ENGINE) < 0) throw new Error('분할판 생성 실패: 템플릿 자리표시자를 찾지 못함');
splitHtml = fill(splitHtml, ' (분할판: ' + ENGINE + ' ' + Buffer.byteLength(engine).toLocaleString('en-US') + '바이트도 같은 폴더에 있어야 함)');
checkUrls(splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', 'PsyStat.html'), splitHtml);
fs.writeFileSync(path.join(__dirname, 'dist', 'split', ENGINE), engine);

var sums = [['PsyStat.html', single], ['split/PsyStat.html', splitHtml], ['split/' + ENGINE, engine]]
  .map(function (x) { return sha256(x[1]) + '  ' + x[0]; }).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'dist', 'SHA256SUMS.txt'), sums);
[['단일 파일판 dist/PsyStat.html', single], ['분할판 dist/split/PsyStat.html', splitHtml], ['분할판 dist/split/' + ENGINE, engine]].forEach(function (x) {
  console.log('빌드 완료:', x[0], Buffer.byteLength(x[1]).toLocaleString('en-US') + ' 바이트');
});
console.log('SHA-256:\n' + sums);
