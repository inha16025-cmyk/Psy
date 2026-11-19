# PsyStat 검증용 기준값 생성 스크립트
# 실행: Rscript tests/make_reference.R
# 출력: tests/reference.json (테스트 데이터 + R 계산 결과)
suppressPackageStartupMessages({
  library(jsonlite); library(car); library(psych); library(qgraph)
})
set.seed(20261119)

## ---- 가상 데이터 (시뮬레이션) ----
n <- 240
group <- rep(c("A", "B", "C"), times = c(70, 90, 80))
x1 <- rnorm(n, 50, 10) + ifelse(group == "B", 4, ifelse(group == "C", 7, 0))
x2 <- 0.5 * x1 + rnorm(n, 0, 8)
x3 <- rexp(n, 0.3)                       # 비정규
x4 <- -0.3 * x2 + rnorm(n, 0, 5)
sex <- sample(c(1, 2), n, replace = TRUE)
pre <- rnorm(n, 20, 4); post <- pre + rnorm(n, 1.2, 3)
eta <- -0.5 + 0.06 * (x1 - 50) - 0.04 * (x2 - 25) + 0.15 * x3
yb <- rbinom(n, 1, plogis(eta))
cat1 <- sample(c("low", "mid", "high"), n, replace = TRUE, prob = c(.3, .4, .3))
cat2 <- ifelse(runif(n) < ifelse(cat1 == "high", .6, .35), "yes", "no")
x1[c(5, 17)] <- NA; x3[c(33)] <- NA     # 결측

ref <- list()
ref$data <- list(group = group, x1 = x1, x2 = x2, x3 = x3, x4 = x4, sex = sex, pre = pre, post = post,
                 yb = yb, cat1 = cat1, cat2 = cat2)

## 분포 함수
ref$dist <- list(
  pt = pt(c(-2.5, 0.3, 1.96, 4), c(5, 12, 30, 200)),
  pf = pf(c(0.5, 2.5, 4, 10), c(2, 3, 5, 1), c(10, 50, 100, 7), lower.tail = FALSE),
  pchisq = pchisq(c(0.2, 3.84, 10, 30), c(1, 1, 4, 12), lower.tail = FALSE),
  qt = qt(c(0.975, 0.995, 0.9), c(3, 20, 100)),
  qnorm = qnorm(c(1e-6, 0.01, 0.3, 0.975)),
  qchisq = qchisq(c(0.95, 0.5), c(3, 10)),
  ptukey = ptukey(c(1.5, 3.2, 4.1, 5.5), c(3, 4, 5, 8), c(20, 60, 12, 200))
)

## 기술통계
xx <- na.omit(x1)
sk <- function(x) { n <- length(x); m <- mean(x); g1 <- mean((x - m)^3) / mean((x - m)^2)^1.5; g1 * sqrt(n * (n - 1)) / (n - 2) }
ku <- function(x) { n <- length(x); m <- mean(x); g2 <- mean((x - m)^4) / mean((x - m)^2)^2 - 3; ((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3)) }
sw1 <- shapiro.test(xx); sw3 <- shapiro.test(na.omit(x3)); sw10 <- shapiro.test(x2[1:10]); sw5 <- shapiro.test(x2[1:5])
ref$desc <- list(mean = mean(xx), sd = sd(xx), median = median(xx), skew = sk(xx), kurt = ku(xx),
                 q1 = unname(quantile(xx, .25)), swW = unname(sw1$statistic), swP = sw1$p.value,
                 sw3W = unname(sw3$statistic), sw3P = sw3$p.value, sw10W = unname(sw10$statistic), sw10P = sw10$p.value,
                 sw5W = unname(sw5$statistic), sw5P = sw5$p.value)

## t 검정
tS <- t.test(x2[sex == 1], x2[sex == 2], var.equal = TRUE)
tW <- t.test(x2[sex == 1], x2[sex == 2], var.equal = FALSE)
lev <- leveneTest(x2 ~ factor(sex), center = mean)
tP <- t.test(post, pre, paired = TRUE)
t1 <- t.test(pre, mu = 19)
ref$ttest <- list(tS = unname(tS$statistic), pS = tS$p.value, ciS = unname(tS$conf.int),
                  tW = unname(tW$statistic), dfW = unname(tW$parameter), pW = tW$p.value,
                  leveneF = lev$`F value`[1], leveneP = lev$`Pr(>F)`[1],
                  tP = unname(tP$statistic), pP = tP$p.value, ciP = unname(tP$conf.int),
                  t1 = unname(t1$statistic), p1 = t1$p.value)

## 일원분산분석
d <- data.frame(x1 = x1, g = factor(group)); d <- na.omit(d)
a <- summary(aov(x1 ~ g, data = d))[[1]]
tk <- TukeyHSD(aov(x1 ~ g, data = d))$g
wl <- oneway.test(x1 ~ g, data = d, var.equal = FALSE)
pb <- pairwise.t.test(d$x1, d$g, p.adjust.method = "bonferroni", pool.sd = TRUE)$p.value
# Games-Howell (수식 직접 구현)
gh <- function(y, g) {
  lv <- levels(g); out <- c()
  for (i in 1:(length(lv) - 1)) for (j in (i + 1):length(lv)) {
    a <- y[g == lv[i]]; b <- y[g == lv[j]]
    vi <- var(a) / length(a); vj <- var(b) / length(b)
    df <- (vi + vj)^2 / (vi^2 / (length(a) - 1) + vj^2 / (length(b) - 1))
    q <- abs(mean(a) - mean(b)) / sqrt((vi + vj) / 2)
    out <- c(out, ptukey(q, length(lv), df, lower.tail = FALSE))
  }
  out
}
levA <- leveneTest(x1 ~ g, data = d, center = mean)
ref$anova <- list(F = a$`F value`[1], p = a$`Pr(>F)`[1], ssb = a$`Sum Sq`[1], ssw = a$`Sum Sq`[2],
                  tukeyP = unname(tk[, "p adj"]), tukeyDiff = unname(tk[, "diff"]),
                  welchF = unname(wl$statistic), welchDf2 = unname(wl$parameter[2]), welchP = wl$p.value,
                  bonfP = c(pb[1, 1], pb[2, 1], pb[2, 2]), ghP = gh(d$x1, d$g),
                  leveneF = levA$`F value`[1])

## 상관
cp <- cor.test(x1, x2); cs <- cor.test(x1, x3, method = "spearman", exact = FALSE)
ref$cor <- list(r = unname(cp$estimate), p = cp$p.value, ci = unname(cp$conf.int),
                rho = unname(cs$estimate))

## 교차분석
ct <- table(cat1, cat2)
ch <- chisq.test(ct, correct = FALSE)
t22 <- table(sex, yb)
ch22 <- chisq.test(t22, correct = TRUE)
fe <- fisher.test(t22)
ref$chisq <- list(chi2 = unname(ch$statistic), df = unname(ch$parameter), p = ch$p.value,
                  yates = unname(ch22$statistic), yatesP = ch22$p.value, fisherP = fe$p.value)

## 선형회귀
m <- lm(x2 ~ x1 + x3 + x4)
sm <- summary(m)
ref$lm <- list(coef = unname(coef(m)), se = unname(sm$coefficients[, 2]), p = unname(sm$coefficients[, 4]),
               r2 = sm$r.squared, adjr2 = sm$adj.r.squared, F = unname(sm$fstatistic[1]),
               vif = unname(vif(m)), n = nobs(m))

## 로지스틱 회귀
g <- glm(yb ~ x1 + x2 + x3, family = binomial)
sg <- summary(g)
nn <- nobs(g); cs2 <- 1 - exp((g$deviance - g$null.deviance) / nn)
nk <- cs2 / (1 - exp(-g$null.deviance / nn))
yhat <- fitted(g); yy <- g$y
hl <- function(y, yhat, gg = 10) {
  cutyhat <- cut(yhat, breaks = quantile(yhat, probs = seq(0, 1, 1 / gg)), include.lowest = TRUE)
  obs <- xtabs(cbind(1 - y, y) ~ cutyhat); expect <- xtabs(cbind(1 - yhat, yhat) ~ cutyhat)
  chisq <- sum((obs - expect)^2 / expect); c(chisq, gg - 2, 1 - pchisq(chisq, gg - 2))
}
ref$logit <- list(coef = unname(coef(g)), se = unname(sg$coefficients[, 2]), p = unname(sg$coefficients[, 4]),
                  deviance = g$deviance, null = g$null.deviance, aic = AIC(g), coxSnell = cs2, nagelkerke = nk,
                  hl = hl(yy, yhat), n = nn)

## 신뢰도 (실제 데이터: psychTools::bfi — Revelle, 2023)
data(bfi, package = "psychTools")
agree <- bfi[, c("A1", "A2", "A3", "A4", "A5")]; agree$A1 <- 7 - agree$A1
al <- psych::alpha(na.omit(agree), warnings = FALSE)  # SPSS와 같은 목록별 삭제
ref$alpha <- list(data = lapply(as.list(agree), function(v) v),
                  raw = al$total$raw_alpha, std = al$total$std.alpha,
                  rdrop = unname(al$item.stats$r.drop), ifdel = unname(al$alpha.drop$raw_alpha))

## 네트워크 (실제 데이터: bfi 15문항, 완전 사례)
items <- c("A1","A2","A3","A4","A5","C1","C2","C3","C4","C5","E1","E2","E3","E4","E5")
bd <- na.omit(bfi[, items])
S <- cor(bd)
res <- EBICglasso(S, nrow(bd), returnAllResults = TRUE, verbose = FALSE)
net <- res$optnet
ca <- centrality_auto(net)$node.centrality
resT <- EBICglasso(S, nrow(bd), threshold = TRUE, verbose = FALSE)
pc <- -cov2cor(solve(S)); diag(pc) <- 0
# 작은 시뮬레이션 네트워크 (스피어만)
sim <- data.frame(x1, x2, x3, x4, pre, post); sim <- na.omit(sim)
Ss <- cor(sim, method = "spearman")
nets <- EBICglasso(Ss, nrow(sim), verbose = FALSE)
ref$network <- list(data = lapply(as.list(bd), function(v) v), n = nrow(bd),
                    net = unname(net), lambda = res$lambda[which.min(res$ebic)], ebic = res$ebic, lambdas = res$lambda,
                    strength = unname(ca$Strength), closeness = unname(ca$Closeness), betweenness = unname(ca$Betweenness),
                    ei = unname(ca$ExpectedInfluence), netThreshold = unname(as.matrix(resT)), pcor = unname(pc),
                    simNet = unname(as.matrix(nets)))

writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE, na = "null"), "tests/reference.json")
cat("reference.json written\n")
