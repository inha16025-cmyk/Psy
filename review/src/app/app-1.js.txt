/* PsyStat 화면(UI) 코드 — 조각 1/6: 공통 도우미·자료 읽기·APA 표·결과 카드·기술통계~판별분석
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 코드는 분할 전과 동일) */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  function select() { return NS.select.apply(this, arguments); } // 뒤 조각에 정의됨 (호출 시점에 연결)
  var S = window.PsyStats;
  var state = { names: [], cols: [], types: [], nrows: 0, fileName: '' };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ---------------- 형식 도우미 ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(x, d) {
    if (x === null || x === undefined || (typeof x === 'number' && isNaN(x))) return '—';
    if (typeof x !== 'number') return esc(x);
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    d = d === undefined ? 3 : d;
    var s = x.toFixed(d);
    if (/^-0\.?0*$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  }
  function fp(p) {
    if (p === null || p === undefined || isNaN(p)) return '—';
    if (p < 0.001) return '< .001';
    return p.toFixed(3).replace(/^0/, '');
  }
  function fr(x) { return f(x, 3).replace(/^(−?)0\./, '$1.'); } // APA: 1을 넘을 수 없는 값
  function star(p) { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : ''; }
  // APA 7판: 통계 기호(라틴 문자)는 기울임, 그리스 문자·약어(CI, OR 등)는 기울이지 않음
  var ITAL = ['M', 'SD', 'SE', 'Mdn', 'n', 'N', 't', 'F', 'p', 'r', 'R', 'df', 'B', 'd', 'g', 'z', 'W', 'U', 'V', 'k'];
  // 기호 앞이 문장 시작·공백·괄호·Δ일 때만 기울임 (예: '치료B'의 B, 'S-W'의 W는 제외)
  var ITAL_RE = new RegExp('(^|[\\s(\\[Δ/·])(' + ITAL.join('|') + ')(?![A-Za-z가-힣])', 'g');
  function italHead(h) {
    return String(h).split(/(<[^>]+>)/).map(function (part) {
      return part.charAt(0) === '<' ? part : part.replace(ITAL_RE, function (_, pre, tok) { return pre + '<i>' + tok + '</i>'; });
    }).join('');
  }
  // table(head, rows, {left, title, note}) → APA 표 (번호는 카드에 추가될 때 매김)
  function table(head, rows, opts) {
    opts = opts || {};
    var h = '<div class="apa"' + (opts.title ? ' data-title="' + esc(opts.title) + '"' : '') + (opts.note ? ' data-note="' + esc(opts.note) + '"' : '') + '>' +
      '<div class="tablewrap"><table class="res"><thead><tr>' + head.map(function (x) { return '<th>' + italHead(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (c, i) { return '<td' + (opts.left && opts.left.indexOf(i) >= 0 ? ' class="l"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table></div></div>';
  }
  var ABBR = [['Boot', 'Boot = 부트스트랩'], ['CI', 'CI = 신뢰구간'], ['OR', 'OR = 오즈비'], ['VIF', 'VIF = 분산팽창지수'], ['AUC', 'AUC = ROC 곡선 아래 면적'],
    ['−2LL', '−2LL = −2 로그우도'], ['AIC', 'AIC = 아카이케 정보기준'], ['BIC', 'BIC = 베이지안 정보기준'], ['EI', 'EI = 기대영향'], ['S-W', 'S-W = Shapiro-Wilk']];
  // 카드 안의 표에 번호·제목·주를 붙인다
  function decorateTables(card, cardTitle) {
    $$('.apa', card).forEach(function (el, k) {
      var title = el.dataset.title, prev = el.previousElementSibling;
      if (!title && prev && prev.tagName === 'H4') { title = prev.textContent; prev.parentNode.removeChild(prev); }
      if (!title) title = cardTitle;
      el.dataset.ftitle = title;
      var headTxt = $('thead', el).textContent, bodyTxt = $('tbody', el).textContent, notes = [];
      if (el.dataset.note) notes.push(el.dataset.note);
      var ab = ABBR.filter(function (a) { return headTxt.indexOf(a[0]) >= 0 || (a[0] === 'CI' && bodyTxt.indexOf('CI') >= 0); }).map(function (a) { return a[1]; });
      if (ab.length) notes.push(ab.join('; ') + '.');
      var stars = /\d\*/.test(bodyTxt);
      var noteHtml = notes.length || stars ? '<div class="apa-note">' + (notes.length ? '<i>주.</i> ' + esc(notes.join(' ')) : '') +
        (stars ? (notes.length ? '<br>' : '') + '*<i>p</i> &lt; .05. **<i>p</i> &lt; .01. ***<i>p</i> &lt; .001.' : '') + '</div>' : '';
      el.insertAdjacentHTML('afterbegin', '<div class="apa-cap"><b class="apa-num">표 ' + (k + 1) + '</b><button class="btn small apa-copy" title="APA 서식으로 복사 (한글·워드·엑셀)">APA 복사</button></div><div class="apa-title">' + esc(title) + '</div>');
      el.insertAdjacentHTML('beforeend', noteHtml);
      $('.apa-copy', el).onclick = function () { copyApa([el]); };
    });
  }
  // 인라인 서식 HTML(워드·한글용) + 탭 구분 텍스트(엑셀용)
  var APA_FONT = "font-family:'Times New Roman','바탕',Batang,serif;font-size:12pt;";
  function cleanCell(h) { return h.replace(/<(?!\/?(i|sub|sup|br)\b)[^>]*>/g, '').replace(/<br>/g, ' '); }
  function apaExport(el, num) {
    var title = el.dataset.ftitle, heads = $$('thead th', el), rows = $$('tbody tr', el);
    var html = '<p style="margin:12pt 0 0;' + APA_FONT + 'font-weight:bold">표 ' + num + '</p>' +
      '<p style="margin:0 0 6pt;' + APA_FONT + 'font-style:italic">' + esc(title) + '</p>' +
      '<table style="border-collapse:collapse;' + APA_FONT + '"><thead><tr>' + heads.map(function (th, i) {
        return '<th style="' + APA_FONT + 'font-weight:normal;border-top:1pt solid #000;border-bottom:1pt solid #000;padding:2pt 7pt;vertical-align:bottom;text-align:' + (i ? 'center' : 'left') + '">' + cleanCell(th.innerHTML) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (tr, ri) {
        return '<tr>' + $$('td', tr).map(function (td, i) {
          return '<td style="' + APA_FONT + 'padding:2pt 7pt;text-align:' + (i && !td.classList.contains('l') ? 'center' : 'left') + (ri === rows.length - 1 ? ';border-bottom:1pt solid #000' : '') + '">' + cleanCell(td.innerHTML) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    var note = $('.apa-note', el);
    if (note) html += '<p style="margin:3pt 0 0;' + APA_FONT + '">' + note.innerHTML + '</p>';
    var txt = function (node) { return node.textContent.replace(/−/g, '-').replace(/\s+/g, ' ').trim(); };
    var text = '표 ' + num + '\n' + title + '\n' + heads.map(txt).join('\t') + '\n' + rows.map(function (tr) { return $$('td', tr).map(txt).join('\t'); }).join('\n') + (note ? '\n' + txt(note) : '');
    return { html: html, text: text };
  }
  function copyApa(els, startNum) {
    var parts = els.map(function (el, i) { return apaExport(el, (startNum || 1) + i); });
    var html = parts.map(function (p) { return p.html; }).join(''), text = parts.map(function (p) { return p.text; }).join('\n\n');
    var handler = function (e) { e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', text); e.preventDefault(); };
    document.addEventListener('copy', handler);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
    document.removeEventListener('copy', handler);
    window.__lastApaCopy = { html: html, text: text }; // 테스트·디버깅용
    flash(ok ? 'APA 표 ' + els.length + '개를 복사했습니다. 한글·워드에는 서식 그대로, 엑셀에는 칸별로 붙습니다. 표 번호는 원고에 맞게 고치세요.' : '복사에 실패했습니다. 표를 드래그해 Ctrl+C로 복사하세요.');
  }
  function rcode(code) { return '<details><summary>R에서 같은 분석 재현하기 (교차검증용)</summary><pre class="rcode">' + esc(code) + '</pre></details>'; }
  function rvec(names) { return 'c(' + names.map(function (n) { return '"' + n + '"'; }).join(', ') + ')'; }
  function rname(n) { return /^[A-Za-z.][A-Za-z0-9._]*$/.test(n) ? n : '`' + n + '`'; }

  /* ---------------- 데이터 읽기 ---------------- */
  var MISSING = { '': 1, 'NA': 1, 'na': 1, 'N/A': 1, '.': 1, 'NaN': 1, '#N/A': 1, '#NULL!': 1, '-': 0 };
  function setData(rows, fileName) {
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    if (rows.length < 2) throw new Error('첫 행은 변수 이름, 그 아래로 자료가 있어야 합니다.');
    var header = rows[0].map(function (h, i) { h = String(h).trim(); return h || ('V' + (i + 1)); });
    var seen = {};
    header = header.map(function (h) { var b = h, k = 2; while (seen[h]) h = b + '_' + k++; seen[h] = 1; return h; });
    var body = rows.slice(1), p = header.length;
    var cols = [], types = [];
    for (var j = 0; j < p; j++) {
      var raw = body.map(function (r) { return r[j] === undefined ? '' : String(r[j]).trim(); });
      var allNum = raw.every(function (v) { return MISSING[v] === 1 || (!isNaN(Number(v.replace(/,/g, ''))) && v !== ''); });
      if (allNum) { cols.push(raw.map(function (v) { return MISSING[v] === 1 ? null : Number(v.replace(/,/g, '')); })); types.push('num'); }
      else { cols.push(raw.map(function (v) { return MISSING[v] === 1 ? null : v; })); types.push('text'); }
    }
    state.names = header; state.cols = cols; state.types = types; state.nrows = body.length; state.fileName = fileName || ''; // 객체를 바꾸지 않고 필드만 갱신 (조각 간 공유)
    updateInfo();
    select('data');
  }
  function parseDelimited(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var first = text.split(/\r?\n/)[0] || '';
    var delim = first.indexOf('\t') >= 0 ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { try { return new TextDecoder('euc-kr').decode(buf); } catch (e2) { return new TextDecoder('utf-8').decode(buf); } }
  }

  // 최소 xlsx 읽기 (첫 번째 시트). 브라우저의 DecompressionStream 필요
  function readXlsx(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('xlsx 파일 구조를 읽을 수 없습니다.'));
    var count = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), entries = {};
    for (var e = 0; e < count; e++) {
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true);
      var xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      entries[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nlen + xlen + clen;
    }
    function get(name) {
      var en = entries[name];
      if (!en) return Promise.resolve(null);
      var l = en.lho, start = l + 30 + dv.getUint16(l + 26, true) + dv.getUint16(l + 28, true);
      var data = u8.subarray(start, start + en.csize);
      if (en.method === 0) return Promise.resolve(new TextDecoder().decode(data));
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('이 브라우저는 xlsx 압축 해제를 지원하지 않습니다. 엑셀에서 "CSV UTF-8"로 저장하거나 복사-붙여넣기를 이용하세요.'));
      var ds = new DecompressionStream('deflate-raw');
      var stream = new Blob([data]).stream().pipeThrough(ds);
      return new Response(stream).text();
    }
    var parser = new DOMParser();
    function xml(s) { return parser.parseFromString(s, 'application/xml'); }
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml')]).then(function (r) {
      var sheetPath = 'xl/worksheets/sheet1.xml';
      if (r[0] && r[1]) {
        var wb = xml(r[0]), sh = wb.getElementsByTagName('sheet')[0];
        var rid = sh && (sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
        var rels = xml(r[1]).getElementsByTagName('Relationship');
        for (var k = 0; k < rels.length; k++) if (rels[k].getAttribute('Id') === rid) {
          var t = rels[k].getAttribute('Target'); sheetPath = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
        }
      }
      var shared = [];
      if (r[2]) {
        var si = xml(r[2]).getElementsByTagName('si');
        for (var s = 0; s < si.length; s++) {
          var ts = si[s].getElementsByTagName('t'), txt = '';
          for (var q = 0; q < ts.length; q++) txt += ts[q].textContent;
          shared.push(txt);
        }
      }
      return get(sheetPath).then(function (sx) {
        if (!sx) throw new Error('첫 번째 시트를 찾을 수 없습니다.');
        var doc = xml(sx), rowsEl = doc.getElementsByTagName('row'), rows = [];
        function colIdx(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var c = 0; c < m[1].length; c++) n = n * 26 + (m[1].charCodeAt(c) - 64); return n - 1; }
        for (var ri = 0; ri < rowsEl.length; ri++) {
          var rn = Number(rowsEl[ri].getAttribute('r')) - 1, cells = rowsEl[ri].getElementsByTagName('c'), arr = [];
          for (var ci = 0; ci < cells.length; ci++) {
            var c = cells[ci], tp = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], val = '';
            if (tp === 's') val = v ? shared[Number(v.textContent)] : '';
            else if (tp === 'inlineStr') { var is = c.getElementsByTagName('t'); val = is.length ? is[0].textContent : ''; }
            else val = v ? v.textContent : '';
            arr[c.getAttribute('r') ? colIdx(c.getAttribute('r')) : ci] = val;
          }
          for (var z = 0; z < arr.length; z++) if (arr[z] === undefined) arr[z] = '';
          rows[isNaN(rn) ? ri : rn] = arr;
        }
        return rows.filter(function (x) { return x; });
      });
    });
  }

  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var buf = reader.result;
      if (/\.xlsx$/i.test(file.name)) {
        readXlsx(buf).then(function (rows) { setData(rows, file.name); }).catch(function (e) { alert(e.message); });
      } else {
        try { setData(parseDelimited(decodeText(buf)), file.name); } catch (e) { alert(e.message); }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 가상 예시 데이터 (시뮬레이션; 실제 자료 아님)
  function exampleData() {
    var r = S.rng(2026), n = 300;
    function norm() { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var head = ['ID', '집단', '성별', '연령', '우울1', '우울2', '우울3', '불안1', '불안2', '불안3', '수면', '스트레스', '사회적지지', '치료반응'];
    var rows = [head];
    for (var i = 0; i < n; i++) {
      var g = i % 3, dep = norm() + (g === 2 ? 0.5 : 0), anx = 0.6 * dep + 0.8 * norm(), sup = norm();
      var stress = 0.5 * dep + 0.3 * anx - 0.3 * sup + 0.7 * norm(), sleep = 0.4 * dep + 0.3 * stress + 0.8 * norm();
      function lik(x) { return Math.max(1, Math.min(5, Math.round(3 + 0.9 * x + 0.6 * norm()))); }
      var eta = -0.3 - 0.7 * dep + 0.4 * sup + (g === 0 ? 0.6 : 0);
      rows.push([i + 1, ['통제', '치료A', '치료B'][g], r() < 0.6 ? '여' : '남', Math.round(25 + 10 * r() + 5 * norm()),
        lik(dep), lik(dep), lik(dep), lik(anx), lik(anx), lik(anx), +(50 + 10 * sleep).toFixed(1), +(50 + 10 * stress).toFixed(1),
        +(50 + 10 * sup).toFixed(1), r() < 1 / (1 + Math.exp(-eta)) ? 1 : 0]);
    }
    rows[5][7] = ''; rows[40][11] = ''; // 결측 예시
    setData(rows, '예시_가상데이터 (시뮬레이션)');
  }

  function updateInfo() {
    $('#datainfo').textContent = state.nrows ? (state.fileName + ' · ' + state.nrows + '행 × ' + state.names.length + '변수') : '데이터 없음';
  }

  /* ---------------- 변수 선택 위젯 ---------------- */
  function varOptions(filter) {
    return state.names.map(function (n, i) { return { name: n, i: i, type: state.types[i] }; })
      .filter(function (v) { return !filter || filter === 'any' || v.type === filter; });
  }
  function levelsOf(i) {
    var lv = [];
    state.cols[i].forEach(function (v) { if (v !== null && lv.indexOf(String(v)) < 0) lv.push(String(v)); });
    return lv.sort(function (a, b) { var x = Number(a), y = Number(b); return (!isNaN(x) && !isNaN(y)) ? x - y : (a < b ? -1 : a > b ? 1 : 0); });
  }
  function selectField(id, label, filter, hint) {
    var o = varOptions(filter).map(function (v) { return '<option value="' + v.i + '">' + esc(v.name) + '</option>'; }).join('');
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '"><option value="">— 선택 —</option>' + o + '</select>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function multiField(id, label, filter, hint) {
    var o = varOptions(filter).map(function (v) {
      return '<label><input type="checkbox" value="' + v.i + '">' + esc(v.name) + '<span class="vt">' + (v.type === 'num' ? '숫자' : '문자') + '</span></label>';
    }).join('');
    return '<div class="field"><div class="lab">' + label + '</div><div class="varlist" id="' + id + '">' + (o || '<div class="hint" style="padding:4px 8px">해당 변수 없음</div>') + '</div>' +
      '<div class="varlist-tools"><button class="btn small" data-all="' + id + '">전체</button><button class="btn small" data-none="' + id + '">해제</button></div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function getMulti(id) { return $$('#' + id + ' input:checked').map(function (c) { return Number(c.value); }); }
  function getSel(id) { var v = $('#' + id).value; return v === '' ? -1 : Number(v); }
  function wireMulti() {
    $$('[data-all]').forEach(function (b) { b.onclick = function () { $$('#' + b.dataset.all + ' input').forEach(function (c) { c.checked = true; }); }; });
    $$('[data-none]').forEach(function (b) { b.onclick = function () { $$('#' + b.dataset.none + ' input').forEach(function (c) { c.checked = false; }); }; });
  }
  function need(cond, msg) { if (!cond) throw new Error(msg); }

  // 문자형/범주형 예측변수 → 더미 코딩 (첫 수준이 기준)
  function designColumns(idxs, forceCat) {
    var cols = [], names = [], notes = [];
    idxs.forEach(function (i) {
      if (state.types[i] === 'num' && !(forceCat && forceCat.indexOf(i) >= 0)) { cols.push(state.cols[i]); names.push(state.names[i]); return; }
      var lv = levelsOf(i);
      notes.push(state.names[i] + ': 기준 범주 = "' + lv[0] + '"');
      lv.slice(1).forEach(function (l) {
        cols.push(state.cols[i].map(function (v) { return v === null ? null : (String(v) === l ? 1 : 0); }));
        names.push(state.names[i] + '[' + l + ']');
      });
    });
    return { cols: cols, names: names, notes: notes };
  }

  /* ---------------- 결과 카드 ---------------- */
  function addCard(title, html, meta) {
    var el = document.createElement('div');
    el.className = 'card';
    var now = new Date();
    el.innerHTML = '<div class="tools"><button class="btn small" data-act="copy" title="이 카드의 모든 표를 APA 서식으로 복사">표 모두 복사</button><button class="btn small" data-act="del">삭제</button></div>' +
      '<h3>' + esc(title) + '</h3><div class="meta">' + esc(meta || '') + ' · ' + esc(state.fileName) + ' · ' + now.toLocaleString('ko-KR') + '</div>' + html;
    decorateTables(el, title);
    var box = $('#results');
    var empty = $('.empty', box); if (empty) empty.remove();
    box.insertBefore(el, box.firstChild);
    el.querySelector('[data-act=del]').onclick = function () { el.remove(); };
    el.querySelector('[data-act=copy]').onclick = function () { var t = $$('.apa', el); if (t.length) copyApa(t); else copyEl(el); };
    return el;
  }
  function copyEl(el) {
    var range = document.createRange(); range.selectNodeContents(el);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    try { document.execCommand('copy'); flash('복사했습니다. 한글(HWP)·워드·엑셀에 붙여넣기 하세요.'); } catch (e) { flash('복사 실패: Ctrl+C를 눌러주세요.'); }
    sel.removeAllRanges();
  }
  function flash(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 16px;border-radius:6px;z-index:99;font-size:13px';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200);
  }
  function errorCard(e) { addCard('오류', '<div class="warn">' + esc(e.message || e) + '</div>'); }

  /* ---------------- 분석 정의 ---------------- */
  var A = {};

  A.desc = {
    group: '탐색', title: '기술통계·정규성',
    desc: '평균, 표준편차, 왜도·첨도(SPSS 방식), Shapiro-Wilk 정규성 검정.',
    form: function () { return multiField('v', '변수', 'num') + selectField('by', '집단별로 나누기 (선택)', 'any'); },
    run: function () {
      var v = getMulti('v'), by = getSel('by'); need(v.length, '변수를 하나 이상 선택하세요.');
      var groups = by < 0 ? [{ label: '전체', idx: null }] : levelsOf(by).map(function (l) { return { label: l, idx: l }; });
      var head = (by >= 0 ? ['변수', '집단'] : ['변수']).concat(['N', '결측', 'M', 'SD', 'Mdn', 'Min', 'Max', '왜도 (SE)', '첨도 (SE)', 'S-W W', 'p']);
      var rows = [];
      v.forEach(function (i) {
        groups.forEach(function (g) {
          var x = g.idx === null ? state.cols[i] : state.cols[i].filter(function (_, r) { return String(state.cols[by][r]) === g.idx; });
          var d = S.descriptives(x);
          var row = [esc(state.names[i])].concat(by >= 0 ? [esc(g.label)] : []);
          rows.push(row.concat([d.n, d.missing, f(d.mean, 2), f(d.sd, 2), f(d.median, 2), f(d.min, 2), f(d.max, 2),
            f(d.skew, 2) + ' (' + f(d.seSkew, 2) + ')', f(d.kurt, 2) + ' (' + f(d.seKurt, 2) + ')', f(d.swW, 3), fp(d.swP)]));
        });
      });
      var html = table(head, rows, { left: by >= 0 ? [1] : [], title: by >= 0 ? state.names[by] + '에 따른 기술통계' : '기술통계와 정규성 검정' }) +
        '<p class="note">왜도·첨도는 SPSS/Excel과 같은 표본 보정 공식(G1, G2). 첨도는 초과첨도(정규분포 = 0). Shapiro-Wilk는 Royston(1995) 알고리즘으로 R의 shapiro.test와 같은 값을 냅니다(n = 3–5000). 중앙값은 R 기본(type 7) 방식입니다.</p>' +
        '<p class="note">N이 클 때는 정규성 검정이 사소한 이탈에도 유의해지므로, 왜도 |2|·첨도 |7| 이내 같은 기준(West, Finch, & Curran, 1995)과 함께 판단하세요.</p>' +
        rcode('psych::describe(df[, ' + rvec(v.map(function (i) { return state.names[i]; })) + '])\nshapiro.test(df$' + rname(state.names[v[0]]) + ')');
      addCard('기술통계', html, v.length + '개 변수');
    }
  };

  function twoLevelPicker(gid) {
    return '<div class="field" id="' + gid + '_lv" style="display:none"><div class="lab">비교할 두 집단</div><div class="inline"><select id="' + gid + '_a"></select><span>vs</span><select id="' + gid + '_b"></select></div></div>';
  }
  function wireLevelPicker(gid) {
    $('#' + gid).onchange = function () {
      var i = getSel(gid), box = $('#' + gid + '_lv');
      if (i < 0) { box.style.display = 'none'; return; }
      var lv = levelsOf(i), o = lv.map(function (l) { return '<option>' + esc(l) + '</option>'; }).join('');
      $('#' + gid + '_a').innerHTML = o; $('#' + gid + '_b').innerHTML = o;
      $('#' + gid + '_b').selectedIndex = Math.min(1, lv.length - 1);
      box.style.display = '';
    };
  }

  A.ttest = {
    group: '평균 비교', title: 't 검정',
    desc: '독립표본(Student·Welch), 대응표본, 일표본 t 검정과 효과크기.',
    form: function () {
      return '<div class="field"><div class="lab">종류</div><div class="inline">' +
        '<label><input type="radio" name="tt" value="ind" checked>독립표본</label><label><input type="radio" name="tt" value="pair">대응표본</label><label><input type="radio" name="tt" value="one">일표본</label></div></div>' +
        '<div id="tt_ind">' + multiField('dv', '종속변수', 'num') + selectField('g', '집단변수', 'any') + twoLevelPicker('g') + '</div>' +
        '<div id="tt_pair" style="display:none">' + selectField('p1', '측정 1 (예: 사후)', 'num') + selectField('p2', '측정 2 (예: 사전)', 'num') + '</div>' +
        '<div id="tt_one" style="display:none">' + multiField('ov', '변수', 'num') + '<div class="field"><label for="mu">검정값 (μ₀)</label><input type="number" id="mu" value="0" step="any"></div></div>';
    },
    wire: function () {
      wireLevelPicker('g');
      $$('input[name=tt]').forEach(function (r) {
        r.onchange = function () { var k0 = $('input[name=tt]:checked').value; ['ind', 'pair', 'one'].forEach(function (k) { $('#tt_' + k).style.display = k === k0 ? '' : 'none'; }); };
      });
    },
    run: function () {
      var kind = $('input[name=tt]:checked').value, html = '';
      if (kind === 'ind') {
        var dv = getMulti('dv'), g = getSel('g'); need(dv.length && g >= 0, '종속변수와 집단변수를 선택하세요.');
        var la = $('#g_a').value, lb = $('#g_b').value; need(la !== lb, '서로 다른 두 집단을 선택하세요.');
        var drows = [], trows = [];
        dv.forEach(function (i) {
          var x1 = state.cols[i].filter(function (_, r) { return String(state.cols[g][r]) === la; });
          var x2 = state.cols[i].filter(function (_, r) { return String(state.cols[g][r]) === lb; });
          var t = S.tTestIndependent(x1, x2), nm = esc(state.names[i]);
          drows.push([nm, esc(la), t.n1, f(t.mean1, 2), f(t.sd1, 2)]); drows.push(['', esc(lb), t.n2, f(t.mean2, 2), f(t.sd2, 2)]);
          trows.push([nm, 'Student (등분산 가정)', f(t.student.t, 2), f(t.student.df, 0), fp(t.student.p), f(t.diff, 2), '[' + f(t.student.ciLow, 2) + ', ' + f(t.student.ciHigh, 2) + ']', f(t.d, 2), f(t.g, 2)]);
          trows.push(['', 'Welch (등분산 미가정)', f(t.welch.t, 2), f(t.welch.df, 2), fp(t.welch.p), f(t.diff, 2), '[' + f(t.welch.ciLow, 2) + ', ' + f(t.welch.ciHigh, 2) + ']', '', '']);
          trows.push(['', 'Levene F(' + t.levene.df1 + ', ' + t.levene.df2 + ') = ' + f(t.levene.F, 2) + ', p ' + (t.levene.p < .001 ? '< .001' : '= ' + fp(t.levene.p)), '', '', '', '', '', '', '']);
        });
        html = '<h4>집단별 기술통계</h4>' + table(['변수', '집단', 'n', 'M', 'SD'], drows, { left: [1] }) +
          '<h4>독립표본 t 검정</h4>' + table(['변수', '검정', 't', 'df', 'p', '평균차', '95% CI', "Cohen's d", "Hedges' g"], trows, { left: [1] }) +
          '<p class="note">Levene 검정은 SPSS와 같은 평균 중심 방식. 최근에는 Levene 결과와 관계없이 Welch 검정을 기본으로 보고할 것을 권고합니다(Delacre, Lakens, & Leys, 2017).</p>' +
          rcode('t.test(' + rname(state.names[dv[0]]) + ' ~ ' + rname(state.names[g]) + ', data = df, var.equal = FALSE)\ncar::leveneTest(' + rname(state.names[dv[0]]) + ' ~ factor(' + rname(state.names[g]) + '), data = df, center = mean)');
        addCard('독립표본 t 검정', html, esc(state.names[g]) + ': ' + la + ' vs ' + lb);
      } else if (kind === 'pair') {
        var a = getSel('p1'), b = getSel('p2'); need(a >= 0 && b >= 0 && a !== b, '서로 다른 두 측정 변수를 선택하세요.');
        var t2 = S.tTestPaired(state.cols[a], state.cols[b]);
        html = table(['', 'n', 'M', 'SD'], [[esc(state.names[a]), t2.n, f(t2.mean1, 2), f(t2.sd1, 2)], [esc(state.names[b]), t2.n, f(t2.mean2, 2), f(t2.sd2, 2)]], { title: '측정별 기술통계' }) +
          table(['비교', '평균차', 'SD차', 't', 'df', 'p', '95% CI', 'd<sub>z</sub>', 'r'], [[esc(state.names[a] + ' − ' + state.names[b]), f(t2.meanDiff, 2), f(t2.sdDiff, 2), f(t2.t, 2), t2.df, fp(t2.p),
            '[' + f(t2.ciLow, 2) + ', ' + f(t2.ciHigh, 2) + ']', f(t2.dz, 2), fr(t2.r)]], { title: '대응표본 t 검정 결과' }) +
          '<p class="note">d<sub>z</sub> = 평균차 / 차이점수의 SD (Lakens, 2013). r은 두 측정 간 상관.</p>' +
          rcode('t.test(df$' + rname(state.names[a]) + ', df$' + rname(state.names[b]) + ', paired = TRUE)');
        addCard('대응표본 t 검정', html, '');
      } else {
        var ov = getMulti('ov'), mu = Number($('#mu').value); need(ov.length, '변수를 선택하세요.');
        var rows = ov.map(function (i) { var t3 = S.tTestOneSample(state.cols[i], mu); return [esc(state.names[i]), t3.n, f(t3.mean, 2), f(t3.sd, 2), f(t3.t, 2), t3.df, fp(t3.p), '[' + f(t3.ciLow, 2) + ', ' + f(t3.ciHigh, 2) + ']', f(t3.d, 2)]; });
        html = table(['변수', 'n', 'M', 'SD', 't', 'df', 'p', '평균차 95% CI', 'd'], rows, { title: '일표본 t 검정 결과 (검정값 = ' + mu + ')' }) + rcode('t.test(df$' + rname(state.names[ov[0]]) + ', mu = ' + mu + ')');
        addCard('일표본 t 검정', html, 'μ₀ = ' + mu);
      }
    }
  };

  A.anova = {
    group: '평균 비교', title: '일원분산분석',
    desc: 'F 검정, Welch ANOVA, 효과크기(η², ω²), 사후검정(Tukey, Games-Howell, Bonferroni).',
    form: function () { return multiField('dv', '종속변수', 'num') + selectField('g', '집단변수 (요인)', 'any'); },
    run: function () {
      var dv = getMulti('dv'), g = getSel('g'); need(dv.length && g >= 0, '종속변수와 집단변수를 선택하세요.');
      var lv = levelsOf(g); need(lv.length >= 2, '집단이 2개 이상이어야 합니다.');
      dv.forEach(function (i) {
        var groups = lv.map(function (l) { return state.cols[i].filter(function (v, r) { return v !== null && String(state.cols[g][r]) === l; }); });
        var keep = lv.filter(function (_, k) { return groups[k].length > 1; });
        groups = groups.filter(function (x) { return x.length > 1; });
        var a = S.anovaOneway(groups, keep);
        var html = '<h4>기술통계</h4>' + table(['집단', 'n', 'M', 'SD'], a.desc.map(function (d) { return [esc(d.label), d.n, f(d.mean, 2), f(d.sd, 2)]; })) +
          '<h4>분산분석표</h4>' + table(['', 'SS', 'df', 'MS', 'F', 'p', 'η²', 'ω²'], [
            ['집단 간', f(a.ssb, 2), a.dfB, f(a.msb, 2), f(a.F, 2), fp(a.p), fr(a.eta2), fr(a.omega2)],
            ['집단 내', f(a.ssw, 2), a.dfW, f(a.msw, 2), '', '', '', ''], ['전체', f(a.sst, 2), a.dfB + a.dfW, '', '', '', '', '']]) +
          table(['보조 검정', '통계량', 'df', 'p'], [
            ['Welch ANOVA', 'F = ' + f(a.welch.F, 2), a.welch.df1 + ', ' + f(a.welch.df2, 2), fp(a.welch.p)],
            ['Levene (등분산)', 'F = ' + f(a.levene.F, 2), a.levene.df1 + ', ' + a.levene.df2, fp(a.levene.p)]], { left: [0], title: 'Welch 분산분석과 등분산 검정' }) +
          '<h4>사후검정 (다중비교)</h4>' + table(['비교', '평균차', 'SE', 'Tukey p', 'Games-Howell p', 'Bonferroni p'], a.posthoc.map(function (p) {
            return [esc(p.a + ' − ' + p.b), f(p.diff, 2), f(p.se, 2), fp(p.pTukey), fp(p.pGH), fp(p.pBonf)];
          })) +
          '<p class="note">등분산 가정이 의심되면 Welch ANOVA와 Games-Howell을 보고하세요. Tukey(집단 크기가 다르면 Tukey-Kramer)와 Games-Howell은 스튜던트화 범위 분포(R의 ptukey 이식)를 사용합니다.</p>' +
          rcode('m <- aov(' + rname(state.names[i]) + ' ~ factor(' + rname(state.names[g]) + '), data = df)\nsummary(m); TukeyHSD(m)\noneway.test(' + rname(state.names[i]) + ' ~ ' + rname(state.names[g]) + ', data = df)');
        addCard('일원분산분석: ' + state.names[i], html, '요인 = ' + state.names[g]);
      });
    }
  };

  function boxMTable(bm) {
    if (!isFinite(bm.M)) return '<div class="warn">' + esc(bm.note || "Box's M을 계산할 수 없습니다.") + '</div>';
    return table(["Box's M", 'F', 'df1', 'df2', 'p', 'χ²', 'df', 'p (χ²)'], [[f(bm.M, 2), f(bm.F, 2), bm.df1, f(bm.df2, 1), fp(bm.pF), f(bm.chi2, 2), bm.df, fp(bm.pChi)]],
      { title: '공분산 행렬의 동질성 검정 (Box의 M)', note: 'Box의 M은 정규성 위반과 큰 표본에 민감하므로 흔히 α = .001 기준으로 판단한다.' });
  }
  function groupDescTable(desc, names, title) {
    var head = ['변수'];
    desc.forEach(function (d) { head.push(esc(d.label) + ' M', 'SD'); });
    var rows = names.map(function (nm, j) { var r = [esc(nm)]; desc.forEach(function (d) { r.push(f(d.means[j], 2), f(d.sds[j], 2)); }); return r; });
    rows.push(['n'].concat([].concat.apply([], desc.map(function (d) { return [d.n, '']; }))));
    return table(head, rows, { title: title });
  }

  A.manova = {
    group: '다변량', title: '다변량분산분석 (MANOVA)',
    desc: '일원 MANOVA: Pillai, Wilks, Hotelling, Roy 검정과 다변량 부분 η², Box의 M, 후속 단변량 분산분석.',
    form: function () { return multiField('dv', '종속변수 (2개 이상)', 'num') + selectField('g', '집단변수 (요인)', 'any'); },
    run: function () {
      var dv = getMulti('dv'), g = getSel('g'); need(dv.length >= 2 && g >= 0, '종속변수 2개 이상과 집단변수를 선택하세요.');
      var names = dv.map(function (i) { return state.names[i]; });
      var r = S.manova(dv.map(function (i) { return state.cols[i]; }), state.cols[g], names), T = r.tests;
      var mrow = function (lab, t) { return [lab, f(t.stat, 3), f(t.F, 2), f(t.df1, 0), f(t.df2, 2).replace(/\.00$/, ''), fp(t.p), fr(t.eta2)]; };
      var alphaB = 0.05 / r.p;
      var html = groupDescTable(r.desc, names, state.names[g] + '에 따른 종속변수의 기술통계') + boxMTable(r.boxM) +
        table(['검정', '값', 'F', '가설 df', '오차 df', 'p', '부분 η²'], [
          mrow("Pillai의 트레이스 (V)", T.pillai), mrow("Wilks의 람다 (Λ)", T.wilks), mrow("Hotelling의 트레이스", T.hotelling), mrow("Roy의 최대근", T.roy)],
          { left: [0], title: '다변량 검정', note: 'Roy의 최대근에 대한 F는 상한값이다. 부분 η²는 SPSS와 같은 정의(Wilks: 1 − Λ^(1/s)).' }) +
        table(['종속변수', 'F', 'df', 'p', '부분 η²'].concat(['Levene F', 'p (Levene)']), r.univariate.map(function (u, j) {
          return [esc(u.name), f(u.F, 2), u.df1 + ', ' + u.df2, fp(u.p) + (u.p < alphaB ? ' †' : ''), fr(u.eta2), f(r.levene[j].F, 2), fp(r.levene[j].p)];
        }), { title: '후속 단변량 분산분석', note: '† Bonferroni 보정 기준(α = .05/' + r.p + ' = ' + alphaB.toFixed(4).replace(/^0/, '') + ')에서 유의.' }) +
        '<p class="note">N = ' + r.n + ' (목록별 제거), 집단 ' + r.G + '개. 표본 크기가 다르고 Box의 M이 유의하면 가장 강건한 Pillai의 V를 보고하는 것이 일반적입니다(Tabachnick & Fidell, 2019). 다변량 효과가 유의할 때 어떤 변수 조합이 집단을 구분하는지는 [판별분석]으로 이어서 볼 수 있습니다. 모든 검정 통계량과 F는 R의 summary.manova()와 같습니다.</p>' +
        rcode('fit <- manova(cbind(' + names.map(rname).join(', ') + ') ~ factor(' + rname(state.names[g]) + '), data = df)\nsummary(fit, test = "Pillai"); summary(fit, test = "Wilks")\nsummary.aov(fit)');
      addCard('MANOVA: ' + names.join(', ') + ' × ' + state.names[g], html, r.G + '집단, ' + r.p + '개 종속변수');
    }
  };

  function ldaPlotSVG(d) {
    var W = 520, H = 360, L = 50, R = 130, T = 20, B = 40, two = d.funcs.length >= 2;
    var cols = ['#2b5fc7', '#c8372d', '#2f9e44', '#b8860b', '#8e44ad', '#16a085', '#d35400', '#555'];
    var xs = d.scores.map(function (s) { return s[0]; }), ys = two ? d.scores.map(function (s) { return s[1]; }) : d.groupIndex.map(function (g) { return g; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (!two) { y0 = -0.6; y1 = d.G - 0.4; }
    var X = function (v) { return L + (v - x0) / ((x1 - x0) || 1) * (W - L - R); }, Y = function (v) { return T + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - T - B); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">';
    s += '<rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="none" stroke="#8a94a6" stroke-width="0.7"/>';
    d.scores.forEach(function (sc, i) {
      var g = d.groupIndex[i], jit = two ? 0 : ((i * 7919) % 100 / 100 - 0.5) * 0.5;
      s += '<circle cx="' + X(sc[0]).toFixed(1) + '" cy="' + Y(two ? sc[1] : g + jit).toFixed(1) + '" r="2.6" fill="' + cols[g % 8] + '" fill-opacity="0.55"/>';
    });
    d.labels.forEach(function (l, g) {
      var cx = d.funcs[0].centroids[g], cy = two ? d.funcs[1].centroids[g] : g;
      s += '<rect x="' + (X(cx) - 5) + '" y="' + (Y(cy) - 5) + '" width="10" height="10" fill="' + cols[g % 8] + '" stroke="#000" stroke-width="1.2"/>';
      s += '<circle cx="' + (W - R + 14) + '" cy="' + (T + 10 + g * 18) + '" r="4" fill="' + cols[g % 8] + '"/><text x="' + (W - R + 24) + '" y="' + (T + 14 + g * 18) + '">' + esc(l) + '</text>';
    });
    s += '<text x="' + (W - R + 10) + '" y="' + (T + 14 + d.G * 18 + 8) + '" fill="#8a94a6">■ 집단 중심</text>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 10) + '" text-anchor="middle">판별함수 1</text>';
    if (two) s += '<text x="14" y="' + ((T + H - B) / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + ((T + H - B) / 2) + ')">판별함수 2</text>';
    return s + '</svg>';
  }

  A.lda = {
    group: '다변량', title: '판별분석',
    desc: '선형판별분석(SPSS·MASS::lda와 같은 정의): 고유값, 정준상관, Wilks Λ, 표준화 계수, 구조행렬, 집단 중심, 분류표와 교차타당화.',
    form: function () {
      return multiField('v', '판별(예측) 변수', 'num') + selectField('g', '집단변수', 'any') +
        '<div class="field"><div class="lab">사전확률</div><div class="inline"><label><input type="radio" name="pri" value="equal" checked>모든 집단 동일 (SPSS 기본)</label><label><input type="radio" name="pri" value="proportional">집단 크기 비례</label></div></div>';
    },
    run: function () {
      var v = getMulti('v'), g = getSel('g'); need(v.length >= 1 && g >= 0, '판별변수와 집단변수를 선택하세요.');
      var names = v.map(function (i) { return state.names[i]; });
      var d = S.discriminant(v.map(function (i) { return state.cols[i]; }), state.cols[g], names, { priors: $('input[name=pri]:checked').value });
      var fn = d.funcs, fh = fn.map(function (_, k) { return '함수 ' + (k + 1); });
      // 구조행렬: SPSS처럼 가장 큰 |상관|이 있는 함수 순, 그 안에서 크기 순
      var order = names.map(function (_, j) { var best = 0; fn.forEach(function (f2, k) { if (Math.abs(f2.structure[j]) > Math.abs(fn[best].structure[j])) best = k; }); return { j: j, k: best, v: Math.abs(fn[best].structure[j]) }; })
        .sort(function (a, b) { return a.k - b.k || b.v - a.v; });
      var cum = 0;
      var confRows = function (M) {
        return d.labels.map(function (l, a) {
          var tot = M[a].reduce(function (x, y) { return x + y; }, 0);
          return [esc(l)].concat(M[a].map(function (c, b) { return c + ' (' + f(100 * c / tot, 1) + '%)'; })).concat([tot]);
        });
      };
      var html = table(['변수', 'Wilks Λ', 'F', 'df1', 'df2', 'p'], d.univariate.map(function (u) { return [esc(u.name), f(u.lambda, 3), f(u.F, 2), u.df1, u.df2, fp(u.p)]; }), { title: '집단 평균의 동일성 검정' }) +
        boxMTable(d.boxM) +
        table(['함수', '고유값', '분산 %', '누적 %', '정준상관'], fn.map(function (f2, k) { cum += f2.pctVar; return [k + 1, f(f2.eigen, 3), f(100 * f2.pctVar, 1), f(100 * cum, 1), fr(f2.canCor)]; }), { title: '고유값' }) +
        table(['함수 검정', 'Wilks Λ', 'χ²', 'df', 'p'], d.wilksSeq.map(function (w) { return [w.from === w.to ? String(w.from) : w.from + '부터 ' + w.to + '까지', f(w.lambda, 3), f(w.chi2, 2), w.df, fp(w.p)]; }), { title: '판별함수의 유의성 (Wilks Λ)' }) +
        table(['변수'].concat(fh), names.map(function (nm, j) { return [esc(nm)].concat(fn.map(function (f2) { return f(f2.stdCoef[j], 3); })); }), { title: '표준화 정준판별함수 계수' }) +
        table(['변수'].concat(fh), order.map(function (o) { return [esc(names[o.j])].concat(fn.map(function (f2, k) { return f(f2.structure[o.j], 3) + (k === o.k && fn.length > 1 ? '<sup>a</sup>' : ''); })); }),
          { title: '구조행렬', note: '판별변수와 표준화 정준판별함수 간의 집단 내 합동 상관. 변수는 함수 안에서 상관의 절댓값 크기 순으로 정렬했다.' + (fn.length > 1 ? ' a는 각 변수와 가장 큰 절대 상관을 보이는 함수.' : '') }) +
        table(['집단'].concat(fh), d.labels.map(function (l, a) { return [esc(l)].concat(fn.map(function (f2) { return f(f2.centroids[a], 3); })); }), { title: '집단 중심에서의 판별함수 값' }) +
        table(['변수'].concat(fh), names.map(function (nm, j) { return [esc(nm)].concat(fn.map(function (f2) { return f(f2.coef[j], 4); })); }).concat([['(상수)'].concat(fn.map(function (f2) { return f(f2.constant, 4); }))]), { title: '비표준화 정준판별함수 계수' }) +
        table(['변수'].concat(d.labels.map(esc)), names.map(function (nm, j) { return [esc(nm)].concat(d.classFn.map(function (c) { return f(c.coef[j], 4); })); }).concat([['(상수)'].concat(d.classFn.map(function (c) { return f(c.constant, 4); }))]), { title: '분류함수 계수 (Fisher의 선형판별함수)' }) +
        table(['실제 \\ 예측'].concat(d.labels.map(esc)).concat(['합계']), confRows(d.confusion), { left: [0], title: '분류 결과 (원 자료)', note: '정분류율 = ' + f(100 * d.accuracy, 1) + '%.' }) +
        (d.cvConfusion ? table(['실제 \\ 예측'].concat(d.labels.map(esc)).concat(['합계']), confRows(d.cvConfusion), { left: [0], title: '분류 결과 (교차타당화: 하나씩 빼기)', note: '각 사례를 그 사례를 제외한 나머지로 도출한 함수로 분류했다. 정분류율 = ' + f(100 * d.cvAccuracy, 1) + '%.' }) : '') +
        '<div>' + ldaPlotSVG(d) + '</div>' +
        '<p class="note">N = ' + d.n + ' (목록별 제거). 사전확률: ' + d.labels.map(function (l, a) { return esc(l) + ' ' + f(d.priors[a], 3); }).join(', ') + '. 비표준화 계수는 집단 내 분산이 1이 되도록 정규화했고(MASS::lda와 같음), 판별함수의 부호는 임의이므로 해석은 구조행렬·집단 중심과 함께 하세요. 우연 수준의 정분류율(비례 기준) = ' + f(100 * d.counts.reduce(function (s2, c) { return s2 + Math.pow(c / d.n, 2); }, 0), 1) + '%.</p>' +
        rcode('library(MASS)\nd <- na.omit(df[, ' + rvec(names.concat([state.names[g]])) + '])\nfit <- lda(d[, ' + rvec(names) + '], d$' + rname(state.names[g]) + ', prior = rep(1/' + d.G + ', ' + d.G + '))\nfit$scaling; table(d$' + rname(state.names[g]) + ', predict(fit)$class)\ncv <- lda(d[, ' + rvec(names) + '], d$' + rname(state.names[g]) + ', CV = TRUE)');
      addCard('판별분석: ' + state.names[g], html, d.G + '집단, 판별변수 ' + d.p + '개');
    }
  };

  // 다음 조각으로 내보내기
  NS.S = S; NS.state = state; NS.$ = $; NS.$$ = $$; NS.esc = esc; NS.f = f; NS.fp = fp; NS.fr = fr;
  NS.star = star; NS.ITAL = ITAL; NS.ITAL_RE = ITAL_RE; NS.italHead = italHead; NS.table = table; NS.ABBR = ABBR; NS.decorateTables = decorateTables; NS.APA_FONT = APA_FONT;
  NS.cleanCell = cleanCell; NS.apaExport = apaExport; NS.copyApa = copyApa; NS.rcode = rcode; NS.rvec = rvec; NS.rname = rname; NS.MISSING = MISSING; NS.setData = setData;
  NS.parseDelimited = parseDelimited; NS.decodeText = decodeText; NS.readXlsx = readXlsx; NS.openFile = openFile; NS.exampleData = exampleData; NS.updateInfo = updateInfo; NS.varOptions = varOptions; NS.levelsOf = levelsOf;
  NS.selectField = selectField; NS.multiField = multiField; NS.getMulti = getMulti; NS.getSel = getSel; NS.wireMulti = wireMulti; NS.need = need; NS.designColumns = designColumns; NS.addCard = addCard;
  NS.copyEl = copyEl; NS.flash = flash; NS.errorCard = errorCard; NS.A = A; NS.twoLevelPicker = twoLevelPicker; NS.wireLevelPicker = wireLevelPicker; NS.boxMTable = boxMTable; NS.groupDescTable = groupDescTable;
  NS.ldaPlotSVG = ldaPlotSVG;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
