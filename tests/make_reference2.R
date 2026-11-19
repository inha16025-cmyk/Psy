# PsyStat 검증 기준값 2: 다분상관, 위계적 회귀, 조절, 매개
# 실행: Rscript tests/make_reference2.R → tests/reference2.json
suppressPackageStartupMessages({ library(jsonlite); library(lavaan); library(qgraph); library(mvtnorm); library(Matrix) })
set.seed(777)
ref <- list()

## 이변량 정규 누적확률 (mvtnorm, Genz 알고리즘)
bv <- expand.grid(h = c(-2, -0.3, 0.7, 1.9), k = c(-1.1, 0.2, 1.5), r = c(-0.95, -0.5, 0.1, 0.6, 0.93, 0.99))
bv$p <- mapply(function(h, k, r) pmvnorm(upper = c(h, k), corr = matrix(c(1, r, r, 1), 2), algorithm = TVPACK(abseps = 1e-14))[1], bv$h, bv$k, bv$r)
ref$bvn <- bv

## 실제 자료: psychTools::bfi (Revelle) — 6점 리커트 + 성별(이분) + 연령(연속), 결측 포함
data(bfi, package = "psychTools")
v <- c("A1", "A2", "A3", "C1", "C2", "E1", "E2", "N1", "N2", "O1", "gender", "age")
d <- bfi[1:800, v]
ref$bfiData <- lapply(as.list(d), function(x) x)
dd <- d; for (k in setdiff(v, "age")) dd[[k]] <- ordered(dd[[k]])
ref$lavcor <- unname(as.matrix(unclass(lavCor(dd, estimator = "two.step", missing = "pairwise"))))
ref$corauto <- unname(as.matrix(suppressMessages(cor_auto(d, verbose = FALSE))))

## 2×2 빈칸 (lavaan zero.add)
u <- c(rep(0, 30), rep(1, 70)); w <- c(rep(0, 20), rep(1, 10), rep(1, 70)); z <- rbinom(100, 1, .4)
ref$zero <- list(u = u, w = w, z = z, R = unname(as.matrix(unclass(lavCor(data.frame(u = ordered(u), w = ordered(w), z = ordered(z)))))))

## nearPD
bad <- matrix(c(1, .9, .7, .9, 1, .1, .7, .1, 1), 3)  # 비양정치
bad4 <- matrix(c(1, .95, .9, -.3, .95, 1, .6, .2, .9, .6, 1, .7, -.3, .2, .7, 1), 4)
ref$npd <- list(a = bad, aOut = unname(as.matrix(nearPD(bad, corr = TRUE, keepDiag = TRUE)$mat)),
                b = bad4, bOut = unname(as.matrix(nearPD(bad4, corr = TRUE, keepDiag = TRUE)$mat)))

## EBICglasso + cor_auto (bfi 리커트 10문항)
it <- c("A1", "A2", "A3", "C1", "C2", "E1", "E2", "N1", "N2", "O1")
nd <- na.omit(bfi[1:800, it])
ref$netAuto <- list(data = lapply(as.list(nd), function(x) x),
                    net = unname(as.matrix(EBICglasso(suppressMessages(cor_auto(nd, verbose = FALSE)), nrow(nd), verbose = FALSE))))

## 위계적 회귀 (가상 자료)
n <- 250
age <- rnorm(n, 40, 10); sex <- rbinom(n, 1, .5); stress <- rnorm(n, 50, 10)
support <- rnorm(n, 30, 6) - 0.1 * stress
dep <- 10 + 0.05 * age + 2 * sex + 0.3 * stress - 0.25 * support - 0.012 * (stress - 50) * (support - 30) + rnorm(n, 0, 5)
med <- 0.4 * stress + rnorm(n, 0, 6)
dep2 <- 5 + 0.2 * stress + 0.35 * med + rnorm(n, 0, 5)
m2 <- -0.2 * stress + rnorm(n, 0, 4)
dep3 <- dep2 + 0.3 * m2
case <- rbinom(n, 1, plogis(-6 + 0.08 * stress + 0.5 * sex))
age[c(3, 9)] <- NA; support[c(14)] <- NA
sim <- data.frame(age, sex, stress, support, dep, med, dep2, m2, dep3, case)
ref$sim <- lapply(as.list(sim), function(x) x)
s0 <- na.omit(sim)
h1 <- lm(dep ~ age + sex, s0); h2 <- lm(dep ~ age + sex + stress + support, s0)
av <- anova(h1, h2)
ref$hier <- list(r2 = c(summary(h1)$r.squared, summary(h2)$r.squared), dF = av$F[2], dP = av$`Pr(>F)`[2],
                 coef2 = unname(coef(h2)), n = nrow(s0))
g1 <- glm(case ~ age + sex, binomial, s0); g2 <- glm(case ~ age + sex + stress + support, binomial, s0)
ref$hierLog <- list(dev = c(g1$deviance, g2$deviance), chi = g1$deviance - g2$deviance, coef2 = unname(coef(g2)),
                    p1 = pchisq(g1$null.deviance - g1$deviance, 2, lower.tail = FALSE))

## 조절 (PROCESS Model 1, 평균중심화)
s1 <- na.omit(sim[, c("dep", "stress", "support", "age")])
s1$xc <- s1$stress - mean(s1$stress); s1$wc <- s1$support - mean(s1$support)
mm <- lm(dep ~ xc * wc + age, s1); mr <- lm(dep ~ xc + wc + age, s1)
V <- vcov(mm); b <- coef(mm); tc <- qt(.975, df.residual(mm))
wv <- c(-1, 0, 1) * sd(s1$support)
ss <- sapply(wv, function(w) { e <- b["xc"] + b["xc:wc"] * w; se <- sqrt(V["xc", "xc"] + 2 * w * V["xc", "xc:wc"] + w^2 * V["xc:wc", "xc:wc"]); c(e, se, 2 * pt(-abs(e / se), df.residual(mm))) })
A <- b["xc:wc"]^2 - tc^2 * V["xc:wc", "xc:wc"]; B <- 2 * (b["xc"] * b["xc:wc"] - tc^2 * V["xc", "xc:wc"]); C <- b["xc"]^2 - tc^2 * V["xc", "xc"]
jn <- sort((-B + c(-1, 1) * sqrt(B^2 - 4 * A * C)) / (2 * A)) + mean(s1$support)
jn <- jn[jn >= min(s1$support) & jn <= max(s1$support)]
ref$mod <- list(coef = unname(b[c("(Intercept)", "xc", "wc", "xc:wc", "age")]), se = unname(sqrt(diag(V))[c("(Intercept)", "xc", "wc", "xc:wc", "age")]),
                dR2 = summary(mm)$r.squared - summary(mr)$r.squared, F = anova(mr, mm)$F[2], slopes = unname(ss), jn = unname(jn), n = nrow(s1))

## 매개 (PROCESS Model 4, 병렬 2개 매개, 공변인 age)
s2 <- na.omit(sim[, c("dep3", "stress", "med", "m2", "age")])
fa1 <- lm(med ~ stress + age, s2); fa2 <- lm(m2 ~ stress + age, s2); fy <- lm(dep3 ~ stress + med + m2 + age, s2); ft <- lm(dep3 ~ stress + age, s2)
ind <- c(coef(fa1)["stress"] * coef(fy)["med"], coef(fa2)["stress"] * coef(fy)["m2"])
B <- 5000; bs <- t(replicate(B, { i <- sample(nrow(s2), replace = TRUE); x <- s2[i, ]
  c(coef(lm(med ~ stress + age, x))[2] * coef(lm(dep3 ~ stress + med + m2 + age, x))["med"],
    coef(lm(m2 ~ stress + age, x))[2] * coef(lm(dep3 ~ stress + med + m2 + age, x))["m2"]) }))
ref$med <- list(a = unname(c(coef(fa1)["stress"], coef(fa2)["stress"])), b = unname(coef(fy)[c("med", "m2")]),
                direct = unname(coef(fy)["stress"]), total = unname(coef(ft)["stress"]), ind = unname(ind),
                seDirect = unname(sqrt(diag(vcov(fy)))["stress"]),
                bootSE = unname(apply(bs, 2, sd)), bootCI = unname(apply(bs, 2, quantile, c(.025, .975))), n = nrow(s2))

writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE, na = "null", dataframe = "columns"), "tests/reference2.json")
cat("reference2.json written\n")
