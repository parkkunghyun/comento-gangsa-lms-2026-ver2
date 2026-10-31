'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useRouter } from 'next/navigation';

interface DashboardData {
  period: string;
  periodLabel: string;
  currentMonth: string;
  thisMonth: {
    total: number;
    approved: number;
    declined: number;
    declineRate: number;
  };
  declineReasons: Record<string, number>;
  topDeclinedInstructor: { name: string; count: number } | null;
  topApprovedInstructor: { name: string; count: number } | null;
  instructorDetails: Array<{
    name: string;
    thisMonth: { approved: number; declined: number; total: number };
    last3Months: { approved: number; declined: number; total: number };
    monthlyTrends: Array<{ month: string; total: number; approved: number; declined: number }>;
    predictedNextMonth: number;
    declineReasons: Array<{ 
      reason: string; 
      educationName: string; 
      educationDate: string;
      responseDate: string;
    }>;
    avgResponseDays: number | null;
  }>;
  monthlyTrends: Array<{
    month: string;
    total: number;
    approved: number;
    declined: number;
  }>;
  approvalRateTop5: Array<{
    name: string;
    rate: number;
    approved: number;
    total: number;
  }>;
  declineRateTop5: Array<{
    name: string;
    rate: number;
    declined: number;
    total: number;
  }>;
  thisMonthClassCounts: Array<{
    name: string;
    count: number;
  }>;
}

export default function RecruitmentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInstructors, setExpandedInstructors] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<'thisMonth' | 'last3Months' | 'year2026'>('thisMonth');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/em/recruitment/dashboard?period=${period}`);
        if (!response.ok) {
          throw new Error('대시보드 데이터를 불러올 수 없습니다.');
        }
        const result = await response.json();
        setData(result.dashboard);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError(err instanceof Error ? err.message : '대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [period]);

  const toggleInstructor = (name: string) => {
    const newExpanded = new Set(expandedInstructors);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedInstructors(newExpanded);
  };

  const handleContactInstructor = (instructorName: string) => {
    router.push(`/em/recruitment/response?instructor=${encodeURIComponent(instructorName)}`);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-sm text-gray-500">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded p-4 text-sm text-gray-700">
        {error || '데이터를 불러올 수 없습니다.'}
      </div>
    );
  }

  const approvalRate = data.thisMonth.total > 0 
    ? Math.round((data.thisMonth.approved / data.thisMonth.total) * 100) 
    : 0;

  // 거절 사유 막대 차트 데이터 (상위 5개)
  const declineReasonData = Object.entries(data.declineReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({
      reason: reason.length > 25 ? reason.substring(0, 25) + '...' : reason,
      fullReason: reason,
      count,
    }));

  // 월별 추이 차트 데이터
  const monthlyChartData = data.monthlyTrends.map((m) => ({
    month: m.month.replace('-', '.').substring(2), // 2026-01 -> 01
    fullMonth: m.month,
    수락: m.approved,
    거절: m.declined,
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">섭외 현황</h1>
            <p className="text-sm text-gray-500 mt-1">{data.periodLabel} 기준 (응답일 기준)</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">기간:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'thisMonth' | 'last3Months' | 'year2026')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
            >
              <option value="thisMonth">이번달</option>
              <option value="last3Months">최근 3개월</option>
              <option value="year2026">2026년 전체</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">섭외 요청 건수</div>
            <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{data.thisMonth.total}</div>
          <div className="text-xs text-gray-400">건</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">수락 건수</div>
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{data.thisMonth.approved}</div>
          <div className="text-xs text-gray-500">{approvalRate}% 수락율</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">거절 건수</div>
            <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{data.thisMonth.declined}</div>
          <div className="text-xs text-gray-500">{data.thisMonth.declineRate}% 거절율</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">전체 수락율</div>
            <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{approvalRate}%</div>
          <div className="text-xs text-gray-500">전체 대비</div>
        </div>
      </div>

      {/* 이번달 강의 순위 */}
      {data.thisMonthClassCounts && data.thisMonthClassCounts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">이번달 강의 순위</h2>
            <p className="text-xs text-gray-500 mt-1">캘린더 참석자 기준</p>
          </div>
          <ResponsiveContainer width="100%" height={Math.min(350, Math.max(250, data.thisMonthClassCounts.length * 30))}>
            <BarChart 
              data={data.thisMonthClassCounts} 
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <defs>
                <linearGradient id="classCountGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.8} />
                  <stop offset="50%" stopColor="#60a5fa" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name"
                stroke="#6b7280" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={0}
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value}건`, '강의 횟수']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
              />
              <Bar 
                dataKey="count" 
                fill="url(#classCountGradient)"
                radius={[10, 10, 0, 0]}
                name="강의 횟수"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 수락율/거절율 상위 5명 그래프 (나란히 배치) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 수락율 상위 5명 */}
        {data.approvalRateTop5 && data.approvalRateTop5.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">수락율 상위 5명</h2>
              <p className="text-xs text-gray-500 mt-1">이번달 기준</p>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={data.approvalRateTop5} 
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <defs>
                  <linearGradient id="approvalRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ddd6fe" stopOpacity={0.8} />
                    <stop offset="50%" stopColor="#c4b5fd" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="name"
                  stroke="#6b7280" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={0}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'rate') return [`${value}%`, '수락율'];
                    return [`${value}`, name];
                  }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  cursor={{ fill: 'rgba(167, 139, 250, 0.08)' }}
                />
                <Bar 
                  dataKey="rate" 
                  fill="url(#approvalRateGradient)"
                  radius={[10, 10, 0, 0]}
                  name="수락율"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 거절율 상위 5명 */}
        {data.declineRateTop5 && data.declineRateTop5.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">거절율 상위 5명</h2>
              <p className="text-xs text-gray-500 mt-1">이번달 기준</p>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={data.declineRateTop5} 
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <defs>
                  <linearGradient id="declineRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fecaca" stopOpacity={0.8} />
                    <stop offset="50%" stopColor="#fda4af" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="name"
                  stroke="#6b7280" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={0}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'rate') return [`${value}%`, '거절율'];
                    return [`${value}`, name];
                  }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  cursor={{ fill: 'rgba(251, 113, 133, 0.08)' }}
                />
                <Bar 
                  dataKey="rate" 
                  fill="url(#declineRateGradient)"
                  radius={[10, 10, 0, 0]}
                  name="거절율"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 월별 추이 및 거절 사유 차트 (나란히 배치) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 월별 추이 차트 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">월별 추이</h2>
            <button
              onClick={() => router.push('/em/recruitment/response')}
              className="text-xs text-gray-600 hover:text-gray-900 underline"
            >
              상세 보기 →
            </button>
          </div>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="수락"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ fill: '#34d399', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="거절"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#fb7185', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
              데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 거절 사유 차트 */}
        {declineReasonData.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">주요 거절 사유</h2>
              <button
                onClick={() => router.push('/em/recruitment/response?status=DECLINED')}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                전체 보기 →
              </button>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={declineReasonData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="declineReasonGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fecaca" stopOpacity={0.8} />
                    <stop offset="50%" stopColor="#fda4af" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                <YAxis dataKey="reason" type="category" stroke="#6b7280" fontSize={11} width={180} />
                <Tooltip
                  formatter={(value: number) => [`${value}건`, '']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  cursor={{ fill: 'rgba(251, 113, 133, 0.08)' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#declineReasonGradient)" 
                  radius={[0, 10, 10, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">주요 거절 사유</h2>
            <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
              거절 사유 데이터가 없습니다.
            </div>
          </div>
        )}
      </div>

      {/* 강사별 현황 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">강사별 현황</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.instructorDetails.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">강사 데이터가 없습니다.</div>
          ) : (
            data.instructorDetails.map((instructor) => {
              const isExpanded = expandedInstructors.has(instructor.name);
              const thisMonthApprovalRate =
                instructor.thisMonth.total > 0
                  ? Math.round((instructor.thisMonth.approved / instructor.thisMonth.total) * 100)
                  : 0;

              return (
                <div 
                  key={instructor.name} 
                  className={`transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                >
                  <button
                    onClick={() => toggleInstructor(instructor.name)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-opacity-50 transition-all duration-200"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-2 text-base">{instructor.name}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100">
                          최근 3개월 {instructor.last3Months.total}건
                        </span>
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-medium border border-emerald-100">
                          수락 {instructor.last3Months.approved}건
                        </span>
                        <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md font-medium border border-rose-100">
                          거절 {instructor.last3Months.declined}건
                        </span>
                        <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-md font-medium border border-violet-100">
                          수락율 {instructor.last3Months.total > 0 
                            ? Math.round((instructor.last3Months.approved / instructor.last3Months.total) * 100) 
                            : 0}%
                        </span>
                      </div>
                    </div>
                    <div className={`ml-4 p-2 rounded-full transition-all duration-300 ${
                      isExpanded 
                        ? 'bg-gray-200 text-gray-900 rotate-180' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                      <svg
                        className="w-5 h-5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 py-5 border-t border-gray-200">
                      {/* 월별 추이 그래프 */}
                      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">월별 섭외 추이</h4>
                        {instructor.monthlyTrends && instructor.monthlyTrends.length > 0 ? (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={instructor.monthlyTrends.map((m) => ({
                                month: m.month.replace('-', '.').substring(2),
                                수락: m.approved,
                                거절: m.declined,
                              }))}
                              margin={{ top: 15, right: 25, left: 0, bottom: 10 }}
                            >
                              <defs>
                                <linearGradient id={`approvedGradient-${instructor.name}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ddd6fe" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0.65} />
                                </linearGradient>
                                <linearGradient id={`declinedGradient-${instructor.name}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#fecaca" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#fda4af" stopOpacity={0.65} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                              <XAxis 
                                dataKey="month" 
                                stroke="#6b7280" 
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis 
                                stroke="#6b7280" 
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip
                                formatter={(value: number, name: string) => {
                                  if (name === '수락') return [`${value}건`, '수락'];
                                  if (name === '거절') return [`${value}건`, '거절'];
                                  return [`${value}건`, name];
                                }}
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  padding: '8px 12px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                }}
                              />
                              <Legend 
                                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                                iconType="rect"
                              />
                              <Bar 
                                dataKey="수락" 
                                fill={`url(#approvedGradient-${instructor.name})`}
                                radius={[8, 8, 0, 0]}
                                name="수락"
                              />
                              <Bar 
                                dataKey="거절" 
                                fill={`url(#declinedGradient-${instructor.name})`}
                                radius={[8, 8, 0, 0]}
                                name="거절"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
                            월별 데이터가 없습니다.
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-5 mb-5">
                        <div className="bg-white rounded-lg border border-gray-200 p-5">
                          <div className="text-xs font-semibold text-gray-600 mb-4 uppercase tracking-wide flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            {data.periodLabel}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                              <span className="text-sm font-medium text-gray-700">총 섭외</span>
                              <span className="text-xl font-bold text-gray-900">{instructor.thisMonth.total}건</span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                              <span className="text-sm font-medium text-gray-700">수락</span>
                              <span className="text-xl font-bold text-gray-900">{instructor.thisMonth.approved}건</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">거절</span>
                              <span className="text-xl font-bold text-gray-900">{instructor.thisMonth.declined}건</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-5">
                          <div className="text-xs font-semibold text-gray-600 mb-4 uppercase tracking-wide flex items-center gap-2">
                            <div className="w-2 h-2 bg-violet-400 rounded-full"></div>
                            최근 3개월
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                              <span className="text-sm font-medium text-gray-700">평균 월 섭외</span>
                              <span className="text-xl font-bold text-gray-900">
                                {Math.round((instructor.last3Months.total / 3) * 10) / 10}건
                              </span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                              <span className="text-sm font-medium text-gray-700">평균 수락율</span>
                              <span className="text-xl font-bold text-gray-900">
                                {instructor.last3Months.total > 0
                                  ? Math.round((instructor.last3Months.approved / instructor.last3Months.total) * 100)
                                  : 0}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">다음달 예상</span>
                              <span className="text-xl font-bold text-gray-900">{instructor.predictedNextMonth}건</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 거절 사유 */}
                      {instructor.declineReasons.length > 0 && (
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 mb-5">
                          <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            최근 3개월 거절 사유
                          </div>
                          <div className="space-y-4">
                            {instructor.declineReasons.map((decline, idx) => (
                              <div 
                                key={idx} 
                                className="border border-gray-200 border-l-4 border-l-rose-300 pl-4 py-2 bg-white rounded-r-lg"
                              >
                                <div className="text-sm font-semibold text-gray-900 mb-1">{decline.educationName}</div>
                                <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-gray-100 rounded">교육일 {decline.educationDate}</span>
                                  <span className="px-2 py-0.5 bg-gray-100 rounded">응답일 {decline.responseDate}</span>
                                </div>
                                <div className="text-sm text-gray-700 mt-2">{decline.reason}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="mt-5 flex gap-3">
                        <button
                          onClick={() => handleContactInstructor(instructor.name)}
                          className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          응답 관리
                        </button>
                        {instructor.thisMonth.declined > 0 && (
                          <button
                            onClick={() => router.push(`/em/recruitment/create?instructor=${encodeURIComponent(instructor.name)}`)}
                            className="px-4 py-2 text-sm font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                          >
                            재섭외
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
