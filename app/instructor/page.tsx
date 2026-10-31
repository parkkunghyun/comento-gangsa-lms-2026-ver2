'use client';

import { useState, useEffect } from 'react';
import Calendar from '@/components/calendar';

// 날짜 선택 캘린더 컴포넌트
function DatePickerCalendar({ 
  selectedDates, 
  onDateToggle 
}: { 
  selectedDates: string[]; 
  onDateToggle: (date: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCalendarDays = () => {
    const days: (Date | null)[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dayOfWeek = firstDay.getDay();

    // 이전 달의 마지막 날들
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
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
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h4 className="text-2xl font-semibold text-gray-900">
          {year}년 {month + 1}월
        </h4>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-bold py-2 ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-gray-500' : 'text-gray-600'
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
          const dateStr = formatDateString(date);
          const isSelected = selectedDates.includes(dateStr);
          const isToday = dateStr === formatDateString(today);
          const isPast = date < today;

          return (
            <button
              key={index}
              onClick={() => {
                if (!isPast && isCurrentMonth) {
                  onDateToggle(dateStr);
                }
              }}
              disabled={isPast || !isCurrentMonth}
              className={`
                aspect-square flex flex-col items-center justify-center
                rounded-lg transition-all duration-200 relative
                ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : ''}
                ${isPast && isCurrentMonth ? 'text-gray-300 cursor-not-allowed opacity-50' : ''}
                ${isToday && isCurrentMonth && !isSelected
                  ? 'bg-gray-50 border-2 border-gray-300 font-semibold'
                  : ''}
                ${isSelected && isCurrentMonth
                  ? 'bg-gray-700 text-white shadow-sm scale-105 font-semibold'
                  : ''}
                ${!isSelected && !isToday && isCurrentMonth && !isPast
                  ? 'hover:bg-gray-50 text-gray-700'
                  : ''}
              `}
            >
              <span className={`text-base font-medium ${isSelected ? 'text-white' : ''}`}>
                {date.getDate()}
              </span>
              {isSelected && isCurrentMonth && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface User {
  role: string;
  user: {
    name: string;
    email: string;
    mobile?: string;
    fee?: string;
  };
}

interface PersonalEvent {
  rowIndex?: number;
  summary: string;
  date: string;
  type?: '강의 불가' | '강의 선호';
}

export default function InstructorCalendarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [addEventMode, setAddEventMode] = useState<'blocked' | 'preferred'>('blocked');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null);
  const [editForm, setEditForm] = useState({ summary: '', date: '' });

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

  // 개인 일정 로드
  useEffect(() => {
    if (!loading) {
      loadPersonalEvents();
    }
  }, [loading]);

  const loadPersonalEvents = async () => {
    setLoadingEvents(true);
    try {
      const response = await fetch('/api/instructor/personal-events');
      const data = await response.json();
      if (data.success) {
        setPersonalEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading personal events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleAddEvent = async () => {
    if (selectedDates.length === 0) {
      alert('날짜를 선택해주세요.');
      return;
    }

    setCreating(true);
    try {
      const eventType = addEventMode === 'preferred' ? '강의 선호' : '강의 불가';
      const summary = newEventName.trim() || eventType;
      const response = await fetch('/api/instructor/personal-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dates: selectedDates,
          summary,
          type: eventType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(
          `${selectedDates.length}개의 ${
            addEventMode === 'preferred' ? '강의 선호' : '강의 불가'
          } 일정이 추가되었습니다.`
        );
        setShowAddEventModal(false);
        setSelectedDates([]);
        setNewEventName('');
        await loadPersonalEvents();
      } else {
        alert(
          data.error ||
            `${addEventMode === 'preferred' ? '강의 선호' : '강의 불가'} 일정 추가 중 오류가 발생했습니다.`
        );
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert(`${addEventMode === 'preferred' ? '강의 선호' : '강의 불가'} 일정 추가 중 오류가 발생했습니다.`);
    } finally {
      setCreating(false);
    }
  };

  const handleDateToggle = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date);
      } else {
        return [...prev, date].sort();
      }
    });
  };

  const handleEditEvent = (event: PersonalEvent) => {
    setEditingEvent(event);
    setEditForm({
      summary: event.summary,
      date: event.date,
    });
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent?.rowIndex || !editForm.summary || !editForm.date) {
      alert('일정 이름과 날짜는 필수입니다.');
      return;
    }

    try {
      const eventType =
        editingEvent.type ||
        (editingEvent.summary.includes('선호') ? '강의 선호' : '강의 불가');
      const response = await fetch('/api/instructor/personal-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: editingEvent.rowIndex,
          summary: editForm.summary,
          date: editForm.date,
          type: eventType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`${eventType} 일정이 수정되었습니다.`);
        setEditingEvent(null);
        setEditForm({ summary: '', date: '' });
        await loadPersonalEvents();
      } else {
        alert(data.error || '일정 수정 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      alert('일정 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteEvent = async (rowIndex: number) => {
    if (!confirm('정말 이 일정을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/instructor/personal-events?rowIndex=${rowIndex}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        alert('일정이 삭제되었습니다.');
        await loadPersonalEvents();
      } else {
        alert(data.error || '일정 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">사용자 정보를 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            기업 교육 일정 확인하기
          </h2>
          <p className="text-gray-600">
            날짜를 클릭하시면 상세한 교육 일정을 확인할 수 있습니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAddEventMode('preferred');
              setShowAddEventModal(true);
              setNewEventName('');
            }}
            className="px-5 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            강의선호 일정 추가
          </button>
          <button
            onClick={() => {
              setAddEventMode('blocked');
              setShowAddEventModal(true);
              setNewEventName('');
            }}
            className="px-5 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            강의 불가 일정 추가
          </button>
        </div>
      </div>
      {(() => {
        const isPreferred = (e: PersonalEvent) => (e.type ? e.type === '강의 선호' : e.summary.includes('선호'));
        const blockedDates = personalEvents.filter((e) => !isPreferred(e)).map((e) => e.date);
        const preferredDates = personalEvents.filter((e) => isPreferred(e)).map((e) => e.date);
        return (
          <Calendar
            apiEndpoint="/api/instructor/calendar"
            personalEventDates={blockedDates}
            preferredEventDates={preferredDates}
            instructorView
          />
        );
      })()}

      {/* 강의 불가/선호 일정 목록 */}
      <div className="mt-8">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">강의 불가/선호 일정 목록</h3>
          <p className="text-sm text-gray-600 mt-1">강의 불가는 X표시, 강의 선호는 연두색으로 캘린더에 표시됩니다.</p>
        </div>
        
        {loadingEvents ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        ) : personalEvents.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-12 text-center border border-gray-100">
            <p className="text-gray-400">등록된 강의 불가/선호 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {personalEvents
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((event, index) => {
                const eventDate = new Date(event.date);
                const formattedDate = `${eventDate.getFullYear()}년 ${String(eventDate.getMonth() + 1).padStart(2, '0')}월 ${String(eventDate.getDate()).padStart(2, '0')}일`;
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][eventDate.getDay()];
                
                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200 flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${event.summary.includes('선호') ? 'bg-emerald-500' : 'bg-gray-500'}`}></div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            {event.summary}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {formattedDate} ({dayOfWeek})
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                        title="수정"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => event.rowIndex && handleDeleteEvent(event.rowIndex)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                        title="삭제"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 일정 추가 모달 */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-gray-900">
                {addEventMode === 'preferred' ? '강의선호 일정 추가' : '강의 불가 일정 추가'}
              </h3>
              <button
                onClick={() => {
                  setShowAddEventModal(false);
                  setSelectedDates([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  일정 이름 (선택)
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
                  placeholder="예) 외부 일정, 개인 사정, 선호 일정 등"
                />
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-4">
                  날짜 선택 <span className="text-red-500">*</span>
                  {selectedDates.length > 0 && (
                    <span className="ml-3 text-gray-700 font-normal text-base">
                      ({selectedDates.length}개 선택됨)
                    </span>
                  )}
                </label>
                <DatePickerCalendar 
                  selectedDates={selectedDates}
                  onDateToggle={handleDateToggle}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleAddEvent}
                disabled={creating || selectedDates.length === 0}
                className={`flex-1 px-8 py-4 text-white rounded-xl font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  addEventMode === 'preferred'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {creating
                  ? '추가 중...'
                  : `${selectedDates.length}개 ${addEventMode === 'preferred' ? '강의선호' : '강의 불가'} 일정 추가`}
              </button>
              <button
                onClick={() => {
                  setShowAddEventModal(false);
                  setSelectedDates([]);
                }}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 수정 모달 */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">강의 불가 일정 수정</h3>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setEditForm({ summary: '', date: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  메모 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
                  placeholder="일정 이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateEvent}
                className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all duration-200"
              >
                수정 완료
              </button>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setEditForm({ summary: '', date: '' });
                }}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
