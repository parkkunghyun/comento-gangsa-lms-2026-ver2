import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRecruitmentRequests, getAllInstructorInfo, getInstructorNamesByEmails } from '@/lib/google-sheets';
import { getAllEvents } from '@/lib/google-calendar';

/**
 * 섭외 현황 대시보드 데이터 API
 * GET /api/em/recruitment/dashboard?period=thisMonth|last3Months|year2026
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    // 기간 파라미터 가져오기
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'thisMonth'; // 기본값: 이번달

    const requests = await getRecruitmentRequests();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = now.getFullYear();

    // 날짜 파싱 헬퍼 함수 (두 가지 형식 지원: "2026. 1. 22" 또는 "2026-03-01")
    const parseDate = (dateStr: string): { year: number; month: number } | null => {
      if (!dateStr) return null;
      
      // 형식 1: "2026. 1. 22" 또는 "2026. 01. 22"
      const match1 = dateStr.match(/(\d{4})\.\s*(\d{1,2})/);
      if (match1) {
        return { year: parseInt(match1[1]), month: parseInt(match1[2]) };
      }
      
      // 형식 2: "2026-03-01"
      const match2 = dateStr.match(/(\d{4})-(\d{1,2})/);
      if (match2) {
        return { year: parseInt(match2[1]), month: parseInt(match2[2]) };
      }
      
      return null;
    };

    // 응답일 기준으로 기간 필터링
    let filteredRequests = requests.filter((req) => {
      // 응답일이 있는 경우만 (수락/거절한 경우)
      if (!req.responseDateTime) return false;
      
      const parsed = parseDate(req.responseDateTime);
      if (!parsed) return false;
      
      const responseMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      
      if (period === 'thisMonth') {
        // 이번달
        return responseMonth === currentMonth;
      } else if (period === 'last3Months') {
        // 최근 3개월 (현재 월 포함)
        const responseDate = new Date(parsed.year, parsed.month - 1, 1);
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        return responseDate >= threeMonthsAgo && responseDate <= currentMonthStart;
      } else if (period === 'year2026') {
        // 2026년 전체
        return parsed.year === 2026;
      }
      
      return false;
    });

    // "기업교육_외부강사" 시트에서 강사 목록 가져오기 (F열 중단/대기중/양성단계 제외)
    const allInstructorsFromSheet = await getAllInstructorInfo(true);
    const allInstructorNames = new Set<string>(allInstructorsFromSheet.map((inst) => inst.name));
    
    // 섭외 로그에 있는 강사도 추가 (혹시 시트에 없는 경우 대비)
    requests.forEach((req) => {
      if (req.instructorName) {
        allInstructorNames.add(req.instructorName);
      }
    });

    // 선택된 기간 통계
    const total = filteredRequests.length;
    const approved = filteredRequests.filter((r) => r.result === 'APPROVED').length;
    const declined = filteredRequests.filter((r) => r.result === 'DECLINED').length;
    const declineRate = total > 0 ? (declined / total) * 100 : 0;

    // 거절 사유 수집
    const declineReasons = filteredRequests
      .filter((r) => r.result === 'DECLINED' && r.declineReason)
      .map((r) => r.declineReason!)
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // 강사별 통계 (모든 강사 포함, 이번달 데이터가 없으면 0)
    const instructorStats: Record<string, { approved: number; declined: number; total: number }> = {};
    
    // 모든 강사 초기화
    allInstructorNames.forEach((name) => {
      instructorStats[name] = { approved: 0, declined: 0, total: 0 };
    });
    
    // 선택된 기간 데이터로 통계 업데이트
    filteredRequests.forEach((req) => {
      const name = req.instructorName;
      if (!name) return;
      
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

    // 거절 최다 강사
    const topDeclinedInstructor = Object.entries(instructorStats)
      .sort((a, b) => b[1].declined - a[1].declined)[0];

    // 수락 최다 강사
    const topApprovedInstructor = Object.entries(instructorStats)
      .sort((a, b) => b[1].approved - a[1].approved)[0];

    // 수락율 상위 5명 계산 (이번달 데이터 기준, 총 섭외가 1건 이상인 강사만)
    const approvalRateTop5 = Object.entries(instructorStats)
      .filter(([_, stats]) => stats.total > 0)
      .map(([name, stats]) => ({
        name,
        rate: Math.round((stats.approved / stats.total) * 100),
        approved: stats.approved,
        total: stats.total,
      }))
      .sort((a, b) => {
        // 수락율 기준 정렬, 같으면 총 섭외 건수 기준
        if (b.rate !== a.rate) {
          return b.rate - a.rate;
        }
        return b.total - a.total;
      })
      .slice(0, 5);

    // 거절율 상위 5명 계산 (이번달 데이터 기준, 총 섭외가 1건 이상인 강사만)
    const declineRateTop5 = Object.entries(instructorStats)
      .filter(([_, stats]) => stats.total > 0)
      .map(([name, stats]) => ({
        name,
        rate: Math.round((stats.declined / stats.total) * 100),
        declined: stats.declined,
        total: stats.total,
      }))
      .sort((a, b) => {
        // 거절율 기준 정렬, 같으면 총 섭외 건수 기준
        if (b.rate !== a.rate) {
          return b.rate - a.rate;
        }
        return b.total - a.total;
      })
      .slice(0, 5);

    // 이번달 강의 횟수 계산 (캘린더에서 참석자 이메일과 시트 H열 비교)
    let thisMonthClassCounts: Array<{ name: string; count: number }> = [];
    try {
      const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';
      
      // 이번달 시작일과 종료일 계산
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const timeMin = thisMonthStart.toISOString();
      const timeMax = nextMonthStart.toISOString();

      // 캘린더 이벤트 가져오기
      const calendarEvents = await getAllEvents(CALENDAR_ID, timeMin, timeMax);

      // 참석자 이메일 수집
      const attendeeEmails = new Set<string>();
      calendarEvents.forEach((event) => {
        event.attendees?.forEach((attendee) => {
          if (attendee.email) {
            attendeeEmails.add(attendee.email.trim().toLowerCase());
          }
        });
      });

      // 시트의 H열 이메일과 매칭하여 강사 이름 가져오기
      const emailToNameMap = await getInstructorNamesByEmails(Array.from(attendeeEmails));

      // 강사별 강의 횟수 집계
      const classCountMap = new Map<string, number>();
      calendarEvents.forEach((event) => {
        event.attendees?.forEach((attendee) => {
          if (attendee.email) {
            const normalizedEmail = attendee.email.trim().toLowerCase();
            const instructorName = emailToNameMap[normalizedEmail];
            if (instructorName) {
              classCountMap.set(instructorName, (classCountMap.get(instructorName) || 0) + 1);
            }
          }
        });
      });

      // 배열로 변환하고 정렬
      thisMonthClassCounts = Array.from(classCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error fetching calendar events for class counts:', error);
      // 에러가 발생해도 빈 배열로 처리
    }

    // 월별 추이 데이터 수집 (최근 6개월)
    const monthlyTrends: Array<{ month: string; total: number; approved: number; declined: number }> = [];
    const monthSet = new Set<string>();
    
    requests.forEach((req) => {
      if (!req.educationDate) return;
      const parsed = parseDate(req.educationDate);
      if (!parsed) return;
      const requestMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      monthSet.add(requestMonth);
    });

    const sortedMonths = Array.from(monthSet).sort().slice(-6); // 최근 6개월
    
      sortedMonths.forEach((month) => {
        const monthRequests = requests.filter((req) => {
          if (!req.educationDate) return false;
          const parsed = parseDate(req.educationDate);
          if (!parsed) return false;
          const requestMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
          return requestMonth === month;
        });

      monthlyTrends.push({
        month,
        total: monthRequests.length,
        approved: monthRequests.filter((r) => r.result === 'APPROVED').length,
        declined: monthRequests.filter((r) => r.result === 'DECLINED').length,
      });
    });

    // 강사별 상세 정보 (최근 3개월 데이터로 예측)
    const instructorDetails: Array<{
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
    }> = [];

    // 모든 강사에 대해 상세 정보 수집
    Array.from(allInstructorNames).forEach((name) => {
      // 해당 강사의 모든 요청 필터링 (응답일이 있는 것만)
      const instructorAllRequests = requests.filter((req) => {
        return req.instructorName === name && req.responseDateTime;
      });

      // 최근 3개월 데이터 (응답일 기준)
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const last3MonthsRequests = instructorAllRequests.filter((req) => {
        if (!req.responseDateTime) return false;
        const parsed = parseDate(req.responseDateTime);
        if (!parsed) return false;
        const responseDate = new Date(parsed.year, parsed.month - 1, 1);
        return responseDate >= threeMonthsAgo && responseDate <= now;
      });

      const last3Months = {
        approved: last3MonthsRequests.filter((r) => r.result === 'APPROVED').length,
        declined: last3MonthsRequests.filter((r) => r.result === 'DECLINED').length,
        total: last3MonthsRequests.length,
      };

      // 월별 추이 데이터 수집 (응답일 기준, 모든 월)
      const instructorMonthlyTrends: Array<{ month: string; total: number; approved: number; declined: number }> = [];
      const monthMap = new Map<string, { total: number; approved: number; declined: number }>();
      
      // 모든 데이터를 월별로 그룹화
      instructorAllRequests.forEach((req) => {
        if (!req.responseDateTime) return;
        const parsed = parseDate(req.responseDateTime);
        if (!parsed) return;
        
        const responseMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        
        if (!monthMap.has(responseMonth)) {
          monthMap.set(responseMonth, { total: 0, approved: 0, declined: 0 });
        }
        
        const stats = monthMap.get(responseMonth)!;
        stats.total++;
        if (req.result === 'APPROVED') {
          stats.approved++;
        } else if (req.result === 'DECLINED') {
          stats.declined++;
        }
      });

      // 월별로 정렬하여 배열로 변환 (모든 월 포함)
      const sortedMonths = Array.from(monthMap.keys()).sort();
      sortedMonths.forEach((month) => {
        const stats = monthMap.get(month)!;
        instructorMonthlyTrends.push({
          month,
          total: stats.total,
          approved: stats.approved,
          declined: stats.declined,
        });
      });

      // 다음달 예측: 최근 3개월 평균 * 승인율
      const avgMonthly = last3Months.total / 3;
      const approvalRate = last3Months.total > 0 ? last3Months.approved / last3Months.total : 0;
      const predictedNextMonth = Math.round(avgMonthly * approvalRate);

      // 최근 3개월 거절 사유 및 응답 정보 수집 (선택된 기간이 아닌 최근 3개월 기준)
      const last3MonthsDeclinedRequests = last3MonthsRequests.filter(
        (req) => req.result === 'DECLINED' && req.declineReason
      );
      const declineReasons = last3MonthsDeclinedRequests.map((req) => {
        return {
          reason: req.declineReason!,
          educationName: req.educationName || '',
          educationDate: req.educationDate || '',
          responseDate: req.responseDateTime || '',
        };
      });

      // 선택된 기간 수락 요청의 평균 응답 속도 계산
      const periodApprovedRequests = filteredRequests.filter(
        (req) => req.instructorName === name && req.result === 'APPROVED' && req.responseDateTime
      );
      let avgResponseDays = null;
      if (periodApprovedRequests.length > 0) {
        const responseDays: number[] = [];
        periodApprovedRequests.forEach((req) => {
          if (req.responseDateTime && req.educationDate) {
            try {
              const responseDateMatch = req.responseDateTime.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
              const educationDateMatch = req.educationDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
              if (responseDateMatch && educationDateMatch) {
                const [, ry, rm, rd] = responseDateMatch;
                const [, ey, em, ed] = educationDateMatch;
                const responseDate = new Date(parseInt(ry), parseInt(rm) - 1, parseInt(rd));
                const educationDate = new Date(parseInt(ey), parseInt(em) - 1, parseInt(ed));
                const diffTime = educationDate.getTime() - responseDate.getTime();
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (days >= 0) {
                  responseDays.push(days);
                }
              }
            } catch (e) {
              // 날짜 파싱 실패 시 무시
            }
          }
        });
        if (responseDays.length > 0) {
          avgResponseDays = Math.round(responseDays.reduce((a, b) => a + b, 0) / responseDays.length);
        }
      }

      instructorDetails.push({
        name,
        thisMonth: instructorStats[name], // 선택된 기간의 통계
        last3Months,
        monthlyTrends: instructorMonthlyTrends,
        predictedNextMonth,
        declineReasons,
        avgResponseDays,
      });
    });

    // 기간 라벨 생성
    let periodLabel = '';
    if (period === 'thisMonth') {
      periodLabel = currentMonth.replace('-', '년 ').replace(/-/, '월');
    } else if (period === 'last3Months') {
      periodLabel = '최근 3개월';
    } else if (period === 'year2026') {
      periodLabel = '2026년 전체';
    }

    return NextResponse.json({
      success: true,
      dashboard: {
        period,
        periodLabel,
        currentMonth,
        thisMonth: {
          total,
          approved,
          declined,
          declineRate: Math.round(declineRate * 10) / 10,
        },
        declineReasons,
        topDeclinedInstructor: topDeclinedInstructor ? {
          name: topDeclinedInstructor[0],
          count: topDeclinedInstructor[1].declined,
        } : null,
        topApprovedInstructor: topApprovedInstructor ? {
          name: topApprovedInstructor[0],
          count: topApprovedInstructor[1].approved,
        } : null,
        instructorDetails: instructorDetails.sort((a, b) => {
          // 이번달 총 섭외 건수로 정렬, 같으면 이름으로 정렬
          if (b.thisMonth.total !== a.thisMonth.total) {
            return b.thisMonth.total - a.thisMonth.total;
          }
          return a.name.localeCompare(b.name);
        }),
        monthlyTrends,
        approvalRateTop5,
        declineRateTop5,
        thisMonthClassCounts,
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
