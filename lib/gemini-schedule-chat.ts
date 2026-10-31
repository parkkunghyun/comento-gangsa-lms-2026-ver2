import {
  getScheduleDataSummary,
  SCHEDULE_CHAT_TOOL_DECLARATIONS,
  runScheduleChatTool,
} from '@/lib/schedule-chat-tools';
import { WEEKDAY_KO, weekdayOf } from '@/lib/schedule-sheet-data';

const MAX_TOOL_ROUNDS = 5;
const RETRY_DELAYS_MS = [1000, 3000];

/** 404 시 순서대로 시도 (환경변수 GEMINI_MODEL이 있으면 최우선) */
const MODEL_CANDIDATES = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(
  (m): m is string => !!m && m.trim().length > 0
);

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

function buildSystemInstruction(summary: Awaited<ReturnType<typeof getScheduleDataSummary>>): string {
  const year = summary.today.slice(0, 4);
  const weekday = WEEKDAY_KO[weekdayOf(summary.today)];
  return `당신은 Potens EM(교육매니저)용 강사·교육 일정 도우미입니다. 실제 동료와 대화하듯 자연스럽고 친절하게 답하세요.

데이터:
- 오늘은 ${summary.today}(${weekday}요일), Asia/Seoul 기준입니다.
- 기업교육 일정은 "캘린더_자동화" 시트(15분마다 캘린더와 동기화) 기준입니다. 보유 범위 ${summary.dateRange.min} ~ ${summary.dateRange.max}, 총 ${summary.eventCount}건, 최종 동기화 ${summary.syncedAt || '알 수 없음'}.
- 이 범위 밖의 기간을 물으면 데이터가 없다고 말하세요.
- 강의 불가/선호는 강사가 직접 등록한 "강사일정" 시트 기준입니다.
- 교육명에 "가섭외"가 붙은 일정은 확정 전(가섭외) 일정입니다. 답할 때 확정과 구분해서 알려주세요.

도구 사용 규칙:
- 반드시 도구 결과만 근거로 답하세요. 없는 사실을 추측·만들어내지 마세요.
- 날짜·요일 계산, 겹침 계산, 개수 세기는 직접 하지 말고 도구에 맡기세요. 도구가 준 숫자를 그대로 쓰세요.
- 연도가 생략되면 ${year}년으로 해석하세요. ("10월 28일" → ${year}-10-28)
- 특정 날짜/기간에 교육이 누구에게 있는지 → search_education_events
- 특정 강사의 일정 → get_instructor_schedule
- 여러 날짜에 가능한 강사, "N주 동안 매주 같은 요일에 가능한 강사" → find_available_instructors (반복은 recurringStartDate/recurringWeeks 사용)
- 한 강사의 한 달 빈 날 → compute_free_weekdays
- 많이 나간 강사, 기업별/월별 횟수 → aggregate_education
- 강사 이름 후보가 여러 명이면 후보를 보여주고 어떤 분인지 물어보세요.
- 결과에 truncated=true가 있으면 일부만 보여준 것이라고 알려주세요.

답변 형식:
- 짧고 명확한 한국어로, 날짜(요일)·기업명·강사명 등 근거를 포함하세요.
- 목록이 길면 핵심만 정리하고 총 건수를 함께 알려주세요.
- 마크다운을 쓰지 마세요. **, *, #, -, \`\`\` 같은 기호를 쓰지 말고 일반 문장, "1." 같은 번호, 줄바꿈만 사용하세요.
- 질문이 애매하면(기간·강사·조건 불명확) 도구를 부르기 전에 한두 문장으로 짧게 되물어보세요.`;
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = { role: string; parts: GeminiPart[] };

function toGeminiContents(history: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of history) {
    if (!m.content?.trim()) continue;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return contents;
}

function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts?.length) return '';
  return parts
    .map((p) => ('text' in p && p.text ? p.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** 채팅 UI용: **, *, 불릿 마크다운 제거 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\n)\s*[\*\-]\s+/g, '$1')
    .replace(/(^|\n)\s*\d+\.\s+\*\*([^*]+)\*\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uniqueModels(): string[] {
  return Array.from(new Set(MODEL_CANDIDATES));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 사용자에게 보여줄 오류 문구 */
function friendlyGeminiError(status: number, errText: string): string {
  if (status === 429) return 'AI 요청이 몰려 잠시 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(errText)) {
    return 'Gemini API 키가 올바르지 않습니다. 서버 환경변수 GEMINI_API_KEY를 확인해주세요.';
  }
  if (status === 403) {
    return 'Gemini API 키에 권한이 없습니다. 키의 사용 제한(IP/웹사이트)과 Generative Language API 활성화 여부를 확인해주세요.';
  }
  if (status >= 500) return 'AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.';
  return `AI 응답 중 오류가 발생했습니다. (Gemini ${status})`;
}

async function callGemini(
  apiKey: string,
  model: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: any } | { ok: false; status: number; errText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, data: await res.json() };

    const errText = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      return { ok: false, status: res.status, errText };
    }
    console.warn(`[Gemini] ${model} ${res.status}, ${RETRY_DELAYS_MS[attempt]}ms 후 재시도`);
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

async function callGeminiWithFallback(
  apiKey: string,
  body: Record<string, unknown>,
  preferredModel?: string
): Promise<{ data: any; model: string }> {
  const models = preferredModel
    ? [preferredModel, ...uniqueModels().filter((m) => m !== preferredModel)]
    : uniqueModels();
  let last: { status: number; errText: string } | null = null;

  for (const model of models) {
    const result = await callGemini(apiKey, model, body);
    if (result.ok) {
      if (model !== models[0]) console.log(`[Gemini] fallback model in use: ${model}`);
      return { data: result.data, model };
    }
    console.error(`Gemini API error (${model}):`, result.status, result.errText.slice(0, 500));
    last = result;
    const modelMissing = result.status === 404 || (result.status === 400 && /not found|not supported/i.test(result.errText));
    if (!modelMissing) break;
  }

  throw new Error(last ? friendlyGeminiError(last.status, last.errText) : 'AI 응답 중 오류가 발생했습니다.');
}

export async function runScheduleChat(history: ChatMessage[]): Promise<{ answer: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const contents = toGeminiContents(history);
  if (!contents.length) {
    throw new Error('메시지가 비어 있습니다.');
  }

  let summary: Awaited<ReturnType<typeof getScheduleDataSummary>>;
  try {
    summary = await getScheduleDataSummary();
  } catch (error: any) {
    console.error('[일정 도우미] 시트 데이터 로드 실패:', error);
    throw new Error('일정 시트(캘린더_자동화)를 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  const systemInstruction = { parts: [{ text: buildSystemInstruction(summary) }] };

  let activeModel: string | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { data, model } = await callGeminiWithFallback(
      apiKey,
      {
        system_instruction: systemInstruction,
        tools: [{ function_declarations: SCHEDULE_CHAT_TOOL_DECLARATIONS }],
        contents,
        generationConfig: { temperature: 0.2 },
      },
      activeModel
    );
    activeModel = model;

    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.filter(
      (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
        'functionCall' in p && !!p.functionCall
    );

    if (functionCalls.length === 0) {
      return { answer: stripMarkdown(extractText(parts)) || '답변을 생성하지 못했습니다. 질문을 조금 바꿔서 다시 물어봐주세요.' };
    }

    contents.push({ role: 'model', parts });

    const responseParts: GeminiPart[] = [];
    for (const fc of functionCalls) {
      const name = fc.functionCall.name;
      let result: unknown;
      try {
        result = await runScheduleChatTool(name, fc.functionCall.args || {});
      } catch (e: any) {
        console.error(`[일정 도우미] 도구 실행 실패 (${name}):`, e);
        result = { error: e?.message || '도구 실행 실패' };
      }
      responseParts.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  const { data: finalData } = await callGeminiWithFallback(
    apiKey,
    {
      system_instruction: systemInstruction,
      tools: [{ function_declarations: SCHEDULE_CHAT_TOOL_DECLARATIONS }],
      tool_config: { function_calling_config: { mode: 'NONE' } },
      contents,
      generationConfig: { temperature: 0.2 },
    },
    activeModel
  );

  return {
    answer:
      stripMarkdown(extractText(finalData.candidates?.[0]?.content?.parts)) ||
      '조회 후 답변을 만들지 못했습니다. 질문을 조금 더 구체적으로 해주세요.',
  };
}
