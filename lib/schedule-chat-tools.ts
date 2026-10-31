import {
  addDays,
  EducationEvent,
  getScheduleData,
  InstructorInfo,
  normalizeDate,
  normalizePersonName,
  ScheduleData,
  todaySeoul,
  WEEKDAY_KO,
  weekdayOf,
} from '@/lib/schedule-sheet-data';

const MAX_EVENTS_RETURNED = 150;
const MAX_RANGE_DAYS = 400;

type StatusFilter = 'all' | 'confirmed' | 'tentative';

function toStatusFilter(raw: unknown): StatusFilter {
  return raw === 'confirmed' || raw === 'tentative' ? raw : 'all';
}

function matchesStatus(event: EducationEvent, status: StatusFilter): boolean {
  if (status === 'confirmed') return !event.tentative;
  if (status === 'tentative') return event.tentative;
  return true;
}

function parseRange(dateFrom: unknown, dateTo: unknown): { from: string; to: string } | { error: string } {
  const from = normalizeDate(String(dateFrom || ''));
  const to = normalizeDate(String(dateTo || dateFrom || ''));
  if (!from || !to) return { error: 'dateFrom/dateTo는 YYYY-MM-DD 형식이어야 합니다.' };
  if (to < from) return { error: 'dateTo가 dateFrom보다 빠릅니다.' };
  if (to > addDays(from, MAX_RANGE_DAYS)) return { error: `조회 기간은 최대 ${MAX_RANGE_DAYS}일입니다.` };
  return { from, to };
}

function overlapsRange(event: EducationEvent, from: string, to: string): boolean {
  return event.dates.some((d) => d >= from && d <= to);
}

function instructorAttends(event: EducationEvent, instructor: InstructorInfo): boolean {
  return instructor.emails.some((email) => event.attendeeEmails.includes(email));
}

function eventHours(event: EducationEvent): number {
  if (event.allDay || !event.startTime || !event.endTime) return 0;
  const [sh, sm] = event.startTime.split(':').map(Number);
  const [eh, em] = event.endTime.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? (minutes / 60) * event.dates.length : 0;
}

function summarizeEvent(event: EducationEvent, data: ScheduleData) {
  const instructors: string[] = [];
  const others: string[] = [];
  for (const email of event.attendeeEmails) {
    const instructor = data.emailToInstructor.get(email);
    const response = event.responses[email];
    if (instructor) instructors.push(response ? `${instructor.name}(${response})` : instructor.name);
    else others.push(email);
  }
  return {
    date: event.date,
    ...(event.endDate !== event.date ? { endDate: event.endDate } : {}),
    weekday: WEEKDAY_KO[weekdayOf(event.date)],
    time: event.allDay ? '종일' : `${event.startTime}-${event.endTime}`,
    title: event.title,
    company: event.company,
    status: event.tentative ? '가섭외' : '확정',
    location: event.location,
    instructors,
    otherAttendeeCount: others.length,
  };
}

type Resolved = { instructor: InstructorInfo } | { candidates: string[] } | { notFound: string };

function resolveInstructor(data: ScheduleData, query: unknown): Resolved {
  const raw = String(query || '').trim();
  if (!raw) return { notFound: raw };

  if (raw.includes('@')) {
    const hit = data.emailToInstructor.get(raw.toLowerCase());
    return hit ? { instructor: hit } : { notFound: raw };
  }

  const target = normalizePersonName(raw);
  const exact = data.instructors.find((i) => normalizePersonName(i.name) === target);
  if (exact) return { instructor: exact };

  const partial = data.instructors.filter((i) => {
    const name = normalizePersonName(i.name);
    return name.includes(target) || target.includes(name);
  });
  if (partial.length === 1) return { instructor: partial[0] };
  if (partial.length > 1) return { candidates: partial.map((i) => i.name) };
  return { notFound: raw };
}

function resolveError(resolved: Resolved) {
  if ('candidates' in resolved) {
    return { error: '이름이 비슷한 강사가 여러 명입니다. 어느 분인지 확인해주세요.', candidates: resolved.candidates };
  }
  if ('notFound' in resolved) {
    return { error: `강사 명단에서 찾을 수 없습니다: ${resolved.notFound}` };
  }
  return null;
}

function personalDates(data: ScheduleData, instructor: InstructorInfo, type: '강의 불가' | '강의 선호') {
  return new Set(
    data.personalEvents
      .filter((p) => p.type === type && p.emails.some((e) => instructor.emails.includes(e)))
      .map((p) => p.date)
  );
}

function timesOverlap(event: EducationEvent, startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime || event.allDay || !event.startTime || !event.endTime) return true;
  return event.startTime < endTime && startTime < event.endTime;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

async function listInstructors() {
  const data = await getScheduleData();
  return {
    count: data.instructors.length,
    instructors: data.instructors.map((i) => i.name),
  };
}

async function searchEducationEvents(args: Record<string, unknown>) {
  const data = await getScheduleData();
  const range = parseRange(args.dateFrom, args.dateTo);
  if ('error' in range) return range;

  let instructor: InstructorInfo | null = null;
  if (args.instructor) {
    const resolved = resolveInstructor(data, args.instructor);
    const err = resolveError(resolved);
    if (err) return err;
    instructor = (resolved as { instructor: InstructorInfo }).instructor;
  }

  const status = toStatusFilter(args.status);
  const company = String(args.company || '').trim().toLowerCase();
  const keyword = String(args.keyword || '').trim().toLowerCase();

  const matched = data.events.filter(
    (e) =>
      overlapsRange(e, range.from, range.to) &&
      matchesStatus(e, status) &&
      (!company || e.company.toLowerCase().includes(company) || e.title.toLowerCase().includes(company)) &&
      (!keyword || `${e.title} ${e.session} ${e.location}`.toLowerCase().includes(keyword)) &&
      (!instructor || instructorAttends(e, instructor))
  );

  return {
    dateFrom: range.from,
    dateTo: range.to,
    total: matched.length,
    truncated: matched.length > MAX_EVENTS_RETURNED,
    events: matched.slice(0, MAX_EVENTS_RETURNED).map((e) => summarizeEvent(e, data)),
  };
}

async function getInstructorSchedule(args: Record<string, unknown>) {
  const data = await getScheduleData();
  const range = parseRange(args.dateFrom, args.dateTo);
  if ('error' in range) return range;

  const resolved = resolveInstructor(data, args.instructor);
  const err = resolveError(resolved);
  if (err) return err;
  const { instructor } = resolved as { instructor: InstructorInfo };

  const education = data.events.filter((e) => overlapsRange(e, range.from, range.to) && instructorAttends(e, instructor));
  const inRange = (d: string) => d >= range.from && d <= range.to;

  return {
    instructor: instructor.name,
    dateFrom: range.from,
    dateTo: range.to,
    educationCount: education.length,
    totalHours: Math.round(education.reduce((sum, e) => sum + eventHours(e), 0) * 10) / 10,
    education: education.slice(0, MAX_EVENTS_RETURNED).map((e) => summarizeEvent(e, data)),
    unavailableDates: Array.from(personalDates(data, instructor, '강의 불가')).filter(inRange).sort(),
    preferredDates: Array.from(personalDates(data, instructor, '강의 선호')).filter(inRange).sort(),
  };
}

/** 강사 한 명의 특정 날짜들에 대한 충돌 사유 */
function conflictsFor(
  data: ScheduleData,
  instructor: InstructorInfo,
  dates: string[],
  opts: { startTime?: string; endTime?: string; tentativeIsBusy: boolean }
) {
  const unavailable = personalDates(data, instructor, '강의 불가');
  const dateSet = new Set(dates);
  const conflicts = new Map<string, string[]>();

  for (const d of dates) {
    if (unavailable.has(d)) conflicts.set(d, ['강의 불가']);
  }
  for (const e of data.events) {
    if (!opts.tentativeIsBusy && e.tentative) continue;
    if (!instructorAttends(e, instructor) || !timesOverlap(e, opts.startTime, opts.endTime)) continue;
    for (const d of e.dates) {
      if (!dateSet.has(d)) continue;
      const label = `${e.tentative ? '가섭외 ' : ''}${e.company || e.title} ${e.allDay ? '종일' : `${e.startTime}-${e.endTime}`}`;
      conflicts.set(d, [...(conflicts.get(d) || []), label]);
    }
  }
  return conflicts;
}

function availabilityFor(
  data: ScheduleData,
  dates: string[],
  opts: { startTime?: string; endTime?: string; tentativeIsBusy: boolean }
) {
  const fullyAvailable: Array<{ name: string; preferredDates: string[] }> = [];
  const partiallyAvailable: Array<{ name: string; availableDates: string[]; conflicts: Record<string, string[]> }> = [];

  for (const instructor of data.instructors) {
    const conflicts = conflictsFor(data, instructor, dates, opts);
    const preferred = personalDates(data, instructor, '강의 선호');
    if (conflicts.size === 0) {
      fullyAvailable.push({ name: instructor.name, preferredDates: dates.filter((d) => preferred.has(d)) });
    } else if (conflicts.size < dates.length) {
      partiallyAvailable.push({
        name: instructor.name,
        availableDates: dates.filter((d) => !conflicts.has(d)),
        conflicts: Object.fromEntries(conflicts),
      });
    }
  }

  fullyAvailable.sort((a, b) => b.preferredDates.length - a.preferredDates.length || a.name.localeCompare(b.name));
  partiallyAvailable.sort((a, b) => b.availableDates.length - a.availableDates.length);
  return { fullyAvailable, partiallyAvailable: partiallyAvailable.slice(0, 15) };
}

async function findAvailableInstructors(args: Record<string, unknown>) {
  const data = await getScheduleData();
  const startTime = typeof args.startTime === 'string' ? args.startTime : undefined;
  const endTime = typeof args.endTime === 'string' ? args.endTime : undefined;
  const opts = { startTime, endTime, tentativeIsBusy: args.tentativeIsBusy !== false };
  const meta = {
    rule: '가능 = 해당 날짜에 기업교육(가섭외 포함 여부는 tentativeIsBusy) 없음 AND 강의 불가 아님. 시간 지정 시 겹치는 교육만 충돌.',
    timeFilter: startTime && endTime ? `${startTime}-${endTime}` : '하루 전체',
    instructorPoolSize: data.instructors.length,
  };

  // 매주 같은 요일 반복 모드
  if (args.recurringStartDate) {
    const start = normalizeDate(String(args.recurringStartDate));
    const weeks = Math.min(Math.max(Number(args.recurringWeeks) || 4, 1), 12);
    if (!start) return { error: 'recurringStartDate는 YYYY-MM-DD 형식이어야 합니다.' };

    const requested = Array.isArray(args.recurringWeekdays) ? (args.recurringWeekdays as unknown[]).map(String) : [];
    const weekdays = (requested.length ? requested : ['월', '화', '수', '목', '금'])
      .map((w) => WEEKDAY_KO.indexOf(w.replace('요일', '').trim()))
      .filter((w) => w >= 0);

    // 시작일이 속한 주의 월요일 기준
    const monday = addDays(start, -((weekdayOf(start) + 6) % 7));
    const byWeekday = weekdays.map((w) => {
      let first = addDays(monday, (w + 6) % 7);
      if (first < start) first = addDays(first, 7);
      const dates = Array.from({ length: weeks }, (_, i) => addDays(first, i * 7));
      const result = availabilityFor(data, dates, opts);
      return {
        weekday: WEEKDAY_KO[w],
        dates,
        fullyAvailable: result.fullyAvailable,
        partiallyAvailable: result.partiallyAvailable.slice(0, 5),
      };
    });
    return { ...meta, mode: `${weeks}주 매주 같은 요일`, byWeekday };
  }

  const dates = (Array.isArray(args.dates) ? (args.dates as unknown[]) : [])
    .map((d) => normalizeDate(String(d)))
    .filter((d): d is string => !!d);
  if (!dates.length) return { error: 'dates 또는 recurringStartDate가 필요합니다.' };

  const unique = Array.from(new Set(dates)).sort();
  return { ...meta, dates: unique, ...availabilityFor(data, unique, opts) };
}

async function computeFreeWeekdays(args: Record<string, unknown>) {
  const data = await getScheduleData();
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(args.yearMonth || '').trim());
  if (!match) return { error: 'yearMonth는 YYYY-MM 형식이어야 합니다.' };

  const resolved = resolveInstructor(data, args.instructor);
  const err = resolveError(resolved);
  if (err) return err;
  const { instructor } = resolved as { instructor: InstructorInfo };

  const first = `${match[1]}-${match[2].padStart(2, '0')}-01`;
  const weekdays: string[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) {
    const w = weekdayOf(d);
    if (w !== 0 && w !== 6) weekdays.push(d);
  }

  const conflicts = conflictsFor(data, instructor, weekdays, { tentativeIsBusy: true });
  const preferred = personalDates(data, instructor, '강의 선호');
  const free = weekdays.filter((d) => !conflicts.has(d));

  return {
    instructor: instructor.name,
    yearMonth: first.slice(0, 7),
    rule: '평일 − (기업교육 ∪ 강의 불가). 주말 제외, 공휴일은 반영하지 않음.',
    weekdayCount: weekdays.length,
    freeCount: free.length,
    freeWeekdays: free,
    busy: Object.fromEntries(conflicts),
    preferredDates: weekdays.filter((d) => preferred.has(d)),
  };
}

async function aggregateEducation(args: Record<string, unknown>) {
  const data = await getScheduleData();
  const range = parseRange(args.dateFrom, args.dateTo);
  if ('error' in range) return range;

  const groupBy = String(args.groupBy || 'instructor');
  const status = toStatusFilter(args.status);
  const company = String(args.company || '').trim().toLowerCase();

  let instructor: InstructorInfo | null = null;
  if (args.instructor) {
    const resolved = resolveInstructor(data, args.instructor);
    const err = resolveError(resolved);
    if (err) return err;
    instructor = (resolved as { instructor: InstructorInfo }).instructor;
  }

  const events = data.events.filter(
    (e) =>
      overlapsRange(e, range.from, range.to) &&
      matchesStatus(e, status) &&
      (!company || e.company.toLowerCase().includes(company) || e.title.toLowerCase().includes(company)) &&
      (!instructor || instructorAttends(e, instructor))
  );

  const groups = new Map<string, { count: number; hours: number }>();
  const add = (key: string, e: EducationEvent) => {
    const g = groups.get(key) || { count: 0, hours: 0 };
    g.count += 1;
    g.hours += eventHours(e);
    groups.set(key, g);
  };

  for (const e of events) {
    if (groupBy === 'company') add(e.company || '(기업명 없음)', e);
    else if (groupBy === 'month') add(e.date.slice(0, 7), e);
    else if (groupBy === 'weekday') add(WEEKDAY_KO[weekdayOf(e.date)], e);
    else {
      const names = new Set(
        e.attendeeEmails.map((email) => data.emailToInstructor.get(email)?.name).filter((n): n is string => !!n)
      );
      if (!names.size) add('(강사 미확인)', e);
      names.forEach((name) => add(name, e));
    }
  }

  const rows = Array.from(groups.entries())
    .map(([key, g]) => ({ key, count: g.count, hours: Math.round(g.hours * 10) / 10 }))
    .sort((a, b) => (groupBy === 'month' ? a.key.localeCompare(b.key) : b.count - a.count));

  return {
    dateFrom: range.from,
    dateTo: range.to,
    groupBy,
    totalEvents: events.length,
    groups: rows.slice(0, 60),
  };
}

// ---------------------------------------------------------------------------

export async function getScheduleDataSummary() {
  const data = await getScheduleData();
  return {
    today: todaySeoul(),
    eventCount: data.events.length,
    dateRange: data.dateRange,
    syncedAt: data.syncedAt,
    instructorCount: data.instructors.length,
  };
}

const dateRangeParams = {
  dateFrom: { type: 'string', description: '시작일 YYYY-MM-DD' },
  dateTo: { type: 'string', description: '종료일 YYYY-MM-DD (하루만 볼 때는 dateFrom과 같게)' },
};

const statusParam = {
  type: 'string',
  enum: ['all', 'confirmed', 'tentative'],
  description: 'all=전체(기본), confirmed=확정만, tentative=가섭외만',
};

export const SCHEDULE_CHAT_TOOL_DECLARATIONS = [
  {
    name: 'list_instructors',
    description: '강사 명단(이름)을 조회합니다. 이름이 애매할 때 후보 확인용.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'search_education_events',
    description:
      '기간 내 기업교육 일정을 검색합니다. 기업명·키워드·강사·확정/가섭외로 필터할 수 있습니다. 특정 날짜에 누가 교육하는지, 어떤 기업 교육이 언제 있는지 등에 사용.',
    parameters: {
      type: 'object',
      properties: {
        ...dateRangeParams,
        company: { type: 'string', description: '기업명 일부 (선택)' },
        keyword: { type: 'string', description: '교육명/차수/장소 키워드 (선택)' },
        instructor: { type: 'string', description: '강사 이름 또는 이메일 (선택)' },
        status: statusParam,
      },
      required: ['dateFrom', 'dateTo'],
    },
  },
  {
    name: 'get_instructor_schedule',
    description: '특정 강사의 기간 내 교육 일정, 총 교육 시간, 강의 불가/선호 날짜를 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        instructor: { type: 'string', description: '강사 이름 또는 이메일' },
        ...dateRangeParams,
      },
      required: ['instructor', 'dateFrom', 'dateTo'],
    },
  },
  {
    name: 'find_available_instructors',
    description:
      '지정한 날짜들에 모두 교육 가능한 강사를 계산합니다(기업교육·강의 불가와 겹치지 않는 강사). ' +
      '여러 특정 날짜는 dates로, "N주 동안 매주 같은 요일" 질문은 recurringStartDate/recurringWeeks/recurringWeekdays로 호출하세요. 날짜 계산은 이 도구가 합니다.',
    parameters: {
      type: 'object',
      properties: {
        dates: { type: 'array', items: { type: 'string' }, description: '확인할 날짜 목록 YYYY-MM-DD' },
        recurringStartDate: { type: 'string', description: '반복 시작일(이 날짜가 속한 주부터) YYYY-MM-DD' },
        recurringWeeks: { type: 'number', description: '반복 주 수 (기본 4)' },
        recurringWeekdays: {
          type: 'array',
          items: { type: 'string' },
          description: '요일 목록 예: ["월","수"]. 생략 시 월~금 각각 계산',
        },
        startTime: { type: 'string', description: '교육 시작 시각 HH:MM (선택, 지정 시 시간이 겹치는 교육만 충돌)' },
        endTime: { type: 'string', description: '교육 종료 시각 HH:MM (선택)' },
        tentativeIsBusy: { type: 'boolean', description: '가섭외 일정도 바쁜 것으로 볼지 (기본 true)' },
      },
    },
  },
  {
    name: 'compute_free_weekdays',
    description: '특정 강사의 해당 월 빈 평일(교육·강의 불가 없는 평일)을 계산합니다.',
    parameters: {
      type: 'object',
      properties: {
        instructor: { type: 'string', description: '강사 이름 또는 이메일' },
        yearMonth: { type: 'string', description: 'YYYY-MM' },
      },
      required: ['instructor', 'yearMonth'],
    },
  },
  {
    name: 'aggregate_education',
    description:
      '기간 내 교육 건수·시간을 강사별/기업별/월별/요일별로 집계합니다. "누가 제일 많이 나갔어", "기업별 교육 횟수", "월별 추이" 같은 질문에 사용.',
    parameters: {
      type: 'object',
      properties: {
        ...dateRangeParams,
        groupBy: { type: 'string', enum: ['instructor', 'company', 'month', 'weekday'] },
        company: { type: 'string', description: '기업명 필터 (선택)' },
        instructor: { type: 'string', description: '강사 필터 (선택)' },
        status: statusParam,
      },
      required: ['dateFrom', 'dateTo', 'groupBy'],
    },
  },
];

export async function runScheduleChatTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_instructors':
      return listInstructors();
    case 'search_education_events':
      return searchEducationEvents(args);
    case 'get_instructor_schedule':
      return getInstructorSchedule(args);
    case 'find_available_instructors':
      return findAvailableInstructors(args);
    case 'compute_free_weekdays':
      return computeFreeWeekdays(args);
    case 'aggregate_education':
      return aggregateEducation(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
