# PsyStat 검증 기준값 3: 조건부 과정 모형 (PROCESS Model 6, 7, 8, 14, 15)
# 모든 계수는 lm()으로 직접 계산; 부트스트랩은 같은 방정식을 5,000회 재표집
# 실행: Rscript tests/make_reference3.R → tests/reference3.json
suppressPackageStartupMessages(library(jsonlite))
set.seed(2026)
n <- 300
x <- rnorm(n); w <- rnorm(n, 3, 1.2); cv <- rnorm(n)
m1 <- 0.4 * x + 0.3 * w + 0.25 * x * (w - 3) + 0.2 * cv + rnorm(n)
m2 <- 0.35 * x + 0.4 * m1 + rnorm(n)
m3 <- 0.2 * m1 + 0.3 * m2 + 0.1 * x + rnorm(n)
y <- 0.2 * x + 0.4 * m1 + 0.3 * m2 + 0.25 * m3 + 0.15 * w + 0.2 * m1 * (w - 3) + 0.1 * cv + rnorm(n)
wb <- rbinom(n, 1, .5)
x[4] <- NA; y[10] <- NA   # 모든 모형이 쓰는 변수에만 결측 → 모형 간 표본 동일
d <- data.frame(x, w, cv, m1, m2, m3, y, wb)
ref <- list(data = lapply(as.list(d), function(v) v))
dd <- na.omit(d)
pct <- function(v) unname(quantile(v, c(.025, .975)))
boot <- function(fun, B = 5000) { r <- t(replicate(B, fun(dd[sample(nrow(dd), replace = TRUE), ]))); list(se = unname(apply(r, 2, sd)), ci = unname(apply(r, 2, pct))) }

## Model 6 (k = 3, 공변인 cv)
f6 <- function(z) {
  a1 <- lm(m1 ~ x + cv, z); a2 <- lm(m2 ~ x + m1 + cv, z); a3 <- lm(m3 ~ x + m1 + m2 + cv, z); fy <- lm(y ~ x + m1 + m2 + m3 + cv, z)
  A <- coef(a1); B2 <- coef(a2); B3 <- coef(a3); Y <- coef(fy)
  c(m1 = A["x"] * Y["m1"], m2 = B2["x"] * Y["m2"], m12 = A["x"] * B2["m1"] * Y["m2"], m3 = B3["x"] * Y["m3"],
    m13 = A["x"] * B3["m1"] * Y["m3"], m23 = B2["x"] * B3["m2"] * Y["m3"], m123 = A["x"] * B2["m1"] * B3["m2"] * Y["m3"])
}
e6 <- f6(dd); b6 <- boot(f6)
fy6 <- lm(y ~ x + m1 + m2 + m3 + cv, dd)
ref$m6 <- list(ind = unname(e6), bootSE = b6$se, bootCI = b6$ci, yCoef = unname(coef(fy6)), direct = unname(coef(fy6)["x"]),
               total = unname(coef(lm(y ~ x + cv, dd))["x"]), m3Coef = unname(coef(lm(m3 ~ x + m1 + m2 + cv, dd))), n = nrow(dd))

## Model 7 (병렬 m1, m2; 중심화 없음; 탐색점 M±1SD)
wv <- mean(dd$w) + c(-1, 0, 1) * sd(dd$w)
f7 <- function(z) {
  a1 <- coef(lm(m1 ~ x * w + cv, z)); a2 <- coef(lm(m2 ~ x * w + cv, z)); Y <- coef(lm(y ~ x + m1 + m2 + cv, z))
  c(imm1 = a1["x:w"] * Y["m1"], imm2 = a2["x:w"] * Y["m2"], (a1["x"] + a1["x:w"] * wv) * Y["m1"], (a2["x"] + a2["x:w"] * wv) * Y["m2"])
}
e7 <- f7(dd); b7 <- boot(f7)
ref$m7 <- list(est = unname(e7), bootSE = b7$se, bootCI = b7$ci, m1Coef = unname(coef(lm(m1 ~ x * w + cv, dd))), wv = wv)

## Model 8 (m1 하나): 조건부 직접효과
f8m <- lm(m1 ~ x * w, dd); f8y <- lm(y ~ x + m1 + w + x:w, dd); V <- vcov(f8y); b <- coef(f8y)
d8 <- sapply(wv, function(v) { e <- b["x"] + b["x:w"] * v; se <- sqrt(V["x", "x"] + 2 * v * V["x", "x:w"] + v^2 * V["x:w", "x:w"]); c(e, se) })
ref$m8 <- list(direct = unname(d8), imm = unname(coef(f8m)["x:w"] * b["m1"]))

## Model 14 (m1, 중심화 있음, 16/50/84 백분위)
z <- dd; z$xc <- z$x - mean(z$x); z$wc <- z$w - mean(z$w); z$m1c <- z$m1 - mean(z$m1)
wp <- unname(quantile(dd$w, c(.16, .5, .84)))
f14 <- function(q) {
  q$xc <- q$x - mean(dd$x); q$wc <- q$w - mean(dd$w); q$m1c <- q$m1 - mean(dd$m1)
  a <- coef(lm(m1 ~ xc + cv, q))["xc"]; Y <- coef(lm(y ~ xc + m1c + wc + m1c:wc + cv, q))
  c(imm = a * Y["m1c:wc"], a * (Y["m1c"] + Y["m1c:wc"] * (wp - mean(dd$w))))
}
e14 <- f14(dd); b14 <- boot(f14)
ref$m14 <- list(est = unname(e14), bootSE = b14$se, bootCI = b14$ci, yCoef = unname(coef(lm(y ~ xc + m1c + wc + m1c:wc + cv, z))), wp = wp)

## Model 15 (m1, 이분 W = wb)
f15y <- lm(y ~ x + m1 + wb + m1:wb + x:wb, dd); a15 <- coef(lm(m1 ~ x, dd))["x"]; b <- coef(f15y); V <- vcov(f15y)
ref$m15 <- list(cond = unname(a15 * (b["m1"] + b["m1:wb"] * c(0, 1))), imm = unname(a15 * b["m1:wb"]),
                direct = unname(sapply(c(0, 1), function(v) c(b["x"] + b["x:wb"] * v, sqrt(V["x", "x"] + 2 * v * V["x", "x:wb"] + v^2 * V["x:wb", "x:wb"])))))

writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE, na = "null"), "tests/reference3.json")
cat("reference3.json written\n")
