import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole, AuthUser, JWTPayload } from '@/types/auth';

const secretKey = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const encodedKey = new TextEncoder().encode(secretKey);

function tryGetCookieStore() {
  try {
    return cookies();
  } catch {
    // 빌드 시(static generation) 또는 요청 컨텍스트가 없는 경우 cookies()가 예외를 던질 수 있음
    return null;
  }
}

/**
 * JWT 토큰을 생성합니다.
 */
export async function createToken(user: AuthUser): Promise<string> {
  const token = await new SignJWT({
    role: user.role,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(encodedKey);

  return token;
}

/**
 * JWT 토큰을 검증하고 사용자 정보를 반환합니다.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 쿠키에서 인증 토큰을 가져옵니다.
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = tryGetCookieStore();
  const token = cookieStore?.get('auth-token');
  return token?.value || null;
}

/**
 * 현재 인증된 사용자 정보를 가져옵니다.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    role: payload.role,
    name: payload.name,
    email: payload.email,
  };
}

/**
 * 인증 토큰을 쿠키에 저장합니다.
 */
export async function setAuthToken(token: string) {
  const cookieStore = tryGetCookieStore();
  if (!cookieStore) return;

  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24시간
    path: '/',
  });
}

/**
 * 인증 토큰을 삭제합니다.
 */
export async function removeAuthToken() {
  const cookieStore = tryGetCookieStore();
  if (!cookieStore) return;
  cookieStore.delete('auth-token');
}



