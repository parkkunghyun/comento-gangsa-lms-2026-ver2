# EM 일정 Q&A 채팅 (Gemini)

로컬 `.env.local` 및 Vercel Environment Variables에 다음을 추가하세요.

```
GEMINI_API_KEY=your-gemini-api-key
```

선택: `GEMINI_MODEL=gemini-2.5-flash` (미설정 시 2.5 → 2.0 → 1.5 순으로 자동 시도)

일정 데이터는 기존 Google 서비스 계정(캘린더·시트)을 사용합니다. 메일 OAuth 토큰과는 무관합니다.
