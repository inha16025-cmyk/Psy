// 단일 HTML 파일 빌드: node build.js → dist/PsyStat.html
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var VERSION = '0.1.0';
var src = function (f) { return fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'); };
var html = src('index.template.html')
  .replace('__VERSION__', VERSION)
  .replace('/*__CSS__*/', function () { return src('style.css'); })
  .replace('/*__STATS__*/', function () { return src('stats.js'); })
  .replace('/*__APP__*/', function () { return src('app.js'); });
if (/https?:\/\/(?!doi\.org|arxiv\.org|psycnet\.apa\.org|www\.w3\.org|schemas\.openxmlformats\.org)/.test(html.replace(/<!--[\s\S]*?-->/g, ''))) {
  console.warn('경고: 허용 목록 밖의 URL 문자열이 포함되어 있습니다.');
}
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
var out = path.join(__dirname, 'dist', 'PsyStat.html');
fs.writeFileSync(out, html);
var sha = crypto.createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(__dirname, 'dist', 'PsyStat.html.sha256'), sha + '  PsyStat.html\n');
console.log('빌드 완료:', out, (html.length / 1024).toFixed(0) + ' KB', '\nSHA-256:', sha);
