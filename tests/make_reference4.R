# PsyStat 검증 기준값 4: MANOVA, Box's M, 선형판별분석
# 실행: Rscript tests/make_reference4.R → tests/reference4.json
suppressPackageStartupMessages({ library(jsonlite); library(MASS); library(car) })
ref <- list()
## 실제 자료: iris (Fisher, 1936; Anderson, 1935)
X <- as.matrix(iris[, 1:4]); g <- iris$Species
ref$iris <- list(X = lapply(1:4, function(j) X[, j]), g = as.character(g))
fit <- manova(X ~ g)
tst <- function(test) unname(summary(fit, test = test)$stats[1, 2:5])
ref$manova <- list(pillai = tst("Pillai"), wilks = tst("Wilks"), hotelling = tst("Hotelling-Lawley"), roy = tst("Roy"),
                   uniF = unname(sapply(summary.aov(fit), function(a) a$`F value`[1])))
## Box's M (Box, 1949) — 공식 직접 계산
boxm <- function(X, g) {
  p <- ncol(X); lv <- levels(g); G <- length(lv); n <- nrow(X); ni <- table(g)
  Si <- lapply(lv, function(l) cov(X[g == l, ])); Sp <- Reduce(`+`, Map(function(S, k) (k - 1) * S, Si, ni)) / (n - G)
  M <- (n - G) * log(det(Sp)) - sum((ni - 1) * sapply(Si, function(S) log(det(S))))
  c1 <- (sum(1 / (ni - 1)) - 1 / (n - G)) * (2 * p^2 + 3 * p - 1) / (6 * (p + 1) * (G - 1))
  df <- p * (p + 1) * (G - 1) / 2
  c(M, M * (1 - c1), df, pchisq(M * (1 - c1), df, lower.tail = FALSE))
}
ref$boxm <- boxm(X, g)
## 판별분석 (MASS::lda, 기본 사전확률 = 집단 비율)
l <- lda(X, g)
ev <- eigen(solve(crossprod(resid(lm(X ~ g)))) %*% (crossprod(scale(fitted(lm(X ~ g)), scale = FALSE))))$values[1:2]
pe <- predict(l, prior = rep(1/3, 3))
lcv <- lda(X, g, CV = TRUE, prior = rep(1/3, 3))
ref$lda <- list(scaling = unname(l$scaling), eig = Re(ev), canCor = sqrt(Re(ev) / (1 + Re(ev))),
                post = unname(pe$posterior[c(1, 51, 71, 84, 134, 150), ]), cls = as.integer(pe$class),
                cvCls = as.integer(lcv$class), cvPost = unname(lcv$posterior[c(71, 84, 134), ]))
## 두 번째 자료 (가상): 2집단, 3 종속변수, 결측
set.seed(9); n <- 120
gg <- rep(c("통제", "처치"), each = 60)
y1 <- rnorm(n, ifelse(gg == "처치", 0.5, 0)); y2 <- 0.5 * y1 + rnorm(n); y3 <- rnorm(n, ifelse(gg == "처치", -0.3, 0)); y2[5] <- NA
ref$sim <- list(y1 = y1, y2 = y2, y3 = y3, g = gg)
dd <- na.omit(data.frame(y1, y2, y3, g = factor(gg, levels = c("처치", "통제"))))
f2 <- manova(cbind(y1, y2, y3) ~ g, dd)
ref$sim$wilks <- unname(summary(f2, test = "Wilks")$stats[1, 2:5])
l2 <- lda(dd[, c("y1", "y2", "y3")], dd$g)
ref$sim$scaling <- unname(l2$scaling[, 1])
writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE), "tests/reference4.json")
cat("reference4.json written\n")
