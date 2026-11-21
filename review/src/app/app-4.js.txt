/* PsyStat 화면(UI) 코드 — 조각 4/5: 네트워크 분석·데이터 화면·화면 전환·시작
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 코드는 분할 전과 동일) */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  // 앞 조각에서 가져오기
  var S = NS.S, state = NS.state, $ = NS.$, $$ = NS.$$, esc = NS.esc, f = NS.f, fr = NS.fr, table = NS.table;
  var rcode = NS.rcode, rvec = NS.rvec, setData = NS.setData, parseDelimited = NS.parseDelimited, openFile = NS.openFile, exampleData = NS.exampleData, updateInfo = NS.updateInfo, multiField = NS.multiField;
  var getMulti = NS.getMulti, wireMulti = NS.wireMulti, need = NS.need, addCard = NS.addCard, errorCard = NS.errorCard, A = NS.A, networkSVG = NS.networkSVG, centralityPlotSVG = NS.centralityPlotSVG;
  var svgDownload = NS.svgDownload, download = NS.download;
  A.network = {
    group: '네트워크', title: '네트워크 분석 (GGM)',
    desc: '가우시안 그래프 모형: EBICglasso(qgraph 동일 절차) 또는 편상관 네트워크, 중심성, 부트스트랩 안정성.',
    form: function () {
      return multiField('v', '노드 변수 (3개 이상)', 'num') +
        '<div class="field"><label for="est">추정 방법</label><select id="est"><option value="ebicglasso">EBICglasso (정규화 편상관)</option><option value="pcor">편상관 (비정규화)</option></select></div>' +
        '<div class="field" id="ebicopts"><label for="gam">EBIC γ (감마)</label><select id="gam"><option value="0.5" selected>0.5 (기본, 보수적)</option><option value="0.25">0.25</option><option value="0">0 (BIC)</option></select>' +
        '<div class="inline" style="margin-top:6px"><label><input type="checkbox" id="thr">threshold = TRUE (특이도 강화)</label></div></div>' +
        '<div class="field" id="pcopts" style="display:none"><label for="alp">유의하지 않은 엣지 제거 (α)</label><select id="alp"><option value="0">제거 안 함</option><option value="0.05">.05</option><option value="0.01">.01</option></select></div>' +
        '<div class="field"><div class="lab">상관 종류</div><div class="inline"><label><input type="radio" name="cr" value="auto" checked>자동 (cor_auto)</label><label><input type="radio" name="cr" value="pearson">Pearson</label><label><input type="radio" name="cr" value="spearman">Spearman</label></div>' +
        '<div class="hint">자동: 리커트·이분 문항(정수, 수준 7개 이하)은 다분·사분상관, 연속변수는 Pearson, 섞이면 다계열상관 (qgraph::cor_auto와 같은 규칙). 다분상관을 쓰면 부트스트랩이 몇 배 느려집니다.</div></div>' +
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
      var nearPDused = false, ordNote = '';
      if (opts.cor === 'auto') {
        opts.ordinal = cols.map(function (c) { return S.isOrdinalAuto(c); }); // 부트스트랩에서도 같은 판정 유지
        ordNote = '<p class="note">cor_auto 순서형 판정: ' + esc(names.filter(function (_, i) { return opts.ordinal[i]; }).join(', ') || '없음 (모두 Pearson)') + '</p>';
      }
      opts.onNearPD = function () { nearPDused = true; };
      var res = S.estimateNetwork(cols, opts), net = res.network, p = v.length;
      opts.onNearPD = null;
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
      var html = (res.notes || []).map(function (t) { return '<div class="warn">' + esc(t) + '</div>'; }).join('') + ordNote +
        (nearPDused ? '<div class="warn">다분상관 행렬이 양정치가 아니어서 가장 가까운 양정치 행렬로 보정했습니다 (Matrix::nearPD와 같은 방법).</div>' : '') +
        table(['N (완전 사례)', '노드', '엣지', '밀도', '평균 |가중치|', '상관'].concat(opts.method === 'ebicglasso' ? ['선택 λ'] : []), [[n, p, nEdges + ' / ' + possible, fr(nEdges / possible), fr(meanW), opts.cor === 'auto' ? 'cor_auto' : opts.cor].concat(opts.method === 'ebicglasso' ? [f(res.lambda, 4)] : [])], { title: '네트워크 요약' }) +
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
            ? 'net <- EBICglasso(' + rcor(opts.cor) + ', n = nrow(d), gamma = ' + opts.gamma + (opts.threshold ? ', threshold = TRUE' : '') + ')\n'
            : 'net <- -cov2cor(solve(' + rcor(opts.cor) + ')); diag(net) <- 0\n') +
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

  function rcor(c) { return c === 'auto' ? 'cor_auto(d)' : 'cor(d' + (c === 'spearman' ? ', method = "spearman"' : '') + ')'; }

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
          }), { title: '엣지 가중치의 부트스트랩 구간' }) + '<p class="note">정규화(EBICglasso) 추정에서 이 구간은 엄밀한 신뢰구간이 아니라 추정 정확도의 지표입니다(Epskamp et al., 2018). 구간이 서로 크게 겹치면 엣지 간 크기 순위를 해석하지 마세요.</p>';
      }
      if (nc) {
        var cs = [['강도 Strength', corrS], ['기대영향 EI', corrE], ['매개 Betweenness', corrB], ['근접 Closeness', corrC]].map(function (m) { return [m[0], f(S.csCoefficient(props, m[1], 0.7, 0.95), 2)]; });
        html += '<p class="note">사례 제거 부트스트랩 ' + nc + '회 (제거 비율 5–75%, 10단계).</p>' + table(['중심성', 'CS 계수 (r ≥ .70, 95%)'], cs, { title: '중심성 안정성 (CS 계수)' }) +
          '<p class="note">CS 계수는 .25 이상이어야 하고, .50 이상이 바람직합니다(Epskamp et al., 2018). bootnet의 corStability()와 같은 정의입니다.</p>' +
          table(['제거 비율'].concat(props.map(function (x) { return Math.round(x * 100) + '%'; })), [['강도: 평균 r'].concat(corrS.map(function (a) { return a.length ? fr(S.mean(a.filter(S.isNum))) : '—'; }))], { title: '사례 제거 비율별 원 강도와의 평균 상관' });
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
  var current = 'data';
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
        try { an.run(); } catch (e) { errorCard(e); if (window.console) console.warn(e); }
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
      '<p class="desc"><b>검증</b>: 모든 계산은 R 4.x(stats, car, psych, qgraph 1.9.8, glasso)의 결과와 자동 대조되었습니다. 저장소의 tests/tests/ 폴더의 테스트(run_tests 1–5)에서 2,600개 이상의 수치를 비교하며, 중요한 결과는 가능하면 SPSS·R로 한 번 더 확인하세요.</p>' +
      '<p class="desc"><b>결과 내보내기</b>: 각 카드의 [복사] 후 한글·워드에 붙여넣기, 또는 상단 [결과 저장]으로 HTML 파일 저장(워드에서 열 수 있음).</p>';
    var refs = [
      ['Box, G. E. P. (1949). A general distribution theory for a class of likelihood criteria. Biometrika, 36(3/4), 317–346.', 'https://doi.org/10.1093/biomet/36.3-4.317'],
      ['American Psychological Association. (2020). Publication manual of the American Psychological Association (7th ed.).', 'https://doi.org/10.1037/0000165-000'],
      ['Bringmann, L. F., et al. (2019). What do centrality measures measure in psychological networks? Journal of Abnormal Psychology, 128(8), 892–903.', 'https://doi.org/10.1037/abn0000446'],
      ['Copenhaver, M. D., & Holland, B. (1988). Computation of the distribution of the maximum studentized range statistic. Journal of Statistical Computation and Simulation, 30(1), 1–15.', 'https://doi.org/10.1080/00949658808811082'],
      ['Delacre, M., Lakens, D., & Leys, C. (2017). Why psychologists should by default use Welch’s t-test instead of Student’s t-test. International Review of Social Psychology, 30(1), 92–101.', 'https://doi.org/10.5334/irsp.82'],
      ['Epskamp, S., Borsboom, D., & Fried, E. I. (2018). Estimating psychological networks and their accuracy: A tutorial paper. Behavior Research Methods, 50(1), 195–212.', 'https://doi.org/10.3758/s13428-017-0862-1'],
      ['Epskamp, S., & Fried, E. I. (2018). A tutorial on regularized partial correlation networks. Psychological Methods, 23(4), 617–634.', 'https://doi.org/10.1037/met0000167'],
      ['Genz, A. (2004). Numerical computation of rectangular bivariate and trivariate normal and t probabilities. Statistics and Computing, 14(3), 251–260.', 'https://doi.org/10.1023/B:STCO.0000035304.20635.31'],
      ['Brosseau-Liard, P. E., & Savalei, V. (2014). Adjusting incremental fit indices for nonnormality. Multivariate Behavioral Research, 49(5), 460–470.', 'https://doi.org/10.1080/00273171.2014.933697'],
      ['Brosseau-Liard, P. E., Savalei, V., & Li, L. (2012). An investigation of the sample performance of two nonnormality corrections for RMSEA. Multivariate Behavioral Research, 47(6), 904–930.', 'https://doi.org/10.1080/00273171.2012.715252'],
      ['Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables and measurement error. Journal of Marketing Research, 18(1), 39–50.', 'https://doi.org/10.1177/002224378101800104'],
      ['Foygel, R., & Drton, M. (2010). Extended Bayesian information criteria for Gaussian graphical models. Advances in Neural Information Processing Systems, 23.', 'https://arxiv.org/abs/1011.6640'],
      ['Friedman, J., Hastie, T., & Tibshirani, R. (2008). Sparse inverse covariance estimation with the graphical lasso. Biostatistics, 9(3), 432–441.', 'https://doi.org/10.1093/biostatistics/kxm045'],
      ['Hayes, A. F. (2015). An index and test of linear moderated mediation. Multivariate Behavioral Research, 50(1), 1–22.', 'https://doi.org/10.1080/00273171.2014.962683'],
      ['Hayes, A. F. (2022). Introduction to mediation, moderation, and conditional process analysis (3rd ed.). Guilford Press.', 'https://www.guilford.com/books/Introduction-to-Mediation-Moderation-and-Conditional-Process-Analysis/Andrew-Hayes/9781462549030'],
      ['Higham, N. J. (2002). Computing the nearest correlation matrix—a problem from finance. IMA Journal of Numerical Analysis, 22(3), 329–343.', 'https://doi.org/10.1093/imanum/22.3.329'],
      ['Hu, L., & Bentler, P. M. (1999). Cutoff criteria for fit indexes in covariance structure analysis. Structural Equation Modeling, 6(1), 1–55.', 'https://doi.org/10.1080/10705519909540118'],
      ['Hosmer, D. W., Lemeshow, S., & Sturdivant, R. X. (2013). Applied logistic regression (3rd ed.). Wiley.', 'https://doi.org/10.1002/9781118548387'],
      ['Lakens, D. (2013). Calculating and reporting effect sizes to facilitate cumulative science. Frontiers in Psychology, 4, 863.', 'https://doi.org/10.3389/fpsyg.2013.00863'],
      ['McNeish, D. (2018). Thanks coefficient alpha, we’ll take it from here. Psychological Methods, 23(3), 412–433.', 'https://doi.org/10.1037/met0000144'],
      ['Olsson, U. (1979). Maximum likelihood estimation of the polychoric correlation coefficient. Psychometrika, 44(4), 443–460.', 'https://doi.org/10.1007/BF02296207'],
      ['Preacher, K. J., & Hayes, A. F. (2008). Asymptotic and resampling strategies for assessing and comparing indirect effects in multiple mediator models. Behavior Research Methods, 40(3), 879–891.', 'https://doi.org/10.3758/BRM.40.3.879'],
      ['Rosseel, Y. (2012). lavaan: An R package for structural equation modeling. Journal of Statistical Software, 48(2), 1–36.', 'https://doi.org/10.18637/jss.v048.i02'],
      ['Yuan, K.-H., & Bentler, P. M. (2000). Three likelihood-based methods for mean and covariance structure analysis with nonnormal missing data. Sociological Methodology, 30(1), 165–200.', 'https://doi.org/10.1111/0081-1750.00078'],
      ['Royston, P. (1995). Remark AS R94: A remark on algorithm AS 181: The W-test for normality. Applied Statistics, 44(4), 547–551.', 'https://doi.org/10.2307/2986146'],
      ['Tabachnick, B. G., & Fidell, L. S. (2019). Using multivariate statistics (7th ed.). Pearson.', 'https://www.pearson.com/en-us/subject-catalog/p/using-multivariate-statistics/P200000003097'],
      ['West, S. G., Finch, J. F., & Curran, P. J. (1995). Structural equation models with nonnormal variables. In R. H. Hoyle (Ed.), Structural equation modeling (pp. 56–75). Sage.', 'https://psycnet.apa.org/record/1995-97753-004'],
      ['Williams, D. R., & Rast, P. (2020). Back to the basics: Rethinking partial correlation network methodology. British Journal of Mathematical and Statistical Psychology, 73(2), 187–212.', 'https://doi.org/10.1111/bmsp.12173']
    ];
    refs = refs.concat(NS.extraRefs || []).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); // 다른 조각이 더한 참고문헌 포함
    var res = $('#results'), pv = $('.datapreview', res); if (pv) pv.remove();
    if (savedResults && savedResults.childNodes.length) { res.appendChild(savedResults); savedResults = null; }
    addCard('참고문헌', '<ul style="padding-left:18px;margin:0">' + refs.map(function (r) { return '<li style="margin-bottom:6px">' + esc(r[0]) + ' <span class="note">' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="note">폐쇄망에서는 링크가 열리지 않으므로 DOI를 텍스트로 표기했습니다.</p>', '도움말');
  }

  function saveResults() {
    var res = $('#results').cloneNode(true);
    $$('.tools, .datapreview, .empty, .inline, .apa-copy', res).forEach(function (e) { e.remove(); });
    $$('.apa-num', res).forEach(function (b, i) { b.textContent = '표 ' + (i + 1); });
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
  // 다음 조각으로 내보내기
  NS.rcor = rcor; NS.runBootstrap = runBootstrap; NS.dataView = dataView; NS.dataPreview = dataPreview; NS.current = current; NS.savedResults = savedResults; NS.select = select; NS.buildNav = buildNav;
  NS.about = about; NS.saveResults = saveResults;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
