'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

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

interface InstructorSettlements {
  [instructorName: string]: GroupedSettlement[];
}

interface InstructorSummary {
  name: string;
  lastMonthAmount: number;
  last3MonthsAmount: number;
  totalAmount: number;
}

export default function EMSettlementPage() {
  const [allSettlements, setAllSettlements] = useState<InstructorSettlements>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

  useEffect(() => {
    const loadSettlements = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/em/settlement');

        if (!response.ok) {
          throw new Error('정산 데이터를 불러올 수 없습니다.');
        }

        const data = await response.json();
        setAllSettlements(data.settlements || {});
      } catch (err) {
        console.error('Error loading settlements:', err);
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadSettlements();
  }, []);

  // 금액 포맷팅
  const formatAmount = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 금액 포맷터 (차트용)
  const formatCurrency = (value: number) => {
    return `${formatAmount(value)}원`;
  };

  // 저번달 및 최근 3개월 정산 금액 계산
  const instructorSummaries = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const summaries: InstructorSummary[] = [];

    Object.keys(allSettlements).forEach((instructorName) => {
      const settlements = allSettlements[instructorName];
      let lastMonthAmount = 0;
      let last3MonthsAmount = 0;
      let totalAmount = 0;

      settlements.forEach((group) => {
        try {
          const settlementDate = new Date(group.date);
          if (!isNaN(settlementDate.getTime())) {
            const amount = group.totalAmount;
            totalAmount += amount;

            // 저번달 체크
            if (
              settlementDate.getFullYear() === lastMonth.getFullYear() &&
              settlementDate.getMonth() === lastMonth.getMonth()
            ) {
              lastMonthAmount += amount;
            }

            // 최근 3개월 체크
            if (settlementDate >= threeMonthsAgo && settlementDate <= now) {
              last3MonthsAmount += amount;
            }
          }
        } catch (e) {
          console.error('Error parsing date:', group.date);
        }
      });

      if (totalAmount > 0) {
        summaries.push({
          name: instructorName,
          lastMonthAmount,
          last3MonthsAmount,
          totalAmount,
        });
      }
    });

    return summaries;
  }, [allSettlements]);

  // 저번달 상위 강사 (상위 3명)
  const topLastMonth = useMemo(() => {
    return [...instructorSummaries]
      .sort((a, b) => b.lastMonthAmount - a.lastMonthAmount)
      .slice(0, 3)
      .filter((item) => item.lastMonthAmount > 0);
  }, [instructorSummaries]);

  // 최근 3개월 상위 강사 (상위 3명)
  const topLast3Months = useMemo(() => {
    return [...instructorSummaries]
      .sort((a, b) => b.last3MonthsAmount - a.last3MonthsAmount)
      .slice(0, 3)
      .filter((item) => item.last3MonthsAmount > 0);
  }, [instructorSummaries]);

  // 전체 정산 금액 계산
  const totalAmount = useMemo(() => {
    return instructorSummaries.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [instructorSummaries]);

  // 전체 월별 정산 데이터 (모든 강사 합계)
  const totalMonthlyData = useMemo(() => {
    const monthlyMap: { [key: string]: number } = {};

    Object.values(allSettlements).forEach((settlements) => {
      settlements.forEach((group) => {
        try {
          const date = new Date(group.date);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyMap[monthKey]) {
              monthlyMap[monthKey] = 0;
            }
            monthlyMap[monthKey] += group.totalAmount;
          }
        } catch (e) {
          console.error('Error parsing date:', group.date);
        }
      });
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
  }, [allSettlements]);

  // 선택된 강사의 월별 데이터
  const selectedInstructorMonthlyData = useMemo(() => {
    if (!selectedInstructor || !allSettlements[selectedInstructor]) {
      return [];
    }

    const settlements = allSettlements[selectedInstructor];
    const monthlyMap: { [key: string]: number } = {};

    settlements.forEach((group) => {
      try {
        const date = new Date(group.date);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = 0;
          }
          monthlyMap[monthKey] += group.totalAmount;
        }
      } catch (e) {
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
  }, [selectedInstructor, allSettlements]);

  // 선택된 강사의 상세 정산 내역
  const selectedInstructorDetails = useMemo(() => {
    if (!selectedInstructor || !allSettlements[selectedInstructor]) {
      return [];
    }

    return allSettlements[selectedInstructor].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [selectedInstructor, allSettlements]);

  // 각 강사별 월별 데이터 계산 함수
  const getInstructorMonthlyData = (instructorName: string) => {
    if (!allSettlements[instructorName]) return [];
    const settlements = allSettlements[instructorName];
    const monthlyMap: { [key: string]: number } = {};

    settlements.forEach((group) => {
      try {
        const date = new Date(group.date);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = 0;
          }
          monthlyMap[monthKey] += group.totalAmount;
        }
      } catch (e) {
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin"></div>
          <div className="text-sm font-medium text-gray-600">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-lg max-w-lg w-full">
          <div className="text-sm font-medium text-red-800 whitespace-pre-line">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
            <p className="text-sm font-medium text-gray-600 mt-1">강사별 정산 현황을 확인할 수 있습니다</p>
          </div>
        </div>
      </div>

      {Object.keys(allSettlements).length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">정산 내역이 없습니다.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 전체 정산 금액 및 그래프 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">전체 정산 현황</h2>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">총 정산 금액</div>
                <div className="text-xl font-bold text-gray-900">{formatAmount(totalAmount)}원</div>
              </div>
            </div>
            {totalMonthlyData.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={totalMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6b7280" 
                      fontSize={12}
                      tick={{ fill: '#4b5563', fontWeight: 500 }}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={12} 
                      tickFormatter={formatCurrency}
                      tick={{ fill: '#4b5563', fontWeight: 500 }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.12)',
                        padding: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#111827"
                      strokeWidth={3}
                      dot={{ fill: '#111827', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 저번달 및 최근 3개월 상위 강사 (나란히 배치) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 저번달 상위 강사 */}
            {topLastMonth.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">저번달 정산 상위 3명</h2>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topLastMonth} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#4b5563" 
                          fontSize={11}
                          tick={{ fill: '#1e293b', fontWeight: 600 }}
                          axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                        />
                        <YAxis 
                          stroke="#4b5563" 
                          fontSize={11} 
                          tickFormatter={formatCurrency}
                          tick={{ fill: '#1e293b', fontWeight: 600 }}
                          axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.12)',
                            padding: '12px',
                          }}
                        />
                        <Bar
                          dataKey="lastMonthAmount"
                          fill="#374151"
                          radius={[8, 8, 0, 0]}
                          onClick={(data) => setSelectedInstructor(data.name)}
                          style={{ cursor: 'pointer' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-2">
                  {topLastMonth.map((instructor, idx) => (
                    <button
                      key={instructor.name}
                      onClick={() => setSelectedInstructor(instructor.name)}
                      className="w-full text-left p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {instructor.name}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          {formatAmount(instructor.lastMonthAmount)}원
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 3개월 상위 강사 */}
            {topLast3Months.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">최근 3개월 정산 상위 3명</h2>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topLast3Months} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#4b5563" 
                          fontSize={11}
                          tick={{ fill: '#1e293b', fontWeight: 600 }}
                          axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                        />
                        <YAxis 
                          stroke="#4b5563" 
                          fontSize={11} 
                          tickFormatter={formatCurrency}
                          tick={{ fill: '#1e293b', fontWeight: 600 }}
                          axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.12)',
                            padding: '12px',
                          }}
                        />
                        <Bar
                          dataKey="last3MonthsAmount"
                          fill="#6b7280"
                          radius={[8, 8, 0, 0]}
                          onClick={(data) => setSelectedInstructor(data.name)}
                          style={{ cursor: 'pointer' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-2">
                  {topLast3Months.map((instructor, idx) => (
                    <button
                      key={instructor.name}
                      onClick={() => setSelectedInstructor(instructor.name)}
                      className="w-full text-left p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {instructor.name}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          {formatAmount(instructor.last3MonthsAmount)}원
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 모든 강사별 정산 (그래프와 가격만) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">강사별 정산 현황</h2>
            </div>
            <div className="space-y-6">
              {instructorSummaries
                .sort((a, b) => b.totalAmount - a.totalAmount)
                .map((instructor) => {
                  const monthlyData = getInstructorMonthlyData(instructor.name);

                  return (
                    <div 
                      key={instructor.name} 
                      className="bg-white rounded-lg p-5 border border-gray-200 hover:bg-gray-50 transition-colors last:mb-0"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-gray-900">{instructor.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-600 mb-1">전체 정산</div>
                          <div className="text-base font-bold text-gray-900">
                            {formatAmount(instructor.totalAmount)}원
                          </div>
                        </div>
                      </div>
                      {monthlyData.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                              <XAxis 
                                dataKey="month" 
                                stroke="#6b7280" 
                                fontSize={11}
                                tick={{ fill: '#4b5563', fontWeight: 500 }}
                              />
                              <YAxis 
                                stroke="#6b7280" 
                                fontSize={11} 
                                tickFormatter={formatCurrency}
                                tick={{ fill: '#4b5563', fontWeight: 500 }}
                              />
                              <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                                  padding: '10px',
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#111827"
                                strokeWidth={3}
                                dot={{ fill: '#111827', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 선택된 강사 상세 정보 */}
          {selectedInstructor && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedInstructor} 정산 상세</h2>
                </div>
                <button
                  onClick={() => setSelectedInstructor(null)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 요약 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">저번달 정산</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatAmount(
                      instructorSummaries.find((s) => s.name === selectedInstructor)?.lastMonthAmount || 0
                    )}
                    원
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">최근 3개월 정산</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatAmount(
                      instructorSummaries.find((s) => s.name === selectedInstructor)?.last3MonthsAmount || 0
                    )}
                    원
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">전체 정산</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatAmount(
                      instructorSummaries.find((s) => s.name === selectedInstructor)?.totalAmount || 0
                    )}
                    원
                  </div>
                </div>
              </div>

              {/* 월별 추이 그래프 */}
              {selectedInstructorMonthlyData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">월별 정산 추이</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={selectedInstructorMonthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                        <XAxis 
                          dataKey="month" 
                          stroke="#6b7280" 
                          fontSize={12}
                          tick={{ fill: '#4b5563', fontWeight: 500 }}
                        />
                        <YAxis 
                          stroke="#6b7280" 
                          fontSize={12} 
                          tickFormatter={formatCurrency}
                          tick={{ fill: '#4b5563', fontWeight: 500 }}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                            padding: '12px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#111827"
                          strokeWidth={3}
                          dot={{ fill: '#111827', r: 5, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 상세 정산 내역 (정산일과 금액만) */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">상세 정산 내역</h3>
                </div>
                <div className="space-y-2">
                  {selectedInstructorDetails.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700 font-semibold text-xs">
                          {idx + 1}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {group.date}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        {formatAmount(group.totalAmount)}원
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
