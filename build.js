// 단일 HTML 파일 빌드: node build.js → dist/PsyStat.html
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var VERSION = '0.5.1';
var src = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };
var html = src('index.template.html')
  .replace('__VERSION__', VERSION)
  .replace('/*__CSS__*/', function () { return src('style.css'); })
  .replace('/*__STATS__*/', function () { return src('stats.js'); })
  .replace('/*__SEM__*/', function () { return src('sem.js'); })
  .replace('/*__APP__*/', function () { return src('app.js'); });
if (/https?:\/\/(?!doi\.org|arxiv\.org|psycnet\.apa\.org|www\.w3\.org|schemas\.openxmlformats\.org|www\.guilford\.com|www\.pearson\.com)/.test(html.replace(/<!--[\s\S]*?-->/g, ''))) {
  console.warn('경고: 허용 목록 밖의 URL 문자열이 포함되어 있습니다.');
}
// 안내 상자에 넣을 해시(스크립트 본문)와 파일 크기: 해시를 먼저 넣고, 크기는 고정 폭으로 채워 자기 자신을 포함해도 맞도록 함
var bodyHash = crypto.createHash('sha256').update(src('stats.js') + src('sem.js') + src('app.js')).digest('hex');
html = html.replace('__SHA__', '(스크립트 본문) ' + bodyHash).replace('__BYTES__', '@@@@@@@@@@');
var bytes = Buffer.byteLength(html); // 자리표시자 10자 = 숫자 10자로 바뀌므로 크기 불변
var num = bytes.toLocaleString('en-US'); while (num.length < 10) num = '\u0020' + num;
html = html.replace('@@@@@@@@@@', num);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
var out = path.join(__dirname, 'dist', 'PsyStat.html');
fs.writeFileSync(out, html);
var sha = crypto.createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat.html.sha256'), sha + '  PsyStat.html\n');
console.log('빌드 완료:', out, (html.length / 1024).toFixed(0) + ' KB', '\nSHA-256:', sha);
