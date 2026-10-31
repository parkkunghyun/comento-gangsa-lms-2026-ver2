# EM 캘린더 Q&A 에이전트

EM(교육매니저)이 캘린더·강사 일정을 **채팅으로 바로 물어볼 수 있는** 기능을 추가한 내용을 정리합니다.

---

## 한 줄 요약

우측 하단 에이전트 아이콘 → 채팅/크게보기 팝업에서  
「누가 언제 교육인지」「OO 멘토 이번 달 빈날」을 물으면,  
Gemini가 기존 Google Calendar·시트 데이터를 조회해 답합니다.

---

## 무엇을 만들었나

### 1. 채팅 UI (`components/em-schedule-chat.tsx`)

- EM 레이아웃 우측 하단에 에이전트 아이콘(`/public/agent-image.jpg`)
- 클릭 시 연한 초록 톤의 부드러운 채팅창
- **크게 보기** → 가운데 팝업에서 동일 대화 이어가기
- 예시 질문 칩, 대화 유지(페이지 이동해도 EM 레이아웃이면 유지)

### 2. API (`POST /api/em/schedule-chat`)

- EM 로그인 세션만 허용
- Gemini function calling으로 일정 도구 호출 후 답변 생성
- API 키는 서버 전용 (`GEMINI_API_KEY`), 브라우저 미노출

### 3. 일정 조회 도구 (`lib/schedule-chat-tools.ts`)

| 도구 | 역할 |
|------|------|
| `list_instructors` | 강사 이름·이메일 목록 |
| `list_calendar_events` | 기간별 전체 교육 캘린더 |
| `list_instructor_schedule` | 특정 강사 교육 + 개인 일정(선호/불가) |
| `compute_free_weekdays` | **빈 평일** 계산 (기준 A) |

데이터 소스:

- Google Calendar (기업교육 일정, 참석자 → 강사정보 이름 매핑)
- 시트 `강사정보` / `기업교육_외부강사` (이름·이메일)
- 시트 `강사일정` (강의 선호 / 강의 불가)

### 4. 빈날 규칙 (기준 A)

해당 월 **평일(월~금)** 중  
`교육 일정 ∪ 강의 불가`를 뺀 날 = 안 잡힌 일정  
(주말 제외, 강의 선호는 빈날에서 빼지 않음)

### 5. 대화 규칙

- 연도 미지정 → **올해(Asia/Seoul)** 로 해석
- 이름·날짜가 애매하면 추측하지 않고 **되묻기**
- 답변에 `**` 등 마크다운 기호 최소화(프롬프트 + 서버에서 제거)

### 6. 설정

자세한 env는 [`SCHEDULE_CHAT_SETUP.md`](./SCHEDULE_CHAT_SETUP.md) 참고.

```
GEMINI_API_KEY=...
# 선택
GEMINI_MODEL=gemini-2.5-flash
```

모델 404 시 2.5 → 2.0 → 1.5 순으로 자동 재시도합니다.  
일정 데이터는 기존 Google 서비스 계정을 쓰며, Gmail OAuth와는 무관합니다.

---

## 어떻게 동작하나

```
EM 채팅 입력
  → POST /api/em/schedule-chat (EM 인증)
  → Gemini + 도구 선언
  → 필요 시 list_calendar_events / compute_free_weekdays 등 실행
  → 도구 결과만 근거로 한국어 답변
  → 채팅창(또는 크게보기 팝업)에 표시
```

예시 질문:

- 「10월 28일에 교육 있는 강사님 누구야?」
- 「한대용 멘토님 10월 교육 안 잡힌 일정 알려줘」
- 「이창환 멘토 11월 교육 일정 알려줘」

---

## 이전 대비 무엇이 나아졌나

| 이전 | 이후 |
|------|------|
| 일정 확인 메뉴에서 달력/강사를 직접 찾아봐야 함 | 자연어로 바로 질문 |
| 「특정일 누가 나가는지」를 눈으로 훑어야 함 | 하루 단위로 강사·과정 요약 답변 |
| 「OO 멘토 빈날」을 수동으로 세야 함 | 평일 − 교육 − 불가 규칙을 서버가 계산 |
| 연도·이름 애매해도 UI만으로는 확인이 번거로움 | 올해 기본 + 애매하면 되물어 소통 |
| 일정 조회와 메일/OAuth가 혼동되기 쉬움 | 일정 Q&A는 SA + Gemini만 사용 (역할 분리) |

정리하면, **기존에 있던 캘린더·시트 데이터를 그대로 쓰면서**, EM이 스케줄 페이지를 헤매지 않고 **채팅 한 번으로 일정 파악**할 수 있게 된 것이 핵심 개선입니다.

---

## 한계 (알아두면 좋은 점)

- 캘린더 참석자에 이메일이 없으면 「교육은 있으나 강사 미확인」으로 답할 수 있음
- 정본은 **Google Calendar + 강사일정(불가)**. `class_schedule` 시트와 다를 수 있음
- 공휴일은 v1에서 별도 제외하지 않음(평일만 기준)
- 조회 전용이며, 일정 수정·섭외 메일 발송은 이 채팅에서 하지 않음

---

## 관련 파일

- `components/em-schedule-chat.tsx` — 채팅 UI
- `components/em-layout.tsx` — EM 레이아웃에 위젯 연결
- `app/api/em/schedule-chat/route.ts` — API
- `lib/gemini-schedule-chat.ts` — Gemini 루프·프롬프트
- `lib/schedule-chat-tools.ts` — 캘린더/빈날 도구
- `docs/SCHEDULE_CHAT_SETUP.md` — 환경변수 안내
- `public/agent-image.jpg` — 에이전트 아이콘
