'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPinPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [newPinCode, setNewPinCode] = useState('');
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // 핀코드 재설정
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !newPinCode || !confirmPinCode) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (newPinCode !== confirmPinCode) {
      setError('새 핀코드가 일치하지 않습니다.');
      return;
    }

    if (newPinCode.length < 4 || newPinCode.length > 10) {
      setError('핀코드는 4자 이상 10자 이하여야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/instructor/reset-pin-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, newPinCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '핀코드 재설정에 실패했습니다.');
      }

      // 성공 시 로그인 페이지로 이동
      alert('핀코드가 성공적으로 변경되었습니다.');
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '핀코드 재설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 헤더 */}
          <div className="px-8 pt-10 pb-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
                핀코드 재설정
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                이메일과 새 핀코드를 입력하세요
              </p>
            </div>
          </div>

          {/* 폼 */}
          <form className="px-8 pb-10" onSubmit={handleResetPin}>
            <div className="space-y-5">
              {/* 이메일 입력 */}
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

              {/* 새 핀코드 입력 */}
              <div>
                <label
                  htmlFor="newPinCode"
                  className={`block text-sm font-medium mb-2 transition-colors ${
                    focusedField === 'newPinCode'
                      ? 'text-gray-900'
                      : 'text-gray-700'
                  }`}
                >
                  새 핀코드
                </label>
                <div className="relative">
                  <input
                    id="newPinCode"
                    name="newPinCode"
                    type="password"
                    required
                    value={newPinCode}
                    onChange={(e) => setNewPinCode(e.target.value)}
                    onFocus={() => setFocusedField('newPinCode')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                      focusedField === 'newPinCode'
                        ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                        : 'border-gray-300 focus:border-gray-900'
                    }`}
                    placeholder="새 핀코드를 입력하세요 (4-10자)"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* 핀코드 확인 */}
              <div>
                <label
                  htmlFor="confirmPinCode"
                  className={`block text-sm font-medium mb-2 transition-colors ${
                    focusedField === 'confirmPinCode'
                      ? 'text-gray-900'
                      : 'text-gray-700'
                  }`}
                >
                  핀코드 확인
                </label>
                <div className="relative">
                  <input
                    id="confirmPinCode"
                    name="confirmPinCode"
                    type="password"
                    required
                    value={confirmPinCode}
                    onChange={(e) => setConfirmPinCode(e.target.value)}
                    onFocus={() => setFocusedField('confirmPinCode')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none ${
                      focusedField === 'confirmPinCode'
                        ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-20'
                        : 'border-gray-300 focus:border-gray-900'
                    }`}
                    placeholder="핀코드를 다시 입력하세요"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* 버튼 */}
            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-800 active:scale-[0.98] shadow-lg hover:shadow-xl'
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
                    핀코드 변경 중...
                  </span>
                ) : (
                  '핀코드 변경'
                )}
              </button>
              <a
                href="/login"
                className="block text-center text-sm text-gray-600 hover:text-gray-900 underline"
              >
                로그인으로 돌아가기
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
