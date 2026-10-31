import {
  getAllInstructorsWithEmail,
  getGoogleSheetsClient,
  getInstructorsFromInfoSheet,
  parseEmailCell,
} from '@/lib/google-sheets';

/**
 * 일정 도우미(AI)용 데이터.
 * 기업교육 일정은 Google Calendar를 직접 조회하지 않고, 15분마다 동기화되는 "캘린더_자동화" 시트를 읽습니다.
 * 강의 불가/선호는 "강사일정" 시트, 강사 이름↔이메일은 강사정보·기업교육_외부강사 시트를 사용합니다.
 */

const SPREADSHEET_ID = () =>
  process.env.GOOGLE_CALENDAR_SHEET_SPREADSHEET_ID ||
  process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
  '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const CALENDAR_SHEET_NAME = () => process.env.GOOGLE_CALENDAR_SHEET_NAME || '캘린더_자동화';
const PERSONAL_EVENTS_SHEET_NAME = '강사일정';

/** 시트는 15분마다 갱신되므로 그보다 짧게 캐시 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_EVENT_SPAN_DAYS = 31;

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export interface EducationEvent {
  id: string;
  title: string;
  company: string;
  session: string;
  /** 시작일 YYYY-MM-DD */
  date: string;
  endDate: string;
  /** 일정이 걸친 모든 날짜 */
  dates: string[];
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  attendeeEmails: string[];
  responses: Record<string, string>;
  creatorEmail: string;
  /** 교육명에 "가섭외"가 들어간 일정 */
  tentative: boolean;
  link: string;
}

export interface InstructorInfo {
  name: string;
  emails: string[];
  /** 기업교육_외부강사 시트의 활동 강사 목록에 있는지 */
  inStatusSheet: boolean;
}

export interface PersonalEvent {
  emails: string[];
  date: string;
  type: '강의 불가' | '강의 선호';
  summary: string;
}

export interface ScheduleData {
  events: EducationEvent[];
  instructors: InstructorInfo[];
  emailToInstructor: Map<string, InstructorInfo>;
  personalEvents: PersonalEvent[];
  syncedAt: string;
  dateRange: { min: string; max: string };
  loadedAt: number;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todaySeoul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "2026-10-31", "2026. 10. 31", "2026/10/31" 등을 YYYY-MM-DD로 */
export function normalizeDate(raw: string): string | null {
  const match = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec((raw || '').trim());
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function normalizeTime(raw: string): string {
  const match = /(\d{1,2}):(\d{2})/.exec((raw || '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

export function normalizePersonName(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, '')
    .replace(/(강사|멘토|코치|매니저)?님$/, '')
    .replace(/(강사|멘토|코치)$/, '');
}

function parseResponses(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (raw || '').split('/')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const email = part.slice(0, idx).trim().toLowerCase();
    const response = part.slice(idx + 1).trim();
    if (email.includes('@') && response) result[email] = response;
  }
  return result;
}

function expandDates(start: string, end: string, allDay: boolean): string[] {
  if (!end || end <= start) return [start];
  // 종일 일정의 종료일은 Google Calendar 규칙상 다음 날(배타적)로 들어옴
  const last = allDay ? addDays(end, -1) : end;
  const dates: string[] = [];
  for (let d = start; d <= last && dates.length < MAX_EVENT_SPAN_DAYS; d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates.length ? dates : [start];
}

async function loadCalendarSheet(): Promise<{ events: EducationEvent[]; syncedAt: string }> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `'${CALENDAR_SHEET_NAME()}'!A:T`,
  });
  const rows = response.data.values || [];
  if (rows.length < 2) return { events: [], syncedAt: '' };

  const header = rows[0].map((h) => String(h || '').trim());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    id: col('이벤트 ID'),
    title: col('교육명'),
    company: col('기업명'),
    session: col('교육 차수'),
    date: col('교육 날짜'),
    startTime: col('시작 시간'),
    endTime: col('종료 시간'),
    endDate: col('종료 날짜'),
    allDay: col('종일 일정'),
    location: col('교육 장소'),
    attendeeEmails: col('참석자 이메일'),
    responses: col('참석 응답'),
    creatorEmail: col('생성자 이메일'),
    link: col('캘린더 링크'),
    syncedAt: col('최종 동기화'),
  };
  const cell = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');

  const events: EducationEvent[] = [];
  let syncedAt = '';
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const date = normalizeDate(cell(row, idx.date));
    const title = cell(row, idx.title);
    if (!date || !title) continue;

    const allDay = cell(row, idx.allDay).toUpperCase() === 'Y';
    const endDate = normalizeDate(cell(row, idx.endDate)) || date;
    const company = cell(row, idx.company) || (/\[([^\]]+)\]/.exec(title)?.[1] ?? '').trim();
    const rowSynced = cell(row, idx.syncedAt);
    if (rowSynced > syncedAt) syncedAt = rowSynced;

    events.push({
      id: cell(row, idx.id) || `row-${r + 1}`,
      title,
      company,
      session: cell(row, idx.session),
      date,
      endDate,
      dates: expandDates(date, endDate, allDay),
      startTime: allDay ? '' : normalizeTime(cell(row, idx.startTime)),
      endTime: allDay ? '' : normalizeTime(cell(row, idx.endTime)),
      allDay,
      location: cell(row, idx.location),
      attendeeEmails: parseEmailCell(cell(row, idx.attendeeEmails)),
      responses: parseResponses(cell(row, idx.responses)),
      creatorEmail: cell(row, idx.creatorEmail).toLowerCase(),
      tentative: title.includes('가섭외'),
      link: cell(row, idx.link),
    });
  }

  events.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return { events, syncedAt };
}

async function loadPersonalEvents(): Promise<PersonalEvent[]> {
  const sheets = getGoogleSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0',
      range: `${PERSONAL_EVENTS_SHEET_NAME}!A:D`,
    });
    const rows = response.data.values || [];
    const events: PersonalEvent[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emails = parseEmailCell(String(row[0] || ''));
      const summary = String(row[1] || '').trim();
      const date = normalizeDate(String(row[2] || ''));
      const rawType = String(row[3] || '').trim();
      if (!emails.length || !date) continue;
      const type: PersonalEvent['type'] =
        rawType === '강의 선호' || rawType === '강의 불가'
          ? rawType
          : summary.includes('선호')
            ? '강의 선호'
            : '강의 불가';
      events.push({ emails, date, type, summary });
    }
    return events;
  } catch (error: any) {
    if (error?.code !== 400) console.error('[일정 도우미] 강사일정 시트 조회 실패:', error?.message);
    return [];
  }
}

async function loadInstructors(): Promise<InstructorInfo[]> {
  const [infoList, statusList] = await Promise.all([
    getInstructorsFromInfoSheet().catch(() => []),
    getAllInstructorsWithEmail().catch(() => []),
  ]);

  const byName = new Map<string, InstructorInfo>();
  const upsert = (name: string, emails: string[], inStatusSheet: boolean) => {
    const key = normalizePersonName(name);
    // "박경현2" 같은 테스트 계정(google-sheets TEST_INSTRUCTORS)은 가능 강사 계산에서 제외
    if (!key || !emails.length || /\d$/.test(key)) return;
    const existing = byName.get(key);
    if (existing) {
      existing.emails = Array.from(new Set([...existing.emails, ...emails]));
      existing.inStatusSheet = existing.inStatusSheet || inStatusSheet;
    } else {
      byName.set(key, { name: name.trim(), emails: Array.from(new Set(emails)), inStatusSheet });
    }
  };

  for (const i of infoList) upsert(i.name, parseEmailCell(i.emailCell), false);
  for (const i of statusList) upsert(i.name, parseEmailCell(i.email), true);

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAll(): Promise<ScheduleData> {
  const [{ events, syncedAt }, personalEvents, instructors] = await Promise.all([
    loadCalendarSheet(),
    loadPersonalEvents(),
    loadInstructors(),
  ]);

  const emailToInstructor = new Map<string, InstructorInfo>();
  for (const instructor of instructors) {
    for (const email of instructor.emails) {
      if (!emailToInstructor.has(email)) emailToInstructor.set(email, instructor);
    }
  }

  return {
    events,
    instructors,
    emailToInstructor,
    personalEvents,
    syncedAt,
    dateRange: {
      min: events[0]?.date || '',
      max: events.reduce((max, e) => (e.endDate > max ? e.endDate : max), ''),
    },
    loadedAt: Date.now(),
  };
}

let cache: ScheduleData | null = null;
let inflight: Promise<ScheduleData> | null = null;

export async function getScheduleData(): Promise<ScheduleData> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  if (!inflight) {
    inflight = loadAll()
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (error) {
    // 시트 조회가 일시적으로 실패하면 직전 데이터라도 사용
    if (cache) return cache;
    throw error;
  }
}
