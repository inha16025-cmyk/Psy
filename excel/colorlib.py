"""Shared color math (OKLab/OKLCH, WCAG contrast, Machado 2009 CVD) and curated chart themes."""
import math

clamp = lambda x, a=0.0, b=1.0: min(b, max(a, x))
to_lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
to_gam = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

def oklab_to_lin(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]

def lin_to_oklab(rgb):
    r, g, b = rgb
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]

ok = lambda rgb: all(-1e-4 <= c <= 1 + 1e-4 for c in rgb)

def oklch(L, C, H):
    h = math.radians(H % 360)
    rgb = oklab_to_lin(L, C * math.cos(h), C * math.sin(h))
    if not ok(rgb):
        lo, hi = 0.0, C
        for _ in range(20):
            mid = (lo + hi) / 2
            if ok(oklab_to_lin(L, mid * math.cos(h), mid * math.sin(h))): lo = mid
            else: hi = mid
        rgb = oklab_to_lin(L, lo * math.cos(h), lo * math.sin(h))
    return tuple(round(clamp(to_gam(clamp(c))) * 255) for c in rgb)

hexof = lambda rgb: '%02X%02X%02X' % rgb
rgbof = lambda h: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
linof = lambda rgb: [to_lin(v / 255) for v in rgb]
def lum(rgb):
    r, g, b = linof(rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a, b):
    x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)

CVD = {'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]}
def simulate(h, mode):
    rgb = rgbof(h)
    if mode == 'none': return h
    if mode == 'gray':
        y = round(clamp(to_gam(lum(rgb))) * 255); return hexof((y, y, y))
    lin = linof(rgb)
    out = [sum(M * c for M, c in zip(row, lin)) for row in CVD[mode]]
    return hexof(tuple(round(clamp(to_gam(clamp(c))) * 255) for c in out))

def min_dist(hs, mode):
    labs = [lin_to_oklab(linof(rgbof(simulate(h, mode)))) for h in hs]
    return min(math.dist(labs[i], labs[j]) for i in range(len(labs)) for j in range(i + 1, len(labs))) * 100


def theme_xml(name, cols6):
    acc = ''.join(f"<a:accent{i+1}><a:srgbClr val='{h}'/></a:accent{i+1}>" for i, h in enumerate(cols6))
    return ("<?xml version='1.0' encoding='UTF-8' standalone='yes'?>"
            f"<a:clrScheme xmlns:a='http://schemas.openxmlformats.org/drawingml/2006/main' name='{name}'>"
            "<a:dk1><a:sysClr val='windowText' lastClr='000000'/></a:dk1><a:lt1><a:sysClr val='window' lastClr='FFFFFF'/></a:lt1>"
            "<a:dk2><a:srgbClr val='44546A'/></a:dk2><a:lt2><a:srgbClr val='E7E6E6'/></a:lt2>"
            f"{acc}<a:hlink><a:srgbClr val='0563C1'/></a:hlink><a:folHlink><a:srgbClr val='954F72'/></a:folHlink></a:clrScheme>")



# ---- curated themes for stacked / Likert / combo charts ----
# Built in OKLCH following the principles behind ColorBrewer's diverging and sequential schemes
# (Harrower & Brewer, 2003): two hues of equal weight around a light neutral, or one hue from light to dark.
# Neutral is a light grey instead of near-white so the middle segment stays visible on a white background.
def _h(L, C, H): return hexof(oklch(L, C, H))
GRAY = lambda L: _h(L, 0, 0)

def likert5(h_neg, h_pos, c=0.14):
    # 1 매우 반대, 2 반대, 3 보통, 4 찬성, 5 매우 찬성, 6 무응답
    return [_h(0.50, c, h_neg), _h(0.76, c * 0.62, h_neg), GRAY(0.87), _h(0.76, c * 0.62, h_pos), _h(0.50, c, h_pos), GRAY(0.62)]
def likert6(h_neg, h_pos, c=0.14):
    # 6점 척도(중립 없음): 1–3 반대(강→약), 4–6 찬성(약→강)
    return [_h(0.46, c, h_neg), _h(0.64, c * 0.75, h_neg), _h(0.83, c * 0.45, h_neg),
            _h(0.83, c * 0.45, h_pos), _h(0.64, c * 0.75, h_pos), _h(0.46, c, h_pos)]
def seq6(h, cmax=0.15, drift=-12):
    out = []
    for i in range(6):
        t = i / 5
        out.append(_h(0.92 - 0.60 * t, 0.025 + (cmax - 0.025) * math.sin(math.pi * (0.12 + 0.62 * t)), h + drift * t))
    return out
def highlight(h_main, h_second):
    # 1 강조색, 2–4 회색(진→연), 5 보조 강조, 6 강조색의 옅은 버전
    return [_h(0.52, 0.15, h_main), GRAY(0.60), GRAY(0.80), GRAY(0.42), _h(0.70, 0.14, h_second), _h(0.82, 0.06, h_main)]

# (display name, ascii slug, kind, colors, description)
CURATED = [
    ('CP 리커트5 주황-보라', 'likert5_orange-purple', 'likert5', likert5(55, 300), '리커트 5점 · 강1=매우반대 … 강5=매우찬성, 강6=무응답 · 색맹에 비교적 강함'),
    ('CP 리커트5 갈색-청록', 'likert5_brown-teal', 'likert5', likert5(70, 195, 0.12), '리커트 5점 · 차분한 학술지 톤'),
    ('CP 리커트5 빨강-파랑', 'likert5_red-blue', 'likert5', likert5(25, 255), '리커트 5점 · 가장 익숙한 반대/찬성 색'),
    ('CP 리커트6 주황-보라', 'likert6_orange-purple', 'likert6', likert6(55, 300), '6점 척도(중립 없음) · 강1–3 반대, 강4–6 찬성'),
    ('CP 순차 파랑', 'seq_blue', 'seq', seq6(255), '점점 진해짐 · 강1(옅음) → 강6(진함)'),
    ('CP 순차 초록', 'seq_green', 'seq', seq6(150, 0.14), '점점 진해짐'),
    ('CP 순차 보라', 'seq_purple', 'seq', seq6(300, 0.13), '점점 진해짐'),
    ('CP 순차 주황', 'seq_orange', 'seq', seq6(60, 0.15, -20), '점점 진해짐 (진할수록 갈색)'),
    ('CP 순차 회색', 'seq_gray', 'seq', [GRAY(0.92 - 0.6 * i / 5) for i in range(6)], '흑백 인쇄 전용'),
    ('CP 강조 파랑+회색', 'highlight_blue', 'highlight', highlight(255, 55), '막대+선 · 강1=강조, 강2–4=회색, 강5=보조 강조'),
    ('CP 강조 주황+회색', 'highlight_orange', 'highlight', highlight(50, 250), '막대+선 · 강1=강조(주황)'),
]
