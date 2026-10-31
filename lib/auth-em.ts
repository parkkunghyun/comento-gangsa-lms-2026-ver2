import { findEMByIdAndPassword } from './google-sheets';

/**
 * EM 로그인 정보를 검증합니다 (아이디 + 비밀번호).
 * Google Sheets의 EM로그인 시트에서 정보를 조회합니다.
 * @param emId EM 아이디
 * @param password 비밀번호
 * @returns EM 정보 또는 null
 */
export async function verifyEMCredentials(
  emId: string,
  password: string
): Promise<{ email: string; name: string } | null> {
  return await findEMByIdAndPassword(emId, password);
}



