/*
 * PsyStat 통계 엔진 — Node.js용 로더
 * 실제 코드는 src/stats/stats-1.js, stats-2.js, stats-3.js 에 있다 (브라우저에서는 각 조각을 별도 <script>로 넣음).
 * 조각으로 나눈 이유: 자료 전송(메일) 시스템이 큰 스크립트 블록을 손상시키는 문제 대응.
 */
'use strict';
require('./stats/stats-1.js');
require('./stats/stats-2.js');
require('./stats/stats-3.js');
require('./stats/stats-4.js');
module.exports = (typeof self !== 'undefined' ? self : global).PsyStats;
