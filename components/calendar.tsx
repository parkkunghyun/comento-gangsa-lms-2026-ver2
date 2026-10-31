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
    instructorName?: string; // 강사 이름 (이메일로 조회)
  }>;
  location?: string;
  isPersonal?: boolean; // 개인 일정 여부
}

interface CalendarProps {
  apiEndpoint: string; // '/api/instructor/calendar' 또는 '/api/em/calendar'
  title?: string; // 페이지 제목 (선택사항)
  personalEventDates?: string[]; // 강의 불가(개인 일정) 날짜 배열 (YYYY-MM-DD 형식)
  preferredEventDates?: string[]; // 강의 선호 날짜 배열 (YYYY-MM-DD 형식)
  educationEventDates?: string[]; // 교육 일정 날짜 배열 (YYYY-MM-DD 형식) - 강사별 캘린더용
  filteredEvents?: CalendarEvent[]; // 필터링된 이벤트 목록 (강사 선택 시 사용)
  variant?: 'default' | 'business'; // 색감/강조 방식
  /** true면 기업교육 일정만 표시 (강의 불가/선호 개인 일정 제외) - EM 전체 기업교육 일정용 */
  educationOnly?: boolean;
  /** true면 강사 본인 캘린더: 그리드에 강사 이름 숨김, 상세 패널은 캘린더 옆에 배치 */
  instructorView?: boolean;
  /** true면 날짜 셀에 강사명 대신 [기업명]만 표시 (EM에서 특정 강사 선택 시) */
  showCompanyLabelInCells?: boolean;
}

export default function Calendar({
  apiEndpoint,
  title,
  personalEventDates = [],
  preferredEventDates = [],
  educationEventDates = [],
  filteredEvents,
  variant = 'default',
  educationOnly = false,
  instructorView = false,
  showCompanyLabelInCells = false,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (filteredEvents) {
      setEvents(filteredEvents);
      setLoading(false);
      return;
    }

    const loadEvents = async () => {
      setLoading(true);
      try {
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
        const timeMin = startOfMonth.toISOString();
        const timeMax = endOfMonth.toISOString();

        const separator = apiEndpoint.includes('?') ? '&' : '?';
        const response = await fetch(
          `${apiEndpoint}${separator}timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[캘린더] API 오류:', errorText);
          throw new Error('일정을 불러올 수 없습니다.');
        }

        const data = await response.json();
        const allEvents = data.events || [];
        const isPersonalEvent = (e: any) =>
          e.isPersonal ||
          e.id?.startsWith('personal-') ||
          e.description === '개인 일정' ||
          e.description === '강의 불가' ||
          e.description === '강의 선호';

        const educationEvents = allEvents.filter((e: any) => !isPersonalEvent(e));
        setEvents(educationOnly ? educationEvents : allEvents);
      } catch (error) {
        console.error('[캘린더 컴포넌트] 일정 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    if (apiEndpoint) {
      loadEvents();
    }
  }, [currentDate, apiEndpoint, filteredEvents, educationOnly]);

  // 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간 기준)
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 특정 날짜의 일정 가져오기
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = formatDateString(date);
    return events.filter((event) => {
      let eventDate = '';
      if (event.start.dateTime) {
        // dateTime인 경우 로컬 시간 기준으로 날짜 추출
        const eventDateObj = new Date(event.start.dateTime);
        eventDate = formatDateString(eventDateObj);
      } else if (event.start.date) {
        // date인 경우 (하루 종일 이벤트)
        eventDate = event.start.date;
      }
      return eventDate === dateStr;
    });
  };

  // 캘린더 그리드 생성
  const getCalendarDays = () => {
    const days: (Date | null)[] = [];
    const startDate = new Date(year, month, 1);
    const dayOfWeek = startDate.getDay(); // 0 (일요일) ~ 6 (토요일)

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

  // 시간 포맷팅
  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const isBusiness = variant === 'business';

  return (
    <div className={`flex gap-4 flex-1 min-h-0 ${instructorView ? 'flex-row' : 'flex-col'}`}>
      {/* 캘린더 카드 - 컴팩트 */}
      <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden ${instructorView ? 'flex-[4] min-w-0 max-w-5xl' : 'w-full'}`}>
        <div className="px-4 pt-3 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">일정 캘린더</h3>
              <p className="text-xs text-gray-500">날짜 선택 시 상세 일정 표시</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                aria-label="이전 달"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h4 className="min-w-[90px] text-center text-sm font-semibold text-gray-900">
                {year}년 {month + 1}월
              </h4>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                aria-label="다음 달"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              기업교육
            </span>
            {!educationOnly && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="text-red-500 font-bold" aria-hidden>✕</span>
                  강의 불가
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  강의 선호
                </span>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-gray-400">로딩 중...</div>
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-0.5 px-2 mb-0.5">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`text-center text-[11px] font-semibold py-1.5 ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-indigo-500/80' : 'text-gray-500'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 캘린더 그리드 - 셀 높이/간격 축소 */}
            <div className="grid grid-cols-7 gap-1 px-2 pb-2 min-h-[320px]">
              {calendarDays.map((date, index) => {
                if (!date) return null;

                const isCurrentMonth = date.getMonth() === month;
                const isToday =
                  date.toDateString() === new Date().toDateString();
                const isSelected =
                  selectedDate &&
                  date.toDateString() === selectedDate.toDateString();
                const dateStr = formatDateString(date);
                const dayEvents = events.filter((event) => {
                  let eventDate = '';
                  if (event.start.dateTime) {
                    // dateTime인 경우 로컬 시간 기준으로 날짜 추출
                    const eventDateObj = new Date(event.start.dateTime);
                    eventDate = formatDateString(eventDateObj);
                  } else if (event.start.date) {
                    // date인 경우 (하루 종일 이벤트)
                    eventDate = event.start.date;
                  }
                  return eventDate === dateStr;
                });
                const hasEvents = dayEvents.length > 0;
                const isPreferredEvent = (event: CalendarEvent) => {
                  const desc = event.description || '';
                  const sum = event.summary || '';
                  return desc.includes('선호') || sum.includes('선호');
                };
                const isBlockedEvent = (event: CalendarEvent) => {
                  const desc = event.description || '';
                  const sum = event.summary || '';
                  if (desc === '개인 일정' || desc.includes('불가') || sum.includes('불가')) return true;
                  // 개인 일정인데 선호가 아니면 불가로 취급(하위 호환)
                  if ((event.isPersonal || event.id?.startsWith('personal-')) && !isPreferredEvent(event)) {
                    return true;
                  }
                  return false;
                };
                const hasBlockedEvents = dayEvents.some(isBlockedEvent);
                const hasPreferredEvents = dayEvents.some(isPreferredEvent);
                const educationDayEvents = dayEvents.filter((event) => {
                  const isPersonal =
                    event.isPersonal ||
                    event.id?.startsWith('personal-') ||
                    event.description === '개인 일정' ||
                    event.description === '강의 불가' ||
                    event.description === '강의 선호';
                  return !isPersonal;
                });
                const hasEducationEvents = educationDayEvents.length > 0;
                // 제목에서 [ ] 안의 내용만 표시 (예: "[대상(주)] R&D 생성형AI_4차수" → "대상(주)", "[수자원공사]_수자원..." → "수자원공사")
                const getCompanyLabel = (summary: string) => {
                  const s = (summary || '').trim();
                  // 반각 [ ], 전각 ［ ］, 【 】 모두 처리
                  const m = s.match(/\[([^\]]+)\]/) || s.match(/［([^］]+)］/) || s.match(/【([^】]+)】/);
                  return m ? m[1].trim() : s;
                };
                // 해당 일자 기업교육 일정의 강사 이름 수집 (중복 제거) - EM 뷰용
                const dayInstructorNames = Array.from(
                  new Set(
                    educationDayEvents.flatMap((e) =>
                      (e.attendees || [])
                        .filter((a) => a.instructorName)
                        .map((a) => a.instructorName!)
                    )
                  )
                ).filter(Boolean);
                // 해당 일자 기업교육 일정의 기업명(제목 앞 []) 수집 - 강사 뷰용
                const dayEducationLabels = Array.from(
                  new Set(educationDayEvents.map((e) => getCompanyLabel(e.summary || '')))
                ).filter(Boolean);
                // 강의 불가 날짜 확인 (props로 전달된 날짜 또는 events에서 확인)
                const hasBlockedDate = personalEventDates.includes(dateStr) || hasBlockedEvents;
                // 강의 선호 날짜 확인 (props로 전달된 날짜 또는 events에서 확인)
                const hasPreferredDate = preferredEventDates.includes(dateStr) || hasPreferredEvents;
                // 교육 일정 날짜 확인 (props로 전달된 날짜 또는 events에서 확인)
                const hasEducationDate = educationEventDates.includes(dateStr) || hasEducationEvents;

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      aspect-square min-h-[52px] flex flex-col rounded-lg transition-all duration-200 relative overflow-hidden
                      ${!isCurrentMonth ? 'text-gray-300 bg-gray-50/50' : 'text-gray-800'}
                      ${isToday && !isSelected && !hasEvents && !hasEducationDate && !hasBlockedDate && !hasPreferredDate
                        ? 'bg-amber-50 border-2 border-amber-300 font-semibold ring-1 ring-amber-200/50'
                        : ''}
                      ${isSelected
                        ? 'bg-gray-800 text-white shadow-lg ring-2 ring-gray-800 ring-offset-2 scale-[1.02]'
                        : ''}
                      ${
                        (hasEducationDate || hasEducationEvents) &&
                        !isSelected &&
                        !isToday &&
                        isCurrentMonth
                          ? 'bg-sky-50 hover:bg-sky-100 border border-sky-200/60'
                          : ''
                      }
                      ${
                        hasPreferredDate &&
                        !hasBlockedDate &&
                        !hasEducationDate &&
                        !isSelected &&
                        !isToday &&
                        isCurrentMonth
                          ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60'
                          : ''
                      }
                      ${!hasEvents && !hasEducationDate && !hasBlockedDate && !hasPreferredDate && !isSelected && !isToday && isCurrentMonth
                        ? 'hover:bg-gray-50 border border-transparent' 
                        : ''}
                    `}
                  >
                    <span className={`relative z-10 text-xs font-semibold self-center pt-1 ${isSelected ? 'text-white' : ''} ${!isCurrentMonth ? 'text-gray-400' : ''}`}>
                      {date.getDate()}
                    </span>
                    {/* 강의 불가: X 표시 */}
                    {(hasBlockedDate || hasBlockedEvents) && !hasEducationEvents && !hasEducationDate && isCurrentMonth && (
                      <span
                        className={`absolute inset-0 flex items-center justify-center pointer-events-none text-lg font-bold select-none ${
                          isSelected ? 'text-white/90' : 'text-red-400'
                        }`}
                        style={{ zIndex: 0 }}
                        aria-hidden
                      >
                        ✕
                      </span>
                    )}
                    {/* 기업교육일(EM 뷰): showCompanyLabelInCells면 [기업명], 아니면 강사 이름 2열 */}
                    {!instructorView && (hasEducationDate || hasPreferredDate || hasEducationEvents || hasPreferredEvents) && isCurrentMonth && (showCompanyLabelInCells ? dayEducationLabels.length > 0 : dayInstructorNames.length > 0) && (
                      <div className="absolute left-0 right-0 top-6 bottom-1 flex flex-col items-center justify-start pointer-events-none px-0.5" title={(showCompanyLabelInCells ? dayEducationLabels : dayInstructorNames).join(', ')}>
                        <div className={`flex gap-x-0.5 gap-y-0.5 w-full max-w-full justify-center items-center ${showCompanyLabelInCells ? 'flex-row flex-wrap' : 'grid grid-cols-2 justify-items-center text-center'} ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                          {(showCompanyLabelInCells ? dayEducationLabels : dayInstructorNames).map((text, i) => (
                            <span key={i} className={`truncate text-[10px] font-semibold leading-tight ${showCompanyLabelInCells ? 'max-w-full' : 'w-full text-center'}`} title={text}>
                              {text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 기업교육일(강사 뷰): 해당 일정의 기업명 [기업명] 표시 */}
                    {instructorView && (hasEducationDate || hasEducationEvents) && isCurrentMonth && dayEducationLabels.length > 0 && (
                      <div className="absolute left-0 right-0 top-6 bottom-1 flex flex-col items-center justify-start pointer-events-none px-0.5" title={dayEducationLabels.join(', ')}>
                        <div className={`flex flex-row flex-wrap gap-x-0.5 gap-y-0 justify-center items-center w-full max-w-full ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                          {dayEducationLabels.map((label, i) => (
                            <span key={i} className="truncate text-[10px] font-semibold leading-tight max-w-full" title={label}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 선택한 날짜의 교육 일정 상세 - 컴팩트 */}
      <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden ${instructorView ? 'flex-1 min-w-[260px] max-w-sm' : 'w-full'}`}>
        <div className="p-4 overflow-auto">
        {selectedDate ? (
          <>
            <h3 className="text-sm font-semibold text-gray-900">
              {formatDate(selectedDate)}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">해당 날짜 일정</p>

            {selectedDateEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs">해당 날짜에 일정 없음</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map((event) => {
                  const isPersonal =
                    event.isPersonal ||
                    event.id?.startsWith('personal-') ||
                    event.description === '개인 일정' ||
                    event.description === '강의 불가' ||
                    event.description === '강의 선호';
                  const isPreferred = event.description === '강의 선호';
                  return (
                    <div
                      key={event.id}
                      className={`border rounded-lg p-3 hover:shadow-sm transition-all ${
                        isPersonal
                          ? 'bg-gray-50 border-gray-200'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 bg-white text-[10px] font-semibold rounded border border-gray-200 text-gray-700">
                          <span
                            className={`w-1 h-1 rounded-full ${
                              !isPersonal ? 'bg-sky-500' : isPreferred ? 'bg-emerald-600' : 'bg-gray-800'
                            }`}
                          />
                          {!isPersonal ? '기업교육' : isPreferred ? '강의 선호' : '강의 불가'}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2 text-sm leading-tight line-clamp-2">{event.summary}</h4>
                    {event.start.dateTime && (
                      <div className="flex items-center text-xs text-gray-600 mb-1">
                        <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          {formatTime(event.start.dateTime)}
                          {event.end?.dateTime && ` - ${formatTime(event.end.dateTime)}`}
                        </span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center text-xs text-gray-600 mb-1">
                        <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.description && (
                      <div
                        className="text-xs text-gray-600 mb-2 leading-relaxed [&_b]:font-semibold [&_br]:block line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: event.description }}
                      />
                    )}
                    {!instructorView && event.attendees && event.attendees.length > 0 && (() => {
                      const instructorNames = event.attendees
                        .filter((a) => a.instructorName)
                        .map((a) => a.instructorName!);
                      if (instructorNames.length === 0) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            강사 {instructorNames.length > 1 ? `(${instructorNames.length}명)` : ''}
                          </p>
                          <div className="space-y-0.5">
                            {instructorNames.map((name, idx) => (
                              <div key={idx} className="text-xs text-gray-700">· {name}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-center">날짜를 선택하면 일정이 표시됩니다.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

