# PsyStat — 폐쇄망용 단일 파일 통계 도구

**`dist/PsyStat.html` 파일 하나**를 브라우저(Chrome/Edge)로 열면 바로 동작합니다.
설치·인터넷·관리자 권한이 필요 없고, 크기는 약 130 KB입니다.

## 보안 담당자 검토용 요약

- **외부 통신 없음**: HTML 안에 Content-Security-Policy `connect-src 'none'`가 걸려 있어, 브라우저가 모든 네트워크 요청을 차단합니다. 외부 스크립트·폰트·이미지도 불러오지 않습니다.
- **자료가 밖으로 나가지 않음**: 자료는 열어 둔 브라우저 탭의 메모리에만 있습니다. 탭을 닫으면 사라지고, 저장소(localStorage, 쿠키)도 쓰지 않습니다.
- **소스 전체 열람 가능**: 난독화하거나 압축(minify)하지 않은 JavaScript입니다(`src/` 폴더에 있는 내용과 같음).
- **무결성 확인**: `dist/PsyStat.html.sha256`에 해시가 있습니다. 반입 후 Windows에서 `certutil -hashfile PsyStat.html SHA256`로 대조하세요.

## 기능

| 영역 | 분석 |
|---|---|
| 탐색 | 기술통계, 왜도·첨도(SPSS 방식), Shapiro-Wilk |
| 평균 비교 | 독립(Student·Welch·Levene)/대응/일표본 t, Cohen's d·Hedges' g; 일원분산분석, Welch ANOVA, η²·ω², Tukey·Games-Howell·Bonferroni |
| 관계 | Pearson·Spearman 상관행렬(95% CI); 교차분석 χ², G², Yates, Fisher 정확검정, Cramér V, OR |
| 회귀 | 다중선형회귀(B, β, CI, VIF, DW); **이분형 로지스틱 회귀**(OR·CI, Wald, −2LL, 모형 χ², Cox-Snell·Nagelkerke·McFadden R², Hosmer-Lemeshow, 분류표, AUC, 분리 경고); 문자형 예측변수 자동 더미코딩 |
| 척도 | Cronbach α, 표준화 α, 수정된 문항-총점 r, 문항 삭제 시 α, 역채점 |
| **네트워크** | EBICglasso(qgraph와 같은 절차, threshold 옵션), 편상관 네트워크(+유의성 필터, 예측력), 강도·근접·매개·기대영향 중심성, 네트워크 그림(SVG/PNG 저장), **엣지 부트스트랩·사례 제거 부트스트랩(CS 계수)** |

- 자료 입력: 엑셀에서 복사해 붙여넣기, CSV(UTF-8과 한글 엑셀 기본인 CP949 모두 자동 인식), XLSX(첫 시트)
- 결과 카드마다 **[복사] → 한글·워드에 붙여넣기**를 지원하고, 상단 [결과 저장]으로 HTML 파일을 받을 수 있습니다.
- 결과 카드마다 **같은 분석을 하는 R 코드**를 함께 보여줍니다. 다른 PC에서 R이나 SPSS로 교차검증할 때 쓰세요.

## 검증

```bash
Rscript tests/make_reference.R   # R로 기준값 생성 (stats, car, psych, qgraph 1.9.8, glasso)
node tests/run_tests.js          # 1,110개 수치 대조
node tests/e2e.js                # 실제 브라우저(Chromium)에서 전체 화면 흐름 테스트
```

R과의 최대 상대오차(2026-11-19 실행 결과):

| 분석 | 최대 상대오차 |
|---|---|
| 분포함수(t, F, χ², 정규, 스튜던트화 범위) | 6e-14 |
| 기술통계·Shapiro-Wilk | 3e-13 |
| t 검정·Levene | 2e-14 |
| 분산분석·사후검정 | 2e-13 |
| 상관·교차분석 | 2e-14 |
| 선형회귀 | 4e-14 |
| 로지스틱 회귀(계수, SE, R², H-L) | 4e-8 |
| Cronbach α (psych::alpha, 목록별 제거) | 1e-14 |
| EBICglasso 네트워크 (qgraph::EBICglasso) | 5e-6 (선택 λ·엣지 수 동일) |
| 중심성 (qgraph::centrality_auto) | 5e-15 |

네트워크 검증에는 실제 공개 자료인 `psychTools::bfi`(Revelle; 15문항, N = 2,563)를 사용했습니다. 나머지 검증 자료는 R로 만든 **가상(시뮬레이션) 자료**입니다. 프로그램 안의 [예시 데이터]도 가상 자료입니다.

## 알려진 한계 (정직한 고지)

- 다분상관(polychoric, qgraph `cor_auto`)이 아직 없습니다. 리커트 문항에는 현재 Spearman이 대안입니다.
- McDonald ω, 요인분석(EFA/CFA), 반복측정·이원 ANOVA, 매개·조절(PROCESS), 다항·순서형 로지스틱은 아직 없습니다.
- Hosmer-Lemeshow는 R `ResourceSelection::hoslem.test` 방식(10분위 집단화)이라, 동점 처리가 다른 SPSS와 값이 약간 다를 수 있습니다.
- 부트스트랩 엣지 구간은 bootnet처럼 백분위 구간입니다. 난수 생성기가 R과 달라서 숫자가 R 결과와 똑같지는 않고, 분포 수준에서 비슷합니다.

## 개발

`src/`(stats.js = 통계 엔진, app.js = 화면, style.css, index.template.html)를 고친 뒤 `node build.js`를 실행하면 `dist/PsyStat.html`이 다시 만들어집니다.
