/** Field help copy — paths follow current (2025–2026) console UIs. Keep detailed. */
export type FieldHelpContent={title:string;steps:string[];link?:{href:string;label:string};note?:string};

export const HELP={
 ga4PropertyId:{
  title:'GA4 속성 ID 찾는 법',
  steps:[
   'analytics.google.com 에 로그인합니다.',
   '왼쪽 아래 톱니바퀴(관리 / Admin)를 엽니다.',
   '속성 열에서 「속성 세부정보」(Property details)를 선택합니다. (구 UI의 「속성 설정」과 동일 위치)',
   '화면 오른쪽 위에 숫자만으로 된 Property ID(예: 550050295)가 있습니다. 복사 아이콘으로 복사하세요.',
   'G- 로 시작하는 측정 ID(웹 스트림)는 아닙니다. 숫자 속성 ID만 넣습니다.',
  ],
  link:{href:'https://analytics.google.com/',label:'Google Analytics 열기'},
  note:'Firebase에 연결된 경우: Firebase 콘솔 → 프로젝트 설정 → 통합 → Google Analytics 에서 Property ID를 확인할 수도 있습니다.',
 },
 firebaseProjectId:{
  title:'Firebase 프로젝트 ID',
  steps:[
   'console.firebase.google.com 에서 프로젝트를 엽니다.',
   '왼쪽 톱니 → 프로젝트 설정 → 일반 탭.',
   '「프로젝트 ID」 문자열을 복사합니다. (프로젝트 이름과 다를 수 있음)',
  ],
  link:{href:'https://console.firebase.google.com/',label:'Firebase 콘솔'},
 },
 admobAndroidAppId:{
  title:'AdMob Android 앱 ID',
  steps:[
   'admob.google.com → 앱 메뉴에서 해당 앱을 선택합니다.',
   '앱 설정(또는 앱 정보)에서 「앱 ID」를 확인합니다.',
   '형식: ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy (물결표 ~ 포함).',
   '광고 단위 ID(~ 대신 /)와 혼동하지 마세요. 앱 단위 ID가 필요합니다.',
  ],
  link:{href:'https://admob.google.com/',label:'AdMob 열기'},
 },
 admobIosAppId:{
  title:'AdMob iOS 앱 ID',
  steps:[
   'AdMob → 앱에서 iOS 앱을 선택합니다.',
   '앱 설정의 앱 ID(ca-app-pub-…~…)를 복사합니다.',
   'Android용 앱 ID와 별개입니다. iOS 미출시면 비워 두어도 됩니다.',
  ],
  link:{href:'https://admob.google.com/',label:'AdMob 열기'},
 },
 androidPkg:{
  title:'Android 패키지 이름',
  steps:[
   'Play Console → 해당 앱 → 왼쪽 「대시보드」 또는 「앱 정보」.',
   '패키지 이름은 com.회사.앱 형식입니다. (앱 이름과 다름)',
   'Google Play 스토어 URL의 id= 뒤 값과 동일합니다.',
  ],
  link:{href:'https://play.google.com/console',label:'Play Console'},
 },
 iosBundleId:{
  title:'iOS 번들 ID',
  steps:[
   'App Store Connect → 앱 → 일반 → 앱 정보.',
   '「번들 ID」를 확인합니다. (예: com.nolsoopgames.app)',
   'Xcode 타깃의 Bundle Identifier와 동일해야 합니다.',
  ],
  link:{href:'https://appstoreconnect.apple.com/',label:'App Store Connect'},
 },
 appleAppId:{
  title:'App Store Apple ID (숫자)',
  steps:[
   'App Store Connect → 나의 앱 → 해당 앱.',
   '앱 정보(일반)에서 「Apple ID」 숫자(예: 1234567890)를 복사합니다.',
   '번들 ID나 SKU가 아닙니다. 순수 숫자만 넣습니다.',
   'App Store 공개 URL의 /id 뒤 숫자와 같습니다.',
  ],
  link:{href:'https://appstoreconnect.apple.com/',label:'App Store Connect'},
 },
 afAndroidId:{
  title:'AppsFlyer Android 앱 ID',
  steps:[
   'AppsFlyer 대시보드 → 앱 목록에서 Android 앱을 선택합니다.',
   '앱 설정 / App Settings 에서 App ID(보통 패키지명과 동일)를 확인합니다.',
   '현재 대시보드는 Zero 요금제라 Pull API로 수치를 가져오지 않습니다. ID만 보관합니다.',
  ],
 },
 afIosId:{
  title:'AppsFlyer iOS 앱 ID',
  steps:[
   'AppsFlyer → iOS 앱 → App Settings.',
   'id + Apple ID 형식(예: id1234567890)인 경우가 많습니다.',
   'API 수집은 하지 않으며 메타데이터만 저장합니다.',
  ],
 },
 ga4JsonKey:{
  title:'GA4 서비스 계정 JSON 키',
  steps:[
   'Google Cloud 콘솔 → IAM 및 관리자 → 서비스 계정.',
   '사용할 서비스 계정을 연 뒤 「키」 탭 → 키 추가 → 새 키 만들기 → JSON.',
   '다운로드된 .json 파일을 이 화면에서 선택합니다. 키 내용은 브라우저에서 암호화된 뒤만 전송됩니다.',
   '같은 서비스 계정 이메일을 GA4 속성 → 관리 → 속성 액세스 관리 → 사용자 추가 → 뷰어로 초대해야 조회됩니다.',
  ],
  link:{href:'https://console.cloud.google.com/iam-admin/serviceaccounts?project=sudoku-master-8998c',label:'서비스 계정 열기'},
 },
 admobOauthJson:{
  title:'AdMob OAuth 클라이언트 JSON',
  steps:[
   'Google Cloud → API 및 서비스 → 사용자 인증 정보(또는 Google Auth Platform → 클라이언트).',
   '「OAuth 2.0 클라이언트 ID」를 만들고 유형은 「웹 애플리케이션」.',
   '승인된 리디렉션 URI에 이 대시보드가 안내하는 콜백 주소를 그대로 등록합니다.',
   '클라이언트 생성 직후(또는 다운로드) JSON을 이 화면에 업로드합니다. GA4 서비스 계정 JSON과 다른 파일입니다.',
  ],
  link:{href:'https://console.cloud.google.com/auth/clients?project=sudoku-master-8998c',label:'OAuth 클라이언트'},
 },
 playJsonKey:{
  title:'Play 서비스 계정 JSON',
  steps:[
   'Google Cloud에서 서비스 계정을 만들고 JSON 키를 다운로드합니다.',
   'Play Console → 사용자 및 권한 → 사용자 초대 → 서비스 계정 이메일을 넣고 「앱 정보 보기(전체)」 이상 권한을 줍니다.',
   '초대를 수락·반영한 뒤, 이 화면에서 JSON을 업로드합니다.',
  ],
  link:{href:'https://play.google.com/console/developers/users-and-permissions',label:'Play 사용자 및 권한'},
 },
 gcsBucket:{
  title:'Play GCS 버킷(Cloud Storage URI)',
  steps:[
   'Play Console 왼쪽 맨 위 「집(홈)」으로 나가 특정 앱 화면이 아니어야 합니다.',
   '「다운로드 보고서」 또는 「계정 관리 → Google Play 앱 보고서」 → 「통계」를 엽니다.',
   '설치 관련 섹션 제목 오른쪽의 「Cloud Storage URI 복사」를 누릅니다.',
   '예: gs://pubsite_prod_rev_0123456789/stats/installs/… — 이 칸에 그대로 붙여넣어도 됩니다. 저장 시 버킷 이름만 남깁니다.',
   '앱 안 「통계 → 보고서 내보내기」 화면이 아닙니다.',
  ],
  link:{href:'https://play.google.com/console',label:'Play Console 홈'},
 },
 ascIssuerId:{
  title:'App Store Connect Issuer ID',
  steps:[
   'appstoreconnect.apple.com → 사용자 및 액세스.',
   '상단 「통합」(Integrations) → 「App Store Connect API」.',
   '페이지 상단에 표시되는 Issuer ID(UUID, 예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)를 복사합니다.',
   '키 이름이나 팀 이름이 아닙니다.',
  ],
  link:{href:'https://appstoreconnect.apple.com/access/integrations/api',label:'ASC API 키 페이지'},
 },
 ascKeyId:{
  title:'App Store Connect Key ID',
  steps:[
   '같은 App Store Connect API 키 목록에서 생성한 키의 Key ID(영문 대문자·숫자 10자)를 복사합니다.',
   '.p8 파일 이름에 포함된 문자열과 일치하는 경우가 많습니다.',
  ],
  link:{href:'https://appstoreconnect.apple.com/access/integrations/api',label:'ASC API 키 페이지'},
 },
 ascPrivateKey:{
  title:'.p8 개인 키',
  steps:[
   '키 생성 직후 한 번만 다운로드되는 AuthKey_XXXXXXXXXX.p8 파일을 엽니다.',
   '-----BEGIN PRIVATE KEY----- 부터 -----END PRIVATE KEY----- 까지 전체 내용을 붙여 넣습니다.',
   '분실 시 새 키를 만들고 이 화면에서 교체해야 합니다.',
  ],
 },
 ascVendorNumber:{
  title:'Vendor Number (선택)',
  steps:[
   'App Store Connect → 결제 및 재무(또는 Payments and Financial Reports).',
   'Vendor Number(보통 8자리 숫자)가 표시됩니다.',
   'Sales Report 배치에 쓰입니다. 모르면 비워 두고 나중에 추가해도 됩니다.',
  ],
  link:{href:'https://appstoreconnect.apple.com/',label:'App Store Connect'},
 },
 metaAccessToken:{
  title:'Meta Access token (최신 Business 설정 UI)',
  steps:[
   'business.facebook.com 에 로그인 → 왼쪽 아래 「설정」(Settings) 톱니를 엽니다. (구 Business Manager 설정도 동일하게 Settings로 진입)',
   '사용자 → 「시스템 사용자」(System users) → 「추가」로 시스템 사용자를 만듭니다. (Admin/Employee)',
   '해당 시스템 사용자 → 「자산 할당」(Assign assets) → 광고 계정을 선택하고 최소 「분석」(ANALYZE) 권한을 줍니다.',
   '같은 시스템 사용자에서 「토큰 생성」(Generate new token) → 비즈니스에 연결된 앱을 고르고 ads_read(또는 ads_management) 권한을 체크한 뒤 생성합니다.',
   '생성된 토큰 문자열을 즉시 복사해 이 칸에 넣습니다. 다시 열면 전체가 보이지 않을 수 있습니다.',
   '개인 Facebook 로그인 토큰보다 시스템 사용자 토큰을 권장합니다. 일부 비즈니스는 60일 만료 토큰만 허용합니다.',
  ],
  link:{href:'https://business.facebook.com/settings/system-users',label:'시스템 사용자 설정'},
  note:'개발자 문서 기준: Business Settings → Users → System users → Generate token. Ads Manager의 「토큰 도구」 개인 토큰은 만료가 짧아 서버 연동에 부적합할 수 있습니다.',
 },
 metaAdAccountId:{
  title:'Meta Ad account ID',
  steps:[
   'Ads Manager(adsmanager.facebook.com) 왼쪽 위 계정 선택기에서 계정을 고릅니다.',
   '계정 설정 → 광고 계정 설정에서 「광고 계정 ID」 숫자를 확인합니다.',
   '이 칸에는 act_1234567890 형식으로 넣거나 숫자만 넣어도 됩니다. (숫자만 넣으면 act_ 를 붙입니다)',
   'Business 설정 → 계정 → 광고 계정 목록의 ID 열과 동일합니다.',
  ],
  link:{href:'https://adsmanager.facebook.com/',label:'Ads Manager'},
 },
 googleAdsClientId:{
  title:'Google Ads OAuth client_id',
  steps:[
   'Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보.',
   'OAuth 2.0 클라이언트 ID(웹 또는 데스크톱)를 만든 뒤 클라이언트의 클라이언트 ID를 복사합니다.',
   'Google Ads API를 사용 설정한 프로젝트여야 합니다.',
  ],
  link:{href:'https://console.cloud.google.com/apis/credentials',label:'사용자 인증 정보'},
 },
 googleAdsClientSecret:{
  title:'Google Ads OAuth client_secret',
  steps:[
   '같은 OAuth 클라이언트 상세에서 「클라이언트 보안 비밀」을 복사합니다.',
   '비밀이 표시되지 않으면 새 비밀을 추가한 뒤 즉시 복사하세요.',
  ],
 },
 googleAdsRefreshToken:{
  title:'Google Ads refresh_token',
  steps:[
   'OAuth Playground 또는 자체 OAuth 동의 흐름으로 Google 계정 승인을 받습니다.',
   '범위에 https://www.googleapis.com/auth/adwords 를 포함합니다.',
   '발급된 refresh_token을 이 칸에 넣습니다. access_token이 아닙니다.',
  ],
  link:{href:'https://developers.google.com/oauthplayground/',label:'OAuth Playground'},
 },
 googleAdsDeveloperToken:{
  title:'Google Ads developer_token',
  steps:[
   'ads.google.com → 도구 및 설정(도구 아이콘) → 설정 → API 센터.',
   '개발자 토큰을 신청·복사합니다. 테스트 계정 토큰은 조회 제약이 있을 수 있습니다.',
   'API 센터 메뉴명은 계정 UI에서 「API Center」로 표시됩니다.',
  ],
  link:{href:'https://ads.google.com/aw/apicenter',label:'Google Ads API 센터'},
 },
 googleAdsCustomerId:{
  title:'Google Ads customer_id',
  steps:[
   'Google Ads 상단 계정 이름 옆 또는 계정 설정에서 고객 ID(xxx-xxx-xxxx)를 확인합니다.',
   '하이픈 포함·제외 모두 가능합니다. MCC 하위 계정이면 해당 고객 ID를 넣습니다.',
  ],
  link:{href:'https://ads.google.com/',label:'Google Ads'},
 },
} as const satisfies Record<string,FieldHelpContent>;
