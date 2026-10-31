'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<'instructor' | 'em'>('instructor');
  const [name, setName] = useState('');
  const [emId, setEmId] = useState('');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: loginType === 'em' ? undefined : name,
          emId: loginType === 'em' ? emId : undefined,
          email: loginType === 'instructor' ? email : undefined,
          pinCode: pinCode || undefined,
          role: loginType === 'em' ? 'EM' : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 로그인 성공 - 역할에 따라 리다이렉트
      if (data.role === 'INSTRUCTOR') {
        router.push('/instructor');
      } else if (data.role === 'EM') {
        router.push('/em');
      }
    } catch (err) {
      setError('로그인 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 overflow-hidden">
          {/* 헤더 */}
          <div className="px-8 pt-10 pb-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
                강사 ADMIN
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                로그인 유형을 선택하세요
              </p>
            </div>
          </div>

          {/* 로그인 유형 선택 */}
          <div className="px-8 pb-6">
            <div className="relative bg-gray-100 rounded-lg p-1 inline-flex w-full">
              <div
                className={`absolute top-1 bottom-1 w-1/2 rounded-md bg-white shadow-sm transition-all duration-300 ease-out ${
                  loginType === 'em' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setLoginType('instructor');
                  setError('');
                  setEmId('');
                }}
                className={`relative flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${
                  loginType === 'instructor'
                    ? 'text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                강사 로그인
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType('em');
                  setError('');
                  setName('');
                }}
                className={`relative flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${
                  loginType === 'em'
                    ? 'text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                EM 로그인
              </button>
            </div>
          </div>

          {/* 폼 */}
          <form className="px-8 pb-10" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* EM 로그인: 아이디 입력 */}
              {loginType === 'em' && (
                <div>
                  <label
                    htmlFor="emId"
                    className={`block text-sm font-medium mb-2 transition-colors ${
                      focusedField === 'emId'
                        ? 'text-gray-900'
                        : 'text-gray-700'
                    }`}
                  >
                    아이디
                  </label>
                  <div className="relative">
                    <input
                      id="emId"
                      name="emId"
                      type="text"
                      required
                      value={emId}
                      onChange={(e) => setEmId(e.target.value)}
                      onFocus={() => setFocusedField('emId')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                        focusedField === 'emId'
                          ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                          : 'border-gray-300 focus:border-gray-900'
                      }`}
                      placeholder="예) comento 또는 이창환"
                    />
                  </div>
                </div>
              )}

              {/* EM 로그인: 비밀번호 입력 */}
              {loginType === 'em' && (
                <div>
                  <label
                    htmlFor="pinCode"
                    className={`block text-sm font-medium mb-2 transition-colors ${
                      focusedField === 'pinCode'
                        ? 'text-gray-900'
                        : 'text-gray-700'
                    }`}
                  >
                    비밀번호
                  </label>
                  <div className="relative">
                    <input
                      id="pinCode"
                      name="pinCode"
                      type="password"
                      required
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      onFocus={() => setFocusedField('pinCode')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                        focusedField === 'pinCode'
                          ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                          : 'border-gray-300 focus:border-gray-900'
                      }`}
                      placeholder="비밀번호를 입력하세요"
                      maxLength={50}
                    />
                  </div>
                </div>
              )}

              {/* 강사 로그인: 이메일 입력 */}
              {loginType === 'instructor' && (
                <div>
                  <label
                    htmlFor="email"
                    className={`block text-sm font-medium mb-2 transition-colors ${
                      focusedField === 'email'
                        ? 'text-gray-900'
                        : 'text-gray-700'
                    }`}
                  >
                    이메일
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                        focusedField === 'email'
                          ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                          : 'border-gray-300 focus:border-gray-900'
                      }`}
                      placeholder="yubin@comento.co.kr"
                    />
                  </div>
                </div>
              )}

              {/* 강사 로그인: 핀코드 입력 */}
              {loginType === 'instructor' && (
                <div>
                  <label
                    htmlFor="pinCode"
                    className={`block text-sm font-medium mb-2 transition-colors ${
                      focusedField === 'pinCode'
                        ? 'text-gray-900'
                        : 'text-gray-700'
                    }`}
                  >
                    핀코드
                  </label>
                  <div className="relative">
                    <input
                      id="pinCode"
                      name="pinCode"
                      type="password"
                      required
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      onFocus={() => setFocusedField('pinCode')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                        focusedField === 'pinCode'
                          ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                          : 'border-gray-300 focus:border-gray-900'
                      }`}
                      placeholder="핀코드를 입력하세요"
                      maxLength={10}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className={`mt-6 w-full py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 text-white hover:bg-gray-700 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
