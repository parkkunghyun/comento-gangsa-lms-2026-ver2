import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRecruitmentRequests, getAllInstructorsWithEmail } from '@/lib/google-sheets';

/**
 * 강사 과부화 분석 및 대체 강사 제안 API
 * POST /api/em/recruitment/dashboard/overload-analysis
 * 
 * GPT API를 최소한으로 사용하기 위해:
 * - 사용자가 버튼을 클릭할 때만 실행
 * - 한 번의 API 호출로 모든 강사 분석
 * - 프롬프트 최적화
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

    const apiKey = process.env.GPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GPT_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 데이터 수집
    const requests = await getRecruitmentRequests();
    const allInstructors = await getAllInstructorsWithEmail(true); // 외부 강사만
    
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // 날짜 파싱 헬퍼
    const parseDate = (dateStr: string): { year: number; month: number } | null => {
      if (!dateStr) return null;
      const match1 = dateStr.match(/(\d{4})\.\s*(\d{1,2})/);
      if (match1) {
        return { year: parseInt(match1[1]), month: parseInt(match1[2]) };
      }
      const match2 = dateStr.match(/(\d{4})-(\d{1,2})/);
      if (match2) {
        return { year: parseInt(match2[1]), month: parseInt(match2[2]) };
      }
      return null;
    };

    // 최근 3개월 데이터 필터링 (응답일 기준)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const recentRequests = requests.filter((req) => {
      if (!req.responseDateTime) return false;
      const parsed = parseDate(req.responseDateTime);
      if (!parsed) return false;
      const responseDate = new Date(parsed.year, parsed.month - 1, 1);
      return responseDate >= threeMonthsAgo && responseDate <= now;
    });

    // 강사별 통계 계산
    const instructorStats: Record<string, {
      last3Months: { approved: number; declined: number; total: number };
      monthlyBreakdown: Array<{ month: string; approved: number }>;
    }> = {};

    // 모든 외부 강사 초기화
    allInstructors.forEach((inst) => {
      instructorStats[inst.name] = {
        last3Months: { approved: 0, declined: 0, total: 0 },
        monthlyBreakdown: [],
      };
    });

    // 강사별 데이터 수집
    recentRequests.forEach((req) => {
      if (!req.instructorName || !req.responseDateTime) return;
      const parsed = parseDate(req.responseDateTime);
      if (!parsed) return;
      
      const monthKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      
      if (!instructorStats[req.instructorName]) {
        instructorStats[req.instructorName] = {
          last3Months: { approved: 0, declined: 0, total: 0 },
          monthlyBreakdown: [],
        };
      }

      const stats = instructorStats[req.instructorName];
      stats.last3Months.total++;
      
      if (req.result === 'APPROVED') {
        stats.last3Months.approved++;
        
        // 월별 수락 건수 추가
        let monthData = stats.monthlyBreakdown.find((m) => m.month === monthKey);
        if (!monthData) {
          monthData = { month: monthKey, approved: 0 };
          stats.monthlyBreakdown.push(monthData);
        }
        monthData.approved++;
      } else if (req.result === 'DECLINED') {
        stats.last3Months.declined++;
      }
    });

    // 분석할 강사 데이터 준비 (수락이 있는 강사만)
    const instructorsForAnalysis = Object.entries(instructorStats)
      .filter(([_, stats]) => stats.last3Months.approved > 0)
      .map(([name, stats]) => ({
        name,
        last3MonthsApproved: stats.last3Months.approved,
        last3MonthsTotal: stats.last3Months.total,
        avgMonthlyApproved: (stats.last3Months.approved / 3).toFixed(1),
        monthlyBreakdown: stats.monthlyBreakdown
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((m) => `${m.month}:${m.approved}건`)
          .join(', '),
      }))
      .sort((a, b) => b.last3MonthsApproved - a.last3MonthsApproved)
      .slice(0, 10); // 상위 10명만 분석 (API 비용 절감)

    // 사용 가능한 대체 강사 목록
    const availableInstructors = allInstructors
      .map((inst) => inst.name)
      .filter((name) => !instructorsForAnalysis.some((a) => a.name === name))
      .slice(0, 20); // 상위 20명만 (프롬프트 길이 제한)

    // 최적화된 프롬프트 (토큰 사용량 최소화)
    const prompt = `강사 섭외 과부화 분석 요청입니다.

## 강사별 최근 3개월 수락 현황 (상위 ${instructorsForAnalysis.length}명)
${instructorsForAnalysis.map((inst, idx) => 
  `${idx + 1}. ${inst.name}: 총 ${inst.last3MonthsApproved}건 수락 (평균 월 ${inst.avgMonthlyApproved}건), 월별: ${inst.monthlyBreakdown || '없음'}`
).join('\n')}

## 사용 가능한 대체 강사 목록
${availableInstructors.join(', ')}

다음 JSON 형식으로만 응답하세요:
{
  "overloadedInstructors": [
    {
      "name": "강사명",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "reason": "과부화 위험 이유 (1문장)",
      "currentLoad": "현재 부하 설명 (1문장)",
      "alternatives": ["대체 강사1", "대체 강사2", "대체 강사3"]
    }
  ],
  "summary": "전체 요약 (2-3문장)"
}

중요:
- riskLevel은 월 평균 수락이 5건 이상이면 HIGH, 3-4건이면 MEDIUM, 그 이하면 LOW
- alternatives는 사용 가능한 대체 강사 목록에서 추천 (최대 3명)
- JSON만 응답, 다른 설명 없음`;

    // GPT API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 가장 저렴한 모델 사용
        messages: [
          {
            role: 'system',
            content: '당신은 강사 섭외 전문가입니다. 과부화 위험 강사를 분석하고 대체 강사를 추천합니다. JSON 형식으로만 응답합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 일관성 향상, 토큰 절감
        max_tokens: 1000, // 토큰 제한
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GPT API Error:', errorData);
      throw new Error(`GPT API 호출 실패: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('GPT API 응답이 비어있습니다.');
    }

    const analysis = JSON.parse(content) as {
      overloadedInstructors: Array<{
        name: string;
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        reason: string;
        currentLoad: string;
        alternatives: string[];
      }>;
      summary: string;
    };

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Overload Analysis API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
