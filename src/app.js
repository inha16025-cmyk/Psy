/* PsyStat 화면(UI) 코드 — 외부 통신 없음 */
(function () {
  'use strict';
  var S = window.PsyStats;
  var state = { names: [], cols: [], types: [], nrows: 0, fileName: '' };
  var current = 'data';
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
  function table(head, rows, opts) {
    opts = opts || {};
    var h = '<div class="tablewrap"><table class="res"><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (c, i) { return '<td' + (opts.left && opts.left.indexOf(i) >= 0 ? ' class="l"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table></div>';
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
    state = { names: header, cols: cols, types: types, nrows: body.length, fileName: fileName || '' };
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
    el.innerHTML = '<div class="tools"><button class="btn small" data-act="copy">복사</button><button class="btn small" data-act="del">삭제</button></div>' +
      '<h3>' + esc(title) + '</h3><div class="meta">' + esc(meta || '') + ' · ' + esc(state.fileName) + ' · ' + now.toLocaleString('ko-KR') + '</div>' + html;
    var box = $('#results');
    var empty = $('.empty', box); if (empty) empty.remove();
    box.insertBefore(el, box.firstChild);
    el.querySelector('[data-act=del]').onclick = function () { el.remove(); };
    el.querySelector('[data-act=copy]').onclick = function () { copyEl(el); };
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
      var html = table(head, rows, { left: by >= 0 ? [1] : [] }) +
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
        html = table(['', 'n', 'M', 'SD'], [[esc(state.names[a]), t2.n, f(t2.mean1, 2), f(t2.sd1, 2)], [esc(state.names[b]), t2.n, f(t2.mean2, 2), f(t2.sd2, 2)]]) +
          table(['비교', '평균차', 'SD차', 't', 'df', 'p', '95% CI', 'd<sub>z</sub>', 'r'], [[esc(state.names[a] + ' − ' + state.names[b]), f(t2.meanDiff, 2), f(t2.sdDiff, 2), f(t2.t, 2), t2.df, fp(t2.p),
            '[' + f(t2.ciLow, 2) + ', ' + f(t2.ciHigh, 2) + ']', f(t2.dz, 2), fr(t2.r)]]) +
          '<p class="note">d<sub>z</sub> = 평균차 / 차이점수의 SD (Lakens, 2013). r은 두 측정 간 상관.</p>' +
          rcode('t.test(df$' + rname(state.names[a]) + ', df$' + rname(state.names[b]) + ', paired = TRUE)');
        addCard('대응표본 t 검정', html, '');
      } else {
        var ov = getMulti('ov'), mu = Number($('#mu').value); need(ov.length, '변수를 선택하세요.');
        var rows = ov.map(function (i) { var t3 = S.tTestOneSample(state.cols[i], mu); return [esc(state.names[i]), t3.n, f(t3.mean, 2), f(t3.sd, 2), f(t3.t, 2), t3.df, fp(t3.p), '[' + f(t3.ciLow, 2) + ', ' + f(t3.ciHigh, 2) + ']', f(t3.d, 2)]; });
        html = table(['변수', 'n', 'M', 'SD', 't', 'df', 'p', '평균차 95% CI', 'd'], rows) + rcode('t.test(df$' + rname(state.names[ov[0]]) + ', mu = ' + mu + ')');
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
            ['Levene (등분산)', 'F = ' + f(a.levene.F, 2), a.levene.df1 + ', ' + a.levene.df2, fp(a.levene.p)]], { left: [0] }) +
          '<h4>사후검정 (다중비교)</h4>' + table(['비교', '평균차', 'SE', 'Tukey p', 'Games-Howell p', 'Bonferroni p'], a.posthoc.map(function (p) {
            return [esc(p.a + ' − ' + p.b), f(p.diff, 2), f(p.se, 2), fp(p.pTukey), fp(p.pGH), fp(p.pBonf)];
          })) +
          '<p class="note">등분산 가정이 의심되면 Welch ANOVA와 Games-Howell을 보고하세요. Tukey(집단 크기가 다르면 Tukey-Kramer)와 Games-Howell은 스튜던트화 범위 분포(R의 ptukey 이식)를 사용합니다.</p>' +
          rcode('m <- aov(' + rname(state.names[i]) + ' ~ factor(' + rname(state.names[g]) + '), data = df)\nsummary(m); TukeyHSD(m)\noneway.test(' + rname(state.names[i]) + ' ~ ' + rname(state.names[g]) + ', data = df)');
        addCard('일원분산분석: ' + state.names[i], html, '요인 = ' + state.names[g]);
      });
    }
  };

  A.cor = {
    group: '관계', title: '상관분석',
    desc: 'Pearson·Spearman 상관행렬, 유의확률, 95% 신뢰구간.',
    form: function () {
      return multiField('v', '변수 (2개 이상)', 'num') + '<div class="field"><div class="lab">방법</div><div class="inline"><label><input type="radio" name="cm" value="pearson" checked>Pearson</label><label><input type="radio" name="cm" value="spearman">Spearman</label></div></div>' +
        '<div class="field"><div class="lab">결측 처리</div><div class="inline"><label><input type="radio" name="mm" value="pairwise" checked>대응별 제거</label><label><input type="radio" name="mm" value="listwise">목록별 제거</label></div></div>';
    },
    run: function () {
      var v = getMulti('v'); need(v.length >= 2, '변수를 2개 이상 선택하세요.');
      var m = $('input[name=cm]:checked').value, mm = $('input[name=mm]:checked').value;
      var cols = v.map(function (i) { return state.cols[i]; }), names = v.map(function (i) { return state.names[i]; });
      var res = S.corMatrix(cols, m, mm);
      var rows = names.map(function (n, a) {
        return [(a + 1) + '. ' + esc(n)].concat(names.map(function (_, b) { return b < a ? fr(res.R[a][b]) + star(res.P[a][b]) : (b === a ? '—' : ''); }));
      });
      var pairs = [];
      for (var a = 0; a < v.length; a++) for (var b = a + 1; b < v.length; b++) {
        var ct = S.corTest(cols[a], cols[b], m);
        if (mm === 'listwise') { var rr = S.completeRows(cols); ct = S.corTest(rr.map(function (r) { return cols[a][r]; }), rr.map(function (r) { return cols[b][r]; }), m); }
        pairs.push([esc(names[a] + ' – ' + names[b]), fr(ct.r), ct.n, f(ct.t, 2), fp(ct.p), '[' + fr(ct.ciLow) + ', ' + fr(ct.ciHigh) + ']']);
      }
      var html = table([''].concat(names.map(function (_, i) { return i + 1; })), rows) +
        '<p class="note">* p < .05, ** p < .01, *** p < .001 (양측).</p><h4>세부 결과</h4>' +
        table(['쌍', m === 'pearson' ? 'r' : 'ρ', 'n', 't', 'p', '95% CI (Fisher z)'], pairs) +
        (m === 'spearman' ? '<p class="note">Spearman의 p값은 SPSS와 같은 t 근사입니다. 표본이 작고 동순위가 없으면 R의 cor.test(exact = TRUE)와 약간 다를 수 있습니다.</p>' : '') +
        rcode('psych::corr.test(df[, ' + rvec(names) + '], method = "' + m + '", use = "' + (mm === 'pairwise' ? 'pairwise' : 'complete') + '")');
      addCard((m === 'pearson' ? 'Pearson' : 'Spearman') + ' 상관분석', html, v.length + '개 변수, ' + (mm === 'pairwise' ? '대응별 제거' : '목록별 제거'));
    }
  };

  A.chisq = {
    group: '관계', title: '교차분석 (χ²)',
    desc: 'Pearson χ², 우도비 검정, Fisher 정확검정(2×2), Cramér V.',
    form: function () { return selectField('r', '행 변수', 'any') + selectField('c', '열 변수', 'any'); },
    run: function () {
      var r = getSel('r'), c = getSel('c'); need(r >= 0 && c >= 0 && r !== c, '서로 다른 두 변수를 선택하세요.');
      var t = S.crosstab(state.cols[r], state.cols[c]);
      var rows = [];
      t.rows.forEach(function (rl, a) {
        rows.push([esc(rl)].concat(t.O[a].map(function (o, b) { return o + ' <span class="note">(' + f(t.E[a][b], 1) + ')</span><br><span class="note">행 ' + f(100 * o / t.rowSums[a], 1) + '%</span>'; })).concat([t.rowSums[a]]));
      });
      rows.push(['합계'].concat(t.colSums).concat([t.n]));
      var tests = [['Pearson χ²', f(t.chi2, 3), t.df, fp(t.p)], ['우도비 G²', f(t.G2, 3), t.df, fp(t.pG2)]];
      if (t.yates) { tests.push(['연속성 보정 (Yates)', f(t.yates.chi2, 3), 1, fp(t.yates.p)]); tests.push(['Fisher 정확검정 (양측)', '', '', fp(t.fisherP)]); }
      var eff = [['Cramér V', fr(t.cramerV)]];
      if (t.yates) { eff.push(['φ', fr(t.phi)]); eff.push(['오즈비 (OR)', f(t.oddsRatio, 3)]); }
      var html = table([esc(state.names[r]) + ' \\ ' + esc(state.names[c])].concat(t.cols.map(esc)).concat(['합계']), rows) +
        '<p class="note">셀: 관측빈도 (기대빈도), 행 백분율.</p>' + table(['검정', '값', 'df', 'p'], tests, { left: [0] }) + table(['효과크기', '값'], eff) +
        (t.lowExpected ? '<div class="warn">기대빈도 5 미만 셀: ' + t.lowExpected + ' / ' + t.cells + '개 (' + f(100 * t.lowExpected / t.cells, 1) + '%). 20%를 넘으면 χ² 근사가 부정확할 수 있습니다' + (t.yates ? ' — Fisher 정확검정을 보고하세요.' : '. 범주 병합을 고려하세요.') + '</div>' : '') +
        rcode('tab <- table(df$' + rname(state.names[r]) + ', df$' + rname(state.names[c]) + ')\nchisq.test(tab, correct = FALSE); fisher.test(tab)');
      addCard('교차분석', html, state.names[r] + ' × ' + state.names[c]);
    }
  };

  A.lm = {
    group: '회귀', title: '선형회귀',
    desc: '다중회귀: B, SE, β, t, p, 95% CI, R², VIF, Durbin-Watson. 문자형 예측변수는 자동 더미코딩.',
    form: function () { return selectField('y', '종속변수', 'num') + multiField('x', '예측변수', 'any', '문자형 변수는 첫 범주를 기준으로 더미코딩됩니다.'); },
    run: function () {
      var y = getSel('y'), x = getMulti('x').filter(function (i) { return i !== y; }); need(y >= 0 && x.length, '종속변수와 예측변수를 선택하세요.');
      var dc = designColumns(x), m = S.linearRegression(state.cols[y], dc.cols, dc.names);
      var html = table(['R', 'R²', '수정 R²', '추정값 SE', 'F', 'df', 'p', 'N'], [[fr(m.R), fr(m.R2), fr(m.adjR2), f(m.see, 3), f(m.F, 2), m.dfM + ', ' + m.dfE, fp(m.p), m.n]]) +
        table(['예측변수', 'B', 'SE', 'β', 't', 'p', '95% CI', 'VIF'], m.coefs.map(function (c) {
          return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.beta, 3), f(c.t, 2), fp(c.p), '[' + f(c.ciLow, 3) + ', ' + f(c.ciHigh, 3) + ']', f(c.vif, 2)];
        })) +
        (dc.notes.length ? '<p class="note">더미코딩 — ' + esc(dc.notes.join('; ')) + '</p>' : '') +
        '<p class="note">Durbin-Watson = ' + f(m.durbinWatson, 3) + '. VIF > 10(보수적으로 > 5)이면 다중공선성을 점검하세요. 계산은 QR 분해 기반 최소제곱으로, R의 lm()과 같은 값을 냅니다.</p>' +
        (m.coefs.some(function (c) { return c.vif > 10; }) ? '<div class="warn">VIF가 10을 넘는 예측변수가 있습니다.</div>' : '') +
        rcode('m <- lm(' + rname(state.names[y]) + ' ~ ' + x.map(function (i) { return rname(state.names[i]); }).join(' + ') + ', data = df)\nsummary(m); car::vif(m); lm.beta::lm.beta(m)');
      addCard('선형회귀: ' + state.names[y], html, x.length + '개 예측변수');
    }
  };

  A.logit = {
    group: '회귀', title: '로지스틱 회귀',
    desc: '이분형 종속변수: B, SE, Wald, p, 오즈비(95% CI), 모형 χ², Nagelkerke R², Hosmer-Lemeshow, 분류표, AUC.',
    form: function () {
      return selectField('y', '종속변수 (두 범주)', 'any') + '<div class="field" id="ev" style="display:none"><label for="evv">사건(=1)으로 볼 범주</label><select id="evv"></select></div>' +
        multiField('x', '예측변수', 'any', '문자형 변수는 첫 범주를 기준으로 더미코딩됩니다.') +
        '<div class="field"><label for="cut">분류 기준 확률</label><input type="number" id="cut" value="0.5" step="0.05" min="0.05" max="0.95"></div>';
    },
    wire: function () {
      $('#y').onchange = function () {
        var i = getSel('y'); if (i < 0) { $('#ev').style.display = 'none'; return; }
        var lv = levelsOf(i);
        $('#evv').innerHTML = lv.map(function (l) { return '<option>' + esc(l) + '</option>'; }).join('');
        $('#evv').selectedIndex = lv.length - 1;
        $('#ev').style.display = '';
        if (lv.length !== 2) $('#ev').insertAdjacentHTML('beforeend', '<div class="hint">주의: 이 변수는 ' + lv.length + '개 범주입니다. 선택한 범주 = 1, 나머지 = 0으로 분석합니다.</div>');
      };
    },
    run: function () {
      var y = getSel('y'), x = getMulti('x').filter(function (i) { return i !== y; }); need(y >= 0 && x.length, '종속변수와 예측변수를 선택하세요.');
      var ev = $('#evv').value, cut = Number($('#cut').value) || 0.5;
      var yy = state.cols[y].map(function (v) { return v === null ? null : (String(v) === ev ? 1 : 0); });
      var dc = designColumns(x), m = S.logisticRegression(yy, dc.cols, dc.names, { cutoff: cut });
      var cl = m.classification;
      var html = (m.warnings.length ? '<div class="warn">' + m.warnings.map(esc).join('<br>') + '</div>' : '') +
        '<h4>모형 적합</h4>' + table(['N', '사건 수', '−2LL', '모형 χ²', 'df', 'p', 'Cox-Snell R²', 'Nagelkerke R²', 'McFadden R²', 'AIC', 'BIC'],
          [[m.n, m.nEvents, f(m.deviance, 3), f(m.chi2, 3), m.dfM, fp(m.pModel), fr(m.coxSnell), fr(m.nagelkerke), fr(m.mcfadden), f(m.aic, 2), f(m.bic, 2)]]) +
        '<h4>회귀계수</h4>' + table(['예측변수', 'B', 'SE', 'Wald χ²', 'p', 'OR', 'OR 95% CI'], m.coefs.map(function (c) {
          return [esc(c.name), f(c.b, 3), f(c.se, 3), f(c.wald, 3), fp(c.p), f(c.or, 3), '[' + f(c.orLow, 3) + ', ' + f(c.orHigh, 3) + ']'];
        })) +
        '<h4>Hosmer-Lemeshow 적합도</h4>' + table(['χ²', 'df', 'p', '집단 수'], [[f(m.hl.chi2, 3), m.hl.df, fp(m.hl.p), m.hl.groups]]) +
        '<h4>분류표 (기준 = ' + cut + ')</h4>' + table(['관측 \\ 예측', '0', '1', '정확도'], [
          ['0 (' + esc(levelsOf(y).length === 2 ? levelsOf(y).filter(function (l) { return l !== ev; })[0] : '기타') + ')', cl.tn, cl.fp, f(100 * cl.specificity, 1) + '% (특이도)'],
          ['1 (' + esc(ev) + ')', cl.fn, cl.tp, f(100 * cl.sensitivity, 1) + '% (민감도)'], ['전체', '', '', f(100 * cl.accuracy, 1) + '%']], { left: [0] }) +
        '<p class="note">AUC (ROC 곡선 아래 면적) = ' + fr(m.auc) + '. 반복 ' + m.iterations + '회 (IRLS, ' + (m.converged ? '수렴' : '<b>미수렴</b>') + ').</p>' +
        (dc.notes.length ? '<p class="note">더미코딩 — ' + esc(dc.notes.join('; ')) + '</p>' : '') +
        '<p class="note">Wald χ² = (B/SE)². 계수·SE는 R의 glm(family = binomial)과 같습니다. Hosmer-Lemeshow는 예측확률의 분위수(10분위)로 집단을 나누는 방식(R ResourceSelection::hoslem.test와 동일)이어서, 동점 처리가 다른 SPSS와는 값이 약간 다를 수 있습니다. 표본이 크면 H-L 검정은 과민해지므로 AUC·보정 정도와 함께 보세요(Hosmer, Lemeshow, & Sturdivant, 2013).</p>' +
        rcode('df$y01 <- as.integer(df$' + rname(state.names[y]) + ' == "' + ev + '")\nm <- glm(y01 ~ ' + x.map(function (i) { return rname(state.names[i]); }).join(' + ') + ', data = df, family = binomial)\nsummary(m); exp(cbind(OR = coef(m), confint.default(m)))\nResourceSelection::hoslem.test(m$y, fitted(m), g = 10)');
      addCard('이분형 로지스틱 회귀: ' + state.names[y] + ' = ' + ev, html, x.length + '개 예측변수');
    }
  };

  A.alpha = {
    group: '척도', title: '신뢰도 (Cronbach α)',
    desc: 'Cronbach α, 표준화 α, 수정된 문항-총점 상관, 문항 삭제 시 α.',
    form: function () { return multiField('v', '문항 (2개 이상)', 'num') + multiField('rev', '역채점할 문항 (선택)', 'num') + '<div class="field"><label for="rmax">역채점: (최솟값 + 최댓값) − 점수</label><div class="inline"><input type="number" id="rmin" value="1" style="width:70px"> + <input type="number" id="rmax" value="5" style="width:70px"></div></div>'; },
    run: function () {
      var v = getMulti('v'), rev = getMulti('rev'); need(v.length >= 2, '문항을 2개 이상 선택하세요.');
      var k = Number($('#rmin').value) + Number($('#rmax').value);
      var cols = v.map(function (i) { return rev.indexOf(i) >= 0 ? state.cols[i].map(function (x) { return x === null ? null : k - x; }) : state.cols[i]; });
      var names = v.map(function (i) { return state.names[i] + (rev.indexOf(i) >= 0 ? ' (R)' : ''); });
      var r = S.reliability(cols, names);
      var html = table(['Cronbach α', '표준화 α', '평균 문항간 r', '문항 수', 'N'], [[fr(r.alpha), fr(r.stdAlpha), fr(r.meanInterItem), r.k, r.n]]) +
        table(['문항', 'M', 'SD', '수정된 문항-총점 r', '삭제 시 α'], r.items.map(function (it) { return [esc(it.name), f(it.mean, 2), f(it.sd, 2), fr(it.rCorrected), fr(it.alphaIfDeleted)]; })) +
        '<p class="note">결측은 목록별 제거(SPSS와 동일). R의 psych::alpha는 기본이 대응별(pairwise)이라 결측이 있으면 값이 약간 다를 수 있습니다. α는 타우 동등성을 가정하므로 McDonald ω도 함께 보고하는 것이 권장됩니다(McNeish, 2018) — ω는 현재 버전에 없습니다.</p>' +
        rcode('psych::alpha(na.omit(df[, ' + rvec(v.map(function (i) { return state.names[i]; })) + '])' + (rev.length ? ', keys = ' + rvec(rev.map(function (i) { return state.names[i]; })) : '') + ')');
      addCard('신뢰도 분석', html, v.length + '문항');
    }
  };

  /* ---------------- 네트워크 분석 ---------------- */
  function networkSVG(net, labels, opts) {
    opts = opts || {};
    var p = net.length, W = 560, H = 480, pad = 40, pos = opts.layout || S.layoutFR(net), maxw = opts.maxw || 0;
    if (!maxw) for (var a = 0; a < p; a++) for (var b = 0; b < p; b++) maxw = Math.max(maxw, Math.abs(net[a][b]));
    var R = Math.max(14, Math.min(24, 220 / p));
    var X = function (i) { return pad + R + pos[i][0] * (W - 2 * pad - 2 * R); }, Y = function (i) { return pad + R + pos[i][1] * (H - 2 * pad - 2 * R); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;background:var(--panel)" font-family="sans-serif">';
    var edges = [];
    for (var i = 0; i < p; i++) for (var j = i + 1; j < p; j++) if (net[i][j] !== 0) edges.push([i, j, net[i][j]]);
    edges.sort(function (x, y) { return Math.abs(x[2]) - Math.abs(y[2]); });
    edges.forEach(function (e) {
      var w = Math.abs(e[2]) / (maxw || 1);
      s += '<line x1="' + X(e[0]).toFixed(1) + '" y1="' + Y(e[0]).toFixed(1) + '" x2="' + X(e[1]).toFixed(1) + '" y2="' + Y(e[1]).toFixed(1) +
        '" stroke="' + (e[2] > 0 ? '#2b5fc7' : '#c8372d') + '" stroke-width="' + (0.8 + 9 * w).toFixed(2) + '" stroke-opacity="' + (0.25 + 0.75 * w).toFixed(2) + '"' +
        (e[2] < 0 ? ' stroke-dasharray="6 3"' : '') + '><title>' + esc(labels[e[0]] + ' – ' + labels[e[1]]) + ': ' + e[2].toFixed(3) + '</title></line>';
    });
    for (var n = 0; n < p; n++) {
      s += '<circle cx="' + X(n).toFixed(1) + '" cy="' + Y(n).toFixed(1) + '" r="' + R + '" fill="#ffffff" stroke="#3a4152" stroke-width="1.5"/>';
      if (opts.pred) { // 예측력 링
        var ang = 2 * Math.PI * Math.max(0, Math.min(1, opts.pred[n])), x1 = X(n), y1 = Y(n) - R, x2 = X(n) + R * Math.sin(ang), y2 = Y(n) - R * Math.cos(ang);
        s += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A' + R + ' ' + R + ' 0 ' + (ang > Math.PI ? 1 : 0) + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" fill="none" stroke="#8a94a6" stroke-width="4"/>';
      }
      var lab = labels[n].length > 6 ? labels[n].slice(0, 6) : labels[n];
      s += '<text x="' + X(n).toFixed(1) + '" y="' + (Y(n) + 4).toFixed(1) + '" text-anchor="middle" font-size="' + (lab.length > 4 ? 8.5 : lab.length > 3 ? 10 : 12) + '" style="fill:#1d2433">' + esc(lab) + '<title>' + esc(labels[n]) + '</title></text>';
    }
    return s + '</svg>';
  }

  function centralityPlotSVG(labels, measures) {
    var keys = Object.keys(measures), p = labels.length, rowH = 20, top = 30, left = 90, pw = 130, gap = 20;
    var W = left + keys.length * (pw + gap), H = top + p * rowH + 30;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="11">';
    labels.forEach(function (l, i) { s += '<text x="' + (left - 8) + '" y="' + (top + i * rowH + rowH / 2 + 4) + '" text-anchor="end">' + esc(l) + '</text>'; });
    keys.forEach(function (k, ki) {
      var x0 = left + ki * (pw + gap), z = measures[k], lo = -2.5, hi = 2.5;
      z.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
      var X = function (v) { return x0 + (v - lo) / (hi - lo) * pw; };
      s += '<text x="' + (x0 + pw / 2) + '" y="16" text-anchor="middle" font-weight="600">' + esc(k) + '</text>';
      s += '<rect x="' + x0 + '" y="' + top + '" width="' + pw + '" height="' + p * rowH + '" fill="none" stroke="#8a94a6" stroke-width="0.6"/>';
      s += '<line x1="' + X(0) + '" y1="' + top + '" x2="' + X(0) + '" y2="' + (top + p * rowH) + '" stroke="#8a94a6" stroke-dasharray="2 2"/>';
      [-2, 0, 2].forEach(function (t) { if (t >= lo && t <= hi) s += '<text x="' + X(t) + '" y="' + (top + p * rowH + 14) + '" text-anchor="middle" fill="#8a94a6">' + t + '</text>'; });
      var pts = [];
      z.forEach(function (v, i) { if (isFinite(v)) pts.push(X(v).toFixed(1) + ',' + (top + i * rowH + rowH / 2)); });
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2b5fc7" stroke-width="1.5"/>';
      z.forEach(function (v, i) { if (isFinite(v)) s += '<circle cx="' + X(v).toFixed(1) + '" cy="' + (top + i * rowH + rowH / 2) + '" r="3" fill="#2b5fc7"/>'; });
    });
    return s + '<text x="' + (left + (W - left) / 2) + '" y="' + (H - 2) + '" text-anchor="middle" fill="#8a94a6">z 점수</text></svg>';
  }

  function svgDownload(svgEl, name, png) {
    var xml = new XMLSerializer().serializeToString(svgEl).replace(/var\(--panel\)/g, '#ffffff').replace(/var\(--ink\)/g, '#1d2433');
    if (!png) { download(name + '.svg', xml, 'image/svg+xml'); return; }
    var vb = svgEl.viewBox.baseVal, img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = vb.width * 3; c.height = vb.height * 3;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.png'; a.click(); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }
  function download(name, content, type) {
    var b = new Blob([content], { type: type + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  A.network = {
    group: '네트워크', title: '네트워크 분석 (GGM)',
    desc: '가우시안 그래프 모형: EBICglasso(qgraph 동일 절차) 또는 편상관 네트워크, 중심성, 부트스트랩 안정성.',
    form: function () {
      return multiField('v', '노드 변수 (3개 이상)', 'num') +
        '<div class="field"><label for="est">추정 방법</label><select id="est"><option value="ebicglasso">EBICglasso (정규화 편상관)</option><option value="pcor">편상관 (비정규화)</option></select></div>' +
        '<div class="field" id="ebicopts"><label for="gam">EBIC γ (감마)</label><select id="gam"><option value="0.5" selected>0.5 (기본, 보수적)</option><option value="0.25">0.25</option><option value="0">0 (BIC)</option></select>' +
        '<div class="inline" style="margin-top:6px"><label><input type="checkbox" id="thr">threshold = TRUE (특이도 강화)</label></div></div>' +
        '<div class="field" id="pcopts" style="display:none"><label for="alp">유의하지 않은 엣지 제거 (α)</label><select id="alp"><option value="0">제거 안 함</option><option value="0.05">.05</option><option value="0.01">.01</option></select></div>' +
        '<div class="field"><div class="lab">상관 종류</div><div class="inline"><label><input type="radio" name="cr" value="pearson" checked>Pearson</label><label><input type="radio" name="cr" value="spearman">Spearman</label></div>' +
        '<div class="hint">리커트 문항은 qgraph의 cor_auto(다분상관)를 흔히 쓰지만 현재 버전은 다분상관을 지원하지 않습니다. 5점 이상 척도에서는 Spearman이 실용적 대안입니다.</div></div>' +
        '<div class="field"><div class="lab">안정성 분석 (부트스트랩, bootnet 방식)</div><div class="inline"><label>엣지 부트스트랩 <input type="number" id="nb" value="0" min="0" step="100" style="width:80px"> 회</label></div>' +
        '<div class="inline" style="margin-top:4px"><label>사례 제거 부트스트랩 <input type="number" id="nc" value="0" min="0" step="100" style="width:80px"> 회</label></div>' +
        '<div class="inline" style="margin-top:4px"><label>난수 시드 <input type="number" id="seed" value="1234" style="width:80px"></label></div>' +
        '<div class="hint">0이면 생략. 논문 보고용으로는 각각 1000회 권장(Epskamp et al., 2018). 변수 15개·1000회 기준 수 분 걸릴 수 있습니다.</div></div>';
    },
    wire: function () {
      $('#est').onchange = function () { var e = $('#est').value; $('#ebicopts').style.display = e === 'ebicglasso' ? '' : 'none'; $('#pcopts').style.display = e === 'pcor' ? '' : 'none'; };
    },
    run: function () {
      var v = getMulti('v'); need(v.length >= 3, '노드 변수를 3개 이상 선택하세요.');
      var names = v.map(function (i) { return state.names[i]; });
      var rows = S.completeRows(v.map(function (i) { return state.cols[i]; }));
      var cols = v.map(function (i) { return rows.map(function (r) { return state.cols[i][r]; }); });
      var n = rows.length; need(n > v.length + 2, '완전 사례 수가 너무 적습니다.');
      var opts = { method: $('#est').value, cor: $('input[name=cr]:checked').value, gamma: Number($('#gam').value), threshold: $('#thr').checked, alpha: Number($('#alp').value) || 0 };
      var res = S.estimateNetwork(cols, opts), net = res.network, p = v.length;
      var ce = S.centrality(net), layout = S.layoutFR(net);
      var nEdges = 0, possible = p * (p - 1) / 2, edgeRows = [];
      for (var a = 0; a < p; a++) for (var b = a + 1; b < p; b++) if (net[a][b] !== 0) { nEdges++; edgeRows.push([a, b, net[a][b]]); }
      edgeRows.sort(function (x, y) { return Math.abs(y[2]) - Math.abs(x[2]); });
      var meanW = 0; edgeRows.forEach(function (e) { meanW += Math.abs(e[2]); }); meanW = nEdges ? meanW / nEdges : 0;
      var pred = opts.method === 'pcor' ? S.predictability(res.K) : null;
      var est = opts.method === 'ebicglasso' ? 'EBICglasso (γ = ' + opts.gamma + (opts.threshold ? ', threshold' : '') + ')' : '편상관' + (opts.alpha ? ' (p < ' + opts.alpha + ' 엣지만)' : '');
      var labels = names.map(function (nm, i) { return String(i + 1); });
      var useNum = names.some(function (nm) { return nm.length > 6; });
      var plotLabels = useNum ? labels : names;
      var zs = { '강도 Strength': S.zscore(ce.strength), '근접 Closeness': S.zscore(ce.closeness), '매개 Betweenness': S.zscore(ce.betweenness), '기대영향 EI': S.zscore(ce.expectedInfluence) };
      var html = (res.notes || []).map(function (t) { return '<div class="warn">' + esc(t) + '</div>'; }).join('') +
        table(['N (완전 사례)', '노드', '엣지', '밀도', '평균 |가중치|', opts.method === 'ebicglasso' ? '선택 λ' : '상관'], [[n, p, nEdges + ' / ' + possible, fr(nEdges / possible), fr(meanW), opts.method === 'ebicglasso' ? f(res.lambda, 4) : opts.cor]]) +
        '<div class="net-plot">' + networkSVG(net, plotLabels, { layout: layout, pred: pred }) + '</div>' +
        '<div class="legend"><span class="sw" style="background:#2b5fc7"></span>정적 편상관<span class="sw" style="background:#c8372d"></span>부적 편상관 (점선) · 선 굵기 ∝ |가중치| · 배치: Fruchterman-Reingold' + (pred ? ' · 회색 링: 노드 예측력(R²)' : '') + '</div>' +
        (useNum ? '<p class="note">노드 번호: ' + names.map(function (nm, i) { return (i + 1) + ' = ' + esc(nm); }).join(', ') + '</p>' : '') +
        '<div class="inline" style="margin:6px 0"><button class="btn small" data-dl="svg">그림 SVG 저장</button><button class="btn small" data-dl="png">그림 PNG 저장</button><button class="btn small" data-dl="csv">가중치 행렬 CSV 저장</button></div>' +
        '<h4>중심성</h4>' + table(['노드', '강도', '근접', '매개', '기대영향'].concat(pred ? ['예측력 R²'] : []), names.map(function (nm, i) {
          return [esc(nm), f(ce.strength[i], 3), isFinite(ce.closeness[i]) ? f(ce.closeness[i], 4) : '—', f(ce.betweenness[i], 0), f(ce.expectedInfluence[i], 3)].concat(pred ? [fr(pred[i])] : []);
        })) +
        '<div class="cent-plot">' + centralityPlotSVG(names, zs) + '</div>' +
        '<p class="note">중심성 정의는 qgraph::centrality_auto와 같습니다(거리 = 1/|w|; 근접중심성은 가장 큰 연결 성분 안에서만 계산). 근접·매개 중심성은 심리 네트워크에서 안정성이 낮은 경우가 많아 해석에 신중해야 합니다(Bringmann et al., 2019). 강도·기대영향은 사례 제거 부트스트랩의 CS 계수로 안정성을 확인한 뒤 해석하세요.</p>' +
        '<h4>엣지 목록 (|가중치| 순)</h4>' + table(['노드 1', '노드 2', '편상관'], edgeRows.slice(0, 60).map(function (e) { return [esc(names[e[0]]), esc(names[e[1]]), fr(e[2])]; }), { left: [1] }) +
        (edgeRows.length > 60 ? '<p class="note">상위 60개만 표시. 전체는 CSV로 저장하세요.</p>' : '') +
        '<h4>가중치 행렬</h4>' + table([''].concat(names.map(function (_, i) { return i + 1; })), names.map(function (nm, a) {
          return [(a + 1) + '. ' + esc(nm)].concat(names.map(function (_, b) { return a === b ? '—' : (net[a][b] === 0 ? '<span class="note">0</span>' : fr(net[a][b])); }));
        })) +
        '<div class="bootbox"></div>' +
        rcode('library(qgraph)\nd <- na.omit(df[, ' + rvec(names) + '])\n' +
          (opts.method === 'ebicglasso'
            ? 'net <- EBICglasso(cor(d' + (opts.cor === 'spearman' ? ', method = "spearman"' : '') + '), n = nrow(d), gamma = ' + opts.gamma + (opts.threshold ? ', threshold = TRUE' : '') + ')\n'
            : 'net <- -cov2cor(solve(cor(d' + (opts.cor === 'spearman' ? ', method = "spearman"' : '') + '))); diag(net) <- 0\n') +
          'qgraph(net, layout = "spring", labels = colnames(d))\ncentrality_auto(net)$node.centrality\n# 안정성: library(bootnet)\n# b1 <- bootnet(d, default = "EBICglasso", nBoots = 1000)\n# b2 <- bootnet(d, default = "EBICglasso", type = "case", nBoots = 1000); corStability(b2)');
      var card = addCard('네트워크 분석: ' + est, html, p + '개 노드');
      card.querySelector('[data-dl=svg]').onclick = function () { svgDownload(card.querySelector('.net-plot svg'), 'network', false); };
      card.querySelector('[data-dl=png]').onclick = function () { svgDownload(card.querySelector('.net-plot svg'), 'network', true); };
      card.querySelector('[data-dl=csv]').onclick = function () {
        var csv = '﻿,' + names.join(',') + '\n' + names.map(function (nm, a) { return nm + ',' + net[a].map(function (x) { return x.toFixed(6); }).join(','); }).join('\n');
        download('network_weights.csv', csv, 'text/csv');
      };
      var nb = Math.max(0, Math.floor(Number($('#nb').value) || 0)), nc = Math.max(0, Math.floor(Number($('#nc').value) || 0));
      if (nb || nc) runBootstrap(card.querySelector('.bootbox'), cols, names, opts, net, ce, nb, nc, Number($('#seed').value) || 1);
    }
  };

  function runBootstrap(box, cols, names, opts, net, ce, nb, nc, seed) {
    var rand = S.rng(seed), p = names.length, orig = S.upperVec(net), pairs = [];
    for (var a = 0; a < p; a++) for (var b = a + 1; b < p; b++) pairs.push([a, b]);
    var edgeSamples = [], props = [0.05, 0.128, 0.206, 0.283, 0.361, 0.439, 0.517, 0.594, 0.672, 0.75];
    var corrS = props.map(function () { return []; }), corrE = props.map(function () { return []; }), corrB = props.map(function () { return []; }), corrC = props.map(function () { return []; });
    var total = nb + nc, done = 0, t0 = Date.now();
    box.innerHTML = '<h4>안정성 분석 진행 중…</h4><div class="progress"><div></div></div><div class="note prog">0 / ' + total + '</div>';
    function step() {
      var until = Date.now() + 120;
      try {
        while (done < total && Date.now() < until) {
          if (done < nb) edgeSamples.push(S.bootEdgeOnce(cols, opts, rand).edges);
          else {
            var k = (done - nb) % props.length, c = S.caseDropOnce(cols, opts, props[k], rand);
            corrS[k].push(S.pearson(ce.strength, c.strength)); corrE[k].push(S.pearson(ce.expectedInfluence, c.expectedInfluence));
            corrB[k].push(S.pearson(ce.betweenness, c.betweenness));
            var okC = ce.closeness.map(function (x, i) { return isFinite(x) && isFinite(c.closeness[i]); });
            corrC[k].push(S.pearson(ce.closeness.filter(function (_, i) { return okC[i]; }), c.closeness.filter(function (_, i) { return okC[i]; })));
          }
          done++;
        }
      } catch (e) { box.innerHTML = '<div class="warn">부트스트랩 중 오류: ' + esc(e.message) + '</div>'; return; }
      box.querySelector('.progress > div').style.width = (100 * done / total) + '%';
      var el = (Date.now() - t0) / 1000;
      box.querySelector('.prog').textContent = done + ' / ' + total + ' · 경과 ' + el.toFixed(0) + '초 · 남은 시간 약 ' + (done ? (el / done * (total - done)).toFixed(0) : '?') + '초';
      if (done < total) { setTimeout(step, 0); return; }
      var html = '<h4>안정성 분석 결과 (시드 = ' + seed + ')</h4>';
      if (nb) {
        var rows = pairs.map(function (pr, e) {
          var s = edgeSamples.map(function (x) { return x[e]; }).sort(function (x, y) { return x - y; });
          var lo = S.quantile(s, 0.025), hi = S.quantile(s, 0.975), nz = s.filter(function (x) { return x !== 0; }).length / s.length;
          return { pr: pr, w: orig[e], m: S.mean(s), lo: lo, hi: hi, nz: nz };
        }).sort(function (x, y) { return Math.abs(y.w) - Math.abs(x.w); });
        html += '<p class="note">엣지 부트스트랩 ' + nb + '회: 비모수 재표집, 2.5–97.5 백분위 구간. "포함 비율"은 엣지가 0이 아닌 표본의 비율.</p>' +
          table(['엣지', '원 추정치', '부트 평균', '95% 구간', '포함 비율'], rows.filter(function (r) { return r.w !== 0 || r.nz > 0.5; }).slice(0, 80).map(function (r) {
            return [esc(names[r.pr[0]] + ' – ' + names[r.pr[1]]), fr(r.w), fr(r.m), '[' + fr(r.lo) + ', ' + fr(r.hi) + ']', f(100 * r.nz, 1) + '%'];
          })) + '<p class="note">정규화(EBICglasso) 추정에서 이 구간은 엄밀한 신뢰구간이 아니라 추정 정확도의 지표입니다(Epskamp et al., 2018). 구간이 서로 크게 겹치면 엣지 간 크기 순위를 해석하지 마세요.</p>';
      }
      if (nc) {
        var cs = [['강도 Strength', corrS], ['기대영향 EI', corrE], ['매개 Betweenness', corrB], ['근접 Closeness', corrC]].map(function (m) { return [m[0], f(S.csCoefficient(props, m[1], 0.7, 0.95), 2)]; });
        html += '<p class="note">사례 제거 부트스트랩 ' + nc + '회 (제거 비율 5–75%, 10단계).</p>' + table(['중심성', 'CS 계수 (r ≥ .70, 95%)'], cs) +
          '<p class="note">CS 계수는 .25 이상이어야 하고, .50 이상이 바람직합니다(Epskamp et al., 2018). bootnet의 corStability()와 같은 정의입니다.</p>' +
          table(['제거 비율'].concat(props.map(function (x) { return Math.round(x * 100) + '%'; })), [['강도: 평균 r'].concat(corrS.map(function (a) { return a.length ? fr(S.mean(a.filter(S.isNum))) : '—'; }))]);
      }
      box.innerHTML = html;
    }
    setTimeout(step, 30);
  }

  /* ---------------- 데이터 화면 ---------------- */
  function dataView() {
    var h = '<h2>데이터</h2><p class="desc">엑셀에서 범위를 복사(Ctrl+C)해 아래에 붙여넣거나, CSV/XLSX 파일을 여세요. 첫 행은 변수 이름입니다. 빈 칸, NA, ., #NULL!은 결측으로 처리됩니다.</p>' +
      '<div class="field"><textarea class="paste" id="pastebox" placeholder="여기에 엑셀 자료를 붙여넣기 (Ctrl+V)"></textarea></div>' +
      '<div class="inline"><button class="btn primary" id="pasteGo">붙여넣은 자료 불러오기</button><button class="btn" id="openBtn2">파일 열기</button></div>';
    if (state.nrows) {
      h += '<h4 style="margin-top:18px">변수 형식</h4><div class="varlist" style="max-height:260px">' + state.names.map(function (n, i) {
        return '<label>' + esc(n) + '<span class="vt"><select data-type="' + i + '"><option value="num"' + (state.types[i] === 'num' ? ' selected' : '') + '>숫자</option><option value="text"' + (state.types[i] === 'text' ? ' selected' : '') + '>문자</option></select></span></label>';
      }).join('') + '</div><div class="hint">숫자로 코딩된 범주형 변수(예: 성별 1/2)는 숫자 그대로 두어도 집단변수로 쓸 수 있습니다. 회귀의 예측변수로 쓸 범주형은 "문자"로 바꾸면 더미코딩됩니다.</div>';
    }
    return h;
  }
  function dataPreview() {
    if (!state.nrows) return '<div class="empty"><h2>PsyStat</h2><p>폐쇄망용 단일 파일 통계 도구입니다. 외부와 통신하지 않으며, 자료는 이 PC의 브라우저 밖으로 나가지 않습니다.</p><p>왼쪽에서 자료를 붙여넣거나, 위의 <b>예시 데이터</b>로 먼저 둘러보세요.</p></div>';
    var maxR = Math.min(state.nrows, 300);
    var h = '<div class="card"><h3>데이터 미리보기</h3><div class="meta">' + esc(state.fileName) + ' · ' + state.nrows + '행 × ' + state.names.length + '변수' + (state.nrows > maxR ? ' (처음 ' + maxR + '행 표시)' : '') + '</div><div class="datagrid"><table><thead><tr><th>#</th>' +
      state.names.map(function (n, i) { return '<th>' + esc(n) + '<br><span class="note">' + (state.types[i] === 'num' ? '숫자' : '문자') + '</span></th>'; }).join('') + '</tr></thead><tbody>';
    for (var r = 0; r < maxR; r++) {
      h += '<tr><td class="na">' + (r + 1) + '</td>' + state.cols.map(function (c) { var v = c[r]; return v === null ? '<td class="na">·</td>' : '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
    }
    return h + '</tbody></table></div></div>';
  }

  /* ---------------- 화면 전환 ---------------- */
  var savedResults = null;
  function select(id) {
    current = id;
    $$('nav.side a').forEach(function (a) { a.classList.toggle('active', a.dataset.id === id); });
    var opts = $('#opts'), res = $('#results');
    if (id === 'data') {
      if (!savedResults) savedResults = document.createDocumentFragment();
      while (res.firstChild && !res.firstChild.classList.contains('datapreview')) savedResults.appendChild(res.firstChild);
      opts.innerHTML = dataView();
      res.innerHTML = '<div class="datapreview">' + dataPreview() + '</div>';
      $('#pasteGo').onclick = function () { var t = $('#pastebox').value; if (!t.trim()) return; try { setData(parseDelimited(t), '붙여넣은 자료'); } catch (e) { alert(e.message); } };
      $('#openBtn2').onclick = function () { $('#file').click(); };
      $$('[data-type]').forEach(function (s) {
        s.onchange = function () {
          var i = Number(s.dataset.type);
          if (s.value === 'num') {
            var conv = state.cols[i].map(function (v) { return v === null ? null : Number(v); });
            if (conv.some(function (v) { return v !== null && isNaN(v); })) { alert('숫자로 바꿀 수 없는 값이 있습니다.'); s.value = 'text'; return; }
            state.cols[i] = conv;
          } else state.cols[i] = state.cols[i].map(function (v) { return v === null ? null : String(v); });
          state.types[i] = s.value; $('#results').innerHTML = '<div class="datapreview">' + dataPreview() + '</div>';
        };
      });
      return;
    }
    var pv = $('.datapreview', res); if (pv) pv.remove();
    if (savedResults && savedResults.childNodes.length) { res.appendChild(savedResults); savedResults = null; }
    if (!res.children.length) res.innerHTML = '<div class="empty"><p>분석을 실행하면 결과가 여기에 쌓입니다 (최신 결과가 위).</p></div>';
    var an = A[id];
    if (!state.nrows) { opts.innerHTML = '<h2>' + esc(an.title) + '</h2><p class="desc">먼저 데이터를 불러오세요.</p>'; return; }
    opts.innerHTML = '<h2>' + esc(an.title) + '</h2><p class="desc">' + esc(an.desc) + '</p>' + an.form() + '<button class="btn primary" id="runBtn" style="width:100%;margin-top:6px">분석 실행</button>';
    wireMulti(); if (an.wire) an.wire();
    $('#runBtn').onclick = function () {
      var btn = $('#runBtn'); btn.disabled = true; btn.textContent = '계산 중…';
      setTimeout(function () {
        try { an.run(); } catch (e) { errorCard(e); if (window.console) console.error(e); }
        btn.disabled = false; btn.textContent = '분석 실행';
        $('#results').scrollTop = 0; window.scrollTo(0, 0);
      }, 20);
    };
  }

  function buildNav() {
    var nav = $('#nav'), h = '<a data-id="data">데이터</a>', lastG = '';
    Object.keys(A).forEach(function (k) {
      if (A[k].group !== lastG) { h += '<div class="grp">' + esc(A[k].group) + '</div>'; lastG = A[k].group; }
      h += '<a data-id="' + k + '">' + esc(A[k].title) + '</a>';
    });
    h += '<div class="grp">정보</div><a data-id="about">도움말·참고문헌</a>';
    nav.innerHTML = h;
    $$('a', nav).forEach(function (a) { a.onclick = function () { a.dataset.id === 'about' ? about() : select(a.dataset.id); }; });
  }

  function about() {
    $$('nav.side a').forEach(function (a) { a.classList.toggle('active', a.dataset.id === 'about'); });
    $('#opts').innerHTML = '<h2>도움말</h2><p class="desc">PsyStat은 하나의 HTML 파일로 동작하는 오프라인 통계 도구입니다. 설치가 필요 없고, 외부 서버와 통신하지 않습니다.</p>' +
      '<p class="desc"><b>검증</b>: 모든 계산은 R 4.x(stats, car, psych, qgraph 1.9.8, glasso)의 결과와 자동 대조되었습니다. 저장소의 tests/run_tests.js에서 1,100개 이상의 수치를 비교하며, 중요한 결과는 가능하면 SPSS·R로 한 번 더 확인하세요.</p>' +
      '<p class="desc"><b>결과 내보내기</b>: 각 카드의 [복사] 후 한글·워드에 붙여넣기, 또는 상단 [결과 저장]으로 HTML 파일 저장(워드에서 열 수 있음).</p>';
    var refs = [
      ['Bringmann, L. F., et al. (2019). What do centrality measures measure in psychological networks? Journal of Abnormal Psychology, 128(8), 892–903.', 'https://doi.org/10.1037/abn0000446'],
      ['Copenhaver, M. D., & Holland, B. (1988). Computation of the distribution of the maximum studentized range statistic. Journal of Statistical Computation and Simulation, 30(1), 1–15.', 'https://doi.org/10.1080/00949658808811082'],
      ['Delacre, M., Lakens, D., & Leys, C. (2017). Why psychologists should by default use Welch’s t-test instead of Student’s t-test. International Review of Social Psychology, 30(1), 92–101.', 'https://doi.org/10.5334/irsp.82'],
      ['Epskamp, S., Borsboom, D., & Fried, E. I. (2018). Estimating psychological networks and their accuracy: A tutorial paper. Behavior Research Methods, 50(1), 195–212.', 'https://doi.org/10.3758/s13428-017-0862-1'],
      ['Epskamp, S., & Fried, E. I. (2018). A tutorial on regularized partial correlation networks. Psychological Methods, 23(4), 617–634.', 'https://doi.org/10.1037/met0000167'],
      ['Foygel, R., & Drton, M. (2010). Extended Bayesian information criteria for Gaussian graphical models. Advances in Neural Information Processing Systems, 23.', 'https://arxiv.org/abs/1011.6640'],
      ['Friedman, J., Hastie, T., & Tibshirani, R. (2008). Sparse inverse covariance estimation with the graphical lasso. Biostatistics, 9(3), 432–441.', 'https://doi.org/10.1093/biostatistics/kxm045'],
      ['Hosmer, D. W., Lemeshow, S., & Sturdivant, R. X. (2013). Applied logistic regression (3rd ed.). Wiley.', 'https://doi.org/10.1002/9781118548387'],
      ['Lakens, D. (2013). Calculating and reporting effect sizes to facilitate cumulative science. Frontiers in Psychology, 4, 863.', 'https://doi.org/10.3389/fpsyg.2013.00863'],
      ['McNeish, D. (2018). Thanks coefficient alpha, we’ll take it from here. Psychological Methods, 23(3), 412–433.', 'https://doi.org/10.1037/met0000144'],
      ['Royston, P. (1995). Remark AS R94: A remark on algorithm AS 181: The W-test for normality. Applied Statistics, 44(4), 547–551.', 'https://doi.org/10.2307/2986146'],
      ['West, S. G., Finch, J. F., & Curran, P. J. (1995). Structural equation models with nonnormal variables. In R. H. Hoyle (Ed.), Structural equation modeling (pp. 56–75). Sage.', 'https://psycnet.apa.org/record/1995-97753-004'],
      ['Williams, D. R., & Rast, P. (2020). Back to the basics: Rethinking partial correlation network methodology. British Journal of Mathematical and Statistical Psychology, 73(2), 187–212.', 'https://doi.org/10.1111/bmsp.12173']
    ];
    var res = $('#results'), pv = $('.datapreview', res); if (pv) pv.remove();
    if (savedResults && savedResults.childNodes.length) { res.appendChild(savedResults); savedResults = null; }
    addCard('참고문헌', '<ul style="padding-left:18px;margin:0">' + refs.map(function (r) { return '<li style="margin-bottom:6px">' + esc(r[0]) + ' <span class="note">' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="note">폐쇄망에서는 링크가 열리지 않으므로 DOI를 텍스트로 표기했습니다.</p>', '도움말');
  }

  function saveResults() {
    var res = $('#results').cloneNode(true);
    $$('.tools, .datapreview, .empty, .inline', res).forEach(function (e) { e.remove(); });
    var css = document.getElementById('appcss').textContent;
    var html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>PsyStat 결과</title><style>' + css + ' body{padding:20px;max-width:1000px;margin:auto}</style></head><body data-theme="light">' + res.innerHTML + '</body></html>';
    var d = new Date(), stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2);
    download('PsyStat_results_' + stamp + '.html', html, 'text/html');
  }

  /* ---------------- 시작 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    buildNav();
    $('#openBtn').onclick = function () { $('#file').click(); };
    $('#file').onchange = function (e) { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; };
    $('#exBtn').onclick = exampleData;
    $('#saveBtn').onclick = saveResults;
    $('#clearBtn').onclick = function () { if (confirm('모든 결과를 지울까요?')) { $('#results').innerHTML = ''; savedResults = null; select(current === 'about' ? 'data' : current); } };
    $('#themeBtn').onclick = function () {
      var r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      r.dataset.theme = dark ? 'light' : 'dark';
    };
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });
    updateInfo();
    select('data');
  });
  window.PsyStatApp = { setData: setData, parseDelimited: parseDelimited, select: select, exampleData: exampleData };
})();
