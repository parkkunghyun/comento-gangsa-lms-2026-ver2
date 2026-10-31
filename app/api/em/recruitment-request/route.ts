import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { createRecruitmentRequest, getClassSchedules, ClassScheduleData } from '@/lib/google-sheets';

/**
 * 섭외 요청 생성 API
 * POST /api/em/recruitment-request
 * 
 * Body: {
 *   scheduleIndices: number[] // 선택된 일정의 rowIndex 배열
 *   instructorName: string // 멘토(외부 강사) 이름
 * }
 * 
 * Response: {
 *   requestId: string // "R-" + UUID
 *   acceptLink: string // 수락 링크
 *   declineLink: string // 거절 링크
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { scheduleIndices, instructorName } = body;

    // 입력 검증
    if (!scheduleIndices || !Array.isArray(scheduleIndices) || scheduleIndices.length === 0) {
      return NextResponse.json(
        { error: '일정을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!instructorName || !instructorName.trim()) {
      return NextResponse.json(
        { error: '멘토(외부 강사)를 선택해주세요.' },
        { status: 400 }
      );
    }

    // requestId 생성: "R-" + UUID (하이픈 제거)
    const uuid = randomUUID().replace(/-/g, '').toUpperCase();
    const requestId = `R-${uuid}`;

    // 교육 일정 조회
    const allSchedules = await getClassSchedules(2026);
    
    // 선택된 일정 필터링
    const selectedSchedules = allSchedules.filter((schedule) =>
      scheduleIndices.includes(schedule.rowIndex)
    );

    if (selectedSchedules.length === 0) {
      return NextResponse.json(
        { error: '선택한 일정을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 외부강사_섭외_로그 시트에 저장
    const { acceptLink, declineLink } = await createRecruitmentRequest(
      requestId,
      selectedSchedules,
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
    console.error('Recruitment request API error:', error);
    return NextResponse.json(
      { error: '섭외 요청 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
