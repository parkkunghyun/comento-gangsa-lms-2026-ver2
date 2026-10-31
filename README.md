# 강사 ADMIN

Next.js App Router 기반의 강사 섭외 및 교육 운영을 위한 LMS(Learning Management System)입니다.

## 프로젝트 개요

이 프로젝트는 기업 교육 강사 섭외 및 관리를 위한 통합 시스템입니다. 강사(INSTRUCTOR)와 교육 매니저(EM) 두 가지 역할로 완전히 분리된 화면 구조와 기능을 제공합니다. Google Spreadsheet를 데이터 소스로 사용하며, Google Calendar와 연동하여 일정을 관리하고, Gmail API를 통해 강사와의 소통을 지원합니다.

## 주요 특징

- **역할 기반 완전 분리 구조**: 강사(INSTRUCTOR)와 EM(Education Manager)이 서로 다른 화면 구조와 메뉴를 가집니다.
- **Google Spreadsheet 기반 인증 및 데이터 관리**: 강사 정보, 정산 데이터, 섭외 로그 등 모든 데이터를 Google Spreadsheet에서 관리합니다.
- **Google Calendar 통합**: 기업 교육 일정을 Google Calendar에서 실시간으로 조회하고 관리합니다.
- **Gmail API 통합**: OAuth2를 통한 Gmail API 연동으로 강사에게 섭외 요청 이메일을 발송할 수 있습니다.
- **JWT 기반 세션 관리**: 안전한 인증 및 권한 관리
- **실시간 섭외율 통계**: 강사별 섭외 요청 수락/거절 통계를 월별로 시각화하여 제공합니다.
- **정산 관리**: 강사별 월별 정산 내역을 조회하고 관리할 수 있습니다.

## 사용자 역할

### 👤 강사 (INSTRUCTOR)

**인증 방식:**
- Google Spreadsheet의 "강사 현황" 시트에서 이름과 이메일로 인증
- C열: 강사명
- H열: 이메일

**접근 가능한 메뉴:**
1. **캘린더** - 본인 일정만 조회 (읽기 전용)
   - Google Calendar에서 본인 이메일이 참석자로 포함된 일정만 표시
   - 월별 캘린더 뷰로 일정 확인
   - 일정 상세 정보 조회

2. **피드백** - 본인 교육 피드백 조회

3. **정산** - 본인 월별 정산 내역
   - 정산일자별로 그룹화된 정산 내역
   - 월별 정산 금액 그래프
   - 일자별 상세 내역 (토글 가능)
   - 클래스명, 시간, 정산 금액 정보

4. **섭외 완료** - 섭외 요청 완료 처리
   - 섭외 요청에 대한 완료 처리
   - 완료 시 로그가 Google Spreadsheet에 기록됨

### 👤 EM (Education Manager)

**인증 방식:**
- 별도 인증 정보 사용
- 성함: `comento`
- 이메일: `comento0804!`

**접근 가능한 메뉴:**
1. **대시보드** - 섭외율 관리 대시보드
   - 전체 월별 섭외 통계 그래프 (수락/거절)
   - 강사별 섭외율 통계 테이블
   - 강사별 월별 통계 그래프 (상세보기)
   - 거절 사유 조회 기능
   - 월평균 섭외 요청 수 표시

2. **일정 확인** - 전체 강사 일정 확인
   - 모든 기업 교육 일정 조회
   - 강사 이름 매핑 표시
   - 월별 캘린더 뷰

3. **강사 현황** - 강사별 상세 정보
   - 강사 상태별 그룹화 (Active, 양성중 등)
   - 강사 프로필 상세 정보 (소속, 직무, 연차, 레벨 등)
   - 교육가능영역 표시
   - Google Drive 프로필 폴더 링크
   - 검색 및 필터 기능

4. **섭외 요청** - 강사 섭외 요청 관리
   - Google Calendar에서 미확정 일정 선택
   - 섭외 요청 생성 및 고유 ID 발급
   - Google Apps Script 링크 생성

5. **피드백 관리** - 전체 강사 피드백 관리

6. **정산 관리** - 전체 강사 정산 관리
   - 모든 강사의 정산 데이터 조회
   - 강사별 월별 정산 금액 그래프
   - 전체 통계 정보

## 프로젝트 구조

```
.
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts           # 로그인 API
│   │   │   ├── logout/route.ts          # 로그아웃 API
│   │   │   ├── me/route.ts              # 현재 사용자 정보 API
│   │   │   └── oauth/                   # OAuth2 인증
│   │   ├── instructor/
│   │   │   ├── calendar/route.ts       # 강사 캘린더 API
│   │   │   ├── settlement/route.ts      # 강사 정산 API
│   │   │   └── recruitment/complete/route.ts  # 섭외 완료 API
│   │   └── em/
│   │       ├── calendar/route.ts       # EM 캘린더 API
│   │       ├── instructors/route.ts     # 강사 목록 API
│   │       ├── instructor-details/route.ts  # 강사 상세 API
│   │       ├── recruitment-stats/route.ts   # 섭외율 통계 API
│   │       ├── recruitment-request/route.ts # 섭외 요청 생성 API
│   │       ├── send-email/route.ts       # 이메일 발송 API
│   │       ├── managers/route.ts        # 매니저 목록 API
│   │       └── settlement/route.ts      # EM 정산 API
│   ├── instructor/                       # 강사 전용 페이지
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # 캘린더
│   │   ├── feedback/page.tsx             # 피드백
│   │   ├── settlement/page.tsx           # 정산
│   │   └── recruitment/page.tsx          # 섭외 완료
│   ├── em/                               # EM 전용 페이지
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # 대시보드
│   │   ├── schedule/page.tsx             # 전체 일정
│   │   ├── instructors/page.tsx          # 강사 현황
│   │   ├── request/page.tsx              # 섭외 요청
│   │   ├── feedback/page.tsx             # 피드백 관리
│   │   └── settlement/page.tsx           # 정산 관리
│   ├── login/page.tsx                    # 로그인 페이지
│   ├── layout.tsx                        # 루트 레이아웃
│   ├── page.tsx                          # 홈 (리다이렉트)
│   └── globals.css                       # 전역 스타일
├── components/
│   ├── instructor-layout.tsx             # 강사 레이아웃 컴포넌트
│   ├── em-layout.tsx                     # EM 레이아웃 컴포넌트
│   └── calendar.tsx                      # 캘린더 컴포넌트 (공통)
├── lib/
│   ├── auth.ts                           # 인증 유틸리티 (JWT)
│   ├── auth-em.ts                        # EM 인증 유틸리티
│   ├── google-sheets.ts                  # Google Sheets API 유틸리티
│   ├── google-calendar.ts                # Google Calendar API 유틸리티
│   ├── google-gmail.ts                   # Gmail API 유틸리티
│   └── google-gmail-oauth.ts             # Gmail OAuth2 유틸리티
├── types/
│   └── auth.ts                           # 인증 관련 타입 정의
├── middleware.ts                         # 인증 미들웨어
├── tailwind.config.js
├── postcss.config.js
└── package.json
```


## 설계 원칙

1. **역할 완전 분리**: 강사와 EM의 메뉴 및 화면 구조를 절대 혼합하지 않습니다.
2. **서버 기반 역할 결정**: 역할은 로그인 직후 서버에서 결정되며, 이후 모든 접근은 역할 기반으로 제어됩니다.
3. **별도의 IA**: 각 역할은 서로 다른 정보 구조(IA)와 사용자 여정을 가진 별도의 서비스처럼 설계됩니다.
4. **강사는 조회 중심**: 강사는 본인 데이터만 조회할 수 있습니다.
5. **EM은 관리 중심**: EM은 전체 강사 및 일정을 관리할 수 있습니다.
6. **데이터 일관성**: 모든 데이터는 Google Spreadsheet를 단일 소스로 사용하여 일관성을 유지합니다.

## 주요 기능 상세

### 캘린더 기능
- 월별 캘린더 뷰
- 일정이 있는 날짜 표시 (동그라미 표시)
- 일정 상세 정보 표시 (제목, 시간, 강사명)
- 강사 이메일을 이름으로 자동 매핑

### 정산 기능
- 정산일자별 그룹화
- 일자별 합계 금액 계산
- 월별 정산 금액 그래프 (선 그래프)
- 일자별 상세 내역 토글 기능
- 최신 날짜 순 정렬

### 섭외 관리 기능
- 섭외 요청 생성 및 고유 ID 발급
- 섭외 로그 자동 기록
- 섭외율 통계 계산 (수락율, 거절율)
- 월별 섭외 통계 그래프
- 거절 사유 조회 및 분석

### 강사 현황 기능
- 강사 상태별 그룹화 (Active, 양성중, Inactive 등)
- 강사 프로필 상세 정보 표시
- 교육가능영역 표시
- 검색 및 필터 기능
- Google Drive 프로필 폴더 링크

## UI/UX 특징

- **현대적이고 세련된 디자인**: AI가 만든 느낌이 아닌 전문적인 UI
- **직관적인 네비게이션**: 사이드바 기반 메뉴 구조
- **반응형 디자인**: 다양한 화면 크기 지원
- **시각적 피드백**: 호버 효과, 트랜지션 애니메이션
- **명확한 정보 계층**: 색상, 타이포그래피, 간격을 통한 정보 구조화
- **접근성 고려**: 명확한 레이블과 대비

## 향후 개선 사항

- 피드백 관리 기능 구현
- 실시간 알림 기능
- 엑셀 내보내기 기능
- 고급 검색 및 필터링
- 대시보드 커스터마이징
