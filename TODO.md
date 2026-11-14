# 진행상황

- [x] 기존 대시보드 화면·분석 코드 분리
- [x] 로그인 페이지 및 설정 스크립트
- [x] 모든 페이지·정적 파일·API 서버 인증
- [x] 세션 만료·로그아웃·계정 변경 시 세션 무효화
- [x] 로그인 제한·Origin 검증·비밀정보 분리
- [x] GA4·AdMob 기존 단위 테스트 + 인증·날짜 범위 테스트 40개
- [x] TypeScript 검사 및 프런트엔드 빌드
- [x] Worker 배포 번들 검사
- [x] Cloudflare D1 생성·운영 배포 (사용자 확인)
- [x] 본인이 로그인 아이디·비밀번호 설정 (사용자 확인)
- [x] 새 서버 암호화 키 등록 및 GA4 JSON 재등록 (사용자 연결 완료 확인)
- [ ] OAuth 리디렉션 URI 등록 및 AdMob 승인 (사용자)
- [ ] 실제 계정 데이터와 콘솔 수치 대조 (사용자)
- [x] 앱 레지스트리(D1)·앱 추가/수정 마법사·동적 `/apps/:slug`
- [x] GA4·AdMob 일별 추세 차트 및 CTR·Overview 비교표
- [x] GA4·AdMob 심화 (newUsers·firstUser·참여·Crash-free·매칭률·포맷·국가)
- [x] Play / ASC 계정 연결 UI·암호화 저장·리포트 API (설치 CSV는 배치)
- [x] Play 설치: Reporting API soft-fail + GCS 실시간 CSV + 배치 enrichment
- [x] 세션 30일·아이디 기억·favicon·오늘/14일 프리셋·국가 확장·차트 선/막대
- [x] Play GCS 설치·평점 CSV / ASC Sales Report 일 배치→D1 + cron
- [x] Play 국가·버전·트래픽·store_performance / ASC Analytics ONGOING / 급변 배지 (P3)
- [x] Overview/Connections 빈 상태·앱 수정·Progress 코드완료 표시
- [ ] AppsFlyer API 연동 (무료 Zero — API 제외, ID 메타만)
- [ ] P4: 정산·Crashlytics BQ·알림 채널 (선택)

검증 제한: 로컬 Wrangler 서버는 실행 환경의 네트워크 인터페이스 오류로 시작되지 않았습니다. 서버 핸들러 통합 테스트는 SQLite와 요청/응답 객체로 검증했으며, 실제 Cloudflare 런타임·브라우저 확인은 운영 배포 후 필요합니다.

## 날짜 선택 변경 — 2026-11-09

- [x] 빠른 기간 선택, 시작·종료일 입력, 두 달 달력, 적용·취소
- [x] GA4·AdMob 명시적 날짜 범위와 최대 366일 검증
- [x] 윤년·연도 경계·지난주·잘못된 날짜·장기간 DAU 계산 테스트
- [ ] 운영 서버에 날짜 선택 변경 배포 및 브라우저 확인
