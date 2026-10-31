// 인증 코드 저장 (실제로는 Redis나 DB를 사용해야 함)
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 인증 코드 생성
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 인증 코드 저장
export function setVerificationCode(email: string, code: string, expiresInMinutes: number = 10): void {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  verificationCodes.set(email.toLowerCase(), { code, expiresAt });
}

// 인증 코드 조회
export function getVerificationCode(email: string): string | null {
  const stored = verificationCodes.get(email.toLowerCase());
  if (!stored || Date.now() > stored.expiresAt) {
    verificationCodes.delete(email.toLowerCase());
    return null;
  }
  return stored.code;
}

// 인증 코드 삭제
export function deleteVerificationCode(email: string): void {
  verificationCodes.delete(email.toLowerCase());
}
