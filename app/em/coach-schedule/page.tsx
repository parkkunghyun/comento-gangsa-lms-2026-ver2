'use client';

import { useState, useEffect } from 'react';
import Calendar from '@/components/calendar';

interface User {
  role: string;
  user: {
    name: string;
    email: string;
  };
}

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

interface Coach {
  name: string;
  email: string;
}

export default function EMCoachSchedulePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [thisMonthStats, setThisMonthStats] = useState({ total: 0 });
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string>('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error('Failed to get user:', data.error);
        } else {
          setUser(data);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching user:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const loadCoaches = async () => {
      try {
        const response = await fetch('/api/em/coaches');
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (err) {
        console.error('Error loading coaches:', err);
      }
    };

    loadCoaches();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEvents(events);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = events.filter(
        (event) =>
          event.summary.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.location?.toLowerCase().includes(query) ||
          event.attendees?.some(
            (attendee) =>
              attendee.displayName?.toLowerCase().includes(query) ||
              attendee.email.toLowerCase().includes(query) ||
              attendee.instructorName?.toLowerCase().includes(query)
          )
      );
      setFilteredEvents(filtered);
    }
  }, [searchQuery, events]);

  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const timeMin = new Date('2026-01-01T00:00:00Z').toISOString();
      const timeMax = new Date('2026-12-31T23:59:59Z').toISOString();

      const response = await fetch(
        `/api/em/coach-calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      );
      if (!response.ok) {
        throw new Error('일정을 불러올 수 없습니다.');
      }
      const result = await response.json();
      const allEvents = result.events || [];
      setEvents(allEvents);
      setFilteredEvents(allEvents);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonthEvents = allEvents.filter((event: CalendarEvent) => {
        const eventDate = event.start.dateTime
          ? new Date(event.start.dateTime)
          : event.start.date
          ? new Date(event.start.date)
          : null;

        if (!eventDate) return false;
        return eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth;
      });

      setThisMonthStats({ total: thisMonthEvents.length });
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const formatEventDate = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      });
    } else if (event.start.date) {
      const date = new Date(event.start.date);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return '-';
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const startTime = start.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (end) {
        const endTime = end.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${startTime} - ${endTime}`;
      }
      return startTime;
    }
    return '종일';
  };

  const getCoachesFromEvent = (event: CalendarEvent) => {
    if (!event.attendees || event.attendees.length === 0) return '-';
    const names = event.attendees
      .filter((attendee) => attendee.instructorName)
      .map((attendee) => attendee.instructorName!)
      .filter(Boolean)
      .join(', ');
    return names || '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-600">사용자 정보를 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">실습코치 일정 확인</h1>
            <p className="text-xs text-gray-500 truncate">
              실습코치별 기업교육 일정과 개인 일정(불가/선호) 확인
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-1.5 flex items-center gap-1">
        <button
          onClick={() => setViewMode('calendar')}
          className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
            viewMode === 'calendar'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            캘린더
          </span>
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
            viewMode === 'list'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            일정 리스트
          </span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative min-w-0">
            <input
              type="text"
              placeholder="기업명, 클래스명, 실습코치명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-400 bg-white"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              초기화
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 px-2.5 py-1.5 bg-blue-50 rounded text-xs text-gray-700">
            검색 결과 <span className="font-semibold text-gray-900">{filteredEvents.length}건</span>
            {viewMode === 'calendar' && <span className="text-gray-500 ml-1">(캘린더에만 표시)</span>}
          </div>
        )}
      </div>

      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              실습코치 선택
            </label>
            <select
              value={selectedCoach}
              onChange={(e) => setSelectedCoach(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-300 focus:border-gray-400 appearance-none bg-white cursor-pointer"
            >
              <option value="">전체 실습코치 일정</option>
              {coaches.map((coach) => (
                <option key={coach.email} value={coach.email}>
                  {coach.name}
                </option>
              ))}
            </select>
          </div>

          {searchQuery.trim() ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-4 w-full max-w-full">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">검색 결과 캘린더</h3>
                <p className="text-xs text-gray-500">&quot;{searchQuery}&quot; {filteredEvents.length}건</p>
              </div>
              <Calendar
                apiEndpoint="/api/em/coach-calendar"
                variant="business"
                educationOnly
                filteredEvents={filteredEvents}
                showCompanyLabelInCells
              />
            </div>
          ) : selectedCoach ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-4 w-full max-w-full">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {coaches.find((c) => c.email === selectedCoach)?.name || '실습코치'} 캘린더
                </h3>
                <p className="text-xs text-gray-500">날짜 클릭 시 오른쪽에 일정 표시</p>
              </div>
              <Calendar
                apiEndpoint={`/api/em/coach-calendar?coachEmail=${encodeURIComponent(selectedCoach)}`}
                variant="business"
                showCompanyLabelInCells
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-4 w-full max-w-full">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">전체 실습코치 일정</h3>
                <p className="text-xs text-gray-500">날짜 클릭 시 오른쪽에 일정 표시</p>
              </div>
              <Calendar apiEndpoint="/api/em/coach-calendar" variant="business" educationOnly />
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">이번달 총 일정</span>
            <span className="text-xl font-bold text-gray-900">
              {thisMonthStats.total}
              <span className="text-sm font-normal text-gray-500 ml-0.5">건</span>
            </span>
          </div>

          {loadingSchedules ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-600 mx-auto mb-3"></div>
              <div className="text-xs text-gray-500">일정 불러오는 중...</div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-xs text-gray-500">{searchQuery ? '검색 결과가 없습니다.' : '일정이 없습니다.'}</div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">일정</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">제목</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">시간</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">실습코치</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">장소</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium text-gray-900">
                          {formatEventDate(event)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-xs font-medium text-gray-900 max-w-[200px] truncate"
                          title={event.summary || ''}
                        >
                          {event.summary || '-'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                          {formatEventTime(event)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{getCoachesFromEvent(event)}</td>
                        <td
                          className="px-4 py-2.5 text-xs text-gray-500 max-w-[120px] truncate"
                          title={event.location || ''}
                        >
                          {event.location || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
