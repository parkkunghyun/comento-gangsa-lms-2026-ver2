import { google } from 'googleapis';

/**
 * ⚠️ DEPRECATED: 이 파일은 Service Account 기반 구현입니다.
 * 
 * Gmail API는 Service Account로 직접 메일을 보낼 수 없습니다.
 * Domain-wide delegation을 사용하더라도 복잡하고 제한적입니다.
 * 
 * 대신 lib/google-gmail-oauth.ts의 OAuth2 기반 구현을 사용하세요.
 */

/**
 * Gmail API 클라이언트를 생성합니다 (Service Account 기반 - 제한적).
 * 
 * ⚠️ 주의사항:
 * - Service Account는 Gmail API에서 메일을 보낼 수 없습니다.
 * - Domain-wide delegation이 설정되어 있어도 From 주소가 delegate 계정과 일치해야 합니다.
 * - failedPrecondition 에러가 발생할 수 있습니다.
 */
export function getGmailClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google Service Account credentials are not configured');
  }

  // Private Key의 개행 문자를 처리
  const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');

  const delegateEmail = process.env.GOOGLE_SERVICE_ACCOUNT_DELEGATE_EMAIL;
  
  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    ...(delegateEmail && { subject: delegateEmail }), // Domain-wide delegation이 설정된 경우
  });

  return google.gmail({ version: 'v1', auth });
}

/**
 * 이메일을 전송합니다 (Service Account 기반 - 제한적).
 * 
 * ⚠️ 이 함수는 failedPrecondition 에러가 발생할 수 있습니다.
 * OAuth2 기반 구현(sendEmailWithOAuth)을 사용하는 것을 권장합니다.
 * 
 * @param to 수신자 이메일
 * @param subject 제목
 * @param body 본문
 * @param from 발신자 이메일 (선택사항, delegate 계정과 일치해야 함)
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  from?: string
): Promise<void> {
  const gmail = getGmailClient();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const fromEmail = from || process.env.GOOGLE_SERVICE_ACCOUNT_DELEGATE_EMAIL || serviceAccountEmail;

  // 이메일 메시지 생성
  const message = [
    `To: ${to}`,
    `From: ${fromEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ].join('\n');

  // Base64 URL-safe 인코딩
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
