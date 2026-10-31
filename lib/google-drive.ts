import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Google Drive API 클라이언트를 생성합니다.
 */
export function getGoogleDriveClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google Service Account credentials are not configured');
  }

  // Private Key의 개행 문자를 처리
  const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * 폴더를 생성하거나 기존 폴더를 찾습니다.
 * @param parentFolderId 부모 폴더 ID
 * @param folderName 폴더 이름
 * @returns 폴더 ID
 */
export async function getOrCreateFolder(
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const drive = getGoogleDriveClient();

  try {
    // 먼저 부모 폴더 접근 권한 확인 및 Shared Drive 여부 확인
    const folderInfo = await drive.files.get({
      fileId: parentFolderId,
      fields: 'id, name, driveId',
      supportsAllDrives: true,
    });
    
    const isSharedDrive = !!folderInfo.data.driveId;
    if (!isSharedDrive) {
      const errorMsg = `⚠️ 이 폴더는 Shared Drive가 아닙니다. Service Account는 Shared Drive에만 파일을 업로드할 수 있습니다.\n` +
        `폴더 ID: ${parentFolderId}\n` +
        `폴더 이름: ${folderInfo.data.name}\n` +
        `driveId: ${folderInfo.data.driveId || '없음 (개인 Drive)'}\n\n` +
        `⚠️ 참고: "공유 폴더"와 "Shared Drive"는 다릅니다. 개인 Drive의 폴더를 공유하는 것은 Shared Drive가 아닙니다.`;
      console.warn(errorMsg);
      throw new Error(errorMsg);
    } else {
      console.log('✅ Shared Drive 확인됨:', {
        folderId: parentFolderId,
        folderName: folderInfo.data.name,
        driveId: folderInfo.data.driveId
      });
    }
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(
        `Google Drive 폴더에 접근할 수 없습니다. 폴더 ID(${parentFolderId})가 올바른지 확인하고, Service Account 이메일(${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL})을 해당 폴더에 편집자 권한으로 공유해주세요. 또한 Service Account는 Shared Drive(공유 드라이브)에만 파일을 업로드할 수 있습니다.`
      );
    }
    throw error;
  }

  // 기존 폴더 검색
  try {
    const searchResponse = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // 기존 폴더가 있으면 반환
      return searchResponse.data.files[0].id!;
    }
  } catch (error: any) {
    console.error('Error searching for folder:', error);
    throw new Error(`폴더 검색 중 오류가 발생했습니다: ${error.message}`);
  }

  // 폴더가 없으면 생성
  try {
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const newFolderId = createResponse.data.id!;
    
    console.log('폴더 생성 성공:', {
      folderName,
      folderId: newFolderId,
      parentFolderId,
    });
    
    // 생성된 폴더에 Service Account 권한 명시적으로 부여 (선택사항)
    // 부모 폴더에서 권한을 상속받으므로 필수는 아님
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (serviceAccountEmail) {
      try {
        await drive.permissions.create({
          fileId: newFolderId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: serviceAccountEmail,
          },
          supportsAllDrives: true,
        });
        console.log('폴더 권한 부여 성공:', newFolderId);
      } catch (permError: any) {
        // 권한 부여 실패는 무시 (이미 권한이 있거나 부모에서 상속받음)
        console.log('권한 부여 스킵 (이미 권한 있음):', permError.message);
      }
    }

    return newFolderId;
  } catch (error: any) {
    console.error('Error creating folder:', error);
    throw new Error(`폴더 생성 중 오류가 발생했습니다: ${error.message}`);
  }
}

/**
 * Google Drive에 파일을 업로드합니다.
 * @param fileBuffer 파일 버퍼
 * @param fileName 파일 이름
 * @param mimeType MIME 타입
 * @param parentFolderId 부모 폴더 ID
 * @returns 파일 ID와 웹 뷰 링크
 */
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getGoogleDriveClient();

  try {
    // 먼저 폴더가 Shared Drive인지 확인
    let isSharedDrive = false;
    let driveId: string | null = null;
    try {
      const folderInfo = await drive.files.get({
        fileId: parentFolderId,
        fields: 'id, name, driveId, capabilities',
        supportsAllDrives: true,
      });
      driveId = folderInfo.data.driveId || null;
      isSharedDrive = !!driveId;
      console.log('폴더 정보:', {
        folderId: parentFolderId,
        folderName: folderInfo.data.name,
        driveId: driveId,
        isSharedDrive,
        capabilities: folderInfo.data.capabilities,
      });
      
      // Shared Drive가 아닌 경우 즉시 오류 발생
      if (!isSharedDrive) {
        throw new Error(
          `이 폴더는 Shared Drive(공유 드라이브)가 아닙니다. Service Account는 개인 Google Drive에 파일을 업로드할 수 없습니다.\n\n` +
          `해결 방법:\n` +
          `1. Google Workspace 관리자에게 Shared Drive를 생성해달라고 요청하세요.\n` +
          `2. 생성된 Shared Drive의 폴더 ID를 사용하세요.\n\n` +
          `참고: "공유 폴더"와 "Shared Drive"는 다릅니다. 개인 Drive의 폴더를 공유하는 것은 Shared Drive가 아닙니다.`
        );
      }
    } catch (checkError: any) {
      // 이미 우리가 던진 오류면 그대로 전달
      if (checkError.message && checkError.message.includes('Shared Drive')) {
        throw checkError;
      }
      console.warn('폴더 정보 확인 실패, 계속 진행:', checkError.message);
    }

    // Buffer를 Stream으로 변환
    const stream = Readable.from(fileBuffer);
    
    console.log('파일 업로드 시도:', {
      fileName,
      parentFolderId,
      mimeType,
      fileSize: fileBuffer.length,
      isSharedDrive,
    });
    
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    console.log('파일 업로드 성공:', {
      fileId: uploadResponse.data.id,
      fileName,
    });

    return {
      fileId: uploadResponse.data.id!,
      webViewLink: uploadResponse.data.webViewLink || '',
    };
  } catch (error: any) {
    console.error('Error uploading file to Google Drive:', {
      fileName,
      parentFolderId,
      errorCode: error.code,
      errorMessage: error.message,
      errorResponse: error.response?.data,
      errors: error.errors,
    });
    
    // Service Account storage quota 오류인 경우
    if (error.message && error.message.includes('Service Accounts do not have storage quota')) {
      throw new Error(
        `❌ Service Account는 개인 Google Drive에 파일을 업로드할 수 없습니다.\n\n` +
        `⚠️ 중요: "공유 폴더"와 "Shared Drive(공유 드라이브)"는 완전히 다른 개념입니다.\n` +
        `- 공유 폴더: 개인 Drive의 폴더를 다른 사람과 공유 (여전히 개인 Drive)\n` +
        `- Shared Drive: Google Workspace의 조직 단위 공유 드라이브 (Service Account 사용 가능)\n\n` +
        `✅ 해결 방법:\n` +
        `1. Google Workspace 관리자에게 Shared Drive를 생성해달라고 요청하세요.\n` +
        `2. 생성된 Shared Drive의 폴더 ID를 사용하세요.\n` +
        `3. Shared Drive 생성 방법: Google Drive → 새로 만들기 → 공유 드라이브\n\n` +
        `현재 폴더 ID: ${parentFolderId}`
      );
    }
    
    // 404 또는 403 오류인 경우
    if (error.code === 404 || error.code === 403) {
      const errorDetails = error.response?.data?.error?.message || error.message;
      throw new Error(
        `파일 업로드 실패: Google Drive 폴더에 접근할 수 없습니다. 폴더 ID(${parentFolderId})에 대한 권한을 확인해주세요. 오류: ${errorDetails}`
      );
    }
    
    throw new Error(`파일 업로드 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
  }
}

/**
 * Google Drive에서 파일을 다운로드합니다.
 * @param fileId 파일 ID
 * @returns 파일 버퍼
 */
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getGoogleDriveClient();

  try {
    console.log('파일 다운로드 시도:', { fileId });

    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'arraybuffer',
      }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    console.log('파일 다운로드 성공:', { fileId, fileSize: buffer.length });

    return buffer;
  } catch (error: any) {
    console.error('Error downloading file from Google Drive:', {
      fileId,
      errorCode: error.code,
      errorMessage: error.message,
      errorResponse: error.response?.data,
    });

    if (error.code === 404 || error.code === 403) {
      const errorDetails = error.response?.data?.error?.message || error.message;
      throw new Error(
        `파일 다운로드 실패: Google Drive 파일에 접근할 수 없습니다. 파일 ID(${fileId})에 대한 권한을 확인해주세요. 오류: ${errorDetails}`
      );
    }

    throw new Error(`파일 다운로드 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
  }
}

/**
 * Google Drive 파일 정보를 가져옵니다.
 * @param fileId 파일 ID
 * @returns 파일 정보 (이름, MIME 타입 등)
 */
export async function getFileInfo(fileId: string): Promise<{ name: string; mimeType: string }> {
  const drive = getGoogleDriveClient();

  try {
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    return {
      name: fileInfo.data.name || 'unknown',
      mimeType: fileInfo.data.mimeType || 'application/octet-stream',
    };
  } catch (error: any) {
    console.error('Error getting file info:', {
      fileId,
      errorCode: error.code,
      errorMessage: error.message,
    });

    throw new Error(`파일 정보 조회 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
  }
}
