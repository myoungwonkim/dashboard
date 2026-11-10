# 놀숲 서비스 현황 대시보드

만세력·스도쿠 등 등록 앱의 GA4·AdMob·Play·App Store 지표를 조회하는 개인용 대시보드입니다. 앱은 D1 레지스트리로 추가합니다. 실제 데이터만 표시하며, 미연결 서비스는 연결 안내만 보입니다. AppsFlyer 무료(Zero)는 API 수집 없이 앱 ID 메타만 보관합니다.

## 로그인

본인이 정한 아이디와 비밀번호로 로그인해야 모든 페이지, 정적 파일, 데이터 API를 사용할 수 있습니다. 공개 회원가입이나 기본 비밀번호는 없습니다. 계정을 등록하기 전에는 서버가 접근을 차단합니다.

- 계정 설정·변경: `npm run account` 실행 후 터미널에서 아이디와 비밀번호 입력. 비밀번호는 표시되거나 파일에 저장되지 않습니다.
- 비밀번호는 8~256자이며 salt를 포함한 PBKDF2-SHA256 100,000회 해시만 Cloudflare Secret에 저장합니다. 긴 고유 비밀번호를 사용하세요.
- 무작위 세션 토큰의 해시를 D1에 저장합니다. 쿠키는 Secure, HttpOnly, SameSite=Lax이며 8시간 후 만료됩니다.
- 로그아웃은 서버 세션을 삭제합니다. 계정 재설정 시 기존 모든 세션이 무효화됩니다.
- IP별 15분 구간당 로그인 요청 5회 제한, 변경 요청 Origin 검증, 인증 실패 시 API 401, 페이지 로그인 이동, 캐시 금지를 적용합니다.

## 최초 배포

Node.js 22.13 이상과 Cloudflare 계정이 필요합니다. **GitHub는 소스 저장소이고 실행 서버는 Cloudflare Workers + D1입니다. GitHub Pages로 배포하지 마세요.** 도메인 `nolsoopgames.com`은 해당 Cloudflare 계정에서 관리해야 합니다.

```sh
git clone https://github.com/myoungwonkim/dashboard.git
cd dashboard
npm ci
npx wrangler login
npx wrangler d1 create nolsoop-dashboard
```

생성된 database_id를 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`에 넣고 저장합니다. 이 ID는 비밀번호가 아닙니다.

```sh
npx wrangler d1 migrations apply nolsoop-dashboard --remote
npm run deploy
npm run account
npm run keys
```

첫 배포 후 계정 등록 전에는 503으로 차단됩니다. `npm run keys`는 최초 한 번만 실행하세요. 암호화 키 교체는 기존 연결을 읽을 수 없게 만듭니다. 계정 변경은 `npm run account`만 실행합니다.

`wrangler.jsonc`는 `dashboard.nolsoopgames.com`을 Worker 커스텀 도메인으로 등록하도록 구성되어 있습니다. 기존 동일 호스트 DNS 레코드가 있으면 Cloudflare에서 충돌 여부를 확인하세요. Workers 기본 주소와 버전 미리보기 주소는 비활성화했습니다.

## 데이터 연결 이전

기존 ChatGPT 대시보드와 새 서버는 별도 DB·암호화 키를 사용합니다. 기존 JSON 비밀 키와 토큰은 이 저장소에 복사하지 않았습니다. 새 도메인에 로그인한 뒤 `/connections`에서 등록합니다.

1. GA4: 서비스 계정 JSON을 업로드하고 등록 앱 속성 조회 성공을 확인합니다.
2. Google OAuth 웹 클라이언트에 아래 승인된 리디렉션 URI를 추가한 뒤 AdMob OAuth JSON을 업로드하고 보고서 읽기를 승인합니다.
3. Play: Console에 서비스 계정 초대 + (선택) GCS 리포트 버킷 이름을 Connections에 등록합니다.
4. App Store Connect: API Key(.p8)·Issuer ID·Key ID·(선택) Vendor Number를 등록합니다. Analytics ONGOING은 첫 리포트까지 하루 이상 걸릴 수 있습니다.
5. Connections에서 **스토어 배치**를 실행하거나 cron(UTC 21:00)을 기다립니다.

```text
https://dashboard.nolsoopgames.com/api/admob/oauth/return
```

GA4 서비스 계정 JSON과 AdMob OAuth 웹 클라이언트 JSON은 서로 다른 파일입니다. 원본 키·OAuth 비밀값·갱신 토큰·로그인 비밀번호를 GitHub에 올리지 마세요.

| 앱 | GA4 속성 | Firebase 프로젝트 |
|---|---|---|
| 읽어주는 만세력 | 550050295 | bazi-ea78b |
| 스도쿠 마스터 | 558243778 | sudoku-master-8998c |

## GitHub를 통한 이후 배포

Cloudflare Workers의 Git 저장소 연결에서 이 저장소를 선택하고 빌드 명령을 `npm run build`, 배포 명령을 `npx wrangler deploy`로 지정할 수 있습니다. D1 ID 수정 후 커밋하세요. 런타임 Secret은 Cloudflare에서 관리하고 저장소에 넣지 않습니다. CI는 테스트·타입 검사·빌드·Worker 번들 검증만 실행하며 자동으로 운영 배포하지 않습니다.

## 검증

```sh
npm test
npm run check
npm run build
npx wrangler deploy --dry-run
```

실제 Google 데이터 조회와 도메인 인증서는 본인 Cloudflare에 배포하고 연결을 등록한 후 검증해야 합니다. 브라우저 로그아웃 후 뒤로가기를 했을 때 오래된 화면이 다시 노출되지 않도록 no-store를 적용하며, 새 요청에는 서버 인증이 항상 필요합니다.
