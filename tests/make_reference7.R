# PsyStat 검증 기준값 7: BCH 원거리 결과변수 (R 독립 구현; 단계 1은 mclust)
# 외부 BCH 구현(Mplus, Latent GOLD, tidySEM)을 쓸 수 없어, 같은 정의(Vermunt, 2010; Bakk et al., 2013)를 R로 따로 구현해 대조한다.
# 실행: Rscript tests/make_reference7.R → tests/reference7.json
suppressPackageStartupMessages({ library(jsonlite); library(mclust) })
X <- as.matrix(iris[, 1:2])
fit <- Mclust(X, G = 3, modelNames = "EEI", control = emControl(tol = c(1e-12, sqrt(.Machine$double.eps))), verbose = FALSE)
Z <- fit$z; cls <- max.col(Z, ties.method = "first"); K <- 3
D <- t(sapply(1:K, function(s) sapply(1:K, function(t) sum(Z[cls == t, s]) / sum(Z[, s]))))
H <- solve(D); W <- H[cls, ]
## 연속 결과변수: Petal.Length
y <- iris$Petal.Length
Ws <- colSums(W); mu <- colSums(W * y) / Ws
V <- crossprod(sweep(W * (y - matrix(mu, length(y), K, byrow = TRUE)), 2, Ws, "/"))
wald <- function(est, V, C) { e <- C %*% est; as.numeric(t(e) %*% solve(C %*% V %*% t(C)) %*% e) }
C <- rbind(c(1, -1, 0), c(1, 0, -1))
pairs <- combn(K, 2); pw <- apply(pairs, 2, function(ab) { c <- rep(0, K); c[ab] <- c(1, -1); wald(mu, V, matrix(c, 1)) })
## 범주 결과변수: Species (3범주)
lv <- levels(iris$Species); L <- length(lv)
P <- t(sapply(1:K, function(s) sapply(lv, function(l) sum(W[, s] * (iris$Species == l)) / Ws[s])))
est <- as.vector(t(P[, 1:(L - 1)]))
psi <- do.call(cbind, lapply(1:K, function(s) sapply(1:(L - 1), function(l) W[, s] * ((iris$Species == lv[l]) - P[s, l]) / Ws[s])))
V2 <- crossprod(psi)
cm <- function(a, b) { r <- matrix(0, L - 1, K * (L - 1)); for (l in 1:(L - 1)) { r[l, (a - 1) * (L - 1) + l] <- 1; r[l, (b - 1) * (L - 1) + l] <- -1 }; r }
Call <- rbind(cm(1, 2), cm(1, 3))
ref <- list(LL = fit$loglik, Z = unname(Z), D = unname(D), contMean = unname(mu), contSE = unname(sqrt(diag(V))), contWald = wald(mu, V, C), contPairs = unname(pw),
            props = unname(P), catWald = wald(est, V2, Call), catPairs = apply(pairs, 2, function(ab) wald(est, V2, cm(ab[1], ab[2]))))
writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE), "tests/reference7.json")
cat("reference7.json written; LL =", fit$loglik, "\n")
