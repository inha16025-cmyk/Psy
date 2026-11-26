/* PsyStat 화면(UI) 코드 — 조각 8/8: 그림 (오즈비 숲 그림, 범주별 오즈비 추세 그림)
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다. */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  var esc = NS.esc, f = NS.f;

  // 글자 폭 대략 추정 (한글 등 넓은 글자 ≈ 1em, 영문·숫자 ≈ 0.6em)
  function textW(t, size) { var w = 0; String(t).split('').forEach(function (c) { w += c.charCodeAt(0) > 0x2e7f ? 1 : 0.6; }); return w * size; }

  /*
   * 행 만들기: coefs(절편 제외, designColumns 순서) + meta(designColumns의 열 정보)
   * 범주형 변수는 "변수 이름" 머리 행, 기준 범주 행(OR = 1), 각 범주 행으로 묶는다.
   */
  function buildRows(coefs, meta, showCont) {
    var rows = [], lastVar = null;
    coefs.forEach(function (c, j) {
      var m = meta[j] || { v: c.name, lv: null };
      if (m.lv === null) { if (showCont) rows.push({ label: c.name + ' (1단위)', c: c }); lastVar = null; return; }
      if (m.v !== lastVar) {
        rows.push({ label: m.v, header: true });
        rows.push({ label: m.ref + ' (기준)', isRef: true, indent: true });
        lastVar = m.v;
      }
      rows.push({ label: String(m.lv), c: c, indent: true });
    });
    return rows;
  }

  function niceTicks(lo, hi) {
    var cand = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 4, 5, 10, 20, 50, 100, 200, 500, 1000];
    var t = cand.filter(function (v) { return v >= lo * 0.999 && v <= hi * 1.001; });
    if (t.length > 8) t = t.filter(function (v) { var e = Math.log10(v); return Math.abs(e - Math.round(e)) < 1e-9 || v === 1; });
    if (t.indexOf(1) < 0) t.push(1);
    return t.sort(function (a, b) { return a - b; });
  }

  /*
   * panels: [{ title, rows }], opts: { lowLabel, highLabel }
   * x축은 로그 척도, OR = 1에 세로 점선. 95% CI가 1을 포함하지 않으면 채운 사각형, 포함하면 빈 사각형.
   */
  function forestSVG(panels, opts) {
    opts = opts || {};
    var fs = 12, rowH = 22, padTop = 10, axisH = 46, plotW = 300, gapL = 12, txtW = 150;
    var labelW = 60;
    panels.forEach(function (p) { p.rows.forEach(function (r) { labelW = Math.max(labelW, textW(r.label, fs) + (r.indent ? 14 : 0) + 4); }); if (p.title) labelW = Math.max(labelW, textW(p.title, fs) * 0.8); });
    labelW = Math.min(Math.ceil(labelW), 260);
    // 축 범위: 모든 CI를 포함하되 0.001~1000에서 자름
    var lo = 0.5, hi = 2;
    panels.forEach(function (p) { p.rows.forEach(function (r) { if (!r.c) return; [r.c.or, r.c.orLow, r.c.orHigh].forEach(function (v) { if (isFinite(v) && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); }); });
    lo = Math.max(lo, 0.001); hi = Math.min(hi, 1000);
    var L0 = Math.log10(lo) - 0.05, L1 = Math.log10(hi) + 0.05;
    var x0 = labelW + gapL, X = function (v) { return x0 + (Math.log10(v) - L0) / (L1 - L0) * plotW; };
    var nRows = 0; panels.forEach(function (p) { nRows += p.rows.length + (p.title ? 1 : 0); });
    var W = x0 + plotW + 14 + txtW, H = padTop + nRows * rowH + axisH;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="' + fs + '">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    var y = padTop, plotTop = padTop, plotBot = padTop + nRows * rowH;
    // OR = 1 기준선
    s += '<line x1="' + X(1).toFixed(1) + '" y1="' + plotTop + '" x2="' + X(1).toFixed(1) + '" y2="' + plotBot + '" stroke="#8a94a6" stroke-dasharray="3 3"/>';
    s += '<text x="' + (x0 + plotW + 14) + '" y="' + (padTop - 0) + '" font-size="10" fill="#5b6475" dominant-baseline="hanging"></text>';
    panels.forEach(function (p) {
      if (p.title) {
        s += '<text x="4" y="' + (y + rowH / 2 + 4) + '" font-weight="700">' + esc(p.title) + '</text>';
        s += '<text x="' + (x0 + plotW + 14) + '" y="' + (y + rowH / 2 + 4) + '" font-size="11" fill="#5b6475">OR [95% CI]</text>';
        y += rowH;
      }
      p.rows.forEach(function (r, k) {
        var cy = y + rowH / 2;
        if (k % 2 === 0) s += '<rect x="0" y="' + y + '" width="' + W + '" height="' + rowH + '" fill="#f3f5f9" fill-opacity="0.6"/>';
        s += '<text x="' + (r.indent ? 18 : 4) + '" y="' + (cy + 4) + '"' + (r.header ? ' font-weight="600"' : '') + (r.isRef ? ' fill="#5b6475"' : '') + '>' + esc(r.label) + '</text>';
        if (r.isRef) {
          var xr = X(1);
          s += '<path d="M' + (xr - 5).toFixed(1) + ' ' + cy + ' L' + xr.toFixed(1) + ' ' + (cy - 5) + ' L' + (xr + 5).toFixed(1) + ' ' + cy + ' L' + xr.toFixed(1) + ' ' + (cy + 5) + ' Z" fill="#ffffff" stroke="#5b6475"/>';
          s += '<text x="' + (x0 + plotW + 14) + '" y="' + (cy + 4) + '" fill="#5b6475">1 (기준)</text>';
        } else if (r.c) {
          var c = r.c, ok = isFinite(c.or) && c.or > 0;
          if (ok) {
            var a = isFinite(c.orLow) && c.orLow > 0 ? c.orLow : lo / 10, b = isFinite(c.orHigh) ? c.orHigh : hi * 10;
            var xa = Math.max(x0, X(Math.max(a, 1e-300))), xb = Math.min(x0 + plotW, X(b)), xm = X(Math.min(Math.max(c.or, lo), hi));
            s += '<line x1="' + xa.toFixed(1) + '" y1="' + cy + '" x2="' + xb.toFixed(1) + '" y2="' + cy + '" stroke="#2b5fc7" stroke-width="1.6"/>';
            if (X(a) < x0) s += '<path d="M' + x0 + ' ' + cy + ' l6 -4 l0 8 Z" fill="#2b5fc7"/>';            // 범위 밖: 화살표
            if (X(b) > x0 + plotW) s += '<path d="M' + (x0 + plotW) + ' ' + cy + ' l-6 -4 l0 8 Z" fill="#2b5fc7"/>';
            var sig = isFinite(c.orLow) && isFinite(c.orHigh) && (c.orLow > 1 || c.orHigh < 1);
            s += '<rect x="' + (xm - 4.5).toFixed(1) + '" y="' + (cy - 4.5) + '" width="9" height="9" fill="' + (sig ? '#2b5fc7' : '#ffffff') + '" stroke="#2b5fc7" stroke-width="1.6"/>';
          }
          s += '<text x="' + (x0 + plotW + 14) + '" y="' + (cy + 4) + '">' + (ok ? f(c.or, 2) + ' [' + f(c.orLow, 2) + ', ' + f(c.orHigh, 2) + ']' : '—') + '</text>';
        }
        y += rowH;
      });
    });
    // 축
    s += '<line x1="' + x0 + '" y1="' + plotBot + '" x2="' + (x0 + plotW) + '" y2="' + plotBot + '" stroke="#1d2433"/>';
    niceTicks(Math.pow(10, L0), Math.pow(10, L1)).forEach(function (t) {
      var xt = X(t); if (xt < x0 - 0.5 || xt > x0 + plotW + 0.5) return;
      s += '<line x1="' + xt.toFixed(1) + '" y1="' + plotBot + '" x2="' + xt.toFixed(1) + '" y2="' + (plotBot + 4) + '" stroke="#1d2433"/>' +
        '<text x="' + xt.toFixed(1) + '" y="' + (plotBot + 16) + '" text-anchor="middle" font-size="11">' + (t < 1 ? String(t).replace(/^0/, '0') : t) + '</text>';
    });
    s += '<text x="' + (x0 + plotW / 2) + '" y="' + (plotBot + 31) + '" text-anchor="middle" font-size="11">오즈비 (로그 척도)</text>';
    if (opts.lowLabel) s += '<text x="' + (X(1) - 6) + '" y="' + (plotBot + 43) + '" text-anchor="end" font-size="10" fill="#5b6475">← ' + esc(opts.lowLabel) + '</text>';
    if (opts.highLabel) s += '<text x="' + (X(1) + 6) + '" y="' + (plotBot + 43) + '" font-size="10" fill="#5b6475">' + esc(opts.highLabel) + ' →</text>';
    return s + '</svg>';
  }

  /*
   * 결과 카드에 숲 그림 붙이기.
   * spec: { panels: [{ title, coefs(절편 제외) }], meta, file, lowLabel, highLabel, note }
   */
  function addForest(card, spec) {
    var hasCont = spec.meta.some(function (m) { return m && m.lv === null; });
    var hasCat = spec.meta.some(function (m) { return m && m.lv !== null; });
    var box = document.createElement('div');
    box.className = 'or-plot-box';
    box.innerHTML = '<h4>그림: 오즈비와 95% 신뢰구간</h4>' +
      '<div class="inline" style="margin:4px 0 6px">' +
      (hasCont && hasCat ? '<label style="font-size:13px"><input type="checkbox" data-act="cont" checked> 연속 예측변수도 표시</label>' : '') +
      '<button class="btn small" data-act="svg">그림 SVG 저장</button><button class="btn small" data-act="png">그림 PNG 저장</button></div>' +
      '<div class="or-plot"></div>' +
      '<p class="note"><i>Note.</i> 사각형 = 오즈비, 가로선 = 95% 신뢰구간(Wald), x축은 로그 척도. 채운 사각형은 신뢰구간이 1을 포함하지 않는 경우. ' +
      '범주형 예측변수는 기준 범주(◇, OR = 1) 대비, 연속 예측변수는 1단위 증가당 오즈비입니다.' + (spec.note ? ' ' + esc(spec.note) : '') +
      ' 기준 범주는 [데이터] 화면에서 바꿀 수 있습니다.</p>';
    var details = card.querySelector('details');
    if (details) card.insertBefore(box, details); else card.appendChild(box);
    var draw = function () {
      var cb = box.querySelector('[data-act=cont]'), showCont = cb ? cb.checked : true;
      var panels = spec.panels.map(function (p) { return { title: p.title, rows: buildRows(p.coefs, spec.meta, showCont) }; });
      box.querySelector('.or-plot').innerHTML = forestSVG(panels, { lowLabel: spec.lowLabel, highLabel: spec.highLabel });
    };
    draw();
    var cb = box.querySelector('[data-act=cont]'); if (cb) cb.onchange = draw;
    box.querySelector('[data-act=svg]').onclick = function () { NS.svgDownload(box.querySelector('.or-plot svg'), spec.file, false); };
    box.querySelector('[data-act=png]').onclick = function () { NS.svgDownload(box.querySelector('.or-plot svg'), spec.file, true); };
    addTrend(box, spec);
    return box;
  }


  /*
   * 범주 추세 그림: 순서가 있는 범주(예: 20대·30대·40대·50대)를 x축에, 기준 범주 대비 오즈비를 y축에 두고 점을 잇는다.
   * series: [{ name, pts: [{ lv, or, lo, hi, isRef }] }]  (pts는 x축 순서대로)
   * opts: { log: true(로그 y축) | false, yLabel }
   */
  var COLORS = ['#2b5fc7', '#c8372d', '#2e8b57', '#b8860b', '#7b4fb0', '#1a8a9a'];
  function trendSVG(levels, series, opts) {
    opts = opts || {};
    var fs = 12, W = 560, left = 64, right = 16, top = series.length > 1 ? 34 : 14, bottom = 58, plotH = 230;
    var H = top + plotH + bottom, plotW = W - left - right;
    var vals = [1];
    series.forEach(function (sr) { sr.pts.forEach(function (p) { [p.or, p.lo, p.hi].forEach(function (v) { if (isFinite(v) && v > 0) vals.push(v); }); }); });
    var lo = Math.max(Math.min.apply(null, vals), opts.log ? 0.001 : 0), hi = Math.min(Math.max.apply(null, vals), 1000);
    var tr = opts.log ? function (v) { return Math.log10(v); } : function (v) { return v; };
    var a = tr(lo), b = tr(hi), pad = (b - a) * 0.08 || 0.1; a -= pad; b += pad;
    if (!opts.log && a < 0) a = 0;
    var Y = function (v) { return top + plotH - (tr(Math.min(Math.max(v, opts.log ? 1e-300 : -1e300), 1e300)) - a) / (b - a) * plotH; };
    var step = plotW / levels.length, X = function (k, si) { return left + step * (k + 0.5) + (series.length > 1 ? (si - (series.length - 1) / 2) * Math.min(10, step / (series.length + 2)) : 0); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="' + fs + '">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    // y축 눈금
    var ticks = opts.log ? niceTicks(Math.pow(10, a), Math.pow(10, b)) : (function () {
      var span = b - a, st = Math.pow(10, Math.floor(Math.log10(span / 5))), m = span / st > 25 ? 5 : span / st > 10 ? 2 : 1, out = [];
      for (var t = Math.ceil(a / (st * m)) * st * m; t <= b + 1e-12; t += st * m) out.push(Number(t.toFixed(10)));
      if (out.indexOf(1) < 0 && 1 >= a && 1 <= b) out.push(1);
      return out.sort(function (x, y) { return x - y; });
    })();
    ticks.forEach(function (t) {
      var yt = Y(t); if (yt < top - 0.5 || yt > top + plotH + 0.5) return;
      s += '<line x1="' + left + '" y1="' + yt.toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + yt.toFixed(1) + '" stroke="#e3e7ee"/>' +
        '<text x="' + (left - 6) + '" y="' + (yt + 4).toFixed(1) + '" text-anchor="end" font-size="11">' + t + '</text>';
    });
    s += '<line x1="' + left + '" y1="' + Y(1).toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + Y(1).toFixed(1) + '" stroke="#8a94a6" stroke-dasharray="4 3"/>';
    s += '<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + (top + plotH) + '" stroke="#1d2433"/>' +
      '<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="#1d2433"/>';
    levels.forEach(function (l, k) { s += '<text x="' + X(k, (series.length - 1) / 2).toFixed(1) + '" y="' + (top + plotH + 17) + '" text-anchor="middle">' + esc(l) + '</text>'; });
    s += '<text x="' + (left + plotW / 2) + '" y="' + (H - 22) + '" text-anchor="middle" font-size="11">' + esc(opts.xLabel || '') + '</text>';
    s += '<text transform="translate(14 ' + (top + plotH / 2) + ') rotate(-90)" text-anchor="middle" font-size="11">' + (opts.log ? '오즈비 (로그 척도)' : '오즈비') + '</text>';
    series.forEach(function (sr, si) {
      var col = COLORS[si % COLORS.length], path = [];
      sr.pts.forEach(function (p, k) { if (isFinite(p.or) && p.or > 0) path.push(X(k, si).toFixed(1) + ',' + Y(p.or).toFixed(1)); });
      s += '<polyline points="' + path.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="1.8"/>';
      sr.pts.forEach(function (p, k) {
        var x = X(k, si);
        if (p.isRef) { s += '<path d="M' + (x - 5).toFixed(1) + ' ' + Y(1).toFixed(1) + ' l5 -5 l5 5 l-5 5 Z" fill="#ffffff" stroke="' + col + '" stroke-width="1.4"/>'; return; }
        if (!(isFinite(p.or) && p.or > 0)) return;
        var y1 = Y(isFinite(p.hi) ? Math.min(p.hi, Math.pow(10, 3)) : hi), y0 = Y(isFinite(p.lo) && p.lo > 0 ? p.lo : lo);
        y1 = Math.max(top, y1); y0 = Math.min(top + plotH, y0);
        s += '<line x1="' + x.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + col + '" stroke-width="1.4"/>' +
          '<line x1="' + (x - 4).toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + (x + 4).toFixed(1) + '" y2="' + y0.toFixed(1) + '" stroke="' + col + '" stroke-width="1.4"/>' +
          '<line x1="' + (x - 4).toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + (x + 4).toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + col + '" stroke-width="1.4"/>';
        var sig = isFinite(p.lo) && isFinite(p.hi) && (p.lo > 1 || p.hi < 1);
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + Y(p.or).toFixed(1) + '" r="4.5" fill="' + (sig ? col : '#ffffff') + '" stroke="' + col + '" stroke-width="1.6"/>';
      });
      if (series.length > 1) {
        var lx = left + si * 150;
        s += '<line x1="' + lx + '" y1="14" x2="' + (lx + 18) + '" y2="14" stroke="' + col + '" stroke-width="2"/><text x="' + (lx + 23) + '" y="18" font-size="11">' + esc(sr.name) + '</text>';
      }
    });
    return s + '</svg>';
  }

  // 추세 그림 영역: 3개 이상 범주를 가진 범주형 예측변수마다 선택 가능
  function addTrend(box, spec) {
    var vars = [];
    spec.meta.forEach(function (m) { if (m && m.lv !== null) { var v = vars.filter(function (x) { return x.v === m.v; })[0]; if (!v) vars.push(v = { v: m.v, ref: m.ref, lvs: [] }); v.lvs.push(m.lv); } });
    vars = vars.filter(function (v) { return v.lvs.length >= 2; });
    if (!vars.length) return;
    var levelsAll = function (v) { return NS.levelsOf(NS.state.names.indexOf(v.v)).filter(function (l) { return l === v.ref || v.lvs.indexOf(l) >= 0; }); };
    var sec = document.createElement('div');
    sec.className = 'trend-box';
    sec.innerHTML = '<h4>그림: 범주별 오즈비 추세</h4>' +
      '<div class="inline" style="margin:4px 0 6px;flex-wrap:wrap;gap:6px 10px">' +
      '<label style="font-size:13px">변수 <select data-act="tv">' + vars.map(function (v, k) { return '<option value="' + k + '">' + esc(v.v) + '</option>'; }).join('') + '</select></label>' +
      '<label style="font-size:13px">x축 순서 <input data-act="order" style="width:260px" title="쉼표로 구분. 범주 이름을 모두 적어야 합니다."></label>' +
      '<label style="font-size:13px"><input type="checkbox" data-act="log" checked> y축 로그 척도</label>' +
      '<button class="btn small" data-act="tsvg">그림 SVG 저장</button><button class="btn small" data-act="tpng">그림 PNG 저장</button></div>' +
      '<div class="trend-plot"></div><div class="trend-test"></div>' +
      '<p class="note"><i>Note.</i> 점 = 기준 범주(◇, OR = 1) 대비 오즈비, 세로선 = 95% 신뢰구간. 위 숲 그림·표와 같은 모형(다른 예측변수 통제)의 값입니다. ' +
      '점을 잇는 선은 읽기 쉽게 하려는 것으로, 범주 사이의 값을 추정한 것은 아닙니다. 범주에 자연스러운 순서가 있을 때만 쓰세요.</p>';
    box.appendChild(sec);
    var cur = 0;
    var setOrder = function () { sec.querySelector('[data-act=order]').value = levelsAll(vars[cur]).join(', '); };
    var draw = function () {
      var v = vars[cur], order = sec.querySelector('[data-act=order]').value.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t; });
      var all = levelsAll(v), msg = '';
      if (order.length !== all.length || all.some(function (l) { return order.indexOf(l) < 0; })) { msg = 'x축 순서에는 범주 ' + all.join(', ') + '을(를) 빠짐없이 한 번씩 적어 주세요.'; order = all; }
      var series = spec.panels.map(function (p) {
        return { name: p.title, pts: order.map(function (l) {
          if (l === v.ref) return { lv: l, isRef: true, or: 1 };
          var j = -1; spec.meta.forEach(function (m, k) { if (m && m.v === v.v && m.lv === l) j = k; });
          var c = p.coefs[j]; return c ? { lv: l, or: c.or, lo: c.orLow, hi: c.orHigh } : { lv: l };
        }) };
      });
      var log = sec.querySelector('[data-act=log]').checked;
      sec.querySelector('.trend-plot').innerHTML = (msg ? '<div class="warn">' + esc(msg) + '</div>' : '') + trendSVG(order, series, { log: log, xLabel: v.v });
      var tt = sec.querySelector('.trend-test');
      if (spec.trendTest) {
        try {
          var r = spec.trendTest(v.v, order);
          tt.innerHTML = '<p class="note"><b>선형 추세 검정 (p for trend)</b>: ' + esc(v.v) + '을(를) 순서 점수(' + order.map(function (l, k) { return esc(l) + '=' + (k + 1); }).join(', ') +
            ')로 바꿔 같은 모형에 넣었을 때, 한 단계 올라갈 때마다 OR = ' + f(r.or, 2) + ' [' + f(r.orLow, 2) + ', ' + f(r.orHigh, 2) + '], <i>B</i> = ' + NS.fb(r.b, 3) + ', <i>SE</i> = ' + NS.fb(r.se, 3) +
            ', Wald χ²(1) = ' + f(r.wald, 2) + ', <i>p</i> ' + (r.p < 0.001 ? '< .001' : '= ' + NS.fp(r.p)) + ', N = ' + r.n + '. 범주 간격이 같다고 가정합니다.</p>';
        } catch (e) { tt.innerHTML = '<p class="note">선형 추세 검정을 계산하지 못했습니다: ' + esc(e.message) + '</p>'; }
      } else tt.innerHTML = '';
    };
    sec.querySelector('[data-act=tv]').onchange = function () { cur = Number(this.value); setOrder(); draw(); };
    sec.querySelector('[data-act=order]').onchange = draw;
    sec.querySelector('[data-act=log]').onchange = draw;
    sec.querySelector('[data-act=tsvg]').onclick = function () { NS.svgDownload(sec.querySelector('.trend-plot svg'), spec.file + '_trend', false); };
    sec.querySelector('[data-act=tpng]').onclick = function () { NS.svgDownload(sec.querySelector('.trend-plot svg'), spec.file + '_trend', true); };
    setOrder(); draw();
  }

  NS.forestSVG = forestSVG; NS.addForest = addForest; NS.buildForestRows = buildRows; NS.trendSVG = trendSVG;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
