# PsyStat 검증 기준값 9: 커뮤니티(walktrap)·브리지 중심성·NCT·부트스트랩 차이 검정
# - walktrap: igraph::cluster_walktrap (외부 기준)
# - 브리지 중심성: networktools를 설치할 수 없어(CRAN 차단) 같은 정의를 igraph 최단경로로 R에서 독립 구현
# - NCT·부트스트랩: NetworkComparisonTest·bootnet을 설치할 수 없어, R이 만든 순열/재표집 번호로
#   qgraph::EBICglasso를 반복 추정해 같은 통계량을 계산 (PsyStat은 같은 번호로 계산해 대조)
# 실행: Rscript tests/make_reference9.R → tests/reference9.json
suppressPackageStartupMessages({ library(jsonlite); library(igraph); library(qgraph) })
data(bfi, package = "psychTools")
items <- c(paste0("A", 1:5), paste0("N", 1:5), paste0("E", 1:5))
d <- na.omit(bfi[1:1200, c(items, "gender")])
X <- as.matrix(d[, items]); grp <- d$gender - 1
ebic <- function(M) suppressWarnings(suppressMessages(EBICglasso(cor(M), nrow(M), verbose = FALSE)))
ref <- list(data = lapply(seq_len(ncol(X)), function(j) X[, j]), names = items, group = grp)

## walktrap: 실제 네트워크 2개 + 음수 엣지·고립 노드가 있는 가상 네트워크
wt <- function(W) { g <- graph_from_adjacency_matrix(abs(W), mode = "undirected", weighted = TRUE, diag = FALSE); w <- cluster_walktrap(g, steps = 4); list(W = unname(W), memb = as.integer(membership(w)), Q = w$modularity) }
net <- ebic(X)
set.seed(5); Wsim <- matrix(0, 12, 12); for (i in 1:11) for (j in (i + 1):12) if (runif(1) < .25) Wsim[i, j] <- Wsim[j, i] <- round(runif(1, -.4, .5), 3); Wsim[12, ] <- Wsim[, 12] <- 0
ref$walktrap <- list(wt(net), wt(ebic(X[, 1:10])), wt(Wsim))

## 브리지 중심성 (커뮤니티 = 문항 접두어 A/N/E), 거리 1/|w|
comm <- substr(items, 1, 1); n <- length(items)
g <- graph_from_adjacency_matrix(abs(net), mode = "undirected", weighted = TRUE, diag = FALSE); E(g)$weight <- 1 / E(g)$weight
Dm <- distances(g)
bstr <- sapply(1:n, function(i) sum(abs(net[i, comm != comm[i]])))
bei <- sapply(1:n, function(i) sum(net[i, comm != comm[i]]))
bclo <- sapply(1:n, function(i) { dd <- Dm[i, comm != comm[i]]; dd <- dd[is.finite(dd)]; 1 / mean(dd) })
bbtw <- numeric(n)
for (s in 1:(n - 1)) for (t in (s + 1):n) if (comm[s] != comm[t] && is.finite(Dm[s, t])) {
  ps <- all_shortest_paths(g, from = s, to = t)$res
  for (pth in ps) { mid <- as.integer(pth); mid <- mid[-c(1, length(mid))]; bbtw[mid] <- bbtw[mid] + 1 / length(ps) }
}
ref$bridge <- list(net = unname(net), comm = comm, strength = bstr, ei = bei, closeness = bclo, betweenness = bbtw)

## NCT (A1–N5 10문항, 성별 비교): 관측값 + 순열 30회
X10 <- X[, 1:10]
st <- function(n1, n2) { u <- upper.tri(n1); e1 <- n1[u]; e2 <- n2[u]
  list(M = max(abs(e1 - e2)), S = abs(sum(abs(e1)) - sum(abs(e2))), gs1 = sum(abs(e1)), gs2 = sum(abs(e2)), edgeDiff = abs(e1 - e2),
       strDiff = abs(colSums(abs(n1)) - colSums(abs(n2))), eiDiff = abs(colSums(n1) - colSums(n2))) }
obs <- st(ebic(X10[grp == 0, ]), ebic(X10[grp == 1, ]))
set.seed(11); perms <- lapply(1:30, function(b) sample(grp))
pst <- lapply(perms, function(l) st(ebic(X10[l == 0, ]), ebic(X10[l == 1, ])))
pv <- function(o, v) (1 + sum(v >= o - 1e-12)) / (length(v) + 1)
edgeP <- sapply(seq_along(obs$edgeDiff), function(k) pv(obs$edgeDiff[k], sapply(pst, function(x) x$edgeDiff[k])))
ref$nct <- list(obs = obs, perms = perms, permM = sapply(pst, function(x) x$M), permS = sapply(pst, function(x) x$S),
                pM = pv(obs$M, sapply(pst, function(x) x$M)), pS = pv(obs$S, sapply(pst, function(x) x$S)), edgeP = edgeP, edgePholm = p.adjust(edgeP, "holm"),
                strP = sapply(1:10, function(k) pv(obs$strDiff[k], sapply(pst, function(x) x$strDiff[k]))))

## 부트스트랩 차이 검정: 재표집 25회 (10문항)
set.seed(21); bidx <- lapply(1:25, function(b) sample(nrow(X10), replace = TRUE))
bs <- lapply(bidx, function(ix) { nn <- ebic(X10[ix, ]); list(edges = nn[upper.tri(nn)], str = colSums(abs(nn))) })
E <- t(sapply(bs, function(x) x$edges)); Sg <- t(sapply(bs, function(x) x$str))
ci <- function(v) unname(quantile(v, c(.025, .975)))
ref$boot <- list(idx = lapply(bidx, function(ix) ix - 1L), edges = unname(E), str = unname(Sg),
                 edgeDiffCI = ci(E[, 1] - E[, 2]), strDiffCI = ci(Sg[, 1] - Sg[, 6]))
writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE), "tests/reference9.json")
cat("reference9.json written\n")
