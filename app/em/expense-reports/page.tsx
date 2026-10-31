'use client';

import { useState, useEffect } from 'react';

interface Instructor {
  email: string;
  name: string;
  months: string[];
  totalReports: number;
}

interface ExpenseReport {
  email: string;
  name: string;
  month: string;
  uploadDate: string;
  fileName: string;
  fileId: string;
  webViewLink: string;
  type: string;
}

export default function EMExpenseReportsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [reportsByInstructor, setReportsByInstructor] = useState<Record<string, Record<string, ExpenseReport[]>>>({});
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/em/expense-reports');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '지출결의서를 불러오는데 실패했습니다.');
      }

      setInstructors(data.instructors || []);
      setReportsByInstructor(data.reportsByInstructor || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/em/expense-reports/download?fileId=${fileId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : '다운로드 중 오류가 발생했습니다.');
    }
  };

  const selectedInstructorData = selectedInstructor ? instructors.find((i) => i.email === selectedInstructor) : null;
  const selectedMonthReports = selectedInstructor && selectedMonth
    ? reportsByInstructor[selectedInstructor]?.[selectedMonth] || []
    : [];

  // 모든 파일을 타입별로 분류
  const excelFiles = selectedMonthReports.filter((r) => r.type === 'excel');
  const zipFiles = selectedMonthReports.filter((r) => r.type === 'zip');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          <div className="text-gray-600">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지출결의서 관리</h1>
          <p className="text-sm text-gray-500 mt-1">강사별 지출결의서를 조회하고 다운로드할 수 있습니다</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 강사 목록 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">강사 목록</h2>
            {instructors.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">등록된 지출결의서가 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {instructors.map((instructor) => (
                  <button
                    key={instructor.email}
                    onClick={() => {
                      setSelectedInstructor(instructor.email);
                      setSelectedMonth(instructor.months[0] || null);
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedInstructor === instructor.email
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{instructor.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{instructor.email}</p>
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-sm font-semibold text-gray-700">{instructor.totalReports}</p>
                        <p className="text-xs text-gray-500">건</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-gray-500">{instructor.months.length}개월</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 월별 상세 정보 */}
        <div className="lg:col-span-2">
          {selectedInstructorData ? (
            <div className="space-y-6">
              {/* 월 선택 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedInstructorData.name} - 월별 선택
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedInstructorData.months.map((month) => {
                    const monthReports =
                      reportsByInstructor[selectedInstructorData.email]?.[month] || [];
                    const hasFiles = monthReports.length > 0;
                    
                    return (
                      <button
                        key={month}
                        onClick={() => setSelectedMonth(month)}
                        className={`p-4 rounded-lg border-2 transition-all text-center ${
                          selectedMonth === month
                            ? 'border-gray-400 bg-gray-100 text-gray-900 font-semibold'
                            : hasFiles
                            ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 text-gray-400'
                        }`}
                      >
                        <p className="font-semibold">{month}</p>
                        <p className="text-xs mt-1">
                          {hasFiles ? `${monthReports.length}개 파일` : '없음'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 파일 다운로드 */}
              {selectedMonth && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {selectedMonth} 지출결의서
                  </h3>
                  
                  {selectedMonthReports.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      해당 월의 지출결의서가 없습니다
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* 엑셀 파일들 */}
                      {excelFiles.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">지출결의서 엑셀 파일</h4>
                          <div className="space-y-3">
                            {excelFiles.map((excelFile, index) => (
                              <div key={index} className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-gray-50/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">지출결의서 엑셀</p>
                                      <p className="text-sm text-gray-500">{excelFile.fileName}</p>
                                      <p className="text-xs text-gray-400 mt-1">업로드일: {excelFile.uploadDate}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={excelFile.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      미리보기
                                    </a>
                                    <button
                                      onClick={() => handleDownload(excelFile.fileId, excelFile.fileName)}
                                      className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                      다운로드
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 압축 파일들 */}
                      {zipFiles.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">영수증 이미지 압축 파일</h4>
                          <div className="space-y-3">
                            {zipFiles.map((zipFile, index) => (
                              <div key={index} className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-gray-50/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">영수증 이미지 압축 파일</p>
                                      <p className="text-sm text-gray-500">{zipFile.fileName}</p>
                                      <p className="text-xs text-gray-400 mt-1">업로드일: {zipFile.uploadDate}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={zipFile.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      미리보기
                                    </a>
                                    <button
                                      onClick={() => handleDownload(zipFile.fileId, zipFile.fileName)}
                                      className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                      다운로드
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 파일이 하나도 없는 경우 (데이터는 있지만 타입이 다른 경우) */}
                      {excelFiles.length === 0 && zipFiles.length === 0 && selectedMonthReports.length > 0 && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            파일이 있지만 표시할 수 없습니다. (타입: {selectedMonthReports.map(r => r.type).join(', ')})
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">왼쪽에서 강사를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
