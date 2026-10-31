import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-gmail-oauth';

export const dynamic = 'force-dynamic';

/**
 * OAuth2 인증 URL을 생성하고 리다이렉트합니다.
 * 
 * 사용자가 이 엔드포인트에 접근하면:
 * 1. Google OAuth 인증 페이지로 리다이렉트
 * 2. 사용자가 로그인 및 권한 동의
 * 3. /api/auth/oauth/callback으로 리다이렉트
 */
export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'OAuth 인증 URL 생성에 실패했습니다.',
        details:
          error?.message ||
          'Google OAuth2 환경 변수(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET)를 확인해주세요.',
      },
      { status: 500 }
    );
  }
}


