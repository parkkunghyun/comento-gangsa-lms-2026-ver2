'use client';

import { useState } from 'react';

export default function InstructorFeedbackPage() {
  const [educationDate, setEducationDate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [improvementText, setImprovementText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!improvementText.trim()) {
      setError('문의 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/instructor/improvement-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationDate: educationDate.trim(),
          companyName: companyName.trim(),
          improvementText: improvementText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '제출에 실패했습니다.');
      }
      setSuccess(true);
      setEducationDate('');
      setCompanyName('');
      setImprovementText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">코멘토에 문의하기</h1>
        <p className="mt-1.5 text-gray-600 text-[15px] leading-relaxed">
          교육 관련 문의나 불편 사항을 남겨 주시면, 담당자가 검토 후 회신·반영하겠습니다.
        </p>
      </div>

      {/* 작성 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80">
          <h2 className="text-base font-semibold text-gray-900">문의 작성</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            강사님 성함은 자동으로 기록되며, 교육일·기업명은 선택 입력입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="educationDate" className="block text-sm font-medium text-gray-700 mb-1.5">
                교육일
              </label>
              <input
                id="educationDate"
                type="date"
                value={educationDate}
                onChange={(e) => setEducationDate(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-gray-900 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-shadow"
              />
              <p className="mt-1 text-xs text-gray-400">해당하는 교육일이 있으면 선택해 주세요.</p>
            </div>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                기업명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="예: OO기업, OO대학교"
                className="block w-full px-3.5 py-2.5 text-gray-900 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-shadow"
              />
            </div>
          </div>

          <div>
            <label htmlFor="improvementText" className="block text-sm font-medium text-gray-700 mb-1.5">
              문의 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="improvementText"
              rows={6}
              value={improvementText}
              onChange={(e) => setImprovementText(e.target.value)}
              placeholder="문의 사항이나 개선 요청, 불편 사항 등을 자유롭게 적어 주세요."
              className="block w-full px-3.5 py-3 text-gray-900 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-y min-h-[140px] transition-shadow"
              required
            />
            <p className="mt-1.5 text-xs text-gray-400">
              여러 건이면 한 건씩 나누어 제출해 주셔도 됩니다.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-100">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-100">
              <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">제출되었습니다.</p>
                <p className="mt-0.5 text-xs text-green-700">담당자가 검토 후 회신·반영하겠습니다.</p>
              </div>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting || !improvementText.trim()}
              className="w-full sm:w-auto min-w-[140px] px-6 py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  제출 중...
                </span>
              ) : (
                '제출하기'
              )}
            </button>
          </div>
        </form>

        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            제출된 문의는 내부 검토 후 회신·서비스·교육 개선에 활용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
