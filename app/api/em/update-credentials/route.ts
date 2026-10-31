import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateEMCredentialsByEmail } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: 'EM 로그인 후 이용해 주세요.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { currentPassword, newId, newPassword } = body;

    if (!currentPassword || currentPassword.toString().trim() === '') {
      return NextResponse.json(
        { error: '현재 비밀번호를 입력해 주세요.' },
        { status: 400 }
      );
    }
    if (!newId || newId.toString().trim() === '') {
      return NextResponse.json(
        { error: '새 아이디를 입력해 주세요.' },
        { status: 400 }
      );
    }
    if (!newPassword || newPassword.toString().trim() === '') {
      return NextResponse.json(
        { error: '새 비밀번호를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const result = await updateEMCredentialsByEmail(
      user.email,
      currentPassword.toString().trim(),
      newId.toString().trim(),
      newPassword.toString().trim()
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || '변경에 실패했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('EM update-credentials error:', error);
    return NextResponse.json(
      { error: '서버 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
