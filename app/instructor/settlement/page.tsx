'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SettlementData {
  mentorName: string;
  className: string;
  time: string;
  amount: string;
  settlementDate: string;
}

interface GroupedSettlement {
  date: string;
  classes: SettlementData[];
  totalAmount: number;
}

interface MonthlyData {
  month: string;
  amount: number;
  date: string; // YYYY-MM 형식
}

export default function InstructorSettlementPage() {
  const [groupedSettlements, setGroupedSettlements] = useState<GroupedSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadSettlements = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/instructor/settlement');

        if (!response.ok) {
          throw new Error('정산 데이터를 불러올 수 없습니다.');
        }

        const data = await response.json();
        console.log('Settlement data received:', {
          count: data.settlements?.length || 0,
          instructorName: data.instructorName,
        });
        
        // 백엔드에서 이미 그룹화되어 반환됨
        setGroupedSettlements(data.settlements || []);
      } catch (err) {
        console.error('Error loading settlements:', err);
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadSettlements();
  }, []);

  // 날짜 파싱 헬퍼 함수
  const parseDate = (dateString: string): Date | null => {
    try {
      // YYYY-MM-DD 형식인 경우
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString);
      }
      // YY-MM-DD 형식인 경우
      const yyFormat = /^(\d{2})-(\d{1,2})-(\d{1,2})$/;
      const match = dateString.match(yyFormat);
      if (match) {
        const [, year, month, day] = match;
        const fullYear = parseInt(year) <= 50 ? `20${year.padStart(2, '0')}` : `19${year.padStart(2, '0')}`;
        const normalizedMonth = month.padStart(2, '0');
        const normalizedDay = day.padStart(2, '0');
        return new Date(`${fullYear}-${normalizedMonth}-${normalizedDay}`);
      }
      // 기본 파싱 시도
      return new Date(dateString);
    } catch (e) {
      console.error('Error parsing date:', dateString, e);
      return null;
    }
  };

  // 월별 데이터 계산
  const monthlyData = useMemo(() => {
    const monthlyMap: { [key: string]: number } = {};

    groupedSettlements.forEach((group) => {
      const date = parseDate(group.date);
      if (date && !isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = 0;
        }
        monthlyMap[monthKey] += group.totalAmount;
      } else {
        console.error('Error parsing date:', group.date);
      }
    });

    return Object.keys(monthlyMap)
      .sort()
      .map((key) => {
        const [year, month] = key.split('-');
        return {
          month: `${year}년 ${parseInt(month)}월`,
          amount: monthlyMap[key],
          date: key,
        };
      });
  }, [groupedSettlements]);

  // 전체 합계 계산
  const totalAmount = useMemo(() => {
    return groupedSettlements.reduce((sum, group) => sum + group.totalAmount, 0);
  }, [groupedSettlements]);

  // 금액 포맷팅
  const formatAmount = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string): string => {
    const date = parseDate(dateString);
    if (date && !isNaN(date.getTime())) {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return dateString;
  };

  // 금액 포맷터 (차트용)
  const formatCurrency = (value: number) => {
    return `${formatAmount(value)}원`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">내 정산</h2>
        <p className="text-gray-600">본인 정산 내역을 확인할 수 있습니다.</p>
      </div>

      {groupedSettlements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">정산 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">전체 정산 금액</h3>
              <p className="text-3xl font-bold text-blue-600">
                {formatAmount(totalAmount)}원
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">정산 횟수</h3>
              <p className="text-3xl font-bold text-gray-900">
                {groupedSettlements.length}회
              </p>
            </div>
          </div>

          {/* 월별 그래프 */}
          {monthlyData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">월별 정산 금액</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 5 }}
                    activeDot={{ r: 7 }}
                    name="정산 금액"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 일자별 상세 내역 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">정산 상세 내역</h3>
            <div className="space-y-4">
              {groupedSettlements.map((group, index) => {
                const isExpanded = expandedDates.has(group.date);
                
                return (
                  <div key={index} className="bg-white rounded-lg shadow p-6">
                    <div 
                      className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 -m-6 p-6 rounded-t-lg transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedDates);
                        if (isExpanded) {
                          newExpanded.delete(group.date);
                        } else {
                          newExpanded.add(group.date);
                        }
                        setExpandedDates(newExpanded);
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <svg 
                            className="w-5 h-5 text-gray-400" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {formatDate(group.date)}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            {group.classes.length}개 클래스
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">정산일 합계</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatAmount(group.totalAmount)}원
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 mt-4">
                        {group.classes.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 mb-1">
                                {item.className || '클래스명 없음'}
                              </h5>
                              {item.time && (
                                <p className="text-sm text-gray-600">시간: {item.time}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {formatAmount(item.amount)}원
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
