# Gmail API OAuth2 설정 가이드

## failedPrecondition 에러 원인 분석

### 1. **From 주소 불일치** (가장 흔한 원인)
- **문제**: From 주소가 OAuth 인증된 계정과 일치하지 않음
- **해결**: From을 명시하지 않거나, 'me'를 사용하거나, 인증된 계정 주소를 사용

### 2. **Scope 부족**
- **문제**: 기존 토큰에 `gmail.send` scope가 없음
- **해결**: 토큰 재발급 필요 (`prompt: 'consent'` 사용)

### 3. **토큰 만료**
- **문제**: access_token이 만료되고 refresh_token도 만료됨
- **해결**: 사용자 재인증 필요

### 4. **회사 도메인 제약**
- **문제**: Google Workspace 관리자가 Gmail API 접근을 제한
- **해결**: 관리자에게 API 접근 권한 요청

## 잘못된 구현 vs 올바른 구현

### ❌ 잘못된 구현 (Service Account 사용)

```typescript
// lib/google-gmail.ts (기존)
export function getGmailClient() {
  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: delegateEmail, // Domain-wide delegation
  });
  return google.gmail({ version: 'v1', auth });
}

// 문제점:
// 1. Service Account는 Gmail API에서 메일을 보낼 수 없음
// 2. Domain-wide delegation이 복잡하고 제한적
// 3. From 주소가 delegate 계정과 일치해야 함
// 4. failedPrecondition 에러 발생 가능성 높음
```

### ✅ 올바른 구현 (OAuth2 사용)

```typescript
// lib/google-gmail-oauth.ts
export function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export async function sendEmailWithOAuth(
  to: string,
  subject: string,
  body: string,
  from: string,
  accessToken: string,
  refreshToken?: string
) {
  // 1. OAuth2 클라이언트 생성
  const oauth2Client = setCredentials(accessToken, refreshToken);
  
  // 2. 토큰 자동 갱신
  if (refreshToken) {
    const newCredentials = await refreshAccessToken(refreshToken);
    oauth2Client.setCredentials(newCredentials);
  }
  
  // 3. Gmail API 클라이언트 생성
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // 4. RFC 2822 형식 메시지 생성
  const message = [
    `To: ${to}`,
    `From: ${from}`, // 인증된 계정과 일치해야 함
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ].join('\r\n');
  
  // 5. Base64 URL-safe 인코딩
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  // 6. 메일 전송
  await gmail.users.messages.send({
    userId: 'me', // 인증된 사용자
    requestBody: { raw: encodedMessage },
  });
}
```

## 설정 단계

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 생성
3. **API 및 서비스 > 사용자 인증 정보** 이동
4. **OAuth 2.0 클라이언트 ID 만들기** 클릭
5. 애플리케이션 유형: **웹 애플리케이션**
6. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:3000/api/auth/oauth/callback
   ```
7. 클라이언트 ID와 클라이언트 보안 비밀번호 복사

### 2. 환경 변수 설정

`.env.local` 파일에 추가:

```env
# OAuth2 설정
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/oauth/callback

# OAuth2 토큰 (초기 인증 후 자동 설정)
GOOGLE_OAUTH_ACCESS_TOKEN=your-access-token
GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token
```

### 3. 초기 OAuth 인증

1. 브라우저에서 다음 URL 접속:
   ```
   http://localhost:3000/api/auth/oauth/authorize
   ```
2. Google 로그인 및 권한 동의
3. 콜백에서 토큰 정보 확인
4. 환경 변수에 토큰 저장

### 4. 메일 전송

```typescript
// app/api/em/send-email/route.ts
await sendEmailWithOAuth(
  to,
  subject,
  emailBody,
  from, // 인증된 계정과 일치해야 함
  accessToken,
  refreshToken
);
```

## 토큰 관리 (프로덕션)

### 현재 구현 (MVP)
- 환경 변수에 토큰 저장
- 단일 사용자만 지원

### 권장 구현 (프로덕션)
- 데이터베이스에 토큰 저장
- 사용자별 토큰 관리
- 토큰 암호화
- 자동 토큰 갱신

```typescript
// 예시: 데이터베이스에 토큰 저장
interface OAuthToken {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

// 토큰 저장
await db.oauthTokens.upsert({
  where: { userId },
  update: {
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    expiresAt: new Date(tokens.expiry_date!),
  },
  create: { ... },
});
```

## 주의사항

1. **From 주소**: 반드시 OAuth 인증된 계정과 일치해야 함
2. **Scope**: `gmail.send`만 사용 (최소 권한 원칙)
3. **토큰 보안**: 환경 변수는 개발용, 프로덕션에서는 DB + 암호화
4. **회사 도메인**: Google Workspace 관리자 승인 필요할 수 있음


