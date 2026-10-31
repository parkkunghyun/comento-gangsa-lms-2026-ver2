'use client';

const EXPENSE_REPORT_TYPEFORM_URL = 'https://comento.typeform.com/to/oj8MSYt8';

export default function InstructorExpenseReportPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">지출결의서 작성</h1>
        <p className="text-sm text-gray-500 mt-1">
          대학/기업교육 지출결의서를 타입폼에서 작성·제출할 수 있습니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-4">
          <p className="text-gray-600 mb-1">버튼을 누르면 지출결의서 제출 페이지(타입폼)로 이동합니다.</p>
          <p className="text-gray-600 mb-6">지출결의서 작성 후 제출 부탁드립니다.</p>
          <a
            href={EXPENSE_REPORT_TYPEFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
          >
            지출결의서 작성하기
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
