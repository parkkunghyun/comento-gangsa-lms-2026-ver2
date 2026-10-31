import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { downloadFileFromDrive, getFileInfo } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: '파일 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 정보 가져오기
    const fileInfo = await getFileInfo(fileId);

    // 파일 다운로드
    const fileBuffer = await downloadFileFromDrive(fileId);

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', fileInfo.mimeType);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.name)}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    // NextResponse 타입(BodyInit) 호환을 위해 ArrayBuffer로 복사
    // (Node의 Buffer.buffer는 ArrayBuffer | SharedArrayBuffer 타입일 수 있음)
    const body = new Uint8Array(fileBuffer).buffer;

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      {
        error: '파일 다운로드 중 오류가 발생했습니다.',
        details: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
