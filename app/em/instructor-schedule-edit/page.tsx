'use client';

import { useState, useEffect, useMemo } from 'react';

interface Instructor {
  name: string;
  email: string;
}

interface PersonalEvent {
  rowIndex: number;
  summary: string;
  date: string;
  type: '강의 선호' | '강의 불가';
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  isPersonal?: boolean;
}

const formatDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const eventDateString = (event: CalendarEvent): string => {
  if (event.start.date) return event.start.date;
  if (event.start.dateTime) return formatDateString(new Date(event.start.dateTime));
  return '';
};

export default function EMInstructorScheduleEditPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [draftBlocked, setDraftBlocked] = useState<Set<string>>(new Set());
  const [educationEvents, setEducationEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetch('/api/em/instructors?includeInternal=true')
      .then((res) => res.json())
      .then((data) => setInstructors(data.instructors || []))
      .catch((err) => console.error('Error loading instructors:', err));
  }, []);

  const blockedEvents = useMemo(() => personalEvents.filter((e) => e.type === '강의 불가'), [personalEvents]);
  const savedBlocked = useMemo(() => new Set(blockedEvents.map((e) => e.date)), [blockedEvents]);
  const preferredDates = useMemo(
    () => new Set(personalEvents.filter((e) => e.type === '강의 선호').map((e) => e.date)),
    [personalEvents]
  );

  const educationByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of educationEvents) {
      if (event.isPersonal) continue;
      const key = eventDateString(event);
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), event]);
    }
    return map;
  }, [educationEvents]);

  const loadPersonalEvents = async (instructorEmail: string) => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/em/instructor-personal-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '일정을 불러오지 못했습니다.' });
        setPersonalEvents([]);
        setDraftBlocked(new Set());
        return;
      }
      const events: PersonalEvent[] = data.events || [];
      setPersonalEvents(events);
      setDraftBlocked(new Set(events.filter((e) => e.type === '강의 불가').map((e) => e.date)));
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!selectedInstructor) {
      setEducationEvents([]);
      return;
    }
    const timeMin = new Date(year, month, 1).toISOString();
    const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    fetch(
      `/api/em/instructor-calendar?instructorEmail=${encodeURIComponent(selectedInstructor)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
    )
      .then((res) => res.json())
      .then((data) => setEducationEvents(data.events || []))
      .catch((err) => console.error('Error loading instructor calendar:', err));
  }, [selectedInstructor, year, month]);

  const handleSelectInstructor = (email: string) => {
    setSelectedInstructor(email);
    setMessage(null);
    setPersonalEvents([]);
    setDraftBlocked(new Set());
    if (email) loadPersonalEvents(email);
  };

  const addDates = useMemo(
    () => Array.from(draftBlocked).filter((d) => !savedBlocked.has(d)).sort(),
    [draftBlocked, savedBlocked]
  );
  const removeEvents = useMemo(
    () => blockedEvents.filter((e) => !draftBlocked.has(e.date)),
    [blockedEvents, draftBlocked]
  );
  const hasChanges = addDates.length > 0 || removeEvents.length > 0;

  const toggleDate = (dateStr: string) => {
    const next = new Set(draftBlocked);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    setDraftBlocked(next);
  };

  const handleApply = async () => {
    if (!hasChanges) return;
    const instructorName = instructors.find((i) => i.email === selectedInstructor)?.name || '강사';
    const lines = [`${instructorName}님의 강의 불가 일정을 변경할까요?`];
    if (addDates.length > 0) lines.push(`- 불가 추가 ${addDates.length}건: ${addDates.join(', ')}`);
    if (removeEvents.length > 0) lines.push(`- 불가 해제 ${removeEvents.length}건: ${removeEvents.map((e) => e.date).join(', ')}`);
    if (!window.confirm(lines.join('\n'))) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/em/instructor-personal-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorEmail: selectedInstructor,
          addDates,
          removeEvents: removeEvents.map(({ rowIndex, summary, date }) => ({ rowIndex, summary, date })),
        }),
      });
      const data = await res.json();
      setMessage(
        res.ok
          ? { type: 'success', text: data.message || '적용되었습니다.' }
          : { type: 'error', text: data.error || '적용에 실패했습니다.' }
      );
      await loadPersonalEvents(selectedInstructor);
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    for (let i = firstDay.getDay() - 1; i >= 0; i--) days.push(new Date(year, month, -i));
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day));
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) days.push(new Date(year, month + 1, day));
    return days;
  }, [year, month]);

  const todayStr = formatDateString(new Date());
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">강사 일정 수정하기</h1>
        <p className="text-xs text-gray-500">
          강사를 선택하고 날짜를 눌러 강의 불가(X)를 체크하거나 해제한 뒤 확인을 누르면 적용됩니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3">
        <label className="block text-xs font-semibold text-gray-600 mb-2">강사 선택</label>
        <select
          value={selectedInstructor}
          onChange={(e) => handleSelectInstructor(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-300 focus:border-gray-400 bg-white cursor-pointer"
        >
          <option value="">강사를 선택하세요</option>
          {instructors.map((instructor) => (
            <option key={`${instructor.name}-${instructor.email}`} value={instructor.email}>
              {instructor.name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`px-4 py-3 text-sm rounded-md ${
            message.type === 'success'
              ? 'bg-gray-100 text-gray-800 border border-gray-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {selectedInstructor && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h4 className="text-lg font-semibold text-gray-900">
              {year}년 {month + 1}월
            </h4>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-700" /> 강의 불가
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> 강의 선호
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 기업교육 일정
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-dashed border-orange-400" /> 저장 전 변경
            </span>
          </div>

          {loadingEvents ? (
            <div className="py-16 text-center text-xs text-gray-500">일정 불러오는 중...</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {weekDays.map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-xs font-bold py-1.5 ${
                      index === 0 ? 'text-red-500' : index === 6 ? 'text-gray-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((date) => {
                  const dateStr = formatDateString(date);
                  const isCurrentMonth = date.getMonth() === month;
                  const isBlocked = draftBlocked.has(dateStr);
                  const isChanged = isBlocked !== savedBlocked.has(dateStr);
                  const isPreferred = preferredDates.has(dateStr);
                  const isToday = dateStr === todayStr;
                  const education = educationByDate.get(dateStr) || [];

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => isCurrentMonth && toggleDate(dateStr)}
                      disabled={!isCurrentMonth || saving}
                      title={education.map((e) => e.summary).join('\n') || undefined}
                      className={`
                        relative min-h-[72px] flex flex-col items-start p-1.5 rounded-lg text-left transition-all
                        ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${isCurrentMonth && isBlocked ? 'bg-gray-700 text-white' : ''}
                        ${isCurrentMonth && !isBlocked && isPreferred ? 'bg-emerald-50 border border-emerald-200 text-gray-800' : ''}
                        ${isCurrentMonth && !isBlocked && !isPreferred ? 'hover:bg-gray-50 text-gray-700 border border-gray-100' : ''}
                        ${isCurrentMonth && isChanged ? 'outline outline-2 outline-dashed outline-orange-400' : ''}
                        ${isToday && isCurrentMonth && !isBlocked ? 'font-bold' : ''}
                      `}
                    >
                      <span className="text-sm font-medium">{date.getDate()}</span>
                      {isCurrentMonth && education.length > 0 && (
                        <span className={`mt-auto flex items-center gap-1 text-[10px] ${isBlocked ? 'text-gray-200' : 'text-blue-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-gray-200' : 'bg-blue-500'}`} />
                          교육 {education.length}
                        </span>
                      )}
                      {isCurrentMonth && isBlocked && (
                        <svg
                          className="absolute top-1.5 right-1.5 w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              불가 추가 <span className="font-semibold text-gray-900">{addDates.length}건</span>
              <span className="mx-1.5 text-gray-300">|</span>
              불가 해제 <span className="font-semibold text-gray-900">{removeEvents.length}건</span>
            </p>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <button
                  type="button"
                  onClick={() => setDraftBlocked(new Set(savedBlocked))}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  되돌리기
                </button>
              )}
              <button
                type="button"
                onClick={handleApply}
                disabled={saving || !hasChanges}
                className="px-5 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? '적용 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
