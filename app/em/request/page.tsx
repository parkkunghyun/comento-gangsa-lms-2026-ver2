'use client';

import { useState, useEffect } from 'react';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    instructorName?: string;
  }>;
  location?: string;
}

interface EventItem {
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  instructors: string[];
}

export default function EMRequestPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestLink, setRequestLink] = useState<string | null>(null);

  // 현재 월의 첫 날과 마지막 날 계산
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 일정 로드
  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const timeMin = startOfMonth.toISOString();
        const timeMax = endOfMonth.toISOString();

        const response = await fetch(
          `/api/em/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
        );

        if (!response.ok) {
          throw new Error('일정을 불러올 수 없습니다.');
        }

        const data = await response.json();
        const calendarEvents: CalendarEvent[] = data.events || [];

        // CalendarEvent를 EventItem으로 변환
        const eventItems: EventItem[] = calendarEvents.map((event) => {
          const startDate = event.start.dateTime 
            ? new Date(event.start.dateTime)
            : event.start.date 
            ? new Date(event.start.date)
            : new Date();

          const endDate = event.end.dateTime
            ? new Date(event.end.dateTime)
            : event.end.date
            ? new Date(event.end.date)
            : new Date();

          const date = startDate.toISOString().split('T')[0];

          const formatTime = (date: Date) => {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
          };

          const startTime = formatTime(startDate);
          const endTime = formatTime(endDate);

          const instructors = (event.attendees || [])
            .filter((attendee) => attendee.instructorName)
            .map((attendee) => attendee.instructorName!)
            .filter((name): name is string => !!name);

          return {
            eventId: event.id,
            title: event.summary || '제목 없음',
            date,
            startTime,
            endTime,
            instructors,
          };
        });

        setEvents(eventItems);
      } catch (err) {
        console.error('Error loading events:', err);
        setError(err instanceof Error ? err.message : '일정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [year, month]);

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 특정 날짜의 일정 가져오기
  const getEventsForDate = (date: Date): EventItem[] => {
    const dateStr = formatDateString(date);
    return events.filter((event) => event.date === dateStr);
  };

  // 캘린더 그리드 생성
  const getCalendarDays = () => {
    const days: (Date | null)[] = [];
    const startDate = new Date(year, month, 1);
    const dayOfWeek = startDate.getDay();

    // 이전 달의 마지막 날들
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push(date);
    }

    // 현재 달의 날들
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // 다음 달의 첫 날들 (캘린더를 6주로 채우기 위해)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 체크박스 선택/해제
  const handleToggleEvent = (eventId: string) => {
    const newSelected = new Set(selectedEventIds);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEventIds(newSelected);
    setError(null);
    setRequestLink(null);
  };

  // 선택된 일정 중 강사 미확정 일정 개수
  const getUnconfirmedCount = () => {
    return Array.from(selectedEventIds).filter((eventId) => {
      const event = events.find((e) => e.eventId === eventId);
      return event && event.instructors.length === 0;
    }).length;
  };

  // 선택된 일정 중 모두 강사 확정인지 확인
  const areAllConfirmed = () => {
    if (selectedEventIds.size === 0) return true;
    return Array.from(selectedEventIds).every((eventId) => {
      const event = events.find((e) => e.eventId === eventId);
      return event && event.instructors.length > 0;
    });
  };

  // 섭외 요청 생성
  const handleCreateRequest = async () => {
    const unconfirmedCount = getUnconfirmedCount();
    
    if (unconfirmedCount === 0) {
      setError('이미 강사가 확정된 일정입니다.');
      return;
    }

    if (selectedEventIds.size === 0) {
      setError('일정을 선택해주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    setRequestLink(null);

    try {
      const response = await fetch('/api/em/recruitment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventIds: Array.from(selectedEventIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '섭외 요청 생성에 실패했습니다.');
      }

      // 링크 생성
      const link = `https://script.google.com/macros/s/AKfycbyHlIXYU3xALlZ1KtHwCO5BXuEujEoZiVPcyAZJ3NkI1pZF8h5N7BRBsOBJ8R6Y-5Nv/exec?requestId=${data.requestId}`;
      setRequestLink(link);

      // 선택된 일정만 초기화 (날짜 선택은 유지)
      setSelectedEventIds(new Set());
    } catch (err) {
      console.error('Error creating request:', err);
      setError(err instanceof Error ? err.message : '섭외 요청 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const unconfirmedCount = getUnconfirmedCount();
  const canCreateRequest = selectedEventIds.size > 0 && unconfirmedCount > 0;

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">새 섭외 요청</h2>
        <p className="text-gray-600">캘린더에서 날짜를 선택하여 강사 미확정 일정의 섭외 요청을 생성할 수 있습니다.</p>
      </div>

      <div className="flex gap-6">
        {/* 캘린더 */}
        <div className="flex-[2] max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">기업교육 일정 캘린더</h3>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h4 className="text-lg font-semibold text-gray-900">
                {year}년 {month + 1}월
              </h4>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">로딩 중...</div>
          ) : (
            <>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-sm font-medium py-2 ${
                      index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 캘린더 그리드 */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, index) => {
                  if (!date) return null;

                  const isCurrentMonth = date.getMonth() === month;
                  const isToday =
                    date.toDateString() === new Date().toDateString();
                  const isSelected =
                    selectedDate &&
                    date.toDateString() === selectedDate.toDateString();
                  const dateStr = formatDateString(date);
                  const dayEvents = events.filter((event) => event.date === dateStr);
                  const hasEvents = dayEvents.length > 0;
                  const hasUnconfirmed = dayEvents.some((e) => e.instructors.length === 0);

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`
                        aspect-square flex flex-col items-center justify-center
                        rounded-lg transition-all duration-200
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isToday && !isSelected && !hasEvents 
                          ? 'bg-blue-50 border-2 border-blue-400 font-semibold' 
                          : ''}
                        ${isSelected 
                          ? 'bg-blue-600 text-white shadow-md scale-105' 
                          : ''}
                        ${hasEvents && !isSelected && !isToday
                          ? 'bg-white hover:bg-gray-50' 
                          : ''}
                        ${!hasEvents && !isSelected && !isToday
                          ? 'hover:bg-gray-50' 
                          : ''}
                      `}
                    >
                      <span className={`text-sm font-medium ${isSelected ? 'text-white' : ''}`}>
                        {date.getDate()}
                      </span>
                      {hasEvents && (
                        <div className="flex gap-0.5 mt-1">
                          {hasUnconfirmed ? (
                            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-sm" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 선택된 날짜의 일정 목록 및 섭외 요청 생성 */}
        <div className="flex-1 min-w-[400px] bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {selectedDate ? (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                {formatDate(selectedDate)}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                선택한 날짜의 일정 ({selectedDateEvents.length}개)
              </p>

              {selectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">해당 날짜에 일정이 없습니다.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
                    {selectedDateEvents.map((event) => {
                      const isSelected = selectedEventIds.has(event.eventId);
                      const isUnconfirmed = event.instructors.length === 0;

                      return (
                        <div
                          key={event.eventId}
                          className={`border rounded-lg p-4 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEvent(event.eventId)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                              <div className="text-sm text-gray-600 mb-2">
                                {event.startTime} - {event.endTime}
                              </div>
                              {isUnconfirmed ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  강사 미확정
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {event.instructors.map((instructor, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                    >
                                      {instructor}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 선택 정보 및 버튼 */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        선택: {selectedEventIds.size}개 / 강사 미확정: {unconfirmedCount}개
                      </div>
                    </div>

                    {areAllConfirmed() && selectedEventIds.size > 0 && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        이미 강사가 확정된 일정입니다.
                      </div>
                    )}

                    <button
                      onClick={handleCreateRequest}
                      disabled={!canCreateRequest || creating}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? '생성 중...' : '강사 섭외 요청 생성'}
                    </button>

                    {/* 생성된 링크 표시 */}
                    {requestLink && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm font-medium text-green-800 mb-2">
                          섭외 요청이 생성되었습니다!
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={requestLink}
                            readOnly
                            className="flex-1 px-3 py-2 border border-green-300 rounded-md bg-white text-sm"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(requestLink);
                              alert('링크가 복사되었습니다.');
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                          >
                            복사
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                        {error}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7 19l-4-2 2-4M14 2l4 4M3 7l4 4" />
              </svg>
              <p className="text-sm">캘린더에서 날짜를 선택하면 해당 날짜의 일정을 볼 수 있습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
