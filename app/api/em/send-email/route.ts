import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendEmailWithOAuth } from '@/lib/google-gmail-oauth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, from, subject, body: emailBody, cc, replyTo } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: '수신자, 제목, 본문을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    const sender =
      from ||
      process.env.GOOGLE_OAUTH_USER_EMAIL ||
      process.env.GMAIL_FROM ||
      user.email;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: 'OAuth2 토큰이 설정되지 않았습니다. 먼저 OAuth 인증을 완료해주세요.',
          authUrl: '/api/auth/oauth/authorize',
        },
        { status: 401 }
      );
    }

    if (!sender) {
      return NextResponse.json(
        { error: '발신자 이메일(GOOGLE_OAUTH_USER_EMAIL)이 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    await sendEmailWithOAuth(
      to,
      subject,
      emailBody,
      sender,
      accessToken,
      refreshToken,
      {
        cc: cc || undefined,
        replyTo: replyTo || undefined,
      }
    );

    return NextResponse.json({
      success: true,
      message: '이메일이 성공적으로 전송되었습니다.',
    });
  } catch (error: any) {
    console.error('Send email API error:', error);

    if (
      error.message?.includes('failedPrecondition') ||
      error.message?.includes('Precondition check failed')
    ) {
      return NextResponse.json(
        {
          error:
            error.message ||
            '메일 전송 실패: 인증된 계정과 From 주소가 일치하지 않거나, 토큰에 gmail.send scope가 없습니다.',
          requiresReauth: true,
          authUrl: '/api/auth/oauth/authorize',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || '이메일 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
