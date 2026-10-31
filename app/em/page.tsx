'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type Period = 'month' | '3months';

interface DashboardData {
  totalEducation: number;
  externalParticipatedCount: number;
  thisMonthTotalEducation: number;
  thisMonthExternalParticipated: number;
  threeMonthsTotalEducation: number;
  threeMonthsExternalParticipated: number;
  instructorCount: number;
  instructorCountExternal: number;
  participationMonthSplit: { externalTop5: Array<{ name: string; count: number }>; internalTop3: Array<{ name: string; count: number }> };
  participationThreeSplit: { externalTop5: Array<{ name: string; count: number }>; internalTop3: Array<{ name: string; count: number }> };
  regionThisMonth: Array<{ name: string; count: number; fill: string }>;
  regionThreeMonths: Array<{ name: string; count: number; fill: string }>;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function formatOneDate(iso: string): string {
  if (!iso) return '0월 0일(0요일)';
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAYS[d.getDay()]}요일)`;
}

/** 하루 / 연속 기간 / 여러 날 표시 */
function formatScheduleDates(dates: string[]): string {
  const sorted = [...dates].filter(Boolean).sort();
  if (sorted.length === 0) return '0월 0일(0요일)';
  if (sorted.length === 1) return formatOneDate(sorted[0]);

  const start = parseIsoDate(sorted[0]);
  const end = parseIsoDate(sorted[sorted.length - 1]);
  const dayMs = 24 * 60 * 60 * 1000;
  const isConsecutive =
    sorted.length === Math.round((end.getTime() - start.getTime()) / dayMs) + 1 &&
    sorted.every((iso, i) => {
      if (i === 0) return true;
      const prev = parseIsoDate(sorted[i - 1]);
      const cur = parseIsoDate(iso);
      return Math.round((cur.getTime() - prev.getTime()) / dayMs) === 1;
    });

  if (isConsecutive) {
    return `${formatOneDate(sorted[0])}~${formatOneDate(sorted[sorted.length - 1])}`;
  }
  return sorted.map(formatOneDate).join(', ');
}

function formatReplyDate(iso: string): string {
  if (!iso) return '0/00(0요일)';
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]}요일)`;
}

function datesBetween(a: string, b: string): string[] {
  const start = parseIsoDate(a <= b ? a : b);
  const end = parseIsoDate(a <= b ? b : a);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function buildRecruitMessage(v: {
  instructorName: string;
  company: string;
  courseName: string;
  dates: string[];
  location: string;
  time: string;
  replyDate: string;
  managerName: string;
}): string {
  const instructor = v.instructorName || 'OO';
  const company = v.company || 'OO';
  const course = v.courseName || 'OOO';
  const schedule = formatScheduleDates(v.dates);
  const location = v.location || 'OOOO';
  const time = v.time || '00:00~00:00 / 총 0시간';
  const reply = formatReplyDate(v.replyDate);
  const manager = v.managerName || '000';

  return `안녕하세요, ${instructor} 강사님.
포텐스닷 ${manager} 매니저입니다.

다름이 아니라, '${company}' 기업을 대상으로 하는 ${course} 교육 섭외 건으로 연락을 드렸습니다.
기업 측에서 희망하는 일자가 확정되어있어, 강사님께 아래 일정을 제안드리고자 합니다.

[교육 개요]
1. 과정명: ${course}
2. 교육 일정: ${schedule}
3. 교육 장소: ${location}
4. 교육 시간: ${time}

현재 기업 측에서 멘토님의 가능 일정을 기다리고 있습니다.
바쁘시겠지만, 원활한 일정 확정을 위해 ${reply}까지 회신 주시면 감사하겠습니다.

그 외 궁금하신 내용은 언제든 편하게 말씀해주세요.

감사합니다.
`;
}

function buildRecruitEmailMessage(v: {
  instructorName: string;
  company: string;
  courseName: string;
  dates: string[];
  location: string;
  time: string;
  replyDate: string;
  managerName: string;
  managerEmail?: string;
}): string {
  const instructor = v.instructorName || 'OO';
  const company = v.company || 'OO';
  const course = v.courseName || 'OOO';
  const schedule = formatScheduleDates(v.dates);
  const location = v.location || 'OOOO';
  const time = v.time || '00:00~00:00 / 총 0시간';
  const reply = formatReplyDate(v.replyDate);
  const manager = v.managerName || '000';
  const managerEmail = v.managerEmail || 'ooo@comento.kr';

  return `안녕하세요, ${instructor} 강사님.
포텐스닷 ${manager} 매니저입니다.

다름이 아니라, '${company}' 기업을 대상으로 하는 ${course} 교육 섭외 건으로 연락을 드렸습니다.
기업 측에서 희망하는 일자가 확정되어있어, 강사님께 아래 일정을 제안드리고자 합니다.

[교육 개요]
1. 과정명: ${course}
2. 교육 일정: ${schedule}
3. 교육 장소: ${location}
4. 교육 시간: ${time}

현재 기업 측에서 멘토님의 가능 일정을 기다리고 있습니다.
바쁘시겠지만, 원활한 일정 확정을 위해 ${reply}까지 회신 주시면 감사하겠습니다.

해당 담당 교육매니저 ${manager}에게 회신 주시면 감사드리겠습니다.
담당 교육 매니저 메일: ${managerEmail}

그 외 궁금하신 내용은 언제든 편하게 말씀해주세요.

감사합니다.
`;
}

function ScheduleDatePicker({
  value,
  onChange,
  inputClassName,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  inputClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = value[0] ? parseIsoDate(value[0]) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRangeStart(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = useMemo(() => new Set(value), [value]);
  const summary =
    value.length === 0
      ? '날짜를 선택하세요'
      : value.length === 1
        ? formatOneDate(value[0])
        : formatScheduleDates(value);

  const firstDow = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toIsoDate(new Date(view.year, view.month, i + 1))
    ),
  ];

  const pick = (iso: string, withRange: boolean) => {
    if (withRange && (rangeStart || value.length > 0)) {
      const anchor = rangeStart || value[value.length - 1];
      const range = datesBetween(anchor, iso);
      onChange(Array.from(new Set([...value, ...range])).sort());
      setRangeStart(iso);
      return;
    }
    if (selected.has(iso)) {
      onChange(value.filter((d) => d !== iso));
      setRangeStart(iso === rangeStart ? null : rangeStart);
      return;
    }
    onChange([...value, iso].sort());
    setRangeStart(iso);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClassName} text-left flex items-center justify-between gap-2`}
      >
        <span className={value.length ? 'text-potens-black' : 'text-[#9a9a9a]'}>{summary}</span>
        <span className="text-potens-body text-[10px] shrink-0">달력</span>
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-full min-w-[280px] max-w-[320px] bg-white border border-potens-line p-3">
          <p className="mb-2 text-[11px] font-bold text-potens-navy leading-relaxed">
            클릭: 날짜 추가/해제 · Shift+클릭: 마지막 선택일부터 연속 선택
          </p>
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="px-2 py-1 text-potens-navy text-sm" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <span className="text-xs font-medium text-potens-navy">
              {view.year}년 {view.month + 1}월
            </span>
            <button type="button" className="px-2 py-1 text-potens-navy text-sm" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] text-potens-body py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, idx) => {
              if (!iso) return <div key={`e-${idx}`} />;
              const isSelected = selected.has(iso);
              const isRangeAnchor = rangeStart === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={(e) => pick(iso, e.shiftKey)}
                  className={`h-8 text-xs transition-colors duration-soft ${
                    isSelected
                      ? 'bg-potens-navy text-white'
                      : isRangeAnchor
                        ? 'bg-[#f3f4f9] text-potens-navy font-medium'
                        : 'text-potens-black hover:bg-[#f7f8fc]'
                  }`}
                >
                  {parseIsoDate(iso).getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <button
              type="button"
              className="text-[11px] text-potens-body hover:text-potens-navy"
              onClick={() => {
                onChange([]);
                setRangeStart(null);
              }}
            >
              초기화
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-potens-orange"
              onClick={() => {
                setOpen(false);
                setRangeStart(null);
              }}
            >
              완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EMDashboardPage() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ role: string; user?: { name: string; email: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [copied, setCopied] = useState(false);
  const [composeMode, setComposeMode] = useState<'sms' | 'email' | null>('sms');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<Array<{ name: string; email: string; emailCell?: string }>>([]);
  const [managers, setManagers] = useState<Array<{ name: string; email: string }>>([]);

  const [msg, setMsg] = useState({
    instructorName: '',
    managerName: '',
    company: '',
    courseName: '',
    dates: [] as string[],
    location: '',
    time: '',
    replyDate: '',
  });

  useEffect(() => {
    if (pathname === '/em') setPeriod('month');
  }, [pathname]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((auth) => {
        if (auth.error || auth.role !== 'EM') {
          setUser(null);
        } else {
          setUser(auth);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const TEST_INSTRUCTOR = {
      name: '박경현2',
      email: 'rudgus4620@gmail.com',
      emailCell: 'rudgus4620@gmail.com',
    };

    Promise.all([
      fetch('/api/em/instructors-info').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/em/instructors?from=info').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/em/managers').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([instData, infoData, mgrData]) => {
        const emailByName = new Map<string, { email: string; emailCell: string }>();
        if (infoData?.instructors) {
          for (const i of infoData.instructors as Array<{
            name: string;
            email: string;
            emailCell?: string;
          }>) {
            if (i.name) {
              emailByName.set(i.name, {
                email: i.email,
                emailCell: i.emailCell || i.email,
              });
            }
          }
        }
        emailByName.set(TEST_INSTRUCTOR.name, {
          email: TEST_INSTRUCTOR.email,
          emailCell: TEST_INSTRUCTOR.emailCell,
        });

        const list: Array<{ name: string; email: string; emailCell?: string }> = [];
        if (instData?.instructors) {
          for (const i of instData.instructors as Array<{
            name?: string;
            email?: string;
            affiliation?: string;
          }>) {
            if (
              !i.name ||
              !i.email ||
              (i.affiliation || '').trim() === '포텐스닷'
            ) {
              continue;
            }
            if (i.name === TEST_INSTRUCTOR.name) continue;
            const fromInfo = emailByName.get(i.name);
            list.push({
              name: i.name,
              email: fromInfo?.email || i.email,
              emailCell: fromInfo?.emailCell || i.email,
            });
          }
        }
        list.push(TEST_INSTRUCTOR);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setInstructors(list);

        if (mgrData?.managers) setManagers(mgrData.managers);
      })
      .catch(() => {
        setInstructors([TEST_INSTRUCTOR]);
      });
  }, []);

  useEffect(() => {
    if (!user?.user?.email || managers.length === 0 || msg.managerName) return;
    const email = user.user.email.trim().toLowerCase();
    const matched = managers.find((m) => m.email.trim().toLowerCase() === email);
    if (matched) setMsg((prev) => ({ ...prev, managerName: matched.name }));
  }, [user, managers, msg.managerName]);

  useEffect(() => {
    if (!user) return;
    setError(null);
    fetch('/api/em/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('데이터를 불러올 수 없습니다.');
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        setError(err.message || '오류가 발생했습니다.');
        setData(null);
      });
  }, [user]);

  const previewText = useMemo(() => buildRecruitMessage(msg), [msg]);
  const selectedInstructor = useMemo(
    () => instructors.find((i) => i.name === msg.instructorName) || null,
    [instructors, msg.instructorName]
  );
  const selectedManager = useMemo(
    () => managers.find((m) => m.name === msg.managerName) || null,
    [managers, msg.managerName]
  );
  const emailPreviewText = useMemo(
    () =>
      buildRecruitEmailMessage({
        ...msg,
        managerEmail: selectedManager?.email,
      }),
    [msg, selectedManager?.email]
  );

  const emailSubject = '[포텐스닷] 기업교육 강사 섭외 건';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('복사에 실패했습니다. 미리보기 텍스트를 직접 선택해 복사해 주세요.');
    }
  };

  const sendRecruitEmail = async () => {
    if (!msg.instructorName || !msg.managerName) {
      alert('강사 성함과 매니저를 선택해주세요.');
      return;
    }
    if (!selectedInstructor?.emailCell && !selectedInstructor?.email) {
      alert('선택한 강사의 이메일을 강사정보 시트에서 찾을 수 없습니다.');
      return;
    }
    if (!selectedManager?.email) {
      alert('선택한 매니저 이메일을 EM로그인 시트에서 찾을 수 없습니다.');
      return;
    }
    if (
      !confirm(
        `${msg.instructorName} 강사님께 섭외 메일을 전송할까요?\n참조(CC): ${selectedManager.email}`
      )
    ) {
      return;
    }

    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/em/send-recruit-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorName: msg.instructorName,
          managerName: msg.managerName,
          company: msg.company,
          courseName: msg.courseName,
          dates: msg.dates,
          location: msg.location,
          time: msg.time,
          replyDate: msg.replyDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.authUrl) {
          setEmailResult(data.error || 'OAuth 인증이 필요합니다.');
          if (confirm(`${data.error || 'OAuth 인증이 필요합니다.'}\n인증 페이지로 이동할까요?`)) {
            window.location.href = data.authUrl;
          }
          return;
        }
        throw new Error(data.error || '메일 전송에 실패했습니다.');
      }
      setEmailResult(`전송 완료 · To ${data.to} · Cc ${data.cc}`);
    } catch (err: any) {
      setEmailResult(err.message || '메일 전송에 실패했습니다.');
      alert(err.message || '메일 전송에 실패했습니다.');
    } finally {
      setEmailSending(false);
    }
  };

  const setField = (key: 'instructorName' | 'managerName' | 'company' | 'courseName' | 'location' | 'time' | 'replyDate', value: string) => {
    setMsg((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-potens-line border-t-potens-navy rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-potens-body">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-potens-navy">
        <p className="text-sm text-white">로그인이 필요합니다.</p>
      </div>
    );
  }

  const totalEducation = data?.totalEducation ?? 0;
  const externalCount = data?.externalParticipatedCount ?? 0;
  const externalRatio =
    totalEducation > 0 ? ((externalCount / totalEducation) * 100).toFixed(1) : '0';
  const totalForPeriod =
    period === 'month' ? (data?.thisMonthTotalEducation ?? 0) : (data?.threeMonthsTotalEducation ?? 0);
  const externalForPeriod =
    period === 'month' ? (data?.thisMonthExternalParticipated ?? 0) : (data?.threeMonthsExternalParticipated ?? 0);
  const ratioForPeriod =
    totalForPeriod > 0 ? ((externalForPeriod / totalForPeriod) * 100).toFixed(1) : '0';
  const instructorCountExternal = data?.instructorCountExternal ?? 0;

  const participationSplit = period === 'month' ? data?.participationMonthSplit : data?.participationThreeSplit;
  const periodLabel = period === 'month' ? '이번 달' : '최근 3개월';

  const donutData = [
    { name: '외부 강사 참여', value: externalForPeriod, color: '#15237A' },
    { name: '미참여', value: totalForPeriod - externalForPeriod, color: '#D9D9D9' },
  ].filter((d) => d.value > 0);

  const inputClass = 'potens-input text-xs py-1.5';

  const statCards = [
    { label: '전체 교육 일정', value: totalEducation, suffix: '건', hint: '2026 기업교육' },
    { label: '외부 강사 참여 교육', value: externalCount, suffix: '건', hint: `전체의 ${externalRatio}%` },
    { label: '대기 줄 배정', value: 0, suffix: '건', hint: '' },
    { label: '외부 강사 수', value: instructorCountExternal, suffix: '명', hint: '' },
  ];

  return (
    <div className="space-y-6 pb-8 text-[13px]">
      <div>
        <h1 className="potens-title text-xl">
          2026 강사 대시보드<span className="text-potens-orange">.</span>
        </h1>
        <p className="potens-body text-sm mt-1">교육 운영 통계를 한눈에 확인하세요.</p>
      </div>

      {error && (
        <div className="border border-potens-line px-3 py-2 text-xs text-potens-body bg-white">
          {error}
        </div>
      )}

      {/* 대시보드 영역: 데이터 로딩 중에도 자리를 잡아 템플릿보다 먼저 보이게 */}
      {!data ? (
        <div className="potens-panel px-5 py-16 flex flex-col items-center justify-center gap-3 min-h-[280px]">
          <div className="w-8 h-8 border-2 border-potens-line border-t-potens-navy rounded-full animate-spin" />
          <p className="text-sm font-medium text-potens-navy">대시보드 데이터 연동 중</p>
          <p className="text-xs text-potens-body">잠시만 기다려주세요...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-potens-line divide-x divide-y md:divide-y-0 divide-potens-line">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white p-4">
                <p className="text-[11px] font-medium text-potens-navy">{card.label}</p>
                <p className="mt-1.5 text-xl tabular-nums">
                  <span className="potens-accent-num">{card.value.toLocaleString()}</span>
                  <span className="text-potens-body text-sm font-normal ml-0.5">{card.suffix}</span>
                </p>
                {card.hint ? <p className="text-[11px] text-potens-body mt-1">{card.hint}</p> : null}
              </div>
            ))}
          </div>

          <div className="potens-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-potens-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="potens-subtitle text-sm">교육 참석 현황</h2>
                <p className="text-[11px] text-potens-body mt-0.5">{periodLabel} 참여 횟수</p>
              </div>
              <div className="flex items-center border border-potens-line">
                {(['month', '3months'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3.5 py-1.5 text-xs font-medium transition-colors duration-soft ${
                      period === p
                        ? 'bg-potens-navy text-white'
                        : 'bg-white text-potens-body hover:text-potens-navy'
                    }`}
                  >
                    {p === 'month' ? '이번 달' : '3개월'}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-xs font-medium text-potens-navy mb-3">외부 강사 참여 Top 5</h3>
                {!(participationSplit?.externalTop5?.length) ? (
                  <p className="text-xs text-potens-body py-4">데이터 없음</p>
                ) : (
                  <div className="h-40 max-w-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={participationSplit.externalTop5} layout="vertical" margin={{ top: 2, right: 8, left: 4, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="0" stroke="#D9D9D9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#5C5C5C' }} axisLine={{ stroke: '#D9D9D9' }} />
                        <YAxis type="category" dataKey="name" width={52} tick={{ fontSize: 10, fill: '#5C5C5C' }} axisLine={{ stroke: '#D9D9D9' }} />
                        <Tooltip contentStyle={{ fontSize: '11px', border: '1px solid #D9D9D9', borderRadius: 0 }} formatter={(value: number) => [`${value}회`, '참여']} />
                        <Bar dataKey="count" fill="#15237A" name="참여 횟수" barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-medium text-potens-navy mb-3">내부 강사 참여 Top 3</h3>
                {!(participationSplit?.internalTop3?.length) ? (
                  <p className="text-xs text-potens-body py-4">데이터 없음</p>
                ) : (
                  <div className="h-40 max-w-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={participationSplit.internalTop3} layout="vertical" margin={{ top: 2, right: 8, left: 4, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="0" stroke="#D9D9D9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#5C5C5C' }} axisLine={{ stroke: '#D9D9D9' }} />
                        <YAxis type="category" dataKey="name" width={52} tick={{ fontSize: 10, fill: '#5C5C5C' }} axisLine={{ stroke: '#D9D9D9' }} />
                        <Tooltip contentStyle={{ fontSize: '11px', border: '1px solid #D9D9D9', borderRadius: 0 }} formatter={(value: number) => [`${value}회`, '참여']} />
                        <Bar dataKey="count" fill="#F26300" name="참여 횟수" barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-medium text-potens-navy mb-3">{periodLabel} 외부 강사 참여 비율</h3>
                {donutData.length === 0 ? (
                  <p className="text-xs text-potens-body py-4">데이터 없음</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-44 h-44 shrink-0 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={53} paddingAngle={1} dataKey="value" nameKey="name">
                            {donutData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: '11px', border: '1px solid #D9D9D9', borderRadius: 0 }} formatter={(v: number) => [`${v}건`, '']} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs font-bold text-potens-black">
                          <span className="text-potens-orange">{externalForPeriod}</span>
                          <span className="text-potens-body">/{totalForPeriod}건</span>
                        </span>
                        <span className="text-[10px] font-medium text-potens-navy">{ratioForPeriod}% 참여</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-potens-body leading-relaxed">
                      전체 {totalForPeriod}건 중<br />외부 강사 참여 {externalForPeriod}건
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setComposeMode((m) => (m === 'sms' ? null : 'sms'))}
          className={
            composeMode === 'sms'
              ? 'potens-btn-primary text-xs py-2 px-4'
              : 'potens-btn-secondary text-xs py-2 px-4'
          }
        >
          섭외 문자 작성
        </button>
        <button
          type="button"
          onClick={() => setComposeMode((m) => (m === 'email' ? null : 'email'))}
          className={
            composeMode === 'email'
              ? 'potens-btn-primary text-xs py-2 px-4'
              : 'potens-btn-secondary text-xs py-2 px-4'
          }
        >
          섭외 메일 작성
        </button>
      </div>

      {composeMode === 'sms' && (
        <div className="potens-panel overflow-visible">
          <div className="px-5 py-4 border-b border-potens-line flex items-center justify-between gap-2">
            <div>
              <h2 className="potens-subtitle text-sm">섭외 문자 작성</h2>
              <p className="text-[11px] text-potens-body mt-0.5">왼쪽 입력 → 오른쪽 미리보기 · 복사해서 바로 사용</p>
            </div>
            <button type="button" onClick={copyMessage} className="potens-btn-primary text-xs py-1.5 px-3 shrink-0">
              {copied ? '복사됨' : '문자 복사'}
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
            <div className="space-y-3 overflow-visible">
              <label className="block">
                <span className="block text-[11px] font-medium text-potens-navy mb-1">강사 성함</span>
                <select value={msg.instructorName} onChange={(e) => setField('instructorName', e.target.value)} className={inputClass}>
                  <option value="">선택하세요</option>
                  {instructors.map((inst) => (
                    <option key={`${inst.name}-${inst.email}`} value={inst.name}>{inst.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-potens-navy mb-1">매니저</span>
                <select value={msg.managerName} onChange={(e) => setField('managerName', e.target.value)} className={inputClass}>
                  <option value="">선택하세요</option>
                  {managers.map((m) => (
                    <option key={`${m.name}-${m.email}`} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['company', '기업명', 'text', '예: 코웨이'],
                  ['courseName', '과정명', 'text', '예: Apps Script 핸즈온'],
                ] as const
              ).map(([key, label, type, placeholder]) => (
                <label key={key} className="block">
                  <span className="block text-[11px] font-medium text-potens-navy mb-1">{label}</span>
                  <input type={type} value={msg[key]} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} className={inputClass} />
                </label>
              ))}
              <div>
                <span className="block text-[11px] font-medium text-potens-navy mb-1">일자</span>
                <ScheduleDatePicker
                  value={msg.dates}
                  onChange={(dates) => setMsg((prev) => ({ ...prev, dates }))}
                  inputClassName={inputClass}
                />
              </div>
              {(
                [
                  ['location', '교육장소', 'text', '예: 코웨이 본사 (서울시 구로구)'],
                  ['time', '교육시간', 'text', '예: 14:00~17:00 / 총 3시간'],
                  ['replyDate', '답변회신 일자', 'date', ''],
                ] as const
              ).map(([key, label, type, placeholder]) => (
                <label key={key} className="block">
                  <span className="block text-[11px] font-medium text-potens-navy mb-1">{label}</span>
                  <input
                    type={type}
                    value={msg[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={placeholder || undefined}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
            <div>
              <p className="text-[11px] font-medium text-potens-navy mb-1">문자 미리보기</p>
              <pre className="whitespace-pre-wrap text-xs text-potens-body bg-white border border-potens-line p-4 min-h-[320px] max-h-[520px] overflow-y-auto font-sans leading-relaxed">
                {previewText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {composeMode === 'email' && (
        <div className="potens-panel overflow-visible">
          <div className="px-5 py-4 border-b border-potens-line flex items-center justify-between gap-2">
            <div>
              <h2 className="potens-subtitle text-sm">섭외 메일 작성</h2>
              <p className="text-[11px] text-potens-body mt-0.5">
                To=강사정보 · Cc·Reply-To=담당 EM(EM로그인)
              </p>
            </div>
            <button
              type="button"
              onClick={sendRecruitEmail}
              disabled={emailSending}
              className="potens-btn-primary text-xs py-1.5 px-3 shrink-0 disabled:opacity-60"
            >
              {emailSending ? '전송 중…' : '메일 전송'}
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
            <div className="space-y-3 overflow-visible">
              <label className="block">
                <span className="block text-[11px] font-medium text-potens-navy mb-1">강사 성함</span>
                <select value={msg.instructorName} onChange={(e) => setField('instructorName', e.target.value)} className={inputClass}>
                  <option value="">선택하세요</option>
                  {instructors.map((inst) => (
                    <option key={`${inst.name}-${inst.email}`} value={inst.name}>{inst.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-potens-navy mb-1">매니저</span>
                <select value={msg.managerName} onChange={(e) => setField('managerName', e.target.value)} className={inputClass}>
                  <option value="">선택하세요</option>
                  {managers.map((m) => (
                    <option key={`${m.name}-${m.email}`} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['company', '기업명', 'text', '예: 코웨이'],
                  ['courseName', '과정명', 'text', '예: Apps Script 핸즈온'],
                ] as const
              ).map(([key, label, type, placeholder]) => (
                <label key={key} className="block">
                  <span className="block text-[11px] font-medium text-potens-navy mb-1">{label}</span>
                  <input type={type} value={msg[key]} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} className={inputClass} />
                </label>
              ))}
              <div>
                <span className="block text-[11px] font-medium text-potens-navy mb-1">일자</span>
                <ScheduleDatePicker
                  value={msg.dates}
                  onChange={(dates) => setMsg((prev) => ({ ...prev, dates }))}
                  inputClassName={inputClass}
                />
              </div>
              {(
                [
                  ['location', '교육장소', 'text', '예: 코웨이 본사 (서울시 구로구)'],
                  ['time', '교육시간', 'text', '예: 14:00~17:00 / 총 3시간'],
                  ['replyDate', '답변회신 일자', 'date', ''],
                ] as const
              ).map(([key, label, type, placeholder]) => (
                <label key={key} className="block">
                  <span className="block text-[11px] font-medium text-potens-navy mb-1">{label}</span>
                  <input
                    type={type}
                    value={msg[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={placeholder || undefined}
                    className={inputClass}
                  />
                </label>
              ))}
              <div className="bg-white border border-potens-line p-3 space-y-2 text-xs text-potens-body">
                <p>
                  <span className="font-medium text-potens-navy">제목</span>
                  <br />
                  {emailSubject}
                </p>
                <p>
                  <span className="font-medium text-potens-navy">받는 사람 (To)</span>
                  <br />
                  {selectedInstructor?.emailCell || selectedInstructor?.email || '강사를 선택하세요'}
                </p>
                <p>
                  <span className="font-medium text-potens-navy">참조 (Cc)</span>
                  <br />
                  {selectedManager?.email || '매니저를 선택하세요'}
                </p>
                <p>
                  <span className="font-medium text-potens-navy">회신 (Reply-To)</span>
                  <br />
                  {selectedManager?.email || '매니저를 선택하세요'}
                </p>
              </div>
              {emailResult && (
                <p className="text-[11px] text-potens-navy bg-potens-bg border border-potens-line px-3 py-2">
                  {emailResult}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium text-potens-navy mb-1">메일 미리보기</p>
              <pre className="whitespace-pre-wrap text-xs text-potens-body bg-white border border-potens-line p-4 min-h-[320px] max-h-[520px] overflow-y-auto font-sans leading-relaxed">
                {emailPreviewText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
