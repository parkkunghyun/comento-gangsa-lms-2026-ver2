import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { createB2URecruitmentRequest } from '@/lib/google-sheets';

/**
 * B2U 섭외 요청 생성 API
 * POST /api/em/b2u-recruitment-request
 *
 * Body: {
 *   educationDate: string   // YYYY-MM-DD
 *   instructorName: string  // 멘토명
 *   educationTitle: string // 대학교육 제목
 * }
 */
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
    const { educationDate, instructorName, educationTitle } = body;

    if (!educationDate || typeof educationDate !== 'string' || !educationDate.trim()) {
      return NextResponse.json(
        { error: '교육일을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!instructorName || typeof instructorName !== 'string' || !instructorName.trim()) {
      return NextResponse.json(
        { error: '멘토를 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!educationTitle || typeof educationTitle !== 'string' || !educationTitle.trim()) {
      return NextResponse.json(
        { error: '대학교육 제목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const uuid = randomUUID().replace(/-/g, '').toUpperCase();
    const requestId = `R-${uuid}`;

    const { acceptLink, declineLink } = await createB2URecruitmentRequest(
      requestId,
      educationDate.trim(),
      educationTitle.trim(),
      instructorName.trim(),
      user.email
    );

    return NextResponse.json({
      success: true,
      requestId,
      acceptLink,
      declineLink,
    });
  } catch (error) {
    console.error('B2U recruitment request API error:', error);
    return NextResponse.json(
      { error: 'B2U 섭외 요청 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
