'use client';

import { useState, useEffect, useMemo } from 'react';

interface FeedbackRow {
  educationDate: string;
  companyName: string;
  writtenAt: string;
  improvementText: string;
  mentorName: string;
}

const PREVIEW_LENGTH = 60;

export default function EMFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<FeedbackRow | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/em/feedback');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '피드백 목록을 불러올 수 없습니다.');
        setFeedback(data.feedback || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sortedFeedback = useMemo(() => {
    const list = [...feedback].sort((a, b) => {
      const da = a.writtenAt || a.educationDate || '';
      const db = b.writtenAt || b.educationDate || '';
      return db.localeCompare(da);
    });
    return list;
  }, [feedback]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">피드백 관리</h2>
        <p className="text-sm text-gray-500">
          강사별로 제출된 개선점(멘트)을 확인할 수 있습니다. 시트에 작성된 내용이 아래에 반영됩니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-4" />
            <p>피드백 목록을 불러오는 중입니다.</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-600 font-medium">{error}</div>
        ) : sortedFeedback.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            등록된 피드백이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    교육일
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    기업명
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    작성일
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    개선될 점
                  </th>
                  <th className="py-3 pl-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    멘토
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFeedback.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm text-gray-900 whitespace-nowrap">
                      {row.educationDate || '-'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-900 whitespace-nowrap">
                      {row.companyName || '-'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600 whitespace-nowrap">
                      {row.writtenAt || '-'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-900 max-w-[320px]">
                      <div className="line-clamp-2 text-gray-800">
                        {row.improvementText || '-'}
                      </div>
                      {(row.improvementText?.length ?? 0) > PREVIEW_LENGTH && (
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="mt-1 text-xs font-medium text-gray-500 hover:text-gray-800 underline"
                        >
                          전체 보기
                        </button>
                      )}
                    </td>
                    <td className="py-3 pl-4 text-sm font-medium text-gray-800 whitespace-nowrap">
                      {row.mentorName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 전체 보기 모달 */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetailRow(null)}
          role="dialog"
          aria-modal="true"
          aria-label="피드백 상세"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">개선될 점 상세</h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm border-b border-gray-100 bg-gray-50/80">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-gray-500">교육일</span>
                <span className="font-medium text-gray-900">{detailRow.educationDate || '-'}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-gray-500">기업명</span>
                <span className="font-medium text-gray-900">{detailRow.companyName || '-'}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-gray-500">작성일</span>
                <span className="font-medium text-gray-900">{detailRow.writtenAt || '-'}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-gray-500">멘토</span>
                <span className="font-medium text-gray-900">{detailRow.mentorName || '-'}</span>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                {detailRow.improvementText || '-'}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
