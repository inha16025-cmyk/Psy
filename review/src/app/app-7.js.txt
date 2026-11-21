/* PsyStat 화면(UI) 코드 — 조각 7/7: 네트워크 확장 (커뮤니티·브리지 중심성·부트스트랩 차이 검정·NCT)
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다. */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  var S = NS.S, state = NS.state, $ = NS.$, $$ = NS.$$, esc = NS.esc, f = NS.f, fp = NS.fp, fr = NS.fr, table = NS.table, rcode = NS.rcode, rvec = NS.rvec;
  var selectField = NS.selectField, multiField = NS.multiField, getMulti = NS.getMulti, getSel = NS.getSel, need = NS.need, addCard = NS.addCard, flash = NS.flash;
  var levelsOf = NS.levelsOf, A = NS.A, networkSVG = NS.networkSVG, centralityPlotSVG = NS.centralityPlotSVG;

  // 문항 이름에서 척도 이름 추정: 끝의 숫자·구분자를 떼어냄 (우울1 → 우울, PHQ_3 → PHQ)
  function prefixOf(name) { var p = String(name).replace(/[\s_.\-]*\d+$/, ''); return p || String(name); }

  /* ---------------- 네트워크 분석 화면: 커뮤니티 입력 ---------------- */
  NS.netCommField = function () {
    return '<div class="field"><div class="lab">커뮤니티 (척도) · 브리지 중심성</div><div class="inline">' +
      '<label><input type="radio" name="cmode" value="none">사용 안 함</label><label><input type="radio" name="cmode" value="manual" checked>척도별 직접 지정</label><label><input type="radio" name="cmode" value="auto">자동 탐지 (walktrap, EGA 방식)</label></div>' +
      '<div id="cmman" class="varlist" style="max-height:200px;margin-top:6px"></div>' +
      '<div class="hint">직접 지정: 문항 이름 끝의 숫자를 뗀 이름(예: 우울1 → 우울)으로 자동 채워지며 고칠 수 있습니다. 커뮤니티가 2개 이상이면 브리지 중심성을 계산합니다(Jones, Ma, & McNally, 2021). 자동 탐지는 네트워크 |가중치|에 walktrap(걸음 4)을 적용하며 igraph와 같은 결과를 냅니다(Golino & Epskamp, 2017).</div></div>';
  };
  function refreshCommList() {
    var box = $('#cmman'); if (!box) return;
    var mode = ($('input[name=cmode]:checked') || {}).value;
    box.style.display = mode === 'manual' ? '' : 'none';
    var old = {}; $$('#cmman input[data-i]').forEach(function (inp) { old[inp.dataset.i] = inp.value; });
    var v = getMulti('v');
    box.innerHTML = v.length ? v.map(function (i) { var val = old[i] !== undefined ? old[i] : prefixOf(state.names[i]); return '<label style="justify-content:space-between">' + esc(state.names[i]) + '<input type="text" data-i="' + i + '" value="' + esc(val) + '" style="width:120px;padding:2px 6px;border:1px solid var(--line);border-radius:4px;background:var(--panel)"></label>'; }).join('')
      : '<div class="hint" style="padding:4px 8px">노드 변수를 먼저 선택하세요.</div>';
  }
  if (A.network) {
    var baseWire = A.network.wire, baseRun = A.network.run;
    A.network.wire = function () {
      if (baseWire) baseWire();
      $$('input[name=cmode]').forEach(function (r) { r.onchange = refreshCommList; });
      $$('#v input').forEach(function (c) { c.addEventListener('change', refreshCommList); });
      $$('[data-all="v"], [data-none="v"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(refreshCommList, 0); }); });
      refreshCommList();
    };
    A.network.run = function () {
      var mode = ($('input[name=cmode]:checked') || {}).value || 'none', manual = {};
      $$('#cmman input[data-i]').forEach(function (inp) { manual[inp.dataset.i] = inp.value.trim() || '(미지정)'; });
      NS.lastNetwork = null;
      baseRun();
      var L = NS.lastNetwork, card = $('#results .card');
      if (!L || !card || mode === 'none') return;
      addCommunities(card, L, mode, manual);
    };
  }

  function addCommunities(card, L, mode, manual) {
    var names = L.names, net = L.net, p = names.length, comm, commNames, wtRes = null;
    if (mode === 'auto') {
      wtRes = S.walktrap(net, 4);
      comm = wtRes.membership.map(function (c) { return c - 1; });
      commNames = []; for (var c = 0; c < wtRes.nComm; c++) commNames.push('커뮤니티 ' + (c + 1));
    } else {
      var labs = L.varIdx.map(function (i) { return manual[i] || prefixOf(state.names[i]); });
      commNames = []; labs.forEach(function (l) { if (commNames.indexOf(l) < 0) commNames.push(l); });
      comm = labs.map(function (l) { return commNames.indexOf(l); });
    }
    var useNum = names.some(function (nm) { return nm.length > 6; }), plotLabels = useNum ? names.map(function (_, i) { return String(i + 1); }) : names;
    var plot = card.querySelector('.net-plot');
    if (plot) plot.innerHTML = networkSVG(net, plotLabels, { layout: L.layout, groups: comm, groupNames: commNames });
    var members = commNames.map(function (_, k) { return names.filter(function (_, i) { return comm[i] === k; }); });
    var html = '<h4>커뮤니티</h4>' + table(['커뮤니티', '노드 수', '노드'], commNames.map(function (cn, k) { return [esc(cn), members[k].length, esc(members[k].join(', '))]; }),
      { left: [0, 2], title: mode === 'auto' ? '자동 탐지된 커뮤니티 (walktrap)' : '지정한 커뮤니티 (척도)', note: mode === 'auto' ? '모듈성 Q = ' + f(wtRes.modularity, 3) + '. 네트워크 |가중치|에 walktrap(걸음 4)을 적용하고 모듈성이 최대인 분할을 골랐다(igraph::cluster_walktrap과 같은 결과). 고립 노드는 각자 하나의 커뮤니티가 된다.' : '모듈성 Q = ' + f(S.modularity(net.map(function (r) { return r.map(Math.abs); }), comm), 3) + ' (지정한 분할 기준).' });
    if (commNames.length >= 2) {
      var bc = S.bridgeCentrality(net, comm), cut = S.quantile(bc.strength, 0.8);
      html += table(['노드', '커뮤니티', '브리지 강도', '브리지 기대영향', '브리지 매개', '브리지 근접'], names.map(function (nm, i) {
        return [esc(nm) + (bc.strength[i] >= cut && bc.strength[i] > 0 ? ' †' : ''), esc(commNames[comm[i]]), f(bc.strength[i], 3), f(bc.expectedInfluence[i], 3), f(bc.betweenness[i], 1), isFinite(bc.closeness[i]) ? f(bc.closeness[i], 4) : '—'];
      }), { left: [0, 1], title: '브리지 중심성', note: '브리지 강도 = 다른 커뮤니티 노드와의 엣지 |가중치| 합, 브리지 기대영향(1단계) = 부호를 살린 합, 브리지 매개 = 서로 다른 커뮤니티 노드 쌍의 최단 경로 위에 놓인 횟수(경로가 여러 개면 비율), 브리지 근접 = 다른 커뮤니티 노드까지 평균 최단거리의 역수(거리 = 1/|w|). † = 브리지 강도 상위 20%(80번째 백분위수 이상)로, 선행연구에서 브리지 노드를 고를 때 흔히 쓰는 기준(Jones et al., 2021). 2단계 기대영향은 제공하지 않는다.' });
      html += '<div class="cent-plot">' + centralityPlotSVG(names, { '브리지 강도': S.zscore(bc.strength), '브리지 기대영향': S.zscore(bc.expectedInfluence), '브리지 매개': S.zscore(bc.betweenness), '브리지 근접': S.zscore(bc.closeness) }) + '</div>';
    } else html += '<p class="note">커뮤니티가 하나뿐이라 브리지 중심성을 계산하지 않았습니다.</p>';
    var boot = card.querySelector('.bootbox'), div = document.createElement('div');
    div.className = 'commbox'; div.innerHTML = html;
    if (boot) boot.parentNode.insertBefore(div, boot); else card.appendChild(div);
    NS.decorateTables(card);
  }

  /* ---------------- 부트스트랩 확장: 차이 검정·정확도·안정성 그림 ---------------- */
  function edgeAccuracySVG(names, orig, pairs, samples) {
    var rows = pairs.map(function (pr, e) {
      var s = samples.map(function (x) { return x[e]; }).sort(function (a, b) { return a - b; });
      return { lab: names[pr[0]] + '–' + names[pr[1]], w: orig[e], lo: S.quantile(s, 0.025), hi: S.quantile(s, 0.975), m: S.mean(s) };
    }).filter(function (r) { return r.w !== 0 || r.lo !== 0 || r.hi !== 0; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 120);
    if (!rows.length) return '';
    var lo = Math.min.apply(null, rows.map(function (r) { return r.lo; }).concat([0])), hi = Math.max.apply(null, rows.map(function (r) { return r.hi; }).concat([0]));
    var W = 560, L = 150, R = 20, T = 20, rh = 9, H = T + rows.length * rh + 30, X = function (v) { return L + (v - lo) / ((hi - lo) || 1) * (W - L - R); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="8.5">';
    s += '<line x1="' + X(0) + '" y1="' + T + '" x2="' + X(0) + '" y2="' + (T + rows.length * rh) + '" stroke="#8a94a6" stroke-dasharray="2 2"/>';
    rows.forEach(function (r, i) {
      var y = T + i * rh + rh / 2;
      s += '<text x="' + (L - 4) + '" y="' + (y + 3) + '" text-anchor="end" style="fill:#1d2433">' + esc(r.lab.length > 26 ? r.lab.slice(0, 26) + '…' : r.lab) + '</text>' +
        '<line x1="' + X(r.lo).toFixed(1) + '" y1="' + y + '" x2="' + X(r.hi).toFixed(1) + '" y2="' + y + '" stroke="#9db4e6" stroke-width="5"/>' +
        '<circle cx="' + X(r.m).toFixed(1) + '" cy="' + y + '" r="1.8" fill="#3a4152"/><circle cx="' + X(r.w).toFixed(1) + '" cy="' + y + '" r="2.4" fill="#c8372d"/>';
    });
    [lo, 0, hi].forEach(function (t) { s += '<text x="' + X(t) + '" y="' + (H - 12) + '" text-anchor="middle" fill="#8a94a6">' + f(t, 2) + '</text>'; });
    return s + '<text x="' + L + '" y="12" fill="#5b6475">● 원 추정치(빨강) · 부트스트랩 평균(검정) · 막대 = 95% 부트스트랩 구간</text></svg>';
  }
  function diffMatrixSVG(labels, samples, values, title) {
    var p = labels.length, cell = Math.max(10, Math.min(22, 360 / p)), L = 110, T = 110, W = L + p * cell + 10, H = T + p * cell + 10;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="9">';
    labels.forEach(function (l, i) {
      var lab = esc(l.length > 16 ? l.slice(0, 16) + '…' : l);
      s += '<text x="' + (L - 4) + '" y="' + (T + i * cell + cell / 2 + 3) + '" text-anchor="end" style="fill:#1d2433">' + lab + '</text>' +
        '<text x="' + (L + i * cell + cell / 2) + '" y="' + (T - 4) + '" transform="rotate(-60 ' + (L + i * cell + cell / 2) + ' ' + (T - 4) + ')" style="fill:#1d2433">' + lab + '</text>';
    });
    for (var i = 0; i < p; i++) for (var j = 0; j < p; j++) {
      var x = L + j * cell, y = T + i * cell;
      if (i === j) { s += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" fill="#ffffff" stroke="#c6ccd6"/><text x="' + (x + cell / 2) + '" y="' + (y + cell / 2 + 3) + '" text-anchor="middle" font-size="' + Math.max(6, cell / 2.8) + '" style="fill:#1d2433">' + f(values[i], 2).replace(/^(−?)0\./, '$1.') + '</text>'; continue; }
      var d = S.diffTest(samples, i, j);
      s += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" fill="' + (d.sig ? '#1d2433' : '#d7dbe2') + '" stroke="#ffffff"><title>' + esc(labels[i] + ' − ' + labels[j]) + ': 95% 구간 [' + f(d.lo, 3) + ', ' + f(d.hi, 3) + ']</title></rect>';
    }
    return s + '</svg>';
  }
  function csPlotSVG(props, series) {
    var W = 460, H = 260, L = 46, R = 120, T = 16, B = 36, X = function (v) { return L + (v - 0.05) / 0.70 * (W - L - R); }, Y = function (v) { return T + (1 - (v + 0.2) / 1.2) * (H - T - B); };
    var cols = ['#2b5fc7', '#c8372d', '#2f9e44', '#b8860b'], s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" font-family="sans-serif" font-size="10">';
    s += '<rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="none" stroke="#8a94a6" stroke-width="0.6"/>';
    s += '<line x1="' + L + '" y1="' + Y(0.7) + '" x2="' + (W - R) + '" y2="' + Y(0.7) + '" stroke="#8a94a6" stroke-dasharray="4 3"/><text x="' + (W - R - 4) + '" y="' + (Y(0.7) - 3) + '" text-anchor="end" fill="#8a94a6">r = .70</text>';
    [0, 0.5, 1].forEach(function (t) { s += '<text x="' + (L - 4) + '" y="' + (Y(t) + 3) + '" text-anchor="end">' + t + '</text>'; });
    props.forEach(function (pv) { s += '<text x="' + X(pv) + '" y="' + (H - B + 13) + '" text-anchor="middle" font-size="8.5">' + Math.round(pv * 100) + '%</text>'; });
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">제거한 사례 비율</text>';
    Object.keys(series).forEach(function (k, ki) {
      var pts = []; series[k].forEach(function (arr, i) { var v = arr.filter(S.isNum); if (v.length) pts.push(X(props[i]).toFixed(1) + ',' + Y(S.mean(v)).toFixed(1)); });
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + cols[ki] + '" stroke-width="2"/>' +
        '<line x1="' + (W - R + 8) + '" y1="' + (T + 10 + ki * 16) + '" x2="' + (W - R + 26) + '" y2="' + (T + 10 + ki * 16) + '" stroke="' + cols[ki] + '" stroke-width="2"/><text x="' + (W - R + 30) + '" y="' + (T + 14 + ki * 16) + '">' + esc(k) + '</text>';
    });
    return s + '<text x="14" y="' + ((T + H - B) / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + ((T + H - B) / 2) + ')">원 중심성과의 평균 상관</text></svg>';
  }
  NS.networkBootExtras = function (box, D) {
    var html = '';
    if (D.nb && D.edgeSamples.length > 10) {
      var nz = D.pairs.map(function (pr, e) { return { pr: pr, e: e, w: D.orig[e] }; }).filter(function (x) { return x.w !== 0; }).sort(function (a, b) { return Math.abs(b.w) - Math.abs(a.w); }).slice(0, 25);
      html += '<h4>엣지 가중치 정확도 (부트스트랩 구간)</h4><div>' + edgeAccuracySVG(D.names, D.orig, D.pairs, D.edgeSamples) + '</div>' +
        '<h4>강도 중심성 차이 검정</h4><div>' + diffMatrixSVG(D.names, D.strSamples, D.ce.strength) + '</div>' +
        '<p class="note">검은 칸 = 두 노드의 강도 차이에 대한 95% 부트스트랩 구간이 0을 포함하지 않음(유의한 차이), 회색 = 차이 없음. 대각선 숫자 = 원 강도. bootnet의 differenceTest와 같은 방식이며 다중비교 보정은 하지 않는다(Epskamp et al., 2018).</p>';
      if (nz.length > 1) html += '<h4>엣지 가중치 차이 검정 (|가중치| 상위 ' + nz.length + '개)</h4><div>' + diffMatrixSVG(nz.map(function (x) { return D.names[x.pr[0]] + '–' + D.names[x.pr[1]]; }), D.edgeSamples.map(function (smp) { return nz.map(function (x) { return smp[x.e]; }); }), nz.map(function (x) { return x.w; })) + '</div>' +
        '<p class="note">검은 칸 = 두 엣지 가중치 차이의 95% 부트스트랩 구간이 0을 포함하지 않음. 대각선 = 원 가중치.</p>';
    }
    if (D.nc) html += '<h4>중심성 안정성 (사례 제거 부트스트랩)</h4><div>' + csPlotSVG(D.props, { '강도': D.corrS, '기대영향': D.corrE, '매개': D.corrB, '근접': D.corrC }) + '</div><p class="note">선이 r = .70 위에 오래 머물수록 중심성 순위가 안정적이다. CS 계수는 위 표 참고.</p>';
    if (html) box.insertAdjacentHTML('beforeend', html);
    var card = box.closest('.card'); if (card) NS.decorateTables(card);
  };

  /* ---------------- NCT: 두 집단 네트워크 비교 ---------------- */
  A.nct = {
    group: '네트워크', title: '네트워크 비교 (NCT)',
    desc: '두 독립 집단의 네트워크를 순열 검정으로 비교(van Borkulo et al., 2023): 전체 연결 강도, 네트워크 구조(최대 엣지 차이), 엣지별 차이, 노드 강도·기대영향 차이.',
    form: function () {
      return multiField('v', '노드 변수 (3개 이상)', 'num') + selectField('g', '집단변수', 'any') + NS.twoLevelPicker('g') +
        '<div class="field"><label for="est">추정 방법</label><select id="est"><option value="ebicglasso">EBICglasso</option><option value="pcor">편상관 (비정규화)</option></select></div>' +
        '<div class="field"><div class="lab">상관 종류</div><div class="inline"><label><input type="radio" name="cr" value="auto" checked>자동 (cor_auto)</label><label><input type="radio" name="cr" value="pearson">Pearson</label><label><input type="radio" name="cr" value="spearman">Spearman</label></div><div class="hint">다분상관(자동)은 정확하지만 순열마다 다시 계산해 시간이 몇 배 걸립니다.</div></div>' +
        '<div class="field"><div class="inline"><label>EBIC γ <select id="gam"><option value="0.5" selected>0.5</option><option value="0.25">0.25</option><option value="0">0</option></select></label><label>순열 <input type="number" id="np" value="1000" min="50" step="100" style="width:80px"> 회</label></div>' +
        '<div class="inline" style="margin-top:4px"><label>엣지·중심성 p값 보정 <select id="padj"><option value="holm" selected>Holm</option><option value="BH">Benjamini-Hochberg</option><option value="none">보정 안 함</option></select></label><label>시드 <input type="number" id="seed" value="1234" style="width:70px"></label></div>' +
        '<div class="hint">독립된 두 집단을 가정합니다(같은 사람의 반복측정은 지원하지 않음). 순열 1,000회 권장, 문항 15개·Pearson 기준 수 분이 걸릴 수 있습니다.</div></div>';
    },
    wire: function () { NS.wireLevelPicker('g'); },
    run: function () {
      var v = getMulti('v'), g = getSel('g'); need(v.length >= 3 && g >= 0, '노드 변수 3개 이상과 집단변수를 선택하세요.');
      var la = $('#g_a').value, lb = $('#g_b').value; need(la !== lb, '서로 다른 두 집단을 선택하세요.');
      var names = v.map(function (i) { return state.names[i]; }), rows = [];
      for (var r = 0; r < state.nrows; r++) { var gv = state.cols[g][r]; if (gv === null || (String(gv) !== la && String(gv) !== lb)) continue; if (v.every(function (i) { return S.isNum(state.cols[i][r]); })) rows.push(r); }
      var cols = v.map(function (i) { return rows.map(function (r2) { return state.cols[i][r2]; }); }), lab = rows.map(function (r3) { return String(state.cols[g][r3]) === la ? 0 : 1; });
      var n1 = lab.filter(function (x) { return x === 0; }).length, n2 = lab.length - n1;
      need(n1 > v.length + 2 && n2 > v.length + 2, '각 집단의 완전 사례가 노드 수보다 충분히 많아야 합니다 (' + la + ': ' + n1 + ', ' + lb + ': ' + n2 + ').');
      var opts = { method: $('#est').value, cor: $('input[name=cr]:checked').value, gamma: Number($('#gam').value), alpha: 0 };
      if (opts.cor === 'auto') opts.ordinal = cols.map(function (c) { return S.isOrdinalAuto(c); });
      var B = Math.max(20, Math.floor(Number($('#np').value) || 1000)), seed = Number($('#seed').value) || 1, adj = $('#padj').value;
      var obs = S.nctObserved(cols, lab, opts), gname = state.names[g];
      var card = addCard('네트워크 비교 (NCT): ' + gname + ' = ' + la + ' vs ' + lb, '<div class="nctbox"><h4>순열 검정 진행 중…</h4><div class="progress"><div></div></div><div class="note prog">0 / ' + B + '</div></div>', names.length + '개 노드, n = ' + n1 + ' / ' + n2);
      var box = card.querySelector('.nctbox'), rand = S.rng(seed), perms = [], done = 0, t0 = Date.now();
      (function step() {
        var until = Date.now() + 150;
        while (done < B && Date.now() < until) { var ps = S.nctPermOnce(cols, lab, opts, rand); if (ps) perms.push(ps); done++; }
        box.querySelector('.progress > div').style.width = (100 * done / B) + '%';
        var el = (Date.now() - t0) / 1000;
        box.querySelector('.prog').textContent = done + ' / ' + B + ' · 경과 ' + el.toFixed(0) + '초 · 남은 시간 약 ' + (done ? (el / done * (B - done)).toFixed(0) : '?') + '초';
        if (done < B) { setTimeout(step, 0); return; }
        renderNCT(card, box, { names: names, obs: obs, sum: S.nctSummarize(obs.stats, perms, adj), la: la, lb: lb, n1: n1, n2: n2, opts: opts, B: B, seed: seed, gname: gname, cols: cols, secs: el });
      })();
    }
  };

  function renderNCT(card, box, R) {
    var names = R.names, p = names.length, o = R.obs, sm = R.sum, st = o.stats, adjName = { holm: 'Holm', BH: 'Benjamini-Hochberg', none: '보정 없음' }[sm.adjust];
    var pooled = S.estimateNetwork(R.cols, R.opts).network, layout = S.layoutFR(pooled), maxw = 0;
    [o.net1, o.net2].forEach(function (m) { m.forEach(function (r) { r.forEach(function (x) { maxw = Math.max(maxw, Math.abs(x)); }); }); });
    var useNum = names.some(function (nm) { return nm.length > 6; }), lab = useNum ? names.map(function (_, i) { return String(i + 1); }) : names;
    var edges = [], k = 0;
    for (var a = 0; a < p; a++) for (var b = a + 1; b < p; b++) { edges.push({ a: a, b: b, w1: o.net1[a][b], w2: o.net2[a][b], d: st.edgeDiff[k], p: sm.edgeP[k], padj: sm.edgePadj[k] }); k++; }
    var sig = edges.filter(function (e) { return e.padj < 0.05; }).sort(function (x, y) { return y.d - x.d; });
    var show = sig.length ? sig : edges.slice().sort(function (x, y) { return y.d - x.d; }).slice(0, 10);
    var c1 = S.centrality(o.net1), c2 = S.centrality(o.net2);
    var html = '<div style="display:flex;flex-wrap:wrap;gap:12px"><div style="flex:1;min-width:280px"><h4 style="text-align:center">' + esc(R.gname + ' = ' + R.la) + ' (n = ' + R.n1 + ')</h4>' + networkSVG(o.net1, lab, { layout: layout, maxw: maxw }) + '</div>' +
      '<div style="flex:1;min-width:280px"><h4 style="text-align:center">' + esc(R.gname + ' = ' + R.lb) + ' (n = ' + R.n2 + ')</h4>' + networkSVG(o.net2, lab, { layout: layout, maxw: maxw }) + '</div></div>' +
      '<p class="note">두 그림은 같은 배치(합친 자료의 네트워크 기준)와 같은 굵기 척도를 써서 직접 비교할 수 있다.' + (useNum ? ' 노드 번호: ' + names.map(function (nm, i) { return (i + 1) + ' = ' + esc(nm); }).join(', ') : '') + '</p>' +
      table(['검정', esc(R.la), esc(R.lb), '검정통계량', 'p'], [
        ['전체 연결 강도 불변성 (Σ|w|)', f(st.gs1, 3), f(st.gs2, 3), 'S = ' + f(st.S, 3), fp(sm.strength.p)],
        ['네트워크 구조 불변성 (최대 |엣지 차이|)', '', '', 'M = ' + f(st.M, 3), fp(sm.structure.p)]], { left: [0], title: '네트워크 비교 검정 (NCT)', note: '순열 ' + sm.B + '회, p = (1 + #{T* ≥ T}) / (B + 1) (Phipson & Smyth, 2010). 전체 강도는 엣지 |가중치|의 합.' }) +
      table(['노드 1', '노드 2', esc(R.la), esc(R.lb), '|차이|', 'p', 'p (' + adjName + ')'], show.map(function (e) { return [esc(names[e.a]), esc(names[e.b]), fr(e.w1), fr(e.w2), fr(e.d), fp(e.p), fp(e.padj)]; }),
        { left: [0, 1], title: sig.length ? '유의하게 다른 엣지 (보정 p < .05)' : '엣지 차이 (|차이| 상위 10개; 보정 후 유의한 엣지 없음)', note: '엣지 ' + edges.length + '개를 모두 검정하고 ' + adjName + ' 방법으로 보정했다.' }) +
      table(['노드', '강도 ' + esc(R.la), '강도 ' + esc(R.lb), 'p (' + adjName + ')', '기대영향 ' + esc(R.la), '기대영향 ' + esc(R.lb), 'p (' + adjName + ')'], names.map(function (nm, i) {
        return [esc(nm), f(c1.strength[i], 3), f(c2.strength[i], 3), fp(sm.strPadj[i]), f(c1.expectedInfluence[i], 3), f(c2.expectedInfluence[i], 3), fp(sm.eiPadj[i])];
      }), { left: [0], title: '중심성 불변성' }) +
      '<p class="note">추정: ' + (R.opts.method === 'ebicglasso' ? 'EBICglasso (γ = ' + R.opts.gamma + ')' : '편상관') + ', 상관 = ' + (R.opts.cor === 'auto' ? 'cor_auto' : R.opts.cor) + '. 각 순열에서 집단 표지를 섞어 두 네트워크를 다시 추정했다(시드 ' + R.seed + ', ' + R.secs.toFixed(0) + '초). ' +
      '검증: 같은 순열 배정으로 R(qgraph::EBICglasso)에서 계산한 통계량·p값과 일치했다(NetworkComparisonTest 패키지는 이 환경에 설치할 수 없어 같은 정의를 재현해 대조). 정규화 추정에서는 집단 크기가 다르면 작은 집단의 네트워크가 더 희소해져 차이가 생길 수 있으므로 집단 크기를 함께 보고하라(van Borkulo et al., 2023).</p>' +
      rcode('library(NetworkComparisonTest)\nd <- na.omit(df[, ' + rvec(names.concat([R.gname])) + '])\ng1 <- d[d$' + R.gname + ' == "' + R.la + '", ' + rvec(names) + ']; g2 <- d[d$' + R.gname + ' == "' + R.lb + '", ' + rvec(names) + ']\nres <- NCT(g1, g2, it = ' + R.B + ', test.edges = TRUE, edges = "all", test.centrality = TRUE,\n           centrality = c("strength", "expectedInfluence"), p.adjust.methods = "' + (R.opts && sm.adjust === 'BH' ? 'BH' : sm.adjust) + '")\nsummary(res)');
    box.innerHTML = html;
    NS.decorateTables(card);
  }

  /* ---------------- 메뉴·해석 가이드 ---------------- */
  if (NS.NAV) NS.NAV.forEach(function (gr) { if (gr[0] === '네트워크' && gr[1].indexOf('nct') < 0) gr[1].push('nct'); });
  if (NS.GUIDES) {
    NS.GUIDES.network = (NS.GUIDES.network || []).concat([
      ['모듈성 Q', '커뮤니티 안 연결이 무작위 기대보다 얼마나 촘촘한지.', '높을수록 커뮤니티 구분이 뚜렷(대략 .3 이상이면 뚜렷한 구조로 보는 관행)', 'Newman (2006); 관행'],
      ['브리지 강도·기대영향', '다른 커뮤니티(척도)와 이어주는 정도. 공병 연구에서 두 증상군을 잇는 증상 탐색.', '상위 20%(80번째 백분위수)를 브리지 노드로 보는 경우가 많음', 'Jones, Ma, & McNally (2021)'],
      ['부트스트랩 차이 검정', '두 엣지(또는 두 노드의 중심성)가 유의하게 다른지.', '차이의 95% 구간이 0을 포함하지 않으면 다름. 다중비교 미보정이므로 탐색적으로 해석', 'Epskamp et al. (2018)']]);
    NS.GUIDES.nct = [
      ['전체 연결 강도 불변성 (S)', '두 네트워크의 엣지 |가중치| 합의 차이.', 'p < .05면 전체 연결성이 다름', 'van Borkulo et al. (2023)'],
      ['네트워크 구조 불변성 (M)', '모든 엣지 중 가장 큰 |차이|.', 'p < .05면 적어도 한 엣지가 다름 → 엣지별 검정으로 확인', 'van Borkulo et al. (2023)'],
      ['엣지·중심성별 p (보정)', '개별 엣지·노드의 차이.', '여러 번 검정하므로 Holm 등으로 보정한 p값 사용', 'van Borkulo et al. (2023)'],
      ['집단 크기', '정규화 추정은 표본이 작을수록 희소한 네트워크를 만든다.', '집단 크기 차이가 크면 결과 해석에 주의, 크기를 함께 보고', 'van Borkulo et al. (2023)']];
  }
  NS.extraRefs = (NS.extraRefs || []).concat([
    ['Jones, P. J., Ma, R., & McNally, R. J. (2021). Bridge centrality: A network approach to understanding comorbidity. Multivariate Behavioral Research, 56(2), 353–367.', 'https://doi.org/10.1080/00273171.2019.1614898'],
    ['Golino, H. F., & Epskamp, S. (2017). Exploratory graph analysis: A new approach for estimating the number of dimensions in psychological research. PLoS ONE, 12(6), e0174035.', 'https://doi.org/10.1371/journal.pone.0174035'],
    ['Newman, M. E. J. (2006). Modularity and community structure in networks. Proceedings of the National Academy of Sciences, 103(23), 8577–8582.', 'https://doi.org/10.1073/pnas.0601602103'],
    ['Phipson, B., & Smyth, G. K. (2010). Permutation p-values should never be zero: Calculating exact p-values when permutations are randomly drawn. Statistical Applications in Genetics and Molecular Biology, 9(1), Article 39.', 'https://doi.org/10.2202/1544-6115.1585'],
    ['Pons, P., & Latapy, M. (2006). Computing communities in large networks using random walks. Journal of Graph Algorithms and Applications, 10(2), 191–218.', 'https://doi.org/10.7155/jgaa.00124'],
    ['van Borkulo, C. D., van Bork, R., Boschloo, L., Kossakowski, J. J., Tio, P., Schoevers, R. A., Borsboom, D., & Waldorp, L. J. (2023). Comparing network structures on three aspects: A permutation test. Psychological Methods, 28(6), 1273–1285.', 'https://doi.org/10.1037/met0000476']
  ]);
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
