# 범주별 오즈비 추세 검정 기준값: Rscript tests/make_reference_trend.R <csv> tests/reference_trend.json
a <- commandArgs(TRUE)
d <- read.csv(a[1], fileEncoding = "UTF-8")
d$y <- as.integer(d$반응 == "예")
d$연령대 <- factor(d$연령대, levels = c("20대", "30대", "40대", "50대"))
m1 <- glm(y ~ 연령대 + 우울, data = d, family = binomial)
d$score <- as.integer(d$연령대)
m2 <- glm(y ~ score + 우울, data = d, family = binomial)
s <- summary(m2)$coefficients["score", ]
or <- exp(coef(m1)[c("연령대30대", "연령대40대", "연령대50대")])
out <- sprintf('{"dummyOR": {"30대": %.10f, "40대": %.10f, "50대": %.10f}, "trend": {"b": %.10f, "se": %.10f, "or": %.10f, "p": %.10g}}',
  or[1], or[2], or[3], s[1], s[2], exp(s[1]), s[4])
writeLines(out, a[2], useBytes = TRUE)
cat(out, "\n")
