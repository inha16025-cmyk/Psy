# PsyStat 검증 기준값 6: 잠재프로파일(LPA)·잠재계층(LCA)
# - LPA: mclust 6 (iris, 실제 자료; Fisher, 1936)
# - LCA 이분: flexmix 2.3 (bfi 문항 이분화, 실제 자료; psychTools)
# - LCA 다범주: R로 독립 구현한 EM (poLCA와 같은 모형; CRAN 접근 불가로 poLCA 대신 사용)
# 실행: Rscript tests/make_reference6.R → tests/reference6.json
suppressPackageStartupMessages({ library(jsonlite); library(mclust); library(flexmix) })
ref <- list()
X <- as.matrix(iris[, 1:4]); colnames(X) <- NULL
ref$iris <- lapply(1:4, function(j) X[, j])
ctrl <- emControl(tol = c(1e-11, sqrt(.Machine$double.eps)))
fits <- list()
for (m in c("EEI", "VVI", "EEE", "VVV")) for (K in 1:4) {
  f <- Mclust(X, G = K, modelNames = m, control = ctrl, verbose = FALSE)
  if (is.null(f)) next
  p <- f$parameters
  sig <- if (K == 1 || length(dim(p$variance$sigma)) == 2) array(p$variance$sigma, c(4, 4, K)) else p$variance$sigma
  fits[[length(fits) + 1]] <- list(model = m, K = K, LL = f$loglik, df = f$df, bic = f$bic,
    pro = if (K == 1) 1 else unname(p$pro), mean = unname(t(p$mean)), sigma = lapply(1:K, function(k) unname(sig[, , k])))
}
ref$lpa <- fits
set.seed(42)
bl <- mclustBootstrapLRT(X, modelName = "EEI", nboot = 300, maxG = 3, verbose = FALSE)
ref$blrt <- list(model = "EEI", obs = unname(bl$obs), p = unname(bl$p.value), nboot = 300)

## LCA
data(bfi, package = "psychTools")
items <- c("A1", "A2", "A3", "A4", "A5")
Y <- na.omit(bfi[1:1000, items])
ref$lcaData <- lapply(as.list(Y), function(v) v)
B <- (as.matrix(Y) >= 4) * 1                          # 이분화: 4–6 = 1
lcaBin <- list()
for (K in 1:3) {
  set.seed(K)
  fx <- stepFlexmix(B ~ 1, k = K, model = FLXMCmvbinary(), nrep = 30, verbose = FALSE,
                    control = list(tolerance = 1e-13, iter.max = 20000, minprior = 0))
  lcaBin[[K]] <- list(K = K, LL = as.numeric(logLik(fx)), df = attr(logLik(fx), "df"))
}
ref$lcaBin <- lcaBin
# 독립 R 구현 EM (다범주, 6점 문항 3개)
lcaEM <- function(Y, K, starts = 50) {
  Y <- as.matrix(Y); n <- nrow(Y); J <- ncol(Y); lv <- lapply(1:J, function(j) sort(unique(Y[, j]))); C <- sapply(lv, length)
  Yc <- sapply(1:J, function(j) match(Y[, j], lv[[j]]))
  best <- -Inf; bestPar <- NULL
  for (s in 1:starts) {
    pi <- rep(1 / K, K); rho <- lapply(1:J, function(j) { m <- matrix(runif(K * C[j]) + .1, K); m / rowSums(m) })
    old <- -Inf
    for (it in 1:20000) {
      lf <- matrix(log(pi), n, K, byrow = TRUE)
      for (j in 1:J) lf <- lf + t(log(rho[[j]][, Yc[, j], drop = FALSE]))
      mx <- apply(lf, 1, max); ll <- sum(mx + log(rowSums(exp(lf - mx))))
      Z <- exp(lf - mx); Z <- Z / rowSums(Z)
      pi <- colMeans(Z)
      rho <- lapply(1:J, function(j) { m <- sapply(1:C[j], function(c) colSums(Z * (Yc[, j] == c))); m <- matrix(m, K); m / rowSums(m) })
      if (abs(ll - old) < 1e-12 * (1 + abs(ll))) break
      old <- ll
    }
    if (ll > best) { best <- ll; bestPar <- list(pi = pi, rho = rho) }
  }
  list(LL = best, pi = bestPar$pi, npar = (K - 1) + K * sum(C - 1))
}
set.seed(7)
lcaPoly <- list()
for (K in 1:3) { e <- lcaEM(Y[, 1:3], K); lcaPoly[[K]] <- list(K = K, LL = e$LL, npar = e$npar, pi = sort(e$pi, decreasing = TRUE)) }
ref$lcaPoly <- lcaPoly
writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE), "tests/reference6.json")
cat("reference6.json written\n")
