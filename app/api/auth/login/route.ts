import { NextRequest, NextResponse } from 'next/server';
import { findInstructor, findInstructorByEmailAndPin } from '@/lib/google-sheets';
import { verifyEMCredentials } from '@/lib/auth-em';
import { createToken, setAuthToken } from '@/lib/auth';
import { AuthUser } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, emId, email, pinCode, role } = body;

    let authUser: AuthUser | null = null;

    // 역할별 인증 처리
    if (role === 'EM') {
      // EM 인증: 아이디와 비밀번호 필요 (하위 호환: name에 아이디가 들어오는 경우도 허용)
      const loginId = (emId || name || '').toString().trim();
      if (!loginId || !pinCode) {
        return NextResponse.json(
          { error: '아이디와 비밀번호를 모두 입력해주세요.' },
          { status: 400 }
        );
      }

      const emInfo = await verifyEMCredentials(loginId, pinCode);
      if (emInfo) {
        authUser = {
          role: 'EM',
          name: emInfo.name,
          email: emInfo.email,
        };
      }
    } else {
      // INSTRUCTOR 인증: 이메일과 핀코드 필요
      if (!email || !pinCode) {
        return NextResponse.json(
          { error: '이메일과 핀코드를 모두 입력해주세요.' },
          { status: 400 }
        );
      }

      const instructor = await findInstructorByEmailAndPin(email, pinCode);
      if (instructor) {
        authUser = {
          role: 'INSTRUCTOR',
          name: instructor.name,
          email: instructor.email,
          mobile: instructor.mobile,
          fee: instructor.fee,
        };
      }
    }

    // 인증 실패
    if (!authUser) {
      return NextResponse.json(
        { error: '일치하는 정보를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const token = await createToken(authUser);

    // 응답 생성 및 쿠키 설정
    const response = NextResponse.json(
      {
        success: true,
        role: authUser.role,
        user: {
          name: authUser.name,
          email: authUser.email,
          ...(authUser.role === 'INSTRUCTOR' && {
            mobile: authUser.mobile,
            fee: authUser.fee,
          }),
        },
      },
      { status: 200 }
    );

    // 쿠키 설정
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    // Google API 관련 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('Service Account')) {
        return NextResponse.json(
          { error: '서버 설정 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

