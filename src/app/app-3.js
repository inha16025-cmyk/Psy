/* PsyStat 화면(UI) 코드 — 조각 3/5: 구조방정식·신뢰도·네트워크 그림
 * 외부 통신 없음. 조각들은 G.__PsyAppNS 로 함수를 공유한다.
 * (전송 시스템의 스크립트 블록 크기 제한 때문에 나눔; 코드는 분할 전과 동일) */
(function (G) {
  'use strict';
  if (G.__psyEngineMissing || !G.PsyStats) return; // 계산 엔진이 없으면 화면을 시작하지 않음
  var NS = G.__PsyAppNS || (G.__PsyAppNS = {});
  // 앞 조각에서 가져오기
  var S = NS.S, state = NS.state, $ = NS.$, $$ = NS.$$, esc = NS.esc, f = NS.f, fp = NS.fp, fr = NS.fr;
  var star = NS.star, table = NS.table, rcode = NS.rcode, rvec = NS.rvec, varOptions = NS.varOptions, multiField = NS.multiField, getMulti = NS.getMulti, need = NS.need;
  var addCard = NS.addCard, A = NS.A;
  /* ---------------- 구조방정식 ---------------- */
  function semDiagram(res) {
    var m = res.model, P = res.params, lat = m.latents;
    var structVars = lat.slice();
    P.forEach(function (p) { if (p.op === '~') [p.lhs, p.rhs].forEach(function (v) { if (structVars.indexOf(v) < 0) structVars.push(v); }); });
    var preds = {}; structVars.forEach(function (v) { preds[v] = []; });
    P.forEach(function (p) { if (p.op === '~') preds[p.lhs].push(p.rhs); });
    var depth = {}, dget = function (v, seen) { if (depth[v] !== undefined) return depth[v]; if (seen[v]) return 0; seen[v] = 1; var d = 0; preds[v].forEach(function (u) { d = Math.max(d, dget(u, seen) + 1); }); depth[v] = d; return d; };
    structVars.forEach(function (v) { dget(v, {}); });
    var ncol = Math.max.apply(null, structVars.map(function (v) { return depth[v]; }).concat([0])) + 1, cols = [];
    for (var c = 0; c < ncol; c++) cols.push(structVars.filter(function (v) { return depth[v] === c; }));
    var inds = function (f) { return P.filter(function (p) { return p.op === '=~' && p.lhs === f; }); };
    var bw = 46, bh = 20, gapI = 5, rx = 52, ry = 21, blockH = 2 * ry + 34 + bh + 34;
    var boxW = function (name) { var w = 0; for (var i = 0; i < name.length; i++) w += name.charCodeAt(i) > 255 ? 10.5 : 6.2; return Math.max(34, Math.min(96, w + 10)); };
    var rowW = function (v) { var L = inds(v); return L.reduce(function (a, q) { return a + boxW(q.rhs) + gapI; }, -gapI); };
    var colW = cols.map(function (cv) { return Math.max(150, Math.max.apply(null, cv.map(function (v) { return rowW(v); }).concat([0])) + 30); });
    var nSkip = P.filter(function (p) { return p.op === '~' && Math.abs((depth[p.lhs] || 0) - (depth[p.rhs] || 0)) !== 1; }).length, topPad = nSkip ? 70 + 22 * nSkip : 0;
    var W = colW.reduce(function (a, b) { return a + b + 60; }, 20), H = Math.max.apply(null, cols.map(function (cv) { return cv.length * blockH; })) + 30 + topPad;
    var pos = {}, x0 = 20;
    cols.forEach(function (cv, ci) {
      var cx = x0 + colW[ci] / 2, top = topPad + (H - topPad - cv.length * blockH) / 2;
      cv.forEach(function (v, k) { pos[v] = [cx, top + k * blockH + ry + 10]; });
      x0 += colW[ci] + 60;
    });
    var std = function (p) { return fr(p.std).replace(/^−\./, '−.'); };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + Math.min(W, 1000) + 'px" font-family="sans-serif" font-size="10.5">' +
      '<defs><marker id="sa" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3a4152"/></marker></defs>';
    var halo = ' paint-order="stroke" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" style="fill:#1d2433"';
    var isLat = function (v) { return lat.indexOf(v) >= 0; };
    var shapeEdge = function (v, tx, ty) { // 도형 경계점
      var p0 = pos[v], dx = tx - p0[0], dy = ty - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
      if (isLat(v)) { var t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)); return [p0[0] + dx * t, p0[1] + dy * t]; }
      var t2 = Math.min(Math.abs((bw / 2 + 8) / (dx || 1e-9)), Math.abs((bh / 2 + 2) / (dy || 1e-9))); return [p0[0] + dx * t2, p0[1] + dy * t2];
    };
    // 구조 경로
    var skipK = 0;
    P.forEach(function (p) {
      if (p.op !== '~') return;
      var A0 = pos[p.rhs], B0 = pos[p.lhs], dd = Math.abs(depth[p.lhs] - depth[p.rhs]);
      // 사이에 다른 변수가 가로막는지 확인 → 곡선으로 우회
      var blocked = structVars.some(function (u) {
        if (u === p.lhs || u === p.rhs) return false;
        var U = pos[u], vx = B0[0] - A0[0], vy = B0[1] - A0[1], L2 = vx * vx + vy * vy, t = ((U[0] - A0[0]) * vx + (U[1] - A0[1]) * vy) / L2;
        if (t <= 0.05 || t >= 0.95) return false;
        var px = A0[0] + t * vx - U[0], py = A0[1] + t * vy - U[1];
        return Math.sqrt(px * px + py * py) < ry + 12;
      });
      if (blocked || dd === 0) {
        var cx = (A0[0] + B0[0]) / 2, cy = Math.min(A0[1], B0[1]) - 70 - 22 * (skipK++);
        var a1 = shapeEdge(p.rhs, cx, cy), b1 = shapeEdge(p.lhs, cx, cy), my = (a1[1] + 2 * cy + b1[1]) / 4;
        s += '<path d="M' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b1[0].toFixed(1) + ' ' + b1[1].toFixed(1) + '" fill="none" stroke="#3a4152" stroke-width="1.4" marker-end="url(#sa)"/>' +
          '<text x="' + cx.toFixed(1) + '" y="' + (my - 2).toFixed(1) + '" text-anchor="middle"' + halo + '>' + std(p) + star(p.p) + '</text>';
        return;
      }
      var a = shapeEdge(p.rhs, B0[0], B0[1]), b = shapeEdge(p.lhs, A0[0], A0[1]);
      s += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#3a4152" stroke-width="1.4" marker-end="url(#sa)"/>' +
        '<text x="' + ((a[0] + b[0]) / 2).toFixed(1) + '" y="' + ((a[1] + b[1]) / 2 - 3).toFixed(1) + '" text-anchor="middle"' + halo + '>' + std(p) + star(p.p) + '</text>';
    });
    // 잠재·구조변수 간 공분산 (곡선)
    P.forEach(function (p) {
      if (p.op !== '~~' || p.lhs === p.rhs || !pos[p.lhs] || !pos[p.rhs]) return;
      var a = pos[p.lhs], b = pos[p.rhs], mx = (a[0] + b[0]) / 2 - (a[0] === b[0] ? 70 : 0), my = (a[1] + b[1]) / 2 - (a[0] === b[0] ? 0 : 40);
      var a2 = shapeEdge(p.lhs, mx, my), b2 = shapeEdge(p.rhs, mx, my);
      s += '<path d="M' + a2[0].toFixed(1) + ' ' + a2[1].toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + b2[0].toFixed(1) + ' ' + b2[1].toFixed(1) + '" fill="none" stroke="#2b5fc7" stroke-width="1.1" stroke-dasharray="4 3" marker-start="url(#sa)" marker-end="url(#sa)"/>' +
        '<text x="' + mx.toFixed(1) + '" y="' + (my + 3).toFixed(1) + '" text-anchor="middle"' + halo + '>' + std(p) + star(p.p) + '</text>';
    });
    // 잠재변수와 지표
    structVars.forEach(function (v) {
      var p0 = pos[v], L = inds(v);
      if (isLat(v)) {
        var y2 = p0[1] + ry + 34, xs = p0[0] - rowW(v) / 2;
        L.forEach(function (q) {
          var wq = boxW(q.rhs), bx = xs + wq / 2; xs += wq + gapI;
          s += '<line x1="' + p0[0] + '" y1="' + (p0[1] + ry) + '" x2="' + bx.toFixed(1) + '" y2="' + y2 + '" stroke="#8a94a6" stroke-width="1" marker-end="url(#sa)"/>' +
            '<rect x="' + (bx - wq / 2).toFixed(1) + '" y="' + y2 + '" width="' + wq.toFixed(1) + '" height="' + bh + '" fill="#ffffff" stroke="#3a4152"/>' +
            '<text x="' + bx.toFixed(1) + '" y="' + (y2 + 14) + '" text-anchor="middle" style="fill:#1d2433">' + esc(q.rhs.length > 12 ? q.rhs.slice(0, 12) + '…' : q.rhs) + '<title>' + esc(q.rhs) + '</title></text>' +
            '<text x="' + bx.toFixed(1) + '" y="' + (y2 + bh + 12) + '" text-anchor="middle" font-size="9.5" style="fill:#5b6475">' + std(q) + '</text>';
        });
        s += '<ellipse cx="' + p0[0] + '" cy="' + p0[1] + '" rx="' + rx + '" ry="' + ry + '" fill="#ffffff" stroke="#1d2433" stroke-width="1.4"/>';
      } else s += '<rect x="' + (p0[0] - bw / 2 - 8) + '" y="' + (p0[1] - bh / 2 - 2) + '" width="' + (bw + 16) + '" height="' + (bh + 4) + '" fill="#ffffff" stroke="#1d2433" stroke-width="1.4"/>';
      s += '<text x="' + p0[0] + '" y="' + (p0[1] + 4) + '" text-anchor="middle" font-weight="600" style="fill:#1d2433">' + esc(v.length > 10 ? v.slice(0, 10) + '…' : v) + '</text>';
    });
    return s + '</svg>';
  }

  var SEM_HELP = '<details><summary>문법 도움말 (lavaan과 같음)</summary><pre class="rcode">' + esc(
    '잠재변수 =~ 지표1 + 지표2 + 지표3   # 측정모형 (첫 지표 적재량 = 1 고정)\n' +
    '결과 ~ 원인1 + 원인2                # 회귀(구조) 경로\n' +
    '변수1 ~~ 변수2                      # (잔차)공분산\n' +
    '결과 ~ a*원인                       # 라벨 a 붙이기 (같은 라벨 = 동일성 제약)\n' +
    '간접 := a*b                         # 정의 모수 (간접효과, 총효과 등)\n' +
    '잠재 =~ NA*지표1 + 지표2            # 첫 적재량 자유 추정 (이때는 잠재 ~~ 1*잠재 로 분산 고정)\n' +
    '# 기본값(lavaan sem과 동일): 외생 잠재변수 간 공분산, 결과변수 간 잔차공분산은 자동 추가') + '</pre></details>';

  A.sem = {
    group: '구조방정식', title: '구조방정식 (CFA·SEM)',
    desc: '확인적 요인분석과 잠재변수 구조모형. lavaan 문법, ML·MLR 추정, 적합도, 표준화 추정치, CR·AVE, 간접효과 부트스트랩.',
    form: function () {
      var nums = varOptions('num');
      return '<div class="field"><label for="syn">모형 문법</label><textarea id="syn" class="paste" style="height:190px" spellcheck="false" placeholder="예)\n요인1 =~ 문항1 + 문항2 + 문항3\n요인2 =~ 문항4 + 문항5 + 문항6\n요인2 ~ 요인1"></textarea>' +
        '<div class="inline" style="margin-top:4px"><button class="btn small" id="tplCfa">CFA 틀</button><button class="btn small" id="tplMed">잠재 매개 틀</button></div>' + SEM_HELP + '</div>' +
        '<div class="field"><div class="lab">변수 넣기 (누르면 커서 위치에 삽입)</div><div class="varlist" style="max-height:120px;padding:4px;display:flex;flex-wrap:wrap;gap:4px">' +
        nums.map(function (v) { return '<button class="btn small vins" data-v="' + esc(v.name) + '">' + esc(v.name) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><div class="lab">추정법</div><div class="inline"><label><input type="radio" name="est" value="ML" checked>ML</label><label><input type="radio" name="est" value="MLR">MLR (강건 표준오차·척도화 χ²)</label></div>' +
        '<div class="hint">MLR은 정규성 위반에 강건합니다(리커트 5점 이상 자료에서 흔히 권장). 결측은 목록별 제거입니다(FIML 미지원).</div></div>' +
        '<div class="field"><div class="inline"><label>정의 모수(:=) 부트스트랩 <input type="number" id="nb" value="1000" min="0" step="500" style="width:80px"> 회</label><label>시드 <input type="number" id="seed" value="1234" style="width:70px"></label></div>' +
        '<div class="hint">:= 가 있을 때만 실행. lavaan 기본(1000회, 백분위 구간)과 같습니다.</div></div>';
    },
    wire: function () {
      var ta = $('#syn');
      try { var saved = localStorage.getItem('psystat_sem_syntax'); if (saved) ta.value = saved; } catch (e) { /* 저장소 사용 불가 */ }
      $$('.vins').forEach(function (b) {
        b.onclick = function () { var st = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.slice(0, st) + b.dataset.v + ta.value.slice(en); ta.focus(); ta.selectionStart = ta.selectionEnd = st + b.dataset.v.length; };
      });
      var nums = varOptions('num').map(function (v) { return v.name; }), v = function (i) { return nums[i] || ('문항' + (i + 1)); };
      $('#tplCfa').onclick = function () { ta.value = '# 확인적 요인분석: 요인 이름은 자유롭게 바꾸세요\n요인1 =~ ' + [v(0), v(1), v(2)].join(' + ') + '\n요인2 =~ ' + [v(3), v(4), v(5)].join(' + ') + '\n'; };
      $('#tplMed').onclick = function () {
        ta.value = '# 잠재변수 매개모형: X → M → Y\nX =~ ' + [v(0), v(1), v(2)].join(' + ') + '\nM =~ ' + [v(3), v(4), v(5)].join(' + ') + '\nY =~ ' + [v(6), v(7), v(8)].join(' + ') +
          '\nM ~ a*X\nY ~ b*M + c*X\n간접효과 := a*b\n총효과 := c + a*b\n';
      };
    },
    run: function () {
      var syn = $('#syn').value; need(syn.trim(), '모형 문법을 입력하세요.');
      try { localStorage.setItem('psystat_sem_syntax', syn); } catch (e) { /* 저장소 사용 불가 */ }
      var data = {}; state.names.forEach(function (n, i) { if (state.types[i] === 'num') data[n] = state.cols[i]; });
      var est = $('input[name=est]:checked').value, res = PsySEM.fitSEM(syn, data, { estimator: est }), F = res.fit, P = res.params;
      var robust = est === 'MLR' && F.scalingFactor;
      var fitRows = [[est === 'MLR' ? 'ML (비척도화)' : 'ML', res.N, f(F.chisq, 2), F.df, fp(F.pvalue), fr(F.cfi), fr(F.tli), fr(F.rmsea) + ' [' + fr(F.rmseaLow) + ', ' + fr(F.rmseaHigh) + ']', fr(F.srmr)]];
      if (robust) fitRows.push(['MLR (강건)', res.N, f(F.chisqScaled, 2), F.df, fp(F.pScaled), fr(F.cfiRobust), fr(F.tliRobust), fr(F.rmseaRobust) + ' [' + fr(F.rmseaRobustLow) + ', ' + fr(F.rmseaRobustHigh) + ']', fr(F.srmr)]);
      var html = res.warnings.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('') +
        table(['추정', 'N', 'χ²', 'df', 'p', 'CFI', 'TLI', 'RMSEA [90% CI]', 'SRMR'], fitRows, { left: [0], title: '모형 적합도',
          note: (robust ? 'MLR 척도화 계수 = ' + F.scalingFactor.toFixed(3) + ' (Yuan-Bentler, Mplus 방식); 강건 CFI·TLI·RMSEA는 Brosseau-Liard와 Savalei의 수정식. ' : '') +
            'AIC = ' + f(F.aic, 2) + ', BIC = ' + f(F.bic, 2) + ', 자유 모수 = ' + F.npar + '. 흔히 쓰는 기준은 CFI·TLI ≥ .95, RMSEA ≤ .06, SRMR ≤ .08(Hu & Bentler, 1999)이지만 고정 절단값으로 기계적으로 판단하지 않는 것이 권장된다.' });
      var rowP = function (p, lab) { return [lab, p.free ? f(p.est, 3) : f(p.est, 2) + '<sup>a</sup>', p.free ? f(p.se, 3) : '—', p.free ? f(p.z, 2) : '—', p.free ? fp(p.p) : '—', fr(p.std)]; };
      var meas = P.filter(function (p) { return p.op === '=~'; });
      if (meas.length) html += table(['요인 → 지표', 'B', 'SE', 'z', 'p', 'β'], meas.map(function (p) { return rowP(p, esc(p.lhs + ' → ' + p.rhs)); }),
        { left: [0], title: '측정모형: 요인적재량', note: 'B = 비표준화 추정치, β = 완전표준화 추정치. a 척도 지정을 위해 고정한 모수.' });
      var regs = P.filter(function (p) { return p.op === '~'; });
      if (regs.length) html += table(['경로', 'B', 'SE', 'z', 'p', '95% CI', 'β'], regs.map(function (p) {
        return [esc(p.rhs + ' → ' + p.lhs) + (p.label ? ' <span class="note">(' + esc(p.label) + ')</span>' : ''), f(p.est, 3), f(p.se, 3), f(p.z, 2), fp(p.p), '[' + f(p.ciLow, 3) + ', ' + f(p.ciHigh, 3) + ']', fr(p.std)];
      }), { left: [0], title: '구조모형: 경로계수' });
      var covs = P.filter(function (p) { return p.op === '~~' && p.lhs !== p.rhs; });
      if (covs.length) html += table(['공분산', 'B', 'SE', 'z', 'p', 'r'], covs.map(function (p) { return rowP(p, esc(p.lhs + ' ↔ ' + p.rhs)); }), { left: [0], title: '공분산과 상관', note: 'r은 (잔차) 상관.' });
      var r2map = {}; res.r2.forEach(function (r) { r2map[r.name] = r.r2; });
      var vars = P.filter(function (p) { return p.op === '~~' && p.lhs === p.rhs; });
      html += table(['변수', '(잔차)분산', 'SE', 'p', 'R²'], vars.map(function (p) { return [esc(p.lhs), f(p.est, 3), p.free ? f(p.se, 3) : '—', p.free ? fp(p.p) : '—', r2map[p.lhs] !== undefined ? fr(r2map[p.lhs]) : '—']; }),
        { left: [0], title: '분산과 설명량 (R²)', note: '외생 잠재변수는 분산, 내생변수는 잔차분산.' });
      if (res.reliability.length) {
        var lat = res.model.latents, id = res.model.idx, Sf = res.M.Sf;
        var corr = function (a, b) { return Sf[id[a]][id[b]] / Math.sqrt(Sf[id[a]][id[a]] * Sf[id[b]][id[b]]); };
        html += table(['요인', '문항 수', 'CR', 'AVE'].concat(lat.length > 1 ? lat.map(function (_, i) { return String(i + 1); }) : []), res.reliability.map(function (r, a) {
          return [(a + 1) + '. ' + esc(r.factor), r.k, fr(r.cr), fr(r.ave)].concat(lat.length > 1 ? lat.map(function (b, j) { return j < a ? fr(corr(lat[a], b)) : (j === a ? '<b>' + fr(Math.sqrt(r.ave)) + '</b>' : ''); }) : []);
        }), { left: [0], title: '집중타당도와 판별타당도', note: 'CR = 개념신뢰도(구성신뢰도), AVE = 평균분산추출. 대각선(굵게)은 √AVE, 아래 삼각은 잠재변수 간 상관(모형 추정). 표준화 적재량으로 계산했으며 교차적재와 오차공분산이 없다고 가정한다. 흔한 기준: CR ≥ .70, AVE ≥ .50, √AVE > 상관(Fornell & Larcker, 1981).' });
      }
      if (res.defined) {
        html += table(['정의 모수', '식', '추정치', 'SE', 'z', 'p', '95% CI (델타)', '95% Boot CI'], res.defined.map(function (d) {
          return [esc(d.name), '<span class="note">' + esc(d.expr) + '</span>', f(d.est, 3), f(d.se, 3), f(d.z, 2), fp(d.p), '[' + f(d.ciLow, 3) + ', ' + f(d.ciHigh, 3) + ']', '<span class="bootci">계산 중…</span>'];
        }), { left: [0, 1], title: '간접효과와 정의 모수', note: '델타 방법 표준오차는 ' + (est === 'MLR' ? '강건 공분산행렬' : '기대정보') + '을 사용했다. 간접효과의 유의성은 부트스트랩 구간이 0을 포함하는지로 판단하는 것이 권장된다.' });
      }
      html += '<h4>경로도 (완전표준화 추정치)</h4><div class="sem-plot">' + semDiagram(res) + '</div>' +
        '<p class="note">타원 = 잠재변수, 사각형 = 관측변수, 점선 양방향 화살표 = 공분산. 지표 아래 숫자는 표준화 적재량. 지표 간 잔차공분산은 그림에서 생략했습니다. * p &lt; .05, ** p &lt; .01, *** p &lt; .001.</p>' +
        '<p class="note">N = ' + res.N + ' (목록별 제거), 추정법 ' + est + ', 반복 ' + res.iterations + '회' + (res.converged ? '' : ' (<b>미수렴</b>)') + '. 추정치·표준오차·적합도는 lavaan 0.6의 sem()/cfa()와 같은 기본값과 공식으로 계산되며, 저장소의 tests/run_tests5.js에서 실제 자료로 대조했습니다.</p>' +
        rcode('library(lavaan)\nmodel <- \'\n' + syn.trim() + '\n\'\nfit <- sem(model, data = df, estimator = "' + est + '"' + (res.defined ? ', se = "bootstrap", bootstrap = 1000' : '') + ')\nsummary(fit, fit.measures = TRUE, standardized = TRUE)' + (res.defined ? '\nparameterEstimates(fit, boot.ci.type = "perc")' : ''));
      var card = addCard('구조방정식: ' + (regs.length ? 'SEM' : 'CFA') + ' (' + est + ')', html, res.model.latents.length + '개 잠재변수, ' + res.model.observed.length + '개 관측변수');
      var nb = Math.max(0, Math.floor(Number($('#nb').value) || 0));
      if (res.defined && nb) semBootstrap(card, res, nb, Number($('#seed').value) || 1);
      else $$('.bootci', card).forEach(function (e) { e.textContent = '—'; });
    }
  };

  function semBootstrap(card, res, B, seed) {
    var rand = S.rng(seed), draws = res.defined.map(function () { return []; }), done = 0, ok = 0, cells = $$('.bootci', card), t0 = Date.now();
    function step() {
      var until = Date.now() + 120;
      while (done < B && Date.now() < until) { var o = PsySEM.bootstrapOnce(res, rand); done++; if (o) { ok++; o.defined.forEach(function (v, j) { draws[j].push(v); }); } }
      cells.forEach(function (c) { c.textContent = done + '/' + B + '…'; });
      if (done < B) { setTimeout(step, 0); return; }
      cells.forEach(function (c, j) {
        var lo = S.quantile(draws[j], 0.025), hi = S.quantile(draws[j], 0.975);
        c.innerHTML = '[' + f(lo, 3) + ', ' + f(hi, 3) + ']' + (lo > 0 || hi < 0 ? '' : '');
      });
      var note = card.querySelectorAll('.apa-note');
      var defNote = [].filter.call(note, function (n) { return n.textContent.indexOf('델타') >= 0; })[0];
      if (defNote) defNote.insertAdjacentHTML('beforeend', ' 부트스트랩: ' + ok + '/' + B + '회 수렴, 백분위 구간, 시드 = ' + seed + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + '초).');
    }
    setTimeout(step, 30);
  }

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
      var html = table(['Cronbach α', '표준화 α', '평균 문항간 r', '문항 수', 'N'], [[fr(r.alpha), fr(r.stdAlpha), fr(r.meanInterItem), r.k, r.n]], { title: '내적 일관성 신뢰도' }) +
        table(['문항', 'M', 'SD', '수정된 문항-총점 r', '삭제 시 α'], r.items.map(function (it) { return [esc(it.name), f(it.mean, 2), f(it.sd, 2), fr(it.rCorrected), fr(it.alphaIfDeleted)]; }), { title: '문항 통계' }) +
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

  // 다음 조각으로 내보내기
  NS.semDiagram = semDiagram; NS.SEM_HELP = SEM_HELP; NS.semBootstrap = semBootstrap; NS.networkSVG = networkSVG; NS.centralityPlotSVG = centralityPlotSVG; NS.svgDownload = svgDownload; NS.download = download;
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
