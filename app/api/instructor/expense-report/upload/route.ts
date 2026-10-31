import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';
import { getOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';

const EXPENSE_REPORT_SPREADSHEET_ID = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const SHEET_NAME = '지출결의서관리';
const GOOGLE_DRIVE_ROOT_FOLDER_ID = '0ADbtUSpjgAJ9Uk9PVA'; // Google Drive 루트 폴더 ID (Shared Drive)

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const month = formData.get('month') as string;
    const excelFile = formData.get('excelFile') as File | null;
    const zipFile = formData.get('zipFile') as File | null;

    if (!month) {
      return NextResponse.json(
        { error: '월을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!excelFile && !zipFile) {
      return NextResponse.json(
        { error: '엑셀 파일 또는 압축된 폴더 중 하나는 필수입니다.' },
        { status: 400 }
      );
    }

    // 루트 폴더가 Shared Drive인지 먼저 확인
    const { getGoogleDriveClient } = await import('@/lib/google-drive');
    const drive = getGoogleDriveClient();
    try {
      const rootFolderInfo = await drive.files.get({
        fileId: GOOGLE_DRIVE_ROOT_FOLDER_ID,
        fields: 'id, name, driveId',
        supportsAllDrives: true,
      });
      
      const isSharedDrive = !!rootFolderInfo.data.driveId;
      if (!isSharedDrive) {
        return NextResponse.json(
          { 
            error: '❌ 루트 폴더가 Shared Drive(공유 드라이브)가 아닙니다.',
            details: `Service Account(${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL})는 개인 Google Drive에 파일을 업로드할 수 없습니다.\n\n` +
              `⚠️ 중요: "공유 폴더"와 "Shared Drive"는 완전히 다른 개념입니다.\n` +
              `- 공유 폴더: 개인 Drive의 폴더를 다른 사람과 공유 (여전히 개인 Drive)\n` +
              `- Shared Drive: Google Workspace의 조직 단위 공유 드라이브 (Service Account 사용 가능)\n\n` +
              `✅ 해결 방법:\n` +
              `1. Google Workspace 관리자에게 Shared Drive를 생성해달라고 요청하세요.\n` +
              `2. Shared Drive 생성 방법: Google Drive → 새로 만들기 → 공유 드라이브\n` +
              `3. 생성된 Shared Drive 안에 폴더를 만들고, 그 폴더 ID를 사용하세요.\n\n` +
              `현재 루트 폴더 ID: ${GOOGLE_DRIVE_ROOT_FOLDER_ID}\n` +
              `폴더 이름: ${rootFolderInfo.data.name}\n` +
              `driveId: ${rootFolderInfo.data.driveId || '없음 (개인 Drive)'}`,
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
          },
          { status: 400 }
        );
      }
      console.log('✅ 루트 폴더가 Shared Drive입니다:', rootFolderInfo.data.driveId);
    } catch (error: any) {
      console.error('루트 폴더 확인 실패:', error);
      if (error.code === 404) {
        return NextResponse.json(
          { 
            error: '루트 폴더에 접근할 수 없습니다.',
            details: `폴더 ID(${GOOGLE_DRIVE_ROOT_FOLDER_ID})가 올바른지 확인하고, Service Account(${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL})를 편집자로 추가해주세요.`,
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // Google Drive 폴더 구조 생성: 강사이름/월
    const instructorName = user.name || user.email.split('@')[0];
    const monthFolderName = month; // YYYY-MM 형식

    // 강사 이름 폴더 생성 또는 조회
    const instructorFolderId = await getOrCreateFolder(
      GOOGLE_DRIVE_ROOT_FOLDER_ID,
      instructorName
    );

    // 월 폴더 생성 또는 조회
    const monthFolderId = await getOrCreateFolder(
      instructorFolderId,
      monthFolderName
    );

    const files: { type: string; fileName: string; fileId: string; webViewLink: string }[] = [];

    // 엑셀 파일 업로드
    if (excelFile) {
      const bytes = await excelFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = excelFile.name.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel';

      const { fileId, webViewLink } = await uploadFileToDrive(
        buffer,
        excelFile.name,
        mimeType,
        monthFolderId
      );

      files.push({
        type: 'excel',
        fileName: excelFile.name,
        fileId: fileId,
        webViewLink: webViewLink,
      });
    }

    // 압축 파일 업로드
    if (zipFile) {
      const bytes = await zipFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = zipFile.name.endsWith('.rar')
        ? 'application/x-rar-compressed'
        : 'application/zip';

      const { fileId, webViewLink } = await uploadFileToDrive(
        buffer,
        zipFile.name,
        mimeType,
        monthFolderId
      );

      files.push({
        type: 'zip',
        fileName: zipFile.name,
        fileId: fileId,
        webViewLink: webViewLink,
      });
    }

    // Google Sheets에 정보 저장
    const sheets = getGoogleSheetsClient();
    const now = new Date();
    const uploadDate = now.toISOString().split('T')[0];

    // 각 파일에 대해 시트에 행 추가
    for (const file of files) {
      const row = [
        user.email, // 강사이메일
        user.name || '', // 강사이름
        month, // 월
        uploadDate, // 업로드일자
        file.fileName, // 파일명
        file.fileId, // Google Drive 파일 ID
        file.webViewLink, // Google Drive 웹 뷰 링크
        file.type, // 파일타입 (excel/zip)
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: EXPENSE_REPORT_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:H`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '지출결의서가 성공적으로 업로드되었습니다.',
    });
  } catch (error: any) {
    console.error('Error uploading expense report:', {
      error: error,
      message: error?.message,
      code: error?.code,
      errors: error?.errors,
      stack: error?.stack,
    });
    
    // Google Drive 권한 오류인 경우 명확한 메시지 제공
    if (error.message && (
      error.message.includes('Google Drive 폴더에 접근할 수 없습니다') ||
      error.message.includes('파일 업로드 실패')
    )) {
      return NextResponse.json(
        { 
          error: error.message,
          help: 'Google Drive 폴더 공유 설정에서 Service Account 이메일을 편집자로 추가해주세요.',
          serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        },
        { status: 403 }
      );
    }
    
    // 기타 Google Drive API 오류
    if (error.code === 404 || error.code === 403) {
      return NextResponse.json(
        { 
          error: 'Google Drive 접근 권한이 없습니다. 폴더 공유 설정을 확인해주세요.',
          details: error.message,
          serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        error: '업로드 중 오류가 발생했습니다.',
        details: error.message || error.toString() || '알 수 없는 오류가 발생했습니다.',
        errorType: error.constructor?.name || 'Unknown'
      },
      { status: 500 }
    );
  }
}
