/*
 * 76자 줄 나누기 (전송용)
 * 메일 프로그램은 줄이 길거나(대개 76~78자 초과) 비ASCII 문자가 있으면 첨부를 quoted-printable(=XX)로 바꾸는데,
 * 받는 쪽에서 그 복원이 중간에 멈춰 파일이 손상된 사례가 있었다. 모든 줄을 76자 이하·ASCII로 만들면
 * 대부분의 메일 프로그램은 파일을 변환하지 않고(7bit) 그대로 보낸다.
 * 의미가 바뀌지 않는 지점에서만 나눈다.
 *  JS  : 문자열·정규식·주석 밖의 원래 공백, 그리고 ( [ { , 바로 뒤 (토큰 사이 줄바꿈은 의미 불변).
 *        return/throw/break/continue 뒤와 ++/-- 앞은 나누지 않음(자동 세미콜론 삽입 방지).
 *        긴 문자열은 ('앞' + '뒤')로 괄호째 나눔(연산 우선순위 보존). 긴 주석은 주석 안에서 나눔.
 *  CSS : 따옴표 밖의 공백, ; , { 뒤.
 *  HTML: 태그 안(따옴표 밖) 공백, 큰따옴표 속성값 안의 공백·; 뒤(style, CSP 등: 공백류로 취급),
 *        본문 글자 사이에는 빈 주석 <!--(줄바꿈)--> 를 넣어 나눔(화면에 보이지 않음).
 */
'use strict';
var LIM = 76;
var RESTRICTED = /^(return|throw|break|continue)$/;

function lexJsLine(line, inBlock) {
  var u = [], i = 0, n = line.length, prevSig = null, code = '';
  function push(t, k) { if (t) u.push({ t: t, k: k }); }
  function lastSig(s) { var m = /([A-Za-z_$][\w$]*|[^\s])$/.exec(s); return m ? m[1] : null; }
  function flush() { if (code) { push(code, 'code'); prevSig = lastSig(code) || prevSig; code = ''; } }
  if (inBlock) {
    var e = line.indexOf('*/');
    if (e < 0) { push(line, 'bc'); return { u: u, inBlock: true }; }
    push(line.slice(0, e + 2), 'bc'); i = e + 2;
  }
  while (i < n) {
    var c = line[i];
    if (c === ' ' || c === '\t') { flush(); var j = i; while (j < n && (line[j] === ' ' || line[j] === '\t')) j++; push(line.slice(i, j), 'sp'); i = j; continue; }
    if (c === '/' && line[i + 1] === '/') { flush(); push(line.slice(i), 'lc'); return { u: u, inBlock: false }; }
    if (c === '/' && line[i + 1] === '*') {
      flush(); var e2 = line.indexOf('*/', i + 2);
      if (e2 < 0) { push(line.slice(i), 'bc'); return { u: u, inBlock: true }; }
      push(line.slice(i, e2 + 2), 'bc'); i = e2 + 2; continue;
    }
    if (c === '"' || c === "'") {
      flush(); var k = i + 1;
      while (k < n && line[k] !== c) { if (line[k] === '\\') k++; k++; }
      push(line.slice(i, k + 1), 'str'); prevSig = 'str'; i = k + 1; continue;
    }
    if (c === '/') {
      var pv = code ? lastSig(code) : prevSig;
      var isRe = pv === null || /^[(\[{,;:=!&|?+\-*%<>~^]$/.test(pv) || /^(return|typeof|case|do|else|in|new|delete|void|throw)$/.test(pv);
      if (isRe) {
        flush(); var r = i + 1, cls = false;
        while (r < n) { var d = line[r]; if (d === '\\') { r += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; r++; }
        r++; while (r < n && /[a-z]/.test(line[r])) r++;
        push(line.slice(i, r), 're'); prevSig = 're'; i = r; continue;
      }
    }
    code += c; i++;
  }
  flush();
  return { u: u, inBlock: false };
}

// 이스케이프 단위(\uXXXX, \xXX, \.)를 쪼개지 않고 width 이하로 자름
function escUnits(body) {
  var out = [], i = 0;
  while (i < body.length) {
    var tok = body[i];
    if (tok === '\\') tok = /^\\(u[0-9A-Fa-f]{4}|x[0-9A-Fa-f]{2}|[\s\S])/.exec(body.slice(i))[0];
    out.push(tok); i += tok.length;
  }
  return out;
}
function chunkUnits(units, width) {
  var parts = [], cur = '';
  units.forEach(function (t) { if (cur && cur.length + t.length > width) { parts.push(cur); cur = ''; } cur += t; });
  parts.push(cur);
  return parts;
}
// 주석 안의 긴 단어를 자름: 닫는 */ 와 여는 /* 를 가르지 않음
function hardSplit(word, width) {
  if (word.length <= width) return [word];
  var parts = [], i = 0;
  while (i < word.length) {
    var e = Math.min(word.length, i + width);
    if (e < word.length && ((word[e - 1] === '*' && word[e] === '/') || (word[e - 1] === '/' && word[e] === '*'))) e--;
    parts.push(word.slice(i, e)); i = e;
  }
  return parts;
}

function wrapJsLine(raw, startInBlock, lx) {
  var indent = startInBlock ? '' : /^[ \t]*/.exec(raw)[0];
  var cont = (indent.length > 40 ? indent.slice(0, 40) : indent) + '  ';
  var avail = LIM - cont.length;
  var units = lx.u.slice();
  if (!startInBlock && units.length && units[0].k === 'sp') units.shift();
  var toks = [], pendSp = false, pendBr = false, lastWord = null, tail = null;
  var kind = null;
  function add(t, sp, br) { toks.push({ t: t, sp: sp, br: br, kind: kind }); }
  units.forEach(function (un, idx) {
    if (un.k === 'sp') {
      var nxt = units[idx + 1];
      pendSp = true;
      pendBr = !RESTRICTED.test(lastWord || '') && !(nxt && /^(\+\+|--)/.test(nxt.t));
      return;
    }
    var sp = pendSp, br = pendBr && toks.length > 0; pendSp = pendBr = false; kind = un.k;
    if (un.k === 'code') {
      // ( [ { , 바로 뒤에서 나눌 수 있음
      var parts = un.t.split(/(?<=[(\[{,])/);
      parts.forEach(function (p, pi) { add(p, pi === 0 ? sp : false, pi === 0 ? br : true); });
      var m = /([A-Za-z_$][\w$]*)$/.exec(un.t); lastWord = m ? m[1] : null;
    } else if (un.k === 'str') {
      var nextSig = null;
      for (var q = idx + 1; q < units.length; q++) if (units[q].k !== 'sp') { nextSig = units[q]; break; }
      var isKey = nextSig && nextSig.k === 'code' && nextSig.t[0] === ':' && toks.length && /[{,]$/.test(toks[toks.length - 1].t);
      if (un.t.length > avail - 10 && !isKey) {
        var ch = chunkUnits(escUnits(un.t.slice(1, -1)), Math.max(10, avail - 12)), Q = un.t[0];
        add('(' + Q + ch[0] + Q, sp, br);
        for (var s = 1; s < ch.length; s++) add('+ ' + Q + ch[s] + Q + (s === ch.length - 1 ? ')' : ''), true, true);
        if (ch.length === 1) toks[toks.length - 1].t += ')';
      } else add(un.t, sp, br);
      lastWord = null;
    } else if (un.k === 're') { add(un.t, sp, br); lastWord = null; }
    else if (un.k === 'bc') {
      var inner = !RESTRICTED.test(lastWord || '');  // return /* … */ x 처럼 주석 안 줄바꿈이 ASI를 부르는 경우 방지
      un.t.split(' ').forEach(function (w, wi) {
        hardSplit(w, avail - 2).forEach(function (h, hi) { add(h, wi === 0 && hi === 0 ? sp : hi === 0, wi === 0 && hi === 0 ? br : inner); });
      });
    } else if (un.k === 'lc') { tail = un.t; }
  });
  // ( [ { , 로 끝나는 토큰 뒤는 언제나 나눌 수 있음
  toks.forEach(function (tk, k) { if (k > 0 && !tk.br && /[(\[{,]$/.test(toks[k - 1].t) && toks[k - 1].kind !== 'bc') tk.br = true; });
  // 나눌 수 없는 연속 토큰의 길이(앞을 내다보기)
  var grp = new Array(toks.length);
  for (var g = toks.length - 1; g >= 0; g--) grp[g] = toks[g].t.length + (toks[g].sp ? 1 : 0) + (g + 1 < toks.length && !toks[g + 1].br ? grp[g + 1] : 0);
  var lines = [], cur = indent, first = true;
  toks.forEach(function (tk, k) {
    var piece = (tk.sp && !first ? ' ' : '') + tk.t;
    if (first) { cur += tk.t; first = false; return; }
    if (tk.br && cur.length + grp[k] > LIM && cur.trim()) { lines.push(cur); cur = cont + tk.t; }
    else cur += piece;
  });
  if (tail) {
    if (!first && (cur + ' ' + tail).length <= LIM) cur += ' ' + tail;
    else {
      if (!first) lines.push(cur);
      var words = tail.slice(2).trim().split(' '), w = [], pre = first ? indent : cont;
      words.forEach(function (x) { w = w.concat(hardSplit(x, LIM - pre.length - 3)); });
      cur = pre + '//';
      w.forEach(function (x) { if ((cur + ' ' + x).length > LIM && cur !== pre + '//') { lines.push(cur); cur = pre + '//'; } cur += ' ' + x; });
    }
  }
  lines.push(cur);
  return lines.join('\n');
}

function wrapJs(text) {
  var inBlock = false;
  return text.split('\n').map(function (line) {
    var sib = inBlock, lx = lexJsLine(line, inBlock); inBlock = lx.inBlock;
    return line.length <= LIM ? line : wrapJsLine(line, sib, lx);
  }).join('\n');
}

// segs: [{t, sep}] sep = 'sp'(원래 공백) | 'cm'(빈 주석으로 나눔: HTML 본문) | 'gl'(공백 없이 나눌 수 있음) | null(첫 조각)
function fillSegs(segs, indent, cont) {
  var lines = [], cur = '';
  segs.forEach(function (s, k) {
    if (k === 0) { cur = s.t; return; }
    var join = s.sep === 'sp' ? ' ' : '';
    if ((cur + join + s.t).length > LIM - (s.sep === 'cm' ? 4 : 0)) {
      if (s.sep === 'cm') { lines.push(cur + '<!--'); cur = cont + '-->' + s.t; }
      else { lines.push(cur); cur = cont + s.t; }
    } else cur += join + s.t;
  });
  lines.push(cur);
  return lines.join('\n');
}

function wrapCss(text) {
  return text.split('\n').map(function (line) {
    if (line.length <= LIM) return line;
    var indent = /^\s*/.exec(line)[0], cont = (indent.length > 40 ? indent.slice(0, 40) : indent) + '  ';
    var segs = [], cur = indent, q = null, sep = null;
    for (var i = indent.length; i < line.length; i++) {
      var c = line[i];
      if (q) { cur += c; if (c === '\\') { cur += line[++i]; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === ' ') { if (cur.trim()) { segs.push({ t: cur, sep: sep }); cur = ''; sep = 'sp'; } continue; }
      cur += c;
      if (c === ';' || c === ',' || c === '{') { segs.push({ t: cur, sep: sep }); cur = ''; sep = 'gl'; }
    }
    if (cur) segs.push({ t: cur, sep: sep });
    return fillSegs(segs, indent, cont);
  }).join('\n');
}

function wrapHtml(text) {
  // 줄 단위가 아니라 문서 단위로 상태(태그 안/밖, 따옴표)를 추적
  var inTag = false, q = null;
  return text.split('\n').map(function (line) {
    var long = line.length > LIM;
    var indent = /^\s*/.exec(line)[0], cont = (indent.length > 40 ? indent.slice(0, 40) : indent) + '  ';
    var segs = [], cur = '', sep = null, i = 0;
    function cut(nsep) { if (cur) { segs.push({ t: cur, sep: sep }); cur = ''; sep = nsep; } }
    if (!inTag && !q) { cur = indent; i = indent.length; }
    for (; i < line.length; i++) {
      var c = line[i];
      if (inTag) {
        if (q) {
          if (c === q) { q = null; cur += c; continue; }
          if (q === '"' && c === ' ') { cut('sp'); continue; }
          cur += c;
          if (q === '"' && c === ';') cut('gl');
          continue;
        }
        if (c === '"' || c === "'") { q = c; cur += c; continue; }
        if (c === ' ') { if (cur.trim()) cut('sp'); continue; }
        cur += c;
        if (c === '>') { inTag = false; cut('cm'); }
        continue;
      }
      if (c === '<') { if (line.slice(i, i + 4) === '<!--') { cur += c; continue; } cut('cm'); inTag = true; cur += c; continue; }
      if (c === ' ') { if (cur.trim()) cut('sp'); continue; }
      if (c === '&') { var m = /^&#?[0-9A-Za-z]+;/.exec(line.slice(i)); if (m) { if (cur.length >= 8) cut('cm'); cur += m[0]; i += m[0].length - 1; continue; } }
      if (cur.length >= 30) cut('cm');
      cur += c;
    }
    if (cur) segs.push({ t: cur, sep: sep });
    return long ? fillSegs(segs, indent, cont) : line;
  }).join('\n');
}

module.exports = { wrapJs: wrapJs, wrapCss: wrapCss, wrapHtml: wrapHtml, LIM: LIM };
