"""Build chart template workbooks whose chart colors follow the workbook theme (accent 1–6).

Changing 페이지 레이아웃 → 색 to another theme recolors every chart in the file.
Run: python3 build_chart_templates.py
"""
import os, re
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, Color
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.legend import LegendEntry
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.chart.text import RichText
from openpyxl.drawing.text import Paragraph, ParagraphProperties, CharacterProperties, Font as DFont
from openpyxl.drawing.colors import ColorChoice, SchemeColor
from openpyxl.drawing.line import LineProperties
from openpyxl.writer.theme import theme_xml as DEFAULT_THEME
from colorlib import CURATED

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '맑은 고딕'
f = lambda **kw: Font(name=FONT, **kw)
INK, MUTED, ACC = '1B1F2A', '5D6475', '2F4FD6'
thin = Side(style='thin', color='D0D4DC')

def theme_with(cols6, name):
    x = DEFAULT_THEME
    for i, h in enumerate(cols6, 1):
        x = re.sub(rf'(<a:accent{i}>\s*<a:srgbClr val=")[0-9A-Fa-f]{{6}}', rf'\g<1>{h}', x)
    x = re.sub(r'(<a:clrScheme name=")[^"]*', rf'\g<1>{name}', x)
    # Korean-friendly theme fonts
    x = re.sub(r'(<a:majorFont>\s*<a:latin typeface=")[^"]*', r'\g<1>맑은 고딕', x)
    x = re.sub(r'(<a:minorFont>\s*<a:latin typeface=")[^"]*', r'\g<1>맑은 고딕', x)
    return x.encode('utf-8') if isinstance(x, str) else x

def scheme(acc):
    return ColorChoice(schemeClr=SchemeColor(val=acc))

def paint(series, acc, line=False, marker=False):
    gp = series.graphicalProperties
    if gp is None:
        series.graphicalProperties = gp = GraphicalProperties()
    if line:
        gp.line = LineProperties(solidFill=scheme(acc), w=28575)
        if marker:
            series.marker.symbol = 'circle'; series.marker.size = 6
            series.marker.graphicalProperties = GraphicalProperties(solidFill=scheme(acc))
            series.marker.graphicalProperties.line = LineProperties(solidFill=scheme(acc))
    else:
        gp.solidFill = scheme(acc)
        gp.line = LineProperties(noFill=True)

def txt(size=900, color='595959', bold=False):
    cp = CharacterProperties(sz=size, b=bold, solidFill=color, latin=DFont(typeface=FONT), ea=DFont(typeface=FONT))
    return RichText(p=[Paragraph(pPr=ParagraphProperties(defRPr=cp), endParaRPr=cp)])

def labels(series, fmt, color):
    series.dLbls = DataLabelList()
    series.dLbls.showVal = True
    for k in ('showSerName', 'showCatName', 'showLegendKey', 'showPercent'):
        setattr(series.dLbls, k, False)
    series.dLbls.numFmt = fmt
    series.dLbls.txPr = txt(800, color)

def axes_visible(ch):
    for ax in (ch.x_axis, ch.y_axis):
        ax.delete = False
        ax.txPr = txt(900, '595959')

def header(ws, title, sub):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 2
    ws['B1'] = title; ws['B1'].font = f(size=16, bold=True, color=INK)
    ws['B2'] = sub; ws['B2'].font = f(size=9, color=MUTED)

def table(ws, top, left, heads, rows, fmt=None, input_cols=()):
    for j, h in enumerate(heads):
        c = ws.cell(row=top, column=left + j, value=h)
        c.font = f(size=9, bold=True, color=MUTED); c.alignment = Alignment(horizontal='center', wrap_text=True)
        c.border = Border(bottom=thin)
    for i, row in enumerate(rows, 1):
        for j, v in enumerate(row):
            c = ws.cell(row=top + i, column=left + j, value=v)
            c.font = f(size=10, color=INK)
            if j: c.alignment = Alignment(horizontal='center')
            if fmt and j: c.number_format = fmt
            if j in input_cols: c.fill = PatternFill('solid', start_color='FFEEF1FF', end_color='FFEEF1FF')

def notes(ws, top, col, lines):
    for i, t in enumerate(lines):
        ws.cell(row=top + i, column=col, value=t).font = f(size=9, color=INK if not t.startswith('※') else MUTED)

COMMON_NOTES = [
    '사용법',
    '· 파란 칸의 숫자만 바꾸면 차트가 따라 바뀝니다. 행(문항·집단)을 늘리면 차트를 클릭 → 데이터 범위의 파란 테두리를 끌어서 넓히세요.',
    '· 색 바꾸기: 페이지 레이아웃 → 색 → 같은 종류의 "CP …" 테마를 고르면 차트 색이 한 번에 바뀝니다 (테마색_팩.zip 설치 필요).',
    '· 다른 파일에서 쓰기: 차트 우클릭 → "서식 파일로 저장"(.crtx). 새 차트를 만들 때 차트 삽입 → 모든 차트 → 서식 파일에서 고르세요.',
    '※ 차트 색은 "그 파일의 테마 색"을 따릅니다. 차트를 다른 파일로 복사하면 그 파일의 테마 색으로 보이니, 그 파일에도 같은 CP 테마를 적용하세요.',
    '※ 표의 숫자는 모두 미리보기용 가상 데이터입니다.',
]

def cell_legend(ws, row, col, names, accents, text_colors):
    """Legend made of cells filled with theme accents, so it recolors with the theme like the chart."""
    for j, (nm, a, tc) in enumerate(zip(names, accents, text_colors)):
        c = ws.cell(row=row, column=col + j, value=nm)
        th = Color(theme=3 + int(a[-1]))          # theme index: 4 = accent1 … 9 = accent6
        c.fill = PatternFill('solid', start_color=th, end_color=th)
        c.font = f(size=9, bold=True, color=tc); c.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[row].height = 18

def pick(slug):
    return next(c for c in CURATED if c[1] == slug)

# ======================================================================
# 1) Likert diverging stacked bar
# ======================================================================
def likert():
    name, slug, _, cols, _ = pick('likert5_orange-purple')
    wb = Workbook(); wb.loaded_theme = theme_with(cols, name)
    ws = wb.active; ws.title = '리커트'
    header(ws, '리커트 척도 차트 (반대 – 보통 – 찬성)', '가운데(보통)를 기준으로 왼쪽은 반대, 오른쪽은 찬성. 문항별 응답 분포를 한눈에 비교합니다.')
    items = ['상담 과정에 만족한다', '상담자가 나를 이해했다', '목표가 분명했다', '회기 시간이 적절했다', '다른 사람에게 추천하겠다', '변화를 체감한다']
    raw = [[4, 9, 15, 42, 30], [2, 6, 12, 38, 42], [8, 16, 24, 34, 18], [10, 18, 30, 28, 14], [3, 7, 14, 36, 40], [12, 20, 28, 26, 14]]
    heads = ['문항', '매우 반대', '반대', '보통', '찬성', '매우 찬성']
    ws['B4'] = '① 응답 수 입력 (명)'; ws['B4'].font = f(size=10, bold=True, color=ACC)
    table(ws, 5, 2, heads, [[it] + r for it, r in zip(items, raw)], input_cols=(1, 2, 3, 4, 5))
    n = len(items); R0 = 6; R1 = R0 + n - 1
    # percentages
    ws['I4'] = '② 비율 (자동)'; ws['I4'].font = f(size=10, bold=True, color=MUTED)
    for j, h in enumerate(heads):
        c = ws.cell(row=5, column=9 + j, value=h); c.font = f(size=9, bold=True, color=MUTED); c.alignment = Alignment(horizontal='center'); c.border = Border(bottom=thin)
    for i in range(n):
        r = R0 + i
        ws.cell(row=r, column=9, value=f'=B{r}').font = f(size=10, color=INK)
        for j in range(5):
            src = chr(ord('C') + j)
            c = ws.cell(row=r, column=10 + j, value=f'=IF(SUM($C{r}:$G{r})=0,0,{src}{r}/SUM($C{r}:$G{r}))')
            c.number_format = '0%'; c.font = f(size=10, color=INK); c.alignment = Alignment(horizontal='center')
    # diverging helper: order matters (Excel stacks the first negative series next to zero)
    ws['P4'] = '③ 차트용 (자동, 수정 불필요)'; ws['P4'].font = f(size=10, bold=True, color=MUTED)
    dh = ['문항', '보통', '반대', '매우 반대', '보통 ', '찬성', '매우 찬성']
    dsrc = [None, ('-', 'L', '/2'), ('-', 'K', ''), ('-', 'J', ''), ('', 'L', '/2'), ('', 'M', ''), ('', 'N', '')]
    for j, h in enumerate(dh):
        c = ws.cell(row=5, column=16 + j, value=h); c.font = f(size=9, bold=True, color=MUTED); c.alignment = Alignment(horizontal='center'); c.border = Border(bottom=thin)
    for i in range(n):
        r = R0 + i
        ws.cell(row=r, column=16, value=f'=B{r}').font = f(size=10, color=MUTED)
        for j in range(1, 7):
            sg, col, tail = dsrc[j]
            c = ws.cell(row=r, column=16 + j, value=f'={sg}{col}{r}{tail}')
            c.number_format = '0%;0%'; c.font = f(size=10, color=MUTED); c.alignment = Alignment(horizontal='center')
    for c in range(3, 23): ws.column_dimensions[chr(64 + c) if c <= 26 else 'Z'].width = 9.5
    ws.column_dimensions['B'].width = 22; ws.column_dimensions['I'].width = 22; ws.column_dimensions['P'].width = 22
    ws.column_dimensions['H'].width = 3; ws.column_dimensions['O'].width = 3

    # chart A: diverging
    ch = BarChart(); ch.type = 'bar'; ch.grouping = 'stacked'; ch.overlap = 100; ch.gapWidth = 45
    ch.add_data(Reference(ws, min_col=17, max_col=22, min_row=5, max_row=R1), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=16, min_row=R0, max_row=R1))
    accs = ['accent3', 'accent2', 'accent1', 'accent3', 'accent4', 'accent5']
    lab_color = ['404040', '404040', 'FFFFFF', '404040', '404040', 'FFFFFF']
    for s, a, lc in zip(ch.series, accs, lab_color):
        paint(s, a); labels(s, '0%;0%;""', lc)
    axes_visible(ch)
    ch.x_axis.scaling.orientation = 'maxMin'      # keep table order top → bottom
    ch.x_axis.tickLblPos = 'low'                   # item labels at the far left, not at 0
    ch.y_axis.number_format = '0%;0%'
    ch.y_axis.scaling.min = -1; ch.y_axis.scaling.max = 1; ch.y_axis.majorUnit = 0.25
    ch.y_axis.majorGridlines.spPr = GraphicalProperties(ln=LineProperties(solidFill='E3E3E3'))
    ch.legend = None
    ch.height = 9.5; ch.width = 22
    ws['B13'] = '차트 A · 가운데 정렬 (발산형 누적 막대)'; ws['B13'].font = f(size=11, bold=True, color=INK)
    cell_legend(ws, 14, 3, ['매우 반대', '반대', '보통', '찬성', '매우 찬성'], ['accent1', 'accent2', 'accent3', 'accent4', 'accent5'],
                ['FFFFFF', '1B1F2A', '1B1F2A', '1B1F2A', 'FFFFFF'])
    ws.add_chart(ch, 'B15')

    # chart B: plain 100% stacked
    ch2 = BarChart(); ch2.type = 'bar'; ch2.grouping = 'percentStacked'; ch2.overlap = 100; ch2.gapWidth = 45
    ch2.add_data(Reference(ws, min_col=10, max_col=14, min_row=5, max_row=R1), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=9, min_row=R0, max_row=R1))
    for s, a, lc in zip(ch2.series, ['accent1', 'accent2', 'accent3', 'accent4', 'accent5'], ['FFFFFF', '404040', '404040', '404040', 'FFFFFF']):
        paint(s, a); labels(s, '0%;;""', lc)
    axes_visible(ch2); ch2.x_axis.scaling.orientation = 'maxMin'; ch2.y_axis.number_format = '0%'
    ch2.y_axis.majorGridlines = None
    ch2.legend.position = 'b'; ch2.legend.txPr = txt(900, '404040'); ch2.height = 9.5; ch2.width = 22
    ws['B35'] = '차트 B · 100% 누적 막대 (왼쪽 끝 정렬, 더 단순한 버전)'; ws['B35'].font = f(size=11, bold=True, color=INK)
    ws.add_chart(ch2, 'B36')

    notes(ws, 56, 2, COMMON_NOTES + [
        '· 이 파일의 색 배치: 강조1 매우 반대 · 강조2 반대 · 강조3 보통 · 강조4 찬성 · 강조5 매우 찬성 · 강조6 무응답 → 리커트5 테마끼리 바꿔 끼울 수 있습니다.',
        '· 차트 A에서 "보통"은 반씩 나눠 0의 양쪽에 놓습니다(Heiberger & Robbins, 2014 방식). 그래서 ③ 표에 "보통"이 두 번 있습니다.',
        '· 흑백 인쇄 시 반대/찬성 색은 밝기가 같게 설계했습니다(어느 쪽도 더 강조되지 않도록). 방향은 0 기준 왼쪽/오른쪽 위치로 읽힙니다.',
        '· 4점 척도라면 "보통" 열에 0을 넣으면 됩니다. 7점 척도는 계열을 2개 더 추가하고 색을 직접 지정해야 합니다(테마 색은 6칸).',
        '※ Heiberger, R. M., & Robbins, N. B. (2014). Design of diverging stacked bar charts for Likert scales and other applications. J. Statistical Software, 57(5). https://doi.org/10.18637/jss.v057.i05',
    ])
    out = os.path.join(HERE, '서식_리커트차트.xlsx'); wb.save(out); return out

# ======================================================================
# 2) Sequential stacked column
# ======================================================================
def sequential():
    name, slug, _, cols, _ = pick('seq_blue')
    wb = Workbook(); wb.loaded_theme = theme_with(cols, name)
    ws = wb.active; ws.title = '순차누적'
    header(ws, '단계형 누적 차트 (점점 진해지는 색)', '정상 → 경도 → 중등도 → 중증처럼 순서가 있는 단계를 옅은 색에서 진한 색으로 쌓습니다.')
    levels = ['정상', '경도', '중등도', '중증', '최중증']
    groups = ['사전', '4회기', '8회기', '종결', '3개월 추적']
    data = [[12, 18, 30, 26, 14], [18, 24, 30, 18, 10], [26, 30, 24, 13, 7], [38, 30, 18, 10, 4], [35, 30, 20, 10, 5]]
    ws['B4'] = '① 인원 입력 (명)'; ws['B4'].font = f(size=10, bold=True, color=ACC)
    table(ws, 5, 2, ['시점'] + levels, [[g] + d for g, d in zip(groups, data)], input_cols=(1, 2, 3, 4, 5))
    ws.column_dimensions['B'].width = 14
    for c in 'CDEFG': ws.column_dimensions[c].width = 9
    R0, R1 = 6, 6 + len(groups) - 1
    lab = ['404040', '404040', 'FFFFFF', 'FFFFFF', 'FFFFFF']
    def mk(grouping, fmt, title, anchor, label_row, label_col=2):
        ch = BarChart(); ch.type = 'col'; ch.grouping = grouping; ch.overlap = 100; ch.gapWidth = 55
        ch.add_data(Reference(ws, min_col=3, max_col=7, min_row=5, max_row=R1), titles_from_data=True)
        ch.set_categories(Reference(ws, min_col=2, min_row=R0, max_row=R1))
        for k, (s, lc) in enumerate(zip(ch.series, lab)):
            paint(s, f'accent{k + 1}'); labels(s, fmt, lc)
        axes_visible(ch); ch.legend.position = 'r'; ch.legend.txPr = txt(900, '404040')
        ch.y_axis.majorGridlines.spPr = GraphicalProperties(ln=LineProperties(solidFill='E3E3E3'))
        if grouping == 'percentStacked': ch.y_axis.number_format = '0%'
        ch.height = 9; ch.width = 16
        ws.cell(row=label_row, column=label_col, value=title).font = f(size=11, bold=True, color=INK)
        ws.add_chart(ch, anchor)
    mk('percentStacked', '0;;""', '차트 A · 100% 누적 세로 막대 (비율 비교)', 'B14', 13)
    mk('stacked', '0;;""', '차트 B · 누적 세로 막대 (인원 수 그대로)', 'B33', 32)
    notes(ws, 52, 2, COMMON_NOTES + [
        '· 이 파일의 색 배치: 강조1(가장 옅음) → 강조6(가장 진함). 순차 테마(파랑·초록·보라·주황·회색)끼리 바꿔 끼울 수 있습니다.',
        '· 단계가 4개면 마지막 열을 지우고, 6개면 열을 하나 추가한 뒤 데이터 범위를 넓히세요(강조6까지 자동 적용).',
        '· 가장 옅은 단계를 "정상/양호"처럼 주목도가 낮아도 되는 범주에 두면 진한 쪽(중증)이 먼저 눈에 들어옵니다.',
    ])
    out = os.path.join(HERE, '서식_순차누적차트.xlsx'); wb.save(out); return out

# ======================================================================
# 3) Bar + line combo
# ======================================================================
def combo():
    name, slug, _, cols, _ = pick('highlight_blue')
    wb = Workbook(); wb.loaded_theme = theme_with(cols, name)
    ws = wb.active; ws.title = '막대선'
    header(ws, '막대 + 선 혼합 차트', '막대는 회색으로 배경 역할, 선은 강조색으로 핵심 지표를 보여 줍니다. 단위가 다르면 선을 보조 축에 둡니다.')
    months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    newc = [14, 12, 18, 21, 19, 16, 13, 15, 22, 24, 20, 17]
    cont = [38, 41, 43, 47, 50, 49, 46, 45, 49, 55, 57, 54]
    score = [21.4, 20.8, 20.1, 19.6, 18.9, 18.7, 18.9, 18.2, 17.6, 17.1, 16.8, 16.5]
    ws['B4'] = '① 값 입력'; ws['B4'].font = f(size=10, bold=True, color=ACC)
    table(ws, 5, 2, ['월', '신규 내담자', '지속 내담자', '평균 증상 점수'], [[m, a, b, c] for m, a, b, c in zip(months, newc, cont, score)], input_cols=(1, 2, 3))
    ws.column_dimensions['B'].width = 8
    for c in 'CDE': ws.column_dimensions[c].width = 13
    R0, R1 = 6, 17
    bar = BarChart(); bar.type = 'col'; bar.grouping = 'stacked'; bar.overlap = 100; bar.gapWidth = 60
    bar.add_data(Reference(ws, min_col=3, max_col=4, min_row=5, max_row=R1), titles_from_data=True)
    bar.set_categories(Reference(ws, min_col=2, min_row=R0, max_row=R1))
    paint(bar.series[0], 'accent2'); paint(bar.series[1], 'accent3')
    axes_visible(bar)
    bar.y_axis.title = '내담자 수 (명)'; bar.y_axis.majorGridlines.spPr = GraphicalProperties(ln=LineProperties(solidFill='E3E3E3'))
    line = LineChart()
    line.add_data(Reference(ws, min_col=5, min_row=5, max_row=R1), titles_from_data=True)
    paint(line.series[0], 'accent1', line=True, marker=True)
    labels(line.series[0], '0.0', '1F1F1F'); line.series[0].dLbls.position = 't'
    line.y_axis.axId = 200; line.y_axis.title = '평균 점수'; line.y_axis.crosses = 'max'; line.y_axis.majorGridlines = None
    line.y_axis.delete = False; line.y_axis.txPr = txt(900, '595959')
    bar += line
    bar.legend.position = 'b'; bar.legend.txPr = txt(900, '404040')
    bar.height = 10; bar.width = 22
    ws['G4'] = '차트 · 누적 막대(회색) + 선(강조, 보조 축)'; ws['G4'].font = f(size=11, bold=True, color=INK)
    ws.add_chart(bar, 'G5')
    notes(ws, 27, 2, COMMON_NOTES + [
        '· 이 파일의 색 배치: 강조1 = 선(핵심 지표), 강조2·3 = 막대(회색), 강조5 = 두 번째 강조가 필요할 때. 강조 테마(파랑·주황)끼리 바꿔 끼울 수 있습니다.',
        '· 보조 축은 두 지표의 단위가 다를 때만 쓰세요. 축 범위에 따라 두 지표의 관계가 과장되어 보일 수 있습니다.',
    ])
    out = os.path.join(HERE, '서식_막대선차트.xlsx'); wb.save(out); return out

for fn in (likert, sequential, combo):
    print('saved', fn())
