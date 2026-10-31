'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const EXAMPLE_CHIPS = [
  '10월 28일에 교육 있는 강사님 누구야?',
  '11월 23일주부터 4주 동안 매주 같은 요일에 가능한 강사',
  '11월에 교육 제일 많이 나간 강사 순위',
];

const panelBg = {
  background: 'linear-gradient(165deg, #f3fbf6 0%, #e8f7ef 45%, #f7fcf9 100%)',
};

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
    </svg>
  );
}

function ShrinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25" />
    </svg>
  );
}

const BUTTON_SIZE = 96;
const EDGE_MARGIN = 20;
const PANEL_GAP = 12;
const DRAG_THRESHOLD = 5;
const POSITION_STORAGE_KEY = 'em-schedule-chat-position';

type Position = { x: number; y: number };

function clampPosition(pos: Position): Position {
  const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE);
  const maxY = Math.max(0, window.innerHeight - BUTTON_SIZE);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

function defaultPosition(): Position {
  return {
    x: window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BUTTON_SIZE - EDGE_MARGIN,
  };
}

export default function EMScheduleChat() {
  const [position, setPosition] = useState<Position | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: Position; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        '안녕하세요. 교육·강사 일정을 물어보시면 캘린더 기준으로 찾아드릴게요. 연도를 안 적어주셔도 기본적으로 올해로 볼게요. 애매하면 다시 여쭤볼게요.',
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    let initial = defaultPosition();
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') initial = parsed;
      }
    } catch {}
    setPosition(clampPosition(initial));
    setViewport({ width: window.innerWidth, height: window.innerHeight });

    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPosition((prev) => (prev ? clampPosition(prev) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: position, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }
    setPosition(clampPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag?.moved) return;
    // 드래그 직후 발생하는 click으로 채팅창이 열리고 닫히지 않게 함
    suppressClickRef.current = true;
    setDragging(false);
    setPosition((prev) => {
      if (prev) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(prev));
        } catch {}
      }
      return prev;
    });
  };

  const closeAll = () => {
    setOpen(false);
    setExpanded(false);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const nextHistory = [...messages, { role: 'user' as const, content }];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/em/schedule-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '응답에 실패했습니다.');
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer || '응답이 비어 있습니다.' },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message || '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const chatBody = (opts: { large?: boolean }) => {
    const large = !!opts.large;
    return (
      <>
        <div className={`flex items-center justify-between gap-2 ${large ? 'px-6 py-4' : 'px-4 py-3.5'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/agent-image.jpg"
              alt=""
              className={`${large ? 'w-11 h-11' : 'w-9 h-9'} rounded-full object-contain bg-white/70 shadow-sm`}
            />
            <div className="min-w-0">
              <p className={`${large ? 'text-base' : 'text-sm'} font-semibold text-[#2d6a4f]`}>
                일정 도우미
              </p>
              <p className="text-[10px] text-[#5a8f72]">캘린더·강사 일정 Q&A</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-8 h-8 rounded-full text-[#5a8f72] hover:bg-white/60 hover:text-[#2d6a4f] flex items-center justify-center transition-colors"
              aria-label={expanded ? '작게 보기' : '크게 보기'}
              title={expanded ? '작게 보기' : '크게 보기'}
            >
              {expanded ? (
                <ShrinkIcon className="w-4 h-4" />
              ) : (
                <ExpandIcon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="w-8 h-8 rounded-full text-[#5a8f72] hover:bg-white/60 hover:text-[#2d6a4f] text-lg leading-none transition-colors"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto space-y-2.5 ${large ? 'px-6 pb-3' : 'px-3.5 pb-2'}`}>
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] leading-relaxed whitespace-pre-wrap rounded-2xl shadow-sm ${
                  large ? 'px-4 py-3 text-sm' : 'px-3.5 py-2.5 text-xs'
                } ${
                  m.role === 'user'
                    ? 'bg-[#66ce94] text-white rounded-br-md'
                    : 'bg-white/90 text-[#3d5c4a] rounded-bl-md'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <p className="text-[11px] text-[#5a8f72] px-1 animate-pulse">일정을 찾는 중…</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={`flex flex-wrap gap-1.5 ${large ? 'px-6 pb-3' : 'px-3.5 pb-2'}`}>
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => send(chip)}
              className="text-[10px] px-2.5 py-1.5 rounded-full bg-white/70 text-[#2d6a4f] hover:bg-white disabled:opacity-50 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          className={`flex gap-2 ${large ? 'px-6 pb-5' : 'px-3.5 pb-3.5'}`}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="일정을 물어보세요"
            disabled={sending}
            className={`flex-1 min-w-0 rounded-full bg-white/90 text-[#2d6a4f] placeholder:text-[#8bb89e] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#66ce94]/50 ${
              large ? 'px-5 py-3 text-sm' : 'px-4 py-2.5 text-xs'
            }`}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={`shrink-0 rounded-full bg-[#66ce94] text-white font-medium shadow-sm hover:bg-[#55c085] disabled:opacity-50 transition-colors ${
              large ? 'px-5 py-3 text-sm' : 'px-4 py-2.5 text-xs'
            }`}
          >
            전송
          </button>
        </form>
      </>
    );
  };

  return (
    <>
      {open && expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/25 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <div
            className="w-full max-w-3xl h-[min(85vh,720px)] flex flex-col overflow-hidden rounded-3xl shadow-[0_20px_60px_rgba(45,106,79,0.2)]"
            style={panelBg}
            role="dialog"
            aria-modal="true"
            aria-label="일정 도우미 크게 보기"
          >
            {chatBody({ large: true })}
          </div>
        </div>
      )}

      {position && open && !expanded && (
        <div
          className="fixed z-40 w-[min(100vw-2rem,460px)] h-[min(72vh,560px)] flex flex-col overflow-hidden rounded-3xl shadow-[0_12px_40px_rgba(102,206,148,0.22)]"
          style={{ ...panelBg, ...panelPlacement(position, viewport) }}
        >
          {chatBody({ large: false })}
        </div>
      )}

      {position && (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            if (open) closeAll();
            else setOpen(true);
          }}
          style={{ left: position.x, top: position.y }}
          className={`fixed z-40 w-24 h-24 rounded-full bg-white shadow-[0_6px_20px_rgba(102,206,148,0.28)] flex items-center justify-center overflow-hidden p-1.5 touch-none select-none focus:outline-none ${
            dragging ? 'cursor-grabbing scale-105' : 'cursor-grab transition-transform duration-200 ease-out hover:scale-110'
          }`}
          aria-label={open ? '일정 도우미 닫기' : '일정 도우미 열기'}
          title="드래그해서 위치를 옮길 수 있어요"
        >
          <img
            src="/agent-image.jpg"
            alt="일정 도우미"
            draggable={false}
            className="w-full h-full rounded-full object-cover pointer-events-none"
          />
        </button>
      )}
    </>
  );
}

/** 버튼이 있는 쪽의 반대 방향(화면 안쪽)으로 채팅창을 펼침 */
function panelPlacement(position: Position, viewport: { width: number; height: number }): React.CSSProperties {
  const centerX = position.x + BUTTON_SIZE / 2;
  const centerY = position.y + BUTTON_SIZE / 2;
  const placement: React.CSSProperties = {};

  if (centerX > viewport.width / 2) {
    placement.right = Math.max(16, viewport.width - (position.x + BUTTON_SIZE));
  } else {
    placement.left = Math.max(16, position.x);
  }

  if (centerY > viewport.height / 2) {
    placement.bottom = Math.max(16, viewport.height - position.y + PANEL_GAP);
    placement.maxHeight = Math.max(240, viewport.height - placement.bottom - 16);
  } else {
    placement.top = Math.max(16, position.y + BUTTON_SIZE + PANEL_GAP);
    placement.maxHeight = Math.max(240, viewport.height - placement.top - 16);
  }

  return placement;
}
