import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { appendImprovementFeedback } from '@/lib/google-sheets';

/**
 * 강사 개선점 제출 API
 * POST /api/instructor/improvement-feedback
 * body: { educationDate: string, companyName?: string, improvementText: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { educationDate, companyName, improvementText } = body;

    if (!improvementText || typeof improvementText !== 'string' || !improvementText.trim()) {
      return NextResponse.json(
        { error: '개선될 점을 입력해 주세요.' },
        { status: 400 }
      );
    }

    const educationDateStr = educationDate ? String(educationDate).trim() : '';
    const companyNameStr = companyName != null ? String(companyName).trim() : '';

    await appendImprovementFeedback(
      educationDateStr,
      companyNameStr,
      improvementText.trim(),
      user.name || 'Unknown'
    );

    return NextResponse.json({
      success: true,
      message: '개선점이 제출되었습니다.',
    });
  } catch (error) {
    console.error('Improvement feedback API error:', error);
    return NextResponse.json(
      { error: '제출 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
