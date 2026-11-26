/* PsyStat 화면(UI) 코드 — 조각 8/8: 그림 (오즈비 숲 그림)
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
    return box;
  }

  NS.forestSVG = forestSVG; NS.addForest = addForest; NS.buildForestRows = buildRows;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
