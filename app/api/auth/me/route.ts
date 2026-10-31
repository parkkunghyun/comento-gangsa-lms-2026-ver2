import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getEMNameFromStatusSheet } from '@/lib/google-sheets';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: '인증되지 않았습니다.' },
      { status: 401 }
    );
  }

  let name = user.name;
  if (user.role === 'EM' && user.email) {
    const statusName = await getEMNameFromStatusSheet(user.email);
    if (statusName) name = statusName;
  }

  return NextResponse.json({
    role: user.role,
    user: {
      name,
      email: user.email,
      ...(user.role === 'INSTRUCTOR' && {
        mobile: user.mobile,
        fee: user.fee,
      }),
    },
  });
}
