"""Build 차트팔레트.xlsx: an offline, macro-free random chart palette workbook.

Same color logic as chart-palette/index.html (OKLCH generation, Machado 2009 CVD simulation).
Run: python3 build_palette_xlsx.py  ->  writes 차트팔레트.xlsx next to this script.
"""
import math, random, os
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as CL

rng = random.Random(20261121)
from colorlib import *

# ---- generators (ported from the web tool) ----
r = lambda a, b: a + rng.random() * (b - a)
MOODS = [  # name, L range, C range, hue spread
    ('균형', (0.55, 0.82), (0.11, 0.17), 360),
    ('학술지', (0.42, 0.78), (0.05, 0.10), 360),
    ('선명', (0.58, 0.76), (0.17, 0.24), 360),
    ('파스텔', (0.80, 0.92), (0.05, 0.10), 360),
    ('유사색', (0.38, 0.88), (0.08, 0.16), 110),
    ('보색', (0.45, 0.85), (0.10, 0.18), 0),
]
def cat_candidate(n, mood):
    _, Lr, Cr, spread = mood
    h0 = r(0, 360)
    Ls = [Lr[0] + (Lr[1] - Lr[0]) * (i / (n - 1)) for i in range(n)]
    rng.shuffle(Ls)
    out = []
    for i in range(n):
        if spread == 0: h = h0 + (180 if i % 2 else 0) + r(-25, 25)
        elif spread < 360: h = h0 + (i / (n - 1)) * spread + r(-8, 8)
        else: h = h0 + 360 / n * i + r(-12, 12)
        out.append(hexof(oklch(Ls[i], r(*Cr), h)))
    return out
def gen_cat(n, mood):
    best, bs = None, -1
    for _ in range(60):
        c = cat_candidate(n, mood)
        s = min(min_dist(c, 'none'), min_dist(c, 'deutan') * 1.3, min_dist(c, 'gray') * 2.2)
        if s > bs: best, bs = c, s
    return best
def gen_seq(n, cmax):
    h0, drift = r(0, 360), r(-70, 70)
    out = []
    for i in range(n):
        t = i / (n - 1)
        L = 0.95 - (0.95 - 0.28) * t
        C = 0.02 + (cmax - 0.02) * math.sin(math.pi * min(1, t * 0.85 + 0.1))
        out.append(hexof(oklch(L, C, h0 + drift * t)))
    return out
def gen_div(n, cmax):
    h0 = r(0, 360); h1 = h0 + r(150, 210)
    out = []
    for i in range(n):
        t = i / (n - 1); d = abs(t - 0.5) * 2
        L = 0.96 - (0.96 - 0.42) * d
        C = 0.012 + (cmax - 0.012) * d ** 0.8
        out.append(hexof(oklch(L, C, h0 if t < 0.5 else h1)))
    return out

TYPES = ['범주형', '순차형', '발산형']
COUNTS = [3, 4, 5, 6, 7, 8]
PER = 12  # palettes per (type, count)
MAXN = 8
pals = []  # (key, type, n, idx, mood_label, colors)
for t in TYPES:
    for n in COUNTS:
        for k in range(PER):
            if t == '범주형':
                mood = MOODS[k % len(MOODS)]
                cols, ml = gen_cat(n, mood), mood[0]
            else:
                cmax, ml = [(0.11, '학술지'), (0.16, '균형'), (0.20, '선명')][k % 3]
                cols = gen_seq(n, cmax) if t == '순차형' else gen_div(n, cmax)
            pals.append((f'{t}-{n}', t, n, k + 1, ml, cols))

def verdict(d, t):
    if t != '범주형': return '단계형'
    return '양호' if d >= 10 else '주의' if d >= 5 else '어려움'

# ---- workbook ----
wb = Workbook()
FONT = '맑은 고딕'
f = lambda **kw: Font(name=FONT, **kw)
thin = Side(style='thin', color='D0D4DC')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
INK, MUTED, ACC = '1B1F2A', '5D6475', '2F4FD6'
fill = lambda h: PatternFill('solid', start_color='FF' + h, end_color='FF' + h)
cf_fill = lambda h: PatternFill(fill_type='solid', bgColor='FF' + h, fgColor='FF' + h)
txt_on = lambda h: '111111' if lum(rgbof(h)) > 0.38 else 'FFFFFF'

# == Library sheet ==
lib = wb.active
lib.title = '팔레트목록'
LIB_FIRST = 4
lib['A1'] = '팔레트 목록'; lib['A1'].font = f(size=16, bold=True, color=INK)
lib['A2'] = f'총 {len(pals)}개. 같은 색 계산 방식(OKLCH)으로 미리 생성해 둔 조합입니다. 셀 색을 그대로 복사해 쓰셔도 됩니다.'
lib['A2'].font = f(size=9, color=MUTED)
heads = ['번호', '키', '유형', '개수', '유형 내 번호', '분위기'] + [f'색{i}' for i in range(1, MAXN + 1)] + \
        ['구분도-일반', '구분도-녹색맹', '구분도-흑백', '판정'] + [f'대비{i}' for i in range(1, MAXN + 1)]
for c, h in enumerate(heads, 1):
    cell = lib.cell(row=3, column=c, value=h)
    cell.font = f(size=9, bold=True, color=MUTED); cell.alignment = Alignment(horizontal='center')
COL_HEX1 = 7
COL_SC = COL_HEX1 + MAXN          # 15
COL_CT1 = COL_SC + 4               # 19
for i, (key, t, n, k, ml, cols) in enumerate(pals):
    row = LIB_FIRST + i
    vals = [i + 1, key, t, n, k, ml]
    for c, v in enumerate(vals, 1):
        lib.cell(row=row, column=c, value=v).font = f(size=9, color=INK)
    for j in range(MAXN):
        cell = lib.cell(row=row, column=COL_HEX1 + j)
        if j < n:
            h = cols[j]; cell.value = '#' + h
            cell.fill = fill(h); cell.font = Font(name='Consolas', size=9, color=txt_on(h))
            lib.cell(row=row, column=COL_CT1 + j, value=round(contrast(rgbof(h), (255, 255, 255)), 2)).font = f(size=9, color=MUTED)
        cell.alignment = Alignment(horizontal='center')
    d0, d1, d2 = (round(min_dist(cols, m), 1) for m in ('none', 'deutan', 'gray'))
    for j, v in enumerate([d0, d1, d2, verdict(min(d0, d1), t)]):
        lib.cell(row=row, column=COL_SC + j, value=v).font = f(size=9, color=INK)
LIB_LAST = LIB_FIRST + len(pals) - 1
widths = [6, 11, 8, 6, 9, 8] + [10] * MAXN + [11, 12, 11, 8] + [7] * MAXN
for c, w in enumerate(widths, 1): lib.column_dimensions[CL(c)].width = w
lib.freeze_panes = 'G4'
lib.auto_filter.ref = f'A3:{CL(len(heads))}{LIB_LAST}'
LR = lambda col: f"팔레트목록!${CL(col)}${LIB_FIRST}:${CL(col)}${LIB_LAST}"

# == Random sheet ==
ws = wb.create_sheet('랜덤', 0)
ws.sheet_view.showGridLines = False
ws.column_dimensions['A'].width = 2
ws.column_dimensions['B'].width = 14
for c in range(3, 3 + MAXN): ws.column_dimensions[CL(c)].width = 12.5
ws.column_dimensions['K'].width = 3; ws.column_dimensions['L'].width = 14; ws.column_dimensions['M'].width = 10

ws['B1'] = '랜덤 차트 팔레트'; ws['B1'].font = f(size=18, bold=True, color=INK)
ws['B2'] = 'F9 키를 누를 때마다 새 조합이 나옵니다. 마음에 들면 "고정 번호"에 번호를 적어 두세요. (매크로·인터넷 필요 없음)'
ws['B2'].font = f(size=9, color=MUTED)

lab = lambda ref, v: (ws.__setitem__(ref, v), setattr(ws[ref], 'font', f(size=9, bold=True, color=MUTED)))
lab('B4', '유형'); lab('D4', '색 개수'); lab('F4', '고정 번호 (1–12)')
inp = lambda ref, v: (ws.__setitem__(ref, v), setattr(ws[ref], 'font', f(size=12, bold=True, color=ACC)),
                      setattr(ws[ref], 'border', BOX), setattr(ws[ref], 'fill', fill('EEF1FF')),
                      setattr(ws[ref], 'alignment', Alignment(horizontal='center')))
inp('C4', '범주형'); inp('E4', 5); inp('G4', None)
dv1 = DataValidation(type='list', formula1='"범주형,순차형,발산형"', allow_blank=False); ws.add_data_validation(dv1); dv1.add('C4')
dv2 = DataValidation(type='list', formula1='"3,4,5,6,7,8"', allow_blank=False); ws.add_data_validation(dv2); dv2.add('E4')
dv3 = DataValidation(type='whole', operator='between', formula1='1', formula2=str(PER), allow_blank=True)
dv3.error = f'1부터 {PER} 사이 숫자를 넣거나 비워 두세요.'; ws.add_data_validation(dv3); dv3.add('G4')

# helpers (column L/M), visible but quiet
for i, (lbl, fm) in enumerate([
    ('키', '=C4&"-"&E4'),
    ('시작 위치', f'=MATCH(M5,{LR(2)},0)'),
    ('유형 내 번호', f'=IF(G4="",RANDBETWEEN(1,{PER}),G4)'),
    ('목록 번호', '=M6+M7-1'),
    ('색 개수', f'=INDEX({LR(4)},M8)'),
]):
    ws.cell(row=5 + i, column=12, value=lbl).font = f(size=8, color='9AA1B2')
    ws.cell(row=5 + i, column=13, value=fm).font = f(size=8, color='9AA1B2')
ws['L4'] = '계산용 (건드리지 마세요)'; ws['L4'].font = f(size=8, italic=True, color='9AA1B2')

ws['B6'] = '현재 팔레트'; ws['B6'].font = f(size=9, bold=True, color=MUTED)
ws['C6'] = '=M5&"  #"&M7&"  ("&INDEX(' + LR(6) + ',M8)&")"'
ws['C6'].font = f(size=13, bold=True, color=INK)

ROW_SW, ROW_IDX = 9, 8
rows = {'일반': ROW_SW, 'HEX': 10, 'R': 11, 'G': 12, 'B': 13, '흰 배경 대비': 14, '녹색맹으로 보면': 16, '흑백 인쇄 시': 17}
for name, rr in rows.items():
    ws.cell(row=rr, column=2, value=name).font = f(size=9, bold=True, color=MUTED)
    ws.cell(row=rr, column=2).alignment = Alignment(vertical='center')
ws.row_dimensions[ROW_SW].height = 54
ws.row_dimensions[16].height = 26; ws.row_dimensions[17].height = 26
for j in range(MAXN):
    col = 3 + j; L = CL(col)
    show = f'{j + 1}<=$M$9'
    ws.cell(row=ROW_IDX, column=col, value=f'=IF({show},"색 {j + 1}","")').font = f(size=8, color=MUTED)
    ws.cell(row=ROW_IDX, column=col).alignment = Alignment(horizontal='center')
    hexf = f'INDEX({LR(COL_HEX1 + j)},$M$8)'
    ws.cell(row=10, column=col, value=f'=IF({show},{hexf},"")')
    for rr, start in ((11, 2), (12, 4), (13, 6)):
        ws.cell(row=rr, column=col, value=f'=IF({show},HEX2DEC(MID({L}$10,{start},2)),"")')
    ws.cell(row=14, column=col, value=f'=IF({show},INDEX({LR(COL_CT1 + j)},$M$8),"")')
    for rr in (ROW_SW, 10, 11, 12, 13, 14, 16, 17):
        c = ws.cell(row=rr, column=col)
        c.alignment = Alignment(horizontal='center', vertical='center')
        if rr in (10, 11, 12, 13): c.font = Font(name='Consolas', size=10, color=INK)
        if rr == 14: c.font = f(size=9, color=MUTED); c.number_format = '0.00'
        if rr in (ROW_SW, 16, 17): c.border = Border(left=Side(style='thin', color='FFFFFF'), right=Side(style='thin', color='FFFFFF'))

# conditional formatting: one rule per palette per swatch cell (fills can't come from formulas otherwise)
for i, (_, t, n, _, _, cols) in enumerate(pals):
    pid = i + 1
    for j in range(n):
        col = CL(3 + j)
        for rr, mode in ((ROW_SW, 'none'), (16, 'deutan'), (17, 'gray')):
            ws.conditional_formatting.add(f'{col}{rr}', FormulaRule(formula=[f'$M$8={pid}'], fill=cf_fill(simulate(cols[j], mode)), stopIfTrue=True))

# contrast chip coloring (WCAG 1.4.11 : 3:1 for graphics)
ws.conditional_formatting.add('C14:J14', FormulaRule(formula=['AND(ISNUMBER(C14),C14<3)'], font=Font(color='B3261E', bold=True)))

ws['B19'] = '구분도 점검'; ws['B19'].font = f(size=9, bold=True, color=MUTED)
for j, (lbl, col) in enumerate([('일반', COL_SC), ('녹색맹', COL_SC + 1), ('흑백', COL_SC + 2), ('판정', COL_SC + 3)]):
    ws.cell(row=20, column=3 + j, value=lbl).font = f(size=8, color=MUTED)
    c = ws.cell(row=21, column=3 + j, value=f'=INDEX({LR(col)},$M$8)')
    c.font = f(size=12, bold=True, color=INK); c.alignment = Alignment(horizontal='left')
ws.conditional_formatting.add('F21', FormulaRule(formula=['F21="양호"'], font=Font(color='1F7A4A', bold=True)))
ws.conditional_formatting.add('F21', FormulaRule(formula=['F21="주의"'], font=Font(color='9A6200', bold=True)))
ws.conditional_formatting.add('F21', FormulaRule(formula=['F21="어려움"'], font=Font(color='B3261E', bold=True)))
notes = [
    '· 숫자는 가장 비슷한 두 색의 OKLab 거리(×100). 10 이상 양호, 5–10 주의, 5 미만 어려움은 이 파일이 정한 경험적 기준입니다(공식 표준 아님). 판정은 일반·녹색맹 값으로 매기며, 흑백 값은 낮은 편이 보통입니다.',
    '· 순차형·발산형은 이웃 단계끼리 비슷한 게 정상이라 "단계형"으로 표시합니다. 흑백 줄에서 밝기 순서가 유지되는지만 보세요.',
    '· 흰 배경 대비가 3 미만(빨간 숫자)이면 흰 배경 위의 얇은 선·작은 점은 잘 안 보일 수 있습니다(WCAG 2.1 기준 1.4.11).',
    '· 녹색맹 시뮬레이션: Machado, Oliveira & Fernandes (2009), IEEE TVCG 15(6). https://doi.org/10.1109/TVCG.2009.113',
]
for i, t in enumerate(notes):
    ws.cell(row=23 + i, column=2, value=t).font = f(size=8, color=MUTED)
ws['B28'] = '차트에 넣는 법 → "사용법" 시트'; ws['B28'].font = f(size=10, bold=True, color=ACC)
ws.freeze_panes = 'A5'

# == Presets sheet ==
ps = wb.create_sheet('검증프리셋')
ps.sheet_view.showGridLines = False
ps['B1'] = '검증된 프리셋'; ps['B1'].font = f(size=16, bold=True, color=INK)
PRE = [
    ('Okabe–Ito (색맹 친화, 범주형)', ['E69F00', '56B4E9', '009E73', 'F0E442', '0072B2', 'D55E00', 'CC79A7', '000000'],
     'Okabe, M., & Ito, K. (2008). Color Universal Design. https://jfly.uni-koeln.de/color/'),
    ('viridis (순차형)', ['440154', '3B528B', '21918C', '5EC962', 'FDE725'],
     'van der Walt, S., & Smith, N. (2015). matplotlib 기본 컬러맵. https://bids.github.io/colormap/'),
    ('회색조 (흑백 인쇄 전용)', ['F0F0F0', 'BDBDBD', '969696', '636363', '252525'], '단순 회색 단계'),
]
ps.column_dimensions['A'].width = 2; ps.column_dimensions['B'].width = 30
for c in range(3, 11): ps.column_dimensions[CL(c)].width = 11
rr = 3
for name, cols, ref in PRE:
    ps.cell(row=rr, column=2, value=name).font = f(size=10, bold=True, color=INK)
    for j, h in enumerate(cols):
        c = ps.cell(row=rr, column=3 + j, value='#' + h); c.fill = fill(h)
        c.font = Font(name='Consolas', size=9, color=txt_on(h)); c.alignment = Alignment(horizontal='center', vertical='center')
        ps.cell(row=rr + 1, column=3 + j, value=', '.join(map(str, rgbof(h)))).font = Font(name='Consolas', size=8, color=MUTED)
        ps.cell(row=rr + 1, column=3 + j).alignment = Alignment(horizontal='center')
    ps.row_dimensions[rr].height = 30
    ps.cell(row=rr + 2, column=2, value=ref).font = f(size=8, color=MUTED)
    rr += 4

# == How-to sheet ==
hw = wb.create_sheet('사용법')
hw.sheet_view.showGridLines = False
hw.column_dimensions['A'].width = 2; hw.column_dimensions['B'].width = 110
lines = [
    ('h', '사용법'),
    ('s', '1. 색 뽑기'),
    ('p', '"랜덤" 시트에서 유형과 색 개수를 고른 뒤 F9를 누르세요. 누를 때마다 바뀝니다. (셀을 편집해도 바뀌니, 마음에 들면 바로 "고정 번호"에 # 뒤의 숫자를 적으세요.)'),
    ('p', '범주형 = 집단 비교(실험/통제 등) · 순차형 = 점수 크기, 빈도 · 발산형 = 변화량처럼 0을 중심으로 +/− 가 있는 값'),
    ('s', '2. 차트 하나에 색 넣기 (가장 기본)'),
    ('p', '차트의 막대(계열)를 클릭 → 우클릭 "데이터 계열 서식" → 채우기 → 색 → "다른 색" → "사용자 지정" 탭 → 빨강/녹색/파랑에 R, G, B 값 입력.'),
    ('p', 'Excel 2016/2019(설치형)에는 HEX 입력칸이 없으니 R, G, B 숫자를 넣으세요. (Microsoft 365 등 최신판에는 "16진수" 칸이 있습니다.)'),
    ('s', '3. 한 번 만든 차트를 서식으로 저장 (다음부터 한 번에)'),
    ('p', '색을 다 입힌 차트를 우클릭 → "서식 파일로 저장" → 이름 지정(.crtx). 다음에 새 차트를 만들 때 차트 삽입 → "모든 차트" → "서식 파일"에서 고르면 색이 그대로 적용됩니다.'),
    ('s', '4. 회사 파일 전체의 기본 차트 색을 바꾸기 (테마 색) ★ 추천'),
    ('p', '페이지 레이아웃 탭 → 색 → "색 사용자 지정" → "강조 1"~"강조 6"에 팔레트 색 1~6을 입력 → 이름 저장.'),
    ('p', '이후 이 통합문서에서 새로 만드는 모든 차트가 자동으로 이 색 순서로 그려집니다. 저장한 테마 색은 같은 PC의 PowerPoint·Word에서도 고를 수 있습니다.'),
    ('p', '(테마 색은 6개까지라, 7–8색 팔레트는 7번째부터는 2번 방식으로 직접 입력하세요.)'),
    ('p', '→ 랜덤으로 뽑은 팔레트를 테마 파일로 바로 만들거나, 미리 만든 테마 묶음을 설치하는 방법은 "테마색" 시트에 있습니다.'),
    ('s', '5. 학위논문·투고용 체크'),
    ('p', '· 흑백 인쇄 줄에서 색끼리 회색 농도가 겹치면, 막대에 무늬(패턴 채우기)나 선 모양(실선/점선)을 함께 쓰세요.'),
    ('p', '· 색만으로 정보를 구분하지 않도록 범례 외에 직접 라벨을 붙이는 것도 좋습니다.'),
    ('p', '· 학술지마다 그림 규정(흑백 인쇄, 컬러 요금, RGB/CMYK)이 다르니 투고 규정(Author Guidelines)을 꼭 확인하세요.'),
    ('s', '6. 선택 사항: 매크로로 한 번에 적용'),
    ('p', '회사에서 매크로가 허용된다면 함께 드린 ApplyPalette.bas 를 Alt+F11 → 파일 → 파일 가져오기로 넣고, 차트를 선택한 뒤 Alt+F8 → ApplyPaletteToChart 실행.'),
    ('p', '현재 "랜덤" 시트의 색이 선택한 차트의 계열(또는 원형 차트의 조각)에 순서대로 적용됩니다. 매크로가 막혀 있다면 이 단계는 건너뛰셔도 됩니다.'),
    ('s', '참고문헌'),
    ('p', 'Machado, G. M., Oliveira, M. M., & Fernandes, L. A. F. (2009). A physiologically-based model for simulation of color vision deficiency. IEEE TVCG, 15(6), 1291–1298. https://doi.org/10.1109/TVCG.2009.113'),
    ('p', 'Okabe, M., & Ito, K. (2008). Color Universal Design (CUD): How to make figures and presentations that are friendly to colorblind people. https://jfly.uni-koeln.de/color/'),
    ('p', 'Crameri, F., Shephard, G. E., & Heron, P. J. (2020). The misuse of colour in science communication. Nature Communications, 11, 5444. https://doi.org/10.1038/s41467-020-19160-7'),
    ('p', 'W3C (2018). Web Content Accessibility Guidelines (WCAG) 2.1, 1.4.11 Non-text Contrast. https://www.w3.org/TR/WCAG21/'),
    ('p', 'Ottosson, B. (2020). A perceptual color space for image processing (OKLab). https://bottosson.github.io/posts/oklab/'),
]
for i, (kind, t) in enumerate(lines, 1):
    c = hw.cell(row=i + (0 if i == 1 else 1), column=2, value=t)
    c.alignment = Alignment(wrap_text=True, vertical='top')
    c.font = {'h': f(size=16, bold=True, color=INK), 's': f(size=11, bold=True, color=ACC), 'p': f(size=10, color=INK)}[kind]


# == Theme colors: ready-made pack + live XML from the random sheet ==
import zipfile
MOOD_SLUG = {'균형': 'balanced', '학술지': 'academic', '선명': 'vivid', '파스텔': 'pastel', '유사색': 'analogous', '보색': 'complementary'}
base = [('Okabe-Ito', 'okabe-ito', ['E69F00', '56B4E9', '009E73', 'F0E442', '0072B2', 'D55E00'], 'Okabe & Ito (2008) 색맹 친화 표준')]
cat6 = [p_ for p_ in pals if p_[0] == '범주형-6']
for mood in [m[0] for m in MOODS]:
    cands = [p_ for p_ in cat6 if p_[4] == mood]
    best = max(cands, key=lambda p_: min(min_dist(p_[5], 'none'), min_dist(p_[5], 'deutan')))
    base.append((mood, MOOD_SLUG[mood], best[5], f'범주형 · {mood} (목록 범주형-6 #{best[3]})'))
base += [(n.replace('CP ', '', 1), slug, c, d) for n, slug, k, c, d in CURATED]
pack, files = [], []
for idx, (label, slug, cols, desc) in enumerate(base, 1):
    pack.append((f'CP {idx:02d} {label}', cols, desc))
    files.append(f'CP{idx:02d}_{slug}.xml')
zpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), '테마색_팩.zip')
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for fn, (name, cols, _) in zip(files, pack):
        z.writestr(fn, theme_xml(name, cols).encode('utf-8'))

th = wb.create_sheet('테마색', 1)
th.sheet_view.showGridLines = False
th.column_dimensions['A'].width = 2; th.column_dimensions['B'].width = 24
for c in range(3, 9): th.column_dimensions[CL(c)].width = 11
th.column_dimensions['I'].width = 40
th['B1'] = '테마 색 (모든 차트의 기본 색 바꾸기)'; th['B1'].font = f(size=16, bold=True, color=INK)
th['B2'] = '테마 색을 바꿔 두면 막대·꺾은선·원형·분산형 등 새로 만드는 모든 차트가 강조 1→6 순서로 자동 색칠됩니다. Excel 2016/2019에서도 됩니다.'
th['B2'].font = f(size=9, color=MUTED)

th['B4'] = 'A. 지금 랜덤 시트의 팔레트를 테마로 만들기'; th['B4'].font = f(size=11, bold=True, color=ACC)
th['B5'] = '테마 이름'; th['B5'].font = f(size=9, bold=True, color=MUTED)
th['C5'] = '내 팔레트 1'; th['C5'].font = f(size=11, bold=True, color=ACC); th['C5'].fill = fill('EEF1FF'); th['C5'].border = BOX
th.merge_cells('C5:E5')
th['B6'] = '사용될 색 (강조 1–6)'; th['B6'].font = f(size=9, bold=True, color=MUTED)
PAD = ['7F7F7F', 'A5A5A5', '595959', 'BFBFBF', '404040', 'D9D9D9']
for j in range(6):
    c = th.cell(row=6, column=3 + j, value=f'=IF(랜덤!{CL(3+j)}10="","{PAD[j]}",MID(랜덤!{CL(3+j)}10,2,6))')
    c.font = Font(name='Consolas', size=10, color=INK); c.alignment = Alignment(horizontal='center')
th['I6'] = '색이 6개보다 적으면 남는 자리는 회색으로 채웁니다.'; th['I6'].font = f(size=8, color=MUTED)
xml_f = ('="<?xml version=\'1.0\' encoding=\'UTF-8\' standalone=\'yes\'?>'
         '<a:clrScheme xmlns:a=\'http://schemas.openxmlformats.org/drawingml/2006/main\' name=\'"&C5&"\'>'
         '<a:dk1><a:sysClr val=\'windowText\' lastClr=\'000000\'/></a:dk1><a:lt1><a:sysClr val=\'window\' lastClr=\'FFFFFF\'/></a:lt1>'
         '<a:dk2><a:srgbClr val=\'44546A\'/></a:dk2><a:lt2><a:srgbClr val=\'E7E6E6\'/></a:lt2>"'
         + ''.join(f'&"<a:accent{j+1}><a:srgbClr val=\'"&{CL(3+j)}6&"\'/></a:accent{j+1}>"' for j in range(6))
         + '&"<a:hlink><a:srgbClr val=\'0563C1\'/></a:hlink><a:folHlink><a:srgbClr val=\'954F72\'/></a:folHlink></a:clrScheme>"')
th['B8'] = '복사할 내용 ↓'; th['B8'].font = f(size=9, bold=True, color=MUTED)
th['B9'] = xml_f
th['B9'].font = Font(name='Consolas', size=8, color=MUTED)
steps = [
    '① 위 B9 셀을 클릭 → Ctrl+C (주의: 랜덤 시트에 "고정 번호"를 먼저 적어 두세요. 안 그러면 복사 순간 색이 바뀔 수 있습니다.)',
    '② 메모장을 열고 Ctrl+V → 파일 → 다른 이름으로 저장 → 인코딩 "UTF-8", 파일 이름 예: 내팔레트1.xml',
    '③ 저장 위치: 주소창에  %APPDATA%\\Microsoft\\Templates\\Document Themes\\Theme Colors  를 붙여넣고 Enter (폴더가 없으면 만드세요)',
    '④ Excel을 다시 열고 → 페이지 레이아웃 탭 → 색 → 맨 위 "사용자 지정"에 나타난 이름을 클릭',
    '※ 메모장 대신, 페이지 레이아웃 → 색 → "색 사용자 지정"에서 강조 1–6에 RGB를 직접 입력해도 결과는 같습니다.',
]
for i, t in enumerate(steps):
    th.cell(row=11 + i, column=2, value=t).font = f(size=9, color=INK)

th['B18'] = 'B. 바로 쓰는 테마 색 묶음 (테마색_팩.zip)'; th['B18'].font = f(size=11, bold=True, color=ACC)
th['B19'] = '압축을 풀어 나온 .xml 파일들을 위 ③의 폴더에 넣으면 아래 조합이 전부 "사용자 지정" 목록에 뜹니다.'
th['B19'].font = f(size=9, color=MUTED)
for i, (name, cols, desc) in enumerate(pack):
    rr = 21 + i
    th.cell(row=rr, column=2, value=name).font = f(size=10, bold=True, color=INK)
    for j, h in enumerate(cols):
        c = th.cell(row=rr, column=3 + j, value='#' + h); c.fill = fill(h)
        c.font = Font(name='Consolas', size=8, color=txt_on(h)); c.alignment = Alignment(horizontal='center', vertical='center')
    th.cell(row=rr, column=9, value=desc).font = f(size=8, color=MUTED)
    th.row_dimensions[rr].height = 24

wb.calculation.fullCalcOnLoad = True
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '차트팔레트.xlsx')
wb.save(out)
print('saved', out, len(pals), 'palettes')
