'use client';

import { useState, useEffect } from 'react';

interface RecruitmentRequest {
  requestId: string;
  companyName: string;
  educationName: string;
  educationDate: string;
  instructorName: string;
  status: string;
  responseDate: string;
  declineReason: string;
  rowIndex: number; // 시트의 행 인덱스 (0-based, 헤더 제외)
}

export default function RecruitmentResponsePage() {
  const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'ACCEPTED' | 'CANCELLED'>('ALL');
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 섭외 요청 목록 로드
  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/em/recruitment-requests');
      if (!response.ok) {
        throw new Error('섭외 요청 목록을 불러올 수 없습니다.');
      }
      const data = await response.json();
      
      // 시트 구조에 맞게 매핑: 요청ID | 기업명 | 교육명 | 교육일 | 멘토명 | 상태 | 응답일 | 거절사유
      // rowIndex는 시트의 실제 행 번호 (0-based, 헤더 제외)
      const mappedRequests: RecruitmentRequest[] = (data.requests || []).map((req: any, index: number) => ({
        requestId: req.requestId || '',
        companyName: req.educationName ? req.educationName.split(']')[0].replace('[', '') : '',
        educationName: req.educationName || '',
        educationDate: req.educationDate || '',
        instructorName: req.instructorName || '',
        status: req.result || 'REQUESTED',
        responseDate: req.responseDateTime || '',
        declineReason: req.declineReason || '',
        rowIndex: index, // 0-based, 헤더 제외
      }));
      
      setRequests(mappedRequests);
    } catch (err) {
      console.error('Error loading requests:', err);
      setError(err instanceof Error ? err.message : '섭외 요청 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // 필터링된 요청 목록
  const filteredRequests = requests.filter((request) => {
    if (filter === 'ALL') return true;
    if (filter === 'APPROVED') return request.status === 'APPROVED' || request.status === 'ACCEPTED';
    return request.status === filter;
  });

  // 승인된 요청 개수
  const approvedCount = requests.filter((r) => r.status === 'APPROVED' || r.status === 'ACCEPTED').length;

  // 새로고침 처리
  const handleRefresh = async () => {
    setProcessing(true);
    setProcessMessage(null);
    setError(null);

    try {
      // 먼저 승인된 요청 처리 시도 (실패해도 무시)
      try {
        const response = await fetch('/api/em/recruitment/process-approved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProcessMessage(data.message || `${data.updatedCount}개의 일정이 업데이트되었습니다.`);
        }
      } catch (err) {
        // API 호출 실패는 무시하고 계속 진행
        console.log('Process approved request failed (ignored):', err);
      }

      // 데이터 새로고침
      await loadRequests();
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('데이터를 새로고침하는 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 셀 편집 시작
  const handleCellClick = (rowIndex: number, columnIndex: number, currentValue: string) => {
    // 요청ID는 편집 불가
    if (columnIndex === 0) return;
    
    setEditingCell({ rowIndex, columnIndex });
    setEditValue(currentValue);
  };

  // 셀 편집 취소
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // 셀 편집 저장
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const response = await fetch('/api/em/recruitment-requests/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: editingCell.rowIndex,
          columnIndex: editingCell.columnIndex,
          value: editValue,
        }),
      });

      if (!response.ok) {
        throw new Error('데이터 업데이트에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      const updatedRequests = [...requests];
      const request = updatedRequests[editingCell.rowIndex];
      
      // 컬럼 인덱스에 따라 해당 필드 업데이트
      switch (editingCell.columnIndex) {
        case 1: // 기업명
          request.companyName = editValue;
          break;
        case 2: // 교육명
          request.educationName = editValue;
          break;
        case 3: // 교육일
          request.educationDate = editValue;
          break;
        case 4: // 멘토명
          request.instructorName = editValue;
          break;
        case 5: // 상태
          request.status = editValue.toUpperCase();
          break;
        case 6: // 응답일
          request.responseDate = editValue;
          break;
        case 7: // 거절사유
          request.declineReason = editValue;
          break;
      }
      
      setRequests(updatedRequests);
      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      console.error('Error updating cell:', err);
      setError(err instanceof Error ? err.message : '데이터 업데이트 중 오류가 발생했습니다.');
    }
  };

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toUpperCase();
    switch (normalizedStatus) {
      case 'REQUESTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 상태 한글명
  const getStatusLabel = (status: string) => {
    const normalizedStatus = status.toUpperCase();
    switch (normalizedStatus) {
      case 'REQUESTED':
        return '요청됨';
      case 'APPROVED':
      case 'ACCEPTED':
        return '수락';
      case 'DECLINED':
        return '거절';
      case 'CANCELLED':
        return '취소';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">섭외 응답 관리</h2>
        <p className="text-gray-600">외부강사_섭외_로그 시트를 직접 확인하고 수정할 수 있습니다.</p>
        <a
          href="https://docs.google.com/spreadsheets/d/1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0/edit?gid=1645089402#gid=1645089402"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          📊 Google Sheets에서 열기
        </a>
      </div>

      {/* 필터 및 액션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">상태 필터:</span>
            {(['ALL', 'REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'ALL' ? '전체' : getStatusLabel(status)}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                새로고침 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                새로고침
                {approvedCount > 0 && ` (승인 ${approvedCount}건)`}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 처리 결과 메시지 */}
      {processMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
          {processMessage}
        </div>
      )}

      {/* 편집 가능한 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">섭외 요청이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    요청ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    기업명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    교육명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    교육일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    멘토명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    응답일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    거절사유
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr key={`${request.requestId}-${request.rowIndex}`} className="hover:bg-gray-50">
                    {/* 요청ID - 편집 불가 */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 bg-gray-50">
                      {request.requestId}
                    </td>
                    
                    {/* 기업명 - 편집 가능 */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 1, request.companyName)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 1 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.companyName || '-'
                      )}
                    </td>
                    
                    {/* 교육명 - 편집 가능 */}
                    <td
                      className="px-4 py-3 text-sm text-gray-900 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 2, request.educationName)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 2 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.educationName || '-'
                      )}
                    </td>
                    
                    {/* 교육일 - 편집 가능 */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 3, request.educationDate)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 3 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.educationDate || '-'
                      )}
                    </td>
                    
                    {/* 멘토명 - 편집 가능 */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 4, request.instructorName)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 4 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.instructorName || '-'
                      )}
                    </td>
                    
                    {/* 상태 - 편집 가능 */}
                    <td
                      className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 5, request.status)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 5 ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        >
                          <option value="REQUESTED">요청됨</option>
                          <option value="APPROVED">수락</option>
                          <option value="ACCEPTED">수락</option>
                          <option value="DECLINED">거절</option>
                          <option value="CANCELLED">취소</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      )}
                    </td>
                    
                    {/* 응답일 - 편집 가능 */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 6, request.responseDate)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 6 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.responseDate || '-'
                      )}
                    </td>
                    
                    {/* 거절사유 - 편집 가능 */}
                    <td
                      className="px-4 py-3 text-sm text-gray-600 cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(request.rowIndex, 7, request.declineReason)}
                    >
                      {editingCell?.rowIndex === request.rowIndex && editingCell?.columnIndex === 7 ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        request.declineReason || '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
