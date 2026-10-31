import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendEmailWithOAuth } from '@/lib/google-gmail-oauth';
import {
  getAllManagers,
  getInstructorEmailCellByName,
  parseEmailCell,
} from '@/lib/google-sheets';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function parseIsoDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function formatOneDate(iso: string): string {
  if (!iso) return '0월 0일(0요일)';
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAYS[d.getDay()]}요일)`;
}

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRecruitEmailHtml(v: {
  instructorName: string;
  company: string;
  courseName: string;
  dates: string[];
  location: string;
  time: string;
  replyDate: string;
  managerName: string;
  managerEmail: string;
}): string {
  const instructor = escapeHtml(v.instructorName || 'OO');
  const company = escapeHtml(v.company || 'OO');
  const course = escapeHtml(v.courseName || 'OOO');
  const schedule = escapeHtml(formatScheduleDates(v.dates));
  const location = escapeHtml(v.location || 'OOOO');
  const time = escapeHtml(v.time || '00:00~00:00 / 총 0시간');
  const reply = escapeHtml(formatReplyDate(v.replyDate));
  const manager = escapeHtml(v.managerName || '000');
  const managerEmail = escapeHtml(v.managerEmail || 'ooo@comento.kr');

  const paragraphs = [
    `안녕하세요, ${instructor} 강사님.`,
    `포텐스닷 ${manager} 매니저입니다.`,
    '',
    `다름이 아니라, '${company}' 기업을 대상으로 하는 ${course} 교육 섭외 건으로 연락을 드렸습니다.`,
    '기업 측에서 희망하는 일자가 확정되어있어, 강사님께 아래 일정을 제안드리고자 합니다.',
    '',
    '[교육 개요]',
    `1. 과정명: ${course}`,
    `2. 교육 일정: ${schedule}`,
    `3. 교육 장소: ${location}`,
    `4. 교육 시간: ${time}`,
    '',
    '현재 기업 측에서 멘토님의 가능 일정을 기다리고 있습니다.',
    `바쁘시겠지만, 원활한 일정 확정을 위해 ${reply}까지 회신 주시면 감사하겠습니다.`,
    '',
    `해당 담당 교육매니저 ${manager}에게 회신 주시면 감사드리겠습니다.`,
    `담당 교육 매니저 메일: ${managerEmail}`,
    '',
    '그 외 궁금하신 내용은 언제든 편하게 말씀해주세요.',
    '',
    '감사합니다.',
  ];

  return paragraphs
    .map((line) => (line === '' ? '<br/>' : `<p style="margin:0 0 8px 0;line-height:1.6;">${line}</p>`))
    .join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      instructorName,
      managerName,
      company,
      courseName,
      dates,
      location,
      time,
      replyDate,
    } = body;

    if (!instructorName || !managerName) {
      return NextResponse.json(
        { error: '강사 성함과 매니저를 선택해주세요.' },
        { status: 400 }
      );
    }

    const emailCell = await getInstructorEmailCellByName(instructorName);
    const instructorEmails = emailCell ? parseEmailCell(emailCell) : [];
    if (instructorEmails.length === 0) {
      return NextResponse.json(
        {
          error: `'${instructorName}' 강사의 이메일을 강사정보 시트에서 찾을 수 없습니다.`,
        },
        { status: 400 }
      );
    }

    const managers = await getAllManagers();
    const manager = managers.find((m) => m.name === managerName);
    if (!manager?.email) {
      return NextResponse.json(
        {
          error: `'${managerName}' 매니저 이메일을 EM로그인 시트에서 찾을 수 없습니다.`,
        },
        { status: 400 }
      );
    }

    const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    const from =
      process.env.GOOGLE_OAUTH_USER_EMAIL ||
      process.env.GMAIL_FROM ||
      user.email;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: 'OAuth2 토큰이 설정되지 않았습니다. 먼저 OAuth 인증을 완료해주세요.',
          authUrl: '/api/auth/oauth/authorize',
        },
        { status: 401 }
      );
    }

    if (!from) {
      return NextResponse.json(
        { error: '발신자 이메일(GOOGLE_OAUTH_USER_EMAIL)이 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const subject = '[포텐스닷] 기업교육 강사 섭외 건';
    const html = buildRecruitEmailHtml({
      instructorName,
      managerName,
      managerEmail: manager.email,
      company: company || '',
      courseName: courseName || '',
      dates: Array.isArray(dates) ? dates : [],
      location: location || '',
      time: time || '',
      replyDate: replyDate || '',
    });

    const to = instructorEmails.join(', ');
    const cc = manager.email;
    const replyTo = manager.email;

    await sendEmailWithOAuth(to, subject, html, from, accessToken, refreshToken, {
      cc,
      replyTo,
    });

    return NextResponse.json({
      success: true,
      message: '섭외 메일이 전송되었습니다.',
      to,
      cc,
      replyTo,
      subject,
    });
  } catch (error: any) {
    console.error('Send recruit email API error:', error);

    if (
      error.message?.includes('failedPrecondition') ||
      error.message?.includes('Precondition check failed')
    ) {
      return NextResponse.json(
        {
          error:
            error.message ||
            '메일 전송 실패: OAuth 계정과 From 주소가 일치하는지 확인해주세요.',
          requiresReauth: true,
          authUrl: '/api/auth/oauth/authorize',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || '섭외 메일 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
