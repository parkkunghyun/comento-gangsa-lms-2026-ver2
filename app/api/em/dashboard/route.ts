import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllEvents } from '@/lib/google-calendar';
import { getInstructorsFromSheetByGid } from '@/lib/google-sheets';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';

const YEAR = 2026;

type RegionKey = '서울' | '경기도' | '지방' | '기타';

/** 개인 일정(강의 불가/선호) 여부 */
function isPersonalEvent(event: { description?: string; id?: string; summary?: string }): boolean {
  const desc = (event.description || '').trim();
  const sum = (event.summary || '').trim();
  const id = (event.id || '').trim();
  if (id.startsWith('personal-')) return true;
  if (desc === '개인 일정' || desc === '강의 불가' || desc === '강의 선호') return true;
  if (desc.includes('선호') || desc.includes('불가')) return true;
  if (sum.includes('선호') || sum.includes('불가')) return true;
  return false;
}

/** 지방 지역명 목록 */
const REGION_LOCAL = [
  '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도',
  '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남',
];

function classifyRegion(location: string, description: string): RegionKey {
  const text = `${location || ''} ${description || ''}`;
  for (const r of REGION_LOCAL) {
    if (text.includes(r)) return '지방';
  }
  if (text.includes('서울')) return '서울';
  if (text.includes('경기도') || text.includes('경기')) return '경기도';
  return '기타';
}

/** 참석자 이메일 정규화 */
function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase().replace(/^mailto:/, '');
}

/**
 * 이벤트 목록에서 강사별 참여 횟수 집계 (시트 등록 강사만, 이름 표시)
 */
function countByInstructorName(
  eventList: { attendees?: Array<{ email?: string }> }[],
  emailToName: Record<string, string>
): Array<{ name: string; count: number }> {
  const map: Record<string, number> = {};
  eventList.forEach((event) => {
    (event.attendees || []).forEach((a) => {
      const email = normalizeEmail(a.email || '');
      const name = email ? emailToName[email] : undefined;
      if (!name) return;
      map[name] = (map[name] || 0) + 1;
    });
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 외부 Top5 / 내부 Top3 로 나누기 */
function splitParticipation(
  list: Array<{ name: string; count: number }>,
  nameToIsExternal: Record<string, boolean>
) {
  const external: Array<{ name: string; count: number }> = [];
  const internal: Array<{ name: string; count: number }> = [];
  list.forEach((item) => {
    if (nameToIsExternal[item.name]) {
      external.push(item);
    } else {
      internal.push(item);
    }
  });
  return {
    externalTop5: external.slice(0, 5),
    internalTop3: internal.slice(0, 3),
  };
}

/** 강사별 지역 참여 집계 (이벤트 목록 + emailToName → 이름별 서울/경기도/지방/기타) */
function instructorRegionStats(
  eventList: { attendees?: Array<{ email?: string }>; location?: string; description?: string }[],
  emailToName: Record<string, string>
): Array<{ name: string; 서울: number; 경기도: number; 지방: number; 기타: number }> {
  const map: Record<string, { 서울: number; 경기도: number; 지방: number; 기타: number }> = {};
  const ensure = (name: string) => {
    if (!map[name]) map[name] = { 서울: 0, 경기도: 0, 지방: 0, 기타: 0 };
    return map[name];
  };
  eventList.forEach((event) => {
    const region = classifyRegion(event.location || '', event.description || '');
    (event.attendees || []).forEach((a) => {
      const email = normalizeEmail(a.email || '');
      const name = email ? emailToName[email] : undefined;
      if (!name) return;
      const row = ensure(name);
      row[region]++;
    });
  });
  return Object.entries(map)
    .map(([name, counts]) => ({ name, ...counts }))
    .filter((r) => r.서울 + r.경기도 + r.지방 + r.기타 > 0)
    .sort((a, b) => {
      const sumA = a.서울 + a.경기도 + a.지방 + a.기타;
      const sumB = b.서울 + b.경기도 + b.지방 + b.기타;
      return sumB - sumA;
    });
}

/** 지역별 전체 건수 (서울, 경기도, 지방, 기타) */
function regionDistribution(
  eventList: { location?: string; description?: string }[]
): Array<{ name: RegionKey; count: number; fill: string }> {
  const counts: Record<RegionKey, number> = { 서울: 0, 경기도: 0, 지방: 0, 기타: 0 };
  eventList.forEach((event) => {
    const r = classifyRegion(event.location || '', event.description || '');
    counts[r]++;
  });
  return [
    { name: '서울', count: counts['서울'], fill: '#3b82f6' },
    { name: '경기도', count: counts['경기도'], fill: '#8b5cf6' },
    { name: '지방', count: counts['지방'], fill: '#10b981' },
    { name: '기타', count: counts['기타'], fill: '#6b7280' },
  ];
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
    }

    const timeMin = new Date(`${YEAR}-01-01T00:00:00Z`).toISOString();
    const timeMax = new Date(`${YEAR}-12-31T23:59:59Z`).toISOString();

    const [events, { emailToName, externalEmails, nameToIsExternal }] = await Promise.all([
      getAllEvents(CALENDAR_ID, timeMin, timeMax),
      getInstructorsFromSheetByGid(),
    ]);

    const educationEvents = (events || []).filter((e) => !isPersonalEvent(e));
    const totalEducation = educationEvents.length;

    let externalParticipatedCount = 0;
    educationEvents.forEach((event) => {
      const hasExternal = (event.attendees || []).some((a) => {
        const email = normalizeEmail(a.email || '');
        return email && externalEmails.has(email);
      });
      if (hasExternal) externalParticipatedCount++;
    });

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const threeMonthsStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const getEventDate = (e: { start?: { dateTime?: string; date?: string } }) => {
      const dt = e.start?.dateTime || e.start?.date;
      return dt ? new Date(dt) : null;
    };

    const thisMonthEvents = educationEvents.filter((e) => {
      const d = getEventDate(e);
      return d && d >= thisMonthStart && d <= thisMonthEnd;
    });
    const threeMonthsEvents = educationEvents.filter((e) => {
      const d = getEventDate(e);
      return d && d >= threeMonthsStart && d <= thisMonthEnd;
    });

    const participationThisMonth = countByInstructorName(thisMonthEvents, emailToName);
    const participationThreeMonths = countByInstructorName(threeMonthsEvents, emailToName);

    const participationMonthSplit = splitParticipation(participationThisMonth, nameToIsExternal);
    const participationThreeSplit = splitParticipation(participationThreeMonths, nameToIsExternal);

    const regionThisMonth = regionDistribution(thisMonthEvents);
    const regionThreeMonths = regionDistribution(threeMonthsEvents);

    const instructorRegionThisMonthAll = instructorRegionStats(thisMonthEvents, emailToName);
    const instructorRegionThreeMonthsAll = instructorRegionStats(threeMonthsEvents, emailToName);
    const instructorRegionThisMonth = instructorRegionThisMonthAll.filter((r) => nameToIsExternal[r.name]);
    const instructorRegionThreeMonths = instructorRegionThreeMonthsAll.filter((r) => nameToIsExternal[r.name]);

    // 이번 달 / 3개월 교육 중 외부 강사 참여 (도넛용)
    const thisMonthTotalEducation = thisMonthEvents.length;
    const thisMonthExternalParticipated = thisMonthEvents.filter((event) =>
      (event.attendees || []).some((a) => {
        const email = normalizeEmail(a.email || '');
        return email && externalEmails.has(email);
      })
    ).length;
    const threeMonthsTotalEducation = threeMonthsEvents.length;
    const threeMonthsExternalParticipated = threeMonthsEvents.filter((event) =>
      (event.attendees || []).some((a) => {
        const email = normalizeEmail(a.email || '');
        return email && externalEmails.has(email);
      })
    ).length;

    const instructorCount = Object.keys(nameToIsExternal).length;
    const instructorCountExternal = Object.values(nameToIsExternal).filter(Boolean).length;

    return NextResponse.json({
      totalEducation,
      externalParticipatedCount,
      thisMonthTotalEducation,
      thisMonthExternalParticipated,
      threeMonthsTotalEducation,
      threeMonthsExternalParticipated,
      instructorCount,
      instructorCountExternal,
      participationThisMonth,
      participationThreeMonths,
      participationMonthSplit: {
        externalTop5: participationMonthSplit.externalTop5,
        internalTop3: participationMonthSplit.internalTop3,
      },
      participationThreeSplit: {
        externalTop5: participationThreeSplit.externalTop5,
        internalTop3: participationThreeSplit.internalTop3,
      },
      regionThisMonth,
      regionThreeMonths,
      instructorRegionThisMonth,
      instructorRegionThreeMonths,
    });
  } catch (error) {
    console.error('[EM Dashboard API]', error);
    return NextResponse.json(
      { error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
