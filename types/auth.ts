/**
 * 사용자 역할 타입
 */
export type UserRole = 'INSTRUCTOR' | 'EM';

/**
 * 인증된 사용자 정보
 */
export interface AuthUser {
  role: UserRole;
  name: string;
  email: string;
  // INSTRUCTOR인 경우에만 존재
  mobile?: string;
  fee?: string;
}

/**
 * JWT 토큰 페이로드
 */
export interface JWTPayload {
  role: UserRole;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
}



