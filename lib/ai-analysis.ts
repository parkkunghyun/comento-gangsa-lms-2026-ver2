/**
 * GPT API를 사용하여 섭외 데이터를 분석합니다.
 */

interface RecruitmentAnalysisData {
  thisMonth: {
    total: number;
    approved: number;
    declined: number;
    declineRate: number;
  };
  declineReasons: Record<string, number>;
  instructorStats: Array<{
    name: string;
    thisMonth: { approved: number; declined: number; total: number };
    last3Months: { approved: number; declined: number; total: number };
  }>;
  monthlyTrends: Array<{
    month: string;
    total: number;
    approved: number;
    declined: number;
  }>;
}

interface AIAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  futurePrediction: {
    nextMonthPredicted: number;
    confidence: number;
    reasoning: string;
  };
  declineAnalysis: {
    mainReasons: Array<{ reason: string; impact: string; suggestion: string }>;
    trend: string;
  };
}

export async function analyzeRecruitmentData(
  data: RecruitmentAnalysisData
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GPT_API_KEY;
  
  if (!apiKey) {
    throw new Error('GPT_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = `당신은 강사 섭외 전문 분석가입니다. 다음 섭외 데이터를 분석하여 전문적이고 실용적인 인사이트를 제공해주세요.

## 현재 월 데이터
- 총 섭외 건수: ${data.thisMonth.total}건
- 수락: ${data.thisMonth.approved}건
- 거절: ${data.thisMonth.declined}건
- 거절율: ${data.thisMonth.declineRate.toFixed(1)}%

## 거절 사유
${Object.entries(data.declineReasons)
  .map(([reason, count]) => `- ${reason}: ${count}건`)
  .join('\n')}

## 강사별 통계 (상위 5명)
${data.instructorStats
  .slice(0, 5)
  .map(
    (inst) =>
      `- ${inst.name}: 이번달 ${inst.thisMonth.total}건 (수락 ${inst.thisMonth.approved}, 거절 ${inst.thisMonth.declined}) / 최근 3개월 평균 ${Math.round(inst.last3Months.total / 3)}건`
  )
  .join('\n')}

## 월별 추이
${data.monthlyTrends
  .map((m) => `${m.month}: 총 ${m.total}건 (수락 ${m.approved}, 거절 ${m.declined})`)
  .join('\n')}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "summary": "전체적인 요약 (2-3문장)",
  "insights": ["인사이트 1", "인사이트 2", "인사이트 3"],
  "recommendations": ["권장사항 1", "권장사항 2", "권장사항 3"],
  "futurePrediction": {
    "nextMonthPredicted": 다음달 예상 섭외 건수 (숫자),
    "confidence": 신뢰도 (0-100),
    "reasoning": "예측 근거 (2-3문장)"
  },
  "declineAnalysis": {
    "mainReasons": [
      {
        "reason": "주요 거절 사유",
        "impact": "영향도 설명",
        "suggestion": "개선 제안"
      }
    ],
    "trend": "거절 추이 분석 (1-2문장)"
  }
}

JSON 형식으로만 응답하고, 다른 설명은 포함하지 마세요.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 강사 섭외 전문 분석가입니다. 데이터를 분석하여 실용적이고 구체적인 인사이트를 제공합니다. 항상 JSON 형식으로만 응답합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
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

    const analysis = JSON.parse(content) as AIAnalysisResult;

    // 기본값 설정
    return {
      summary: analysis.summary || '데이터 분석이 완료되었습니다.',
      insights: analysis.insights || [],
      recommendations: analysis.recommendations || [],
      futurePrediction: {
        nextMonthPredicted: analysis.futurePrediction?.nextMonthPredicted || 0,
        confidence: analysis.futurePrediction?.confidence || 0,
        reasoning: analysis.futurePrediction?.reasoning || '데이터 부족으로 예측이 어렵습니다.',
      },
      declineAnalysis: {
        mainReasons: analysis.declineAnalysis?.mainReasons || [],
        trend: analysis.declineAnalysis?.trend || '거절 추이를 분석할 데이터가 부족합니다.',
      },
    };
  } catch (error) {
    console.error('AI Analysis Error:', error);
    // 에러 발생 시 기본값 반환
    return {
      summary: 'AI 분석 중 오류가 발생했습니다. 기본 통계를 확인해주세요.',
      insights: ['데이터를 지속적으로 수집하여 더 정확한 분석이 가능합니다.'],
      recommendations: ['섭외 데이터를 정기적으로 확인하고 패턴을 파악하세요.'],
      futurePrediction: {
        nextMonthPredicted: Math.round(data.thisMonth.total * 0.9),
        confidence: 50,
        reasoning: '기본 통계 기반 예측입니다.',
      },
      declineAnalysis: {
        mainReasons: [],
        trend: '거절 추이 분석을 위해 더 많은 데이터가 필요합니다.',
      },
    };
  }
}
