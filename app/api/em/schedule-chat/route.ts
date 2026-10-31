import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { runScheduleChat, ChatMessage } from '@/lib/gemini-schedule-chat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수에 Gemini API 키를 추가해주세요.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const messages = body.messages as ChatMessage[] | undefined;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    let history: ChatMessage[] = Array.isArray(messages)
      ? messages
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
          )
          .map((m) => ({ role: m.role, content: m.content.trim() }))
          .filter((m) => m.content.length > 0)
      : [];

    if (message) {
      history = [...history, { role: 'user', content: message }];
    }

    // Gemini contents should start with a user turn
    while (history.length && history[0].role === 'assistant') {
      history = history.slice(1);
    }

    if (!history.length) {
      return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });
    }

    // Keep last N turns to control token use
    if (history.length > 20) {
      history = history.slice(-20);
    }

    const { answer } = await runScheduleChat(history);

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (error: any) {
    console.error('Schedule chat API error:', error);
    return NextResponse.json(
      { error: error?.message || '일정 채팅 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
