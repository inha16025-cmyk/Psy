# PsyStat 검증 기준값 5: 구조방정식 (lavaan 0.6)
# 실제 자료: HolzingerSwineford1939, PoliticalDemocracy (Bollen, 1989) — lavaan 패키지 내장
# 실행: Rscript tests/make_reference5.R → tests/reference5.json
suppressPackageStartupMessages({ library(jsonlite); library(lavaan) })
fm <- c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "rmsea.ci.lower", "rmsea.ci.upper", "rmsea.pvalue", "srmr", "aic", "bic", "logl", "npar", "baseline.chisq", "baseline.df")
fmr <- c("chisq.scaled", "chisq.scaling.factor", "pvalue.scaled", "cfi.robust", "tli.robust", "rmsea.robust", "rmsea.ci.lower.robust", "rmsea.ci.upper.robust", "srmr")
grab <- function(fit) {
  pe <- parameterEstimates(fit, standardized = TRUE)
  pe <- pe[pe$op != ":=", ]
  list(lhs = pe$lhs, op = pe$op, rhs = pe$rhs, est = pe$est, se = pe$se, std = pe$std.all)
}
grabDef <- function(fit) { pe <- parameterEstimates(fit); pe <- pe[pe$op == ":=", ]; list(name = pe$lhs, est = pe$est, se = pe$se) }
ref <- list()
HS <- HolzingerSwineford1939
ref$hs <- list(data = lapply(HS[, c(paste0("x", 1:9), "ageyr", "grade")], function(v) v))
m1 <- "visual =~ x1 + x2 + x3\ntextual =~ x4 + x5 + x6\nspeed =~ x7 + x8 + x9"
f1 <- cfa(m1, HS); f1r <- cfa(m1, HS, estimator = "MLR")
ref$hs$cfa <- list(model = m1, ml = c(grab(f1), fit = list(as.list(fitMeasures(f1, fm)))), mlr = c(grab(f1r), fit = list(as.list(fitMeasures(f1r, c(fm, fmr))))))
m2 <- "visual =~ x1 + x2 + x3\ntextual =~ x4 + x5 + x6\nspeed =~ x7 + x8 + x9\ntextual ~ a*visual + ageyr\nspeed ~ b*textual + c*visual\nind := a*b\ntotal := c + a*b"
f2 <- sem(m2, HS); f2r <- sem(m2, HS, estimator = "MLR")
ref$hs$sem <- list(model = m2, ml = c(grab(f2), fit = list(as.list(fitMeasures(f2, fm))), def = list(grabDef(f2))),
                   mlr = c(grab(f2r), fit = list(as.list(fitMeasures(f2r, c(fm, fmr)))), def = list(grabDef(f2r))))
set.seed(1)
fb <- sem(m2, HS, se = "bootstrap", bootstrap = 2000)
pb <- parameterEstimates(fb, boot.ci.type = "perc"); pb <- pb[pb$op == ":=", ]
ref$hs$boot <- list(name = pb$lhs, lo = pb$ci.lower, hi = pb$ci.upper)
PD <- PoliticalDemocracy
ref$pd <- list(data = lapply(PD, function(v) v))
m3 <- "ind60 =~ x1 + x2 + x3\ndem60 =~ y1 + a*y2 + b*y3 + c*y4\ndem65 =~ y5 + a*y6 + b*y7 + c*y8\ndem60 ~ ind60\ndem65 ~ ind60 + dem60\ny1 ~~ y5\ny2 ~~ y4 + y6\ny3 ~~ y7\ny4 ~~ y8\ny6 ~~ y8"
f3 <- sem(m3, PD); f3r <- sem(m3, PD, estimator = "MLR")
ref$pd$sem <- list(model = m3, ml = c(grab(f3), fit = list(as.list(fitMeasures(f3, fm)))), mlr = c(grab(f3r), fit = list(as.list(fitMeasures(f3r, c(fm, fmr))))))
writeLines(toJSON(ref, digits = NA, auto_unbox = TRUE, na = "null"), "tests/reference5.json")
cat("reference5.json written\n")
