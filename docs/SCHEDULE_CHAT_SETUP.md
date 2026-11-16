# EM 일정 Q&A 채팅 (OpenAI)

로컬 `.env` 및 Vercel Environment Variables에 다음을 추가하세요.

```
OPENAI_API_KEY=your-openai-api-key
```

선택: `OPENAI_MODEL=gpt-4.1-mini` (미설정 시 gpt-4.1-mini → gpt-4o-mini 순으로 자동 시도)

일정 데이터는 기존 Google 서비스 계정(캘린더_자동화 시트)을 사용합니다. 메일 OAuth 토큰과는 무관합니다.
