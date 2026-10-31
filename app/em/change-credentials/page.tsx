'use client';

import { useState, useEffect } from 'react';

interface MeUser {
  name: string;
  email: string;
}

export default function EMChangeCredentialsPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!newPassword.trim()) {
      setMessage({ type: 'error', text: '새 비밀번호를 입력해 주세요.' });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/em/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newId: newId.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '변경에 실패했습니다.' });
        return;
      }
      setMessage({ type: 'success', text: '아이디/비밀번호가 변경되었습니다. 다음 로그인부터 새 정보를 사용해 주세요.' });
      setCurrentPassword('');
      setNewId('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">아이디/비밀번호 변경</h2>
      <p className="text-sm text-gray-500 mb-6">로그인에 사용하는 아이디와 비밀번호를 변경합니다.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* 계정 정보 */}
        {user && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
            <h3 className="text-sm font-medium text-gray-700 mb-3">현재 로그인 계정</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-500">이름</dt>
              <dd className="text-gray-900 font-medium">{user.name}</dd>
              <dt className="text-gray-500">이메일</dt>
              <dd className="text-gray-900">{user.email}</dd>
            </dl>
          </div>
        )}

        {/* 변경 입력 */}
        <form onSubmit={handleSubmit} className="p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">변경할 정보 입력</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm text-gray-600 mb-1.5">
                현재 비밀번호 <span className="text-gray-400">(필수)</span>
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                placeholder="현재 비밀번호 입력"
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="newId" className="block text-sm text-gray-600 mb-1.5">
                새 아이디 <span className="text-gray-400">(필수)</span>
              </label>
              <input
                id="newId"
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                placeholder="변경할 아이디 입력"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm text-gray-600 mb-1.5">
                새 비밀번호 <span className="text-gray-400">(필수)</span>
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                placeholder="변경할 비밀번호 입력"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="newPasswordConfirm" className="block text-sm text-gray-600 mb-1.5">
                새 비밀번호 확인 <span className="text-gray-400">(필수)</span>
              </label>
              <input
                id="newPasswordConfirm"
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                placeholder="새 비밀번호 다시 입력"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {message && (
            <div
              className={`mt-4 px-4 py-3 text-sm rounded-md ${
                message.type === 'success'
                  ? 'bg-gray-100 text-gray-800 border border-gray-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              변경 후에는 새 아이디·비밀번호로만 로그인할 수 있습니다.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 px-5 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? '처리 중...' : '변경 적용'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
