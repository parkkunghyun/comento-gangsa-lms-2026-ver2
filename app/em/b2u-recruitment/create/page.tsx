'use client';

import { useState, useEffect } from 'react';

interface Instructor {
  name: string;
  email: string;
}

interface SuccessData {
  requestId: string;
  acceptLink: string;
  declineLink: string;
  educationDate: string;
  educationTitle: string;
  instructorName: string;
}

export default function B2URecruitmentCreatePage() {
  const [educationDate, setEducationDate] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [educationTitle, setEducationTitle] = useState('');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [messageTemplate, setMessageTemplate] = useState('');

  useEffect(() => {
    const loadInstructors = async () => {
      try {
        const response = await fetch('/api/em/instructors');
        if (response.ok) {
          const data = await response.json();
          setInstructors(data.instructors || []);
        }
      } catch (err) {
        console.error('Error loading instructors:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInstructors();
  }, []);

  const generateB2UTemplate = (data: SuccessData) => {
    return `멘토님 안녕하세요 🙂 코멘토 대학교육팀입니다.
아래 B2U 대학교육 건과 관련하여 멘토님께 강의 가능 여부를 여쭙고자 연락드립니다.
[교육 정보]
구분: B2U 대학교육
교육명: ${data.educationTitle}
교육일자: ${data.educationDate}
멘토: ${data.instructorName}

일정 확인 후, 아래 링크 중 해당되는 버튼을 눌러주시면 감사하겠습니다.
▶ 수락 링크 ${data.acceptLink}

▶ 거절 링크 ${data.declineLink}

수락해주시는 경우, 담당 매니저가 자세한 교육 안내를 위해 별도로 연락드릴 예정입니다.
(대학/기관 대상 사업 특성상 추가 서류를 요청드릴 수 있는 점 미리 안내드립니다.)
확인해주셔서 감사드리며, 궁금하신 점 있으시면 언제든 편하게 말씀 주세요.
감사합니다 🙏`;
  };

  const handleCreateTemplate = async () => {
    if (!educationDate.trim()) {
      setError('날짜를 선택해주세요.');
      return;
    }
    if (!instructorName.trim()) {
      setError('멘토를 선택해주세요.');
      return;
    }
    if (!educationTitle.trim()) {
      setError('대학교육 제목을 입력해주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/em/b2u-recruitment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationDate: educationDate.trim(),
          instructorName: instructorName.trim(),
          educationTitle: educationTitle.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '섭외 요청 생성에 실패했습니다.');
      }

      const successData: SuccessData = {
        requestId: data.requestId,
        acceptLink: data.acceptLink,
        declineLink: data.declineLink,
        educationDate: educationDate.trim(),
        educationTitle: educationTitle.trim(),
        instructorName: instructorName.trim(),
      };
      setSuccess(successData);
      setMessageTemplate(generateB2UTemplate(successData));

      setEducationDate('');
      setInstructorName('');
      setEducationTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '섭외 요청 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(messageTemplate);
    alert('카톡 메시지가 복사되었습니다!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">B2U 섭외요청</h1>
            <p className="text-gray-600 text-sm">날짜·멘토·대학교육 제목을 입력하고 템플릿 생성을 누르면 섭외요청이 생성됩니다.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">섭외 정보 입력</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
            <input
              type="date"
              value={educationDate}
              onChange={(e) => setEducationDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">멘토명</label>
            <select
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all appearance-none bg-white cursor-pointer disabled:opacity-60"
            >
              <option value="">선택하세요</option>
              {instructors.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">대학교육 제목</label>
            <input
              type="text"
              value={educationTitle}
              onChange={(e) => setEducationTitle(e.target.value)}
              placeholder="예: 2025년 1학기 진로특강"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
            />
          </div>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>
        )}
        <div className="mt-6">
          <button
            onClick={handleCreateTemplate}
            disabled={creating || loading}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                생성 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                템플릿 생성
              </>
            )}
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-white border border-gray-200/60 rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">섭외 요청이 생성되었습니다</h3>
                <p className="text-sm text-gray-600">카톡 메시지를 복사하여 전송하세요</p>
              </div>
            </div>
            <button
              onClick={handleCopyTemplate}
              className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              전체 메시지 복사
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    카톡 메시지 템플릿
                  </label>
                  <button
                    onClick={handleCopyTemplate}
                    className="text-sm text-gray-700 hover:text-gray-900 font-semibold flex items-center gap-1"
                  >
                    복사
                  </button>
                </div>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={18}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm font-mono whitespace-pre-wrap resize-none bg-white focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                  placeholder="템플릿 생성 후 여기서 내용을 수정할 수 있습니다."
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-bold text-gray-900 mb-5">요청 정보</h4>
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">요청 ID</p>
                  <p className="text-sm font-mono font-semibold text-gray-900 bg-white px-4 py-3 rounded-lg border border-gray-200">{success.requestId}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">교육일</p>
                  <p className="text-sm font-medium text-gray-900">{success.educationDate}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">대학교육 제목</p>
                  <p className="text-sm font-medium text-gray-900">{success.educationTitle}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">멘토</p>
                  <p className="text-sm font-medium text-gray-900">{success.instructorName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
