import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCode } from '@/lib/google-gmail-oauth';

export const dynamic = 'force-dynamic';

/**
 * OAuth2 인증 콜백을 처리합니다.
 * 
 * Google OAuth 인증 후 이 엔드포인트로 리다이렉트됩니다.
 * 
 * ⚠️ 토큰 저장 방법:
 * - 실제 프로덕션에서는 데이터베이스에 저장해야 합니다.
 * - 여기서는 환경 변수로 저장 (MVP, 실제로는 DB 권장)
 * - 또는 세션/쿠키에 저장 (보안 주의)
 * 
 * @param request 쿼리 파라미터에 'code' 포함
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // 에러 처리
    if (error) {
      return NextResponse.json(
        { error: `OAuth 인증 실패: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: '인증 코드가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 인증 코드를 토큰으로 교환
    const tokens = await getTokenFromCode(code);

    if (!tokens.access_token) {
      return NextResponse.json(
        { error: '토큰을 받아오지 못했습니다.' },
        { status: 500 }
      );
    }

    // ⚠️ 토큰 저장 (실제로는 데이터베이스에 저장해야 함)
    // 여기서는 환경 변수로 저장하는 방법을 안내
    console.log('=== OAuth2 토큰 정보 ===');
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token || '없음 (이미 발급된 경우)');
    console.log('Expiry Date:', tokens.expiry_date);
    console.log('Scope:', tokens.scope);
    console.log('========================');
    console.log('\n⚠️ 다음 환경 변수를 .env.local에 추가하세요:');
    console.log(`GOOGLE_OAUTH_ACCESS_TOKEN=${tokens.access_token}`);
    if (tokens.refresh_token) {
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    }

    // ⚠️ 실제 구현에서는:
    // 1. 데이터베이스에 토큰 저장
    // 2. 또는 암호화하여 쿠키/세션에 저장
    // 3. 사용자별로 토큰 관리 (여러 사용자가 있는 경우)

    // 성공 페이지로 리다이렉트 (또는 JSON 응답)
    return NextResponse.json({
      success: true,
      message: 'OAuth 인증이 완료되었습니다. 환경 변수에 토큰을 저장해주세요.',
      hasRefreshToken: !!tokens.refresh_token,
      // 실제로는 토큰을 안전하게 저장한 후 리다이렉트
      // return NextResponse.redirect('/em/request?oauth=success');
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'OAuth 인증 처리 중 오류가 발생했습니다.',
        details: error?.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}


