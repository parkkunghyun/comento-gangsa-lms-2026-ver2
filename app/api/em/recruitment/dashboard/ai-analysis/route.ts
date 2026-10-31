import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRecruitmentRequests } from '@/lib/google-sheets';
import { analyzeRecruitmentData } from '@/lib/ai-analysis';

/**
 * AI 분석 API (별도 호출)
 * POST /api/em/recruitment/dashboard/ai-analysis
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const requests = await getRecruitmentRequests();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 이번달 데이터 필터링
    const thisMonthRequests = requests.filter((req) => {
      if (!req.educationDate) return false;
      const dateMatch = req.educationDate.match(/(\d{4})\.\s*(\d{1,2})/);
      if (!dateMatch) return false;
      const [, year, month] = dateMatch;
      const requestMonth = `${year}-${month.padStart(2, '0')}`;
      return requestMonth === currentMonth;
    });

    // 이번달 통계
    const totalThisMonth = thisMonthRequests.length;
    const approvedThisMonth = thisMonthRequests.filter((r) => r.result === 'APPROVED').length;
    const declinedThisMonth = thisMonthRequests.filter((r) => r.result === 'DECLINED').length;
    const declineRate = totalThisMonth > 0 ? (declinedThisMonth / totalThisMonth) * 100 : 0;

    // 거절 사유 수집
    const declineReasons = thisMonthRequests
      .filter((r) => r.result === 'DECLINED' && r.declineReason)
      .map((r) => r.declineReason!)
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // 강사별 통계
    const instructorStats: Record<string, { approved: number; declined: number; total: number }> = {};
    
    thisMonthRequests.forEach((req) => {
      const name = req.instructorName;
      if (!instructorStats[name]) {
        instructorStats[name] = { approved: 0, declined: 0, total: 0 };
      }
      instructorStats[name].total++;
      if (req.result === 'APPROVED') {
        instructorStats[name].approved++;
      } else if (req.result === 'DECLINED') {
        instructorStats[name].declined++;
      }
    });

    // 월별 추이 데이터 수집 (최근 6개월)
    const monthlyTrends: Array<{ month: string; total: number; approved: number; declined: number }> = [];
    const monthSet = new Set<string>();
    
    requests.forEach((req) => {
      if (!req.educationDate) return;
      const dateMatch = req.educationDate.match(/(\d{4})\.\s*(\d{1,2})/);
      if (!dateMatch) return;
      const [, year, month] = dateMatch;
      const requestMonth = `${year}-${month.padStart(2, '0')}`;
      monthSet.add(requestMonth);
    });

    const sortedMonths = Array.from(monthSet).sort().slice(-6);
    
    sortedMonths.forEach((month) => {
      const monthRequests = requests.filter((req) => {
        if (!req.educationDate) return false;
        const dateMatch = req.educationDate.match(/(\d{4})\.\s*(\d{1,2})/);
        if (!dateMatch) return false;
        const [, year, monthNum] = dateMatch;
        const requestMonth = `${year}-${monthNum.padStart(2, '0')}`;
        return requestMonth === month;
      });

      monthlyTrends.push({
        month,
        total: monthRequests.length,
        approved: monthRequests.filter((r) => r.result === 'APPROVED').length,
        declined: monthRequests.filter((r) => r.result === 'DECLINED').length,
      });
    });

    // 강사별 통계 배열
    const instructorStatsArray = Object.entries(instructorStats).map(([name, stats]) => ({
      name,
      thisMonth: stats,
      last3Months: { approved: 0, declined: 0, total: 0 }, // 간단화
    }));

    // AI 분석 수행
    const aiAnalysis = await analyzeRecruitmentData({
      thisMonth: {
        total: totalThisMonth,
        approved: approvedThisMonth,
        declined: declinedThisMonth,
        declineRate,
      },
      declineReasons,
      instructorStats: instructorStatsArray,
      monthlyTrends,
    });

    return NextResponse.json({
      success: true,
      aiAnalysis,
    });
  } catch (error) {
    console.error('AI Analysis API error:', error);
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
