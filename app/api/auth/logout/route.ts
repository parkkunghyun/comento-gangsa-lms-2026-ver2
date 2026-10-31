import { NextResponse } from 'next/server';
import { removeAuthToken } from '@/lib/auth';

export async function POST() {
  await removeAuthToken();
  return NextResponse.json({ success: true }, { status: 200 });
}



