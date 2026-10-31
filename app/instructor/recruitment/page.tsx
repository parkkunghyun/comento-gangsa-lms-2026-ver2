'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InstructorRecruitmentPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleComplete = async () => {
    if (!projectName.trim()) {
      setError('프로젝트명을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/instructor/recruitment/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '섭외 완료 기록에 실패했습니다.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/instructor');
      }, 2000);
    } catch (err) {
      console.error('Error completing recruitment:', err);
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-green-600 text-xl font-semibold mb-2">
            섭외 완료가 기록되었습니다!
          </div>
          <p className="text-gray-600">잠시 후 메인 페이지로 이동합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">섭외 완료</h2>
        <p className="text-gray-600 mb-6">
          섭외 요청을 수락하셨다면 아래 버튼을 눌러 섭외 완료를 기록해주세요.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트/클래스명 (선택사항)
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="프로젝트명을 입력하세요"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : '섭외 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}


