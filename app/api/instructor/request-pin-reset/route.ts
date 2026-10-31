import { NextRequest, NextResponse } from 'next/server';
import { findInstructorByEmail } from '@/lib/google-sheets';
import { sendEmail } from '@/lib/google-gmail';
import { generateVerificationCode, setVerificationCode } from '@/lib/verification-codes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 강사 정보 확인
    const instructor = await findInstructorByEmail(email);
    if (!instructor) {
      // 보안을 위해 존재하지 않는 이메일이어도 성공 메시지 반환
      return NextResponse.json({
        success: true,
        message: '인증 코드가 전송되었습니다.',
      });
    }

    // 인증 코드 생성 및 저장
    const code = generateVerificationCode();
    setVerificationCode(email, code, 10); // 10분 후 만료

    // 이메일 전송
    try {
      const emailSubject = '핀코드 재설정 인증 코드';
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">핀코드 재설정 인증 코드</h2>
          <p>안녕하세요, ${instructor.name}님.</p>
          <p>핀코드 재설정을 위한 인증 코드입니다:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">이 코드는 10분간 유효합니다.</p>
          <p style="color: #666; font-size: 14px;">본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
        </div>
      `;

      await sendEmail(email, emailSubject, emailBody);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // 이메일 전송 실패해도 계속 진행 (개발 환경에서는 콘솔에 출력)
      console.log(`[개발 모드] 인증 코드: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: '인증 코드가 전송되었습니다.',
    });
  } catch (error) {
    console.error('Request pin reset error:', error);
    return NextResponse.json(
      { error: '인증 코드 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
