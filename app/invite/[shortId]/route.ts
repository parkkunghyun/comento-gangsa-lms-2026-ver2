import { NextRequest, NextResponse } from 'next/server';
import { findRequestIdByShortId } from '@/lib/google-sheets';

/**
 * 짧은 URL 리다이렉트 핸들러
 * GET /invite/[shortId]?action=accept|decline
 * 
 * shortId로 requestId를 찾아서 GAS URL로 302 리다이렉트
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  try {
    const { shortId } = params;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'accept'; // 기본값: accept

    if (!shortId) {
      return NextResponse.json(
        { error: 'shortId가 필요합니다.' },
        { status: 400 }
      );
    }

    // shortId로 requestId 찾기
    const requestId = await findRequestIdByShortId(shortId);

    if (!requestId) {
      return NextResponse.json(
        { error: '요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // GAS URL 생성
    const baseUrl = 'https://script.google.com/macros/s/AKfycbyBIeSjPeq1X68uaR72wce9RTK5uwqOj2EE4LeX708eFHRzK2lWUSoAW6okb5Ggp4Di/exec';
    const gasUrl = `${baseUrl}?action=${action}&requestId=${requestId}`;

    // 302 리다이렉트
    return NextResponse.redirect(gasUrl, { status: 302 });
  } catch (error) {
    console.error('Invite redirect error:', error);
    return NextResponse.json(
      { error: '리다이렉트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
