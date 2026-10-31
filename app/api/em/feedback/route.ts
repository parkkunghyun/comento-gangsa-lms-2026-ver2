import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getImprovementFeedbackList } from '@/lib/google-sheets';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const feedback = await getImprovementFeedbackList();
    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('EM feedback API error:', error);
    return NextResponse.json(
      { error: '피드백 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
