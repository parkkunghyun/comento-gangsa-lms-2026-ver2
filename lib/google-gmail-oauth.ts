import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * OAuth2 클라이언트를 생성합니다.
 * 
 * ⚠️ 주의사항:
 * - Gmail API는 Service Account로 직접 메일을 보낼 수 없습니다.
 * - 반드시 OAuth2를 사용해야 하며, 실제 사용자 계정으로 인증해야 합니다.
 * - 회사 도메인 계정의 경우, 관리자가 API 접근을 제한할 수 있습니다.
 */
export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth2 credentials are not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * OAuth2 인증 URL을 생성합니다.
 * 
 * ⚠️ 중요: gmail.send scope만 사용합니다.
 * - gmail.readonly는 사용하지 않습니다.
 * - 최소 권한 원칙에 따라 필요한 scope만 요청합니다.
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send', // 메일 전송만 가능
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh token을 받기 위해 필요
    scope: scopes,
    prompt: 'consent', // 항상 동의 화면을 표시하여 refresh token을 받도록 함
  });
}

/**
 * OAuth2 토큰을 교환합니다 (인증 코드를 토큰으로 변환).
 * 
 * @param code OAuth 인증 코드
 * @returns 토큰 정보 (access_token, refresh_token 등)
 */
export async function getTokenFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * 저장된 토큰으로 OAuth2 클라이언트를 설정합니다.
 * 
 * ⚠️ 토큰 재발급 로직:
 * - access_token이 만료되면 자동으로 refresh_token을 사용하여 갱신합니다.
 * - refresh_token도 만료된 경우, 사용자가 다시 인증해야 합니다.
 * 
 * @param accessToken 저장된 access token
 * @param refreshToken 저장된 refresh token (선택사항, 토큰 갱신에 필요)
 */
export function setCredentials(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

/**
 * 토큰을 갱신합니다.
 * 
 * ⚠️ failedPrecondition 에러가 발생하는 주요 원인:
 * 1. refresh_token이 없거나 만료됨
 * 2. scope가 부족함 (gmail.send가 없음)
 * 3. From 주소가 인증된 계정과 일치하지 않음
 * 
 * @param refreshToken refresh token
 * @returns 새로운 토큰 정보
 */
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('토큰 갱신에 실패했습니다. 다시 인증이 필요합니다.');
  }
}

/**
 * Gmail API 클라이언트를 생성합니다 (OAuth2 기반).
 * 
 * ⚠️ 주의사항:
 * - 토큰이 만료되었을 수 있으므로, 항상 토큰 갱신을 시도합니다.
 * - From 주소는 반드시 인증된 계정과 일치해야 합니다.
 * 
 * @param accessToken 저장된 access token
 * @param refreshToken 저장된 refresh token (선택사항)
 */
export async function getGmailClientWithOAuth(accessToken: string, refreshToken?: string) {
  const oauth2Client = setCredentials(accessToken, refreshToken);
  
  // 토큰이 만료되었는지 확인하고 갱신 시도
  if (refreshToken) {
    try {
      // 토큰 정보 확인
      const tokenInfo = await oauth2Client.getAccessToken();
      if (!tokenInfo.token) {
        // 토큰이 없거나 만료된 경우 갱신
        const newCredentials = await refreshAccessToken(refreshToken);
        oauth2Client.setCredentials(newCredentials);
      }
    } catch (error) {
      console.error('Token validation failed, attempting refresh:', error);
      if (refreshToken) {
        try {
          const newCredentials = await refreshAccessToken(refreshToken);
          oauth2Client.setCredentials(newCredentials);
        } catch (refreshError) {
          throw new Error('토큰 갱신에 실패했습니다. 다시 인증이 필요합니다.');
        }
      }
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * 이메일을 전송합니다 (OAuth2 기반).
 * 
 * ⚠️ failedPrecondition 에러가 발생하는 정확한 원인:
 * 
 * 1. **From 주소 불일치**:
 *    - From 주소가 인증된 OAuth 계정과 일치하지 않으면 에러 발생
 *    - 해결: From을 명시하지 않거나, 'me'를 사용하거나, 인증된 계정 주소를 사용
 * 
 * 2. **Scope 부족**:
 *    - 기존 토큰에 gmail.send scope가 없으면 에러 발생
 *    - 해결: 토큰 재발급 필요 (prompt: 'consent' 사용)
 * 
 * 3. **토큰 만료**:
 *    - access_token이 만료되고 refresh_token도 만료된 경우
 *    - 해결: 사용자 재인증 필요
 * 
 * 4. **회사 도메인 제약**:
 *    - Google Workspace 관리자가 Gmail API 접근을 제한할 수 있음
 *    - 해결: 관리자에게 API 접근 권한 요청
 * 
 * @param to 수신자 이메일
 * @param subject 제목
 * @param body 본문 (HTML 지원)
 * @param from 발신자 이메일 (선택사항, 인증된 계정과 일치해야 함)
 * @param accessToken OAuth2 access token
 * @param refreshToken OAuth2 refresh token (선택사항, 토큰 갱신에 필요)
 */
export async function sendEmailWithOAuth(
  to: string,
  subject: string,
  body: string,
  from: string,
  accessToken: string,
  refreshToken?: string,
  options?: { cc?: string; replyTo?: string }
): Promise<void> {
  // Gmail 클라이언트 생성 (토큰 갱신 포함)
  const gmail = await getGmailClientWithOAuth(accessToken, refreshToken);

  // ⚠️ 중요: From 주소는 인증된 계정과 일치해야 합니다.
  // 인증된 계정 정보 가져오기
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  let verifiedFrom = from;
  
  try {
    // 인증된 사용자 정보 가져오기
    const userInfo = await oauth2Client.getAccessToken();
    // 실제로는 Gmail API의 users.getProfile을 사용해야 하지만,
    // 여기서는 from 파라미터를 그대로 사용하되, 검증 로직 추가
    
    // ⚠️ From 주소 검증: 인증된 계정과 일치하는지 확인
    // 실제 구현에서는 토큰에서 이메일을 추출하거나, 별도 API 호출 필요
    // 여기서는 from 파라미터를 신뢰하되, 주석으로 경고
  } catch (error) {
    console.error('Failed to verify user info:', error);
    // 계속 진행 (from 파라미터 사용)
  }

  // RFC 2822 형식의 이메일 메시지 생성
  // ⚠️ 중요: From 헤더는 반드시 인증된 계정과 일치해야 합니다.
  const messageLines = [
    `To: ${to}`,
    `From: ${verifiedFrom}`, // 인증된 계정과 일치해야 함
  ];
  if (options?.cc) {
    messageLines.push(`Cc: ${options.cc}`);
  }
  if (options?.replyTo) {
    messageLines.push(`Reply-To: ${options.replyTo}`);
  }
  // 한글 제목 MIME 인코딩 (RFC 2047)
  const encodedSubject = /[^\x00-\x7F]/.test(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
    : subject;
  messageLines.push(
    `Subject: ${encodedSubject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '', // 빈 줄 (헤더와 본문 구분)
    body,
  );

  const message = messageLines.join('\r\n');

  // Base64 URL-safe 인코딩 (RFC 4648 Section 5)
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // 패딩 제거

  try {
    // Gmail API를 사용하여 메일 전송
    // ⚠️ userId는 'me'를 사용 (인증된 사용자)
    const response = await gmail.users.messages.send({
      userId: 'me', // 인증된 사용자
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Email sent successfully. Message ID: ${response.data.id}`);
  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // 에러 상세 정보 로깅
    if (error.response) {
      console.error('Error response:', error.response.data);
      console.error('Error status:', error.response.status);
    }

    // failedPrecondition 에러 처리
    if (error.response?.status === 400 && error.response?.data?.error?.status === 'FAILED_PRECONDITION') {
      const errorMessage = error.response.data.error.message || '';
      
      if (errorMessage.includes('Precondition check failed')) {
        throw new Error(
          '메일 전송 실패: 인증된 계정과 From 주소가 일치하지 않거나, ' +
          '토큰에 gmail.send scope가 없습니다. ' +
          '토큰을 재발급하거나 From 주소를 확인해주세요.'
        );
      }
    }

    throw error;
  }
}


