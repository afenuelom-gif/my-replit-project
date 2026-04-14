# AI Job Interview Platform

## Overview

A full-stack AI-powered job interview simulator called **IntervYou AI**. Users enter a job role and optional job description, then conduct a simulated interview (2 min test, or 30–45 min full session) with 2-3 AI interviewer personas in a Zoom/Teams-style video call layout. Interviewers speak via ElevenLabs TTS (with a static portrait). At the end, a detailed performance report is generated.

## Architecture

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

### Stack
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI/TTS/STT**: OpenAI (GPT-4o for questions/evaluation/reports/posture, gpt-4o-mini-transcribe for STT), ElevenLabs (TTS audio)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Clerk (`@clerk/express` server-side, `@clerk/react` client-side)
- **Dev bypass**: Set `BYPASS_AUTH=true` in env to skip auth; attaches synthetic `dev_bypass_user`

## Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express API server |
| `@workspace/interview-platform` | `artifacts/interview-platform` | React frontend |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec + Orval config |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks |
| `@workspace/db` | `lib/db` | Drizzle schema + client |

## Key Files

- `lib/api-spec/openapi.yaml` — OpenAPI specification (source of truth for API)
- `artifacts/api-server/src/routes/interview/index.ts` — All interview API routes
- `artifacts/api-server/src/lib/interviewAI.ts` — AI integrations (GPT-4o, ElevenLabs TTS, STT, posture, reports)
- `lib/db/src/schema/index.ts` — DB schema (interviewers, sessions, questions, posture)
- `artifacts/interview-platform/src/pages/home.tsx` — Setup page
- `artifacts/interview-platform/src/pages/interview.tsx` — Interview room (Zoom-style layout)
- `artifacts/interview-platform/src/pages/report.tsx` — Performance report page
- `artifacts/interview-platform/src/hooks/useElevenLabsTTS.ts` — TTS hook (ElevenLabs backend + browser speech fallback)
- `artifacts/interview-platform/src/components/InterviewerCard.tsx` — Interviewer card with static portrait + speaking waveform animation

## API Endpoints

- `GET /api/interview/interviewers` — List all interviewer personas
- `POST /api/interview/sessions` — Create a new interview session
- `GET /api/interview/sessions/:id` — Get session with questions & interviewers
- `POST /api/interview/sessions/:id/next-question` — Submit answer + get next question
- `POST /api/interview/sessions/:id/complete` — End session, generate report
- `GET /api/interview/sessions/:id/report` — Get performance report
- `POST /api/interview/sessions/:id/tts` — Text-to-Speech via ElevenLabs (returns `{ audioBase64, format }`)
- `POST /api/interview/sessions/:id/transcribe` — Speech-to-Text (ElevenLabs scribe_v1 or GPT fallback)
- `POST /api/interview/sessions/:id/posture` — Posture analysis via vision
- `DELETE /api/interview/sessions/:id` — Cancel/delete a session
- `GET /api/users/me` — Get current user info (requires auth)
- `GET /api/users/me/sessions` — Get user's interview history (requires auth)
- `GET /api/dev/status` — Dev mode status (BYPASS_AUTH flag)

## ElevenLabs TTS Integration

When `ELEVENLABS_API_KEY` is set as a Replit secret, the platform uses ElevenLabs for high-quality AI voice audio:

- **TTS**: `POST /api/interview/sessions/:id/tts` — backend fetches `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` using model `eleven_turbo_v2_5`, returns base64-encoded MP3
- **STT**: ElevenLabs `scribe_v1` model for speech transcription; falls back to OpenAI `gpt-4o-mini-transcribe` if key missing
- **Voice mapping** (OpenAI name → ElevenLabs voice ID):
  - nova → `21m00Tcm4TlvDq8ikWAM` (Rachel)
  - shimmer → `EXAVITQu4vr4xnSDxMaL` (Bella)
  - alloy → `MF3mGyEYCl7XYWbV9V6O` (Elli)
  - onyx → `pNInz6obpgDQGcFmaJgB` (Adam)
  - echo → `TxGEqnHWrfWFTfGW9XjX` (Josh)
  - fable → `ErXwobaYiN019PkySvjV` (Arnold)
- **Frontend hook**: `useElevenLabsTTS(sessionId)` — calls TTS endpoint, plays audio via `<Audio>`, falls back to browser `SpeechSynthesis` if API unavailable
- **Free plan note**: ElevenLabs free plan requires a paid Starter ($5+/mo) plan for API access to shared library voices. The app gracefully falls back to browser speech synthesis for free-tier keys.

## Database Tables

- `users` — Clerk user IDs, emails, session credits
- `interviewers` — Dynamic interviewer personas with avatars, voices, personalities
- `interview_sessions` — Session config (job role, desc, duration, status, userId FK)
- `interview_questions` — All questions/answers per session
- `posture_analysis` — Periodic webcam snapshots analyzed by vision AI
- `interview_reports` — Generated performance reports (userId FK for history queries)

## Interviewers

6 pre-seeded AI interviewer personas (shown with static portrait + speaking waveform animation):
1. Sarah Chen — Senior Engineering Manager (voice: nova / Rachel)
2. Marcus Williams — Head of Product (voice: onyx / Adam)
3. Elena Rodriguez — VP of Engineering (voice: alloy / Elli)
4. David Kim — Technical Lead (voice: echo / Josh)
5. Priya Sharma — HR Director (voice: shimmer / Bella)
6. James O'Brien — CTO (voice: fable / Arnold)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Interview Flow

1. User enters job role + optional job description on home page; selects duration (2 min test, 30/35/40/45 min)
2. Session created → 2-3 interviewers selected randomly
3. First question generated by GPT-4o based on job role
4. Welcome message plays via ElevenLabs TTS ("Hello, welcome..."), then first question auto-plays
5. User answers by clicking mic button (MediaRecorder → base64 → STT transcription)
6. Answer sent to backend → GPT-4o evaluates → generates next question or follow-up
7. When time expires, `isFinalThankYou: true` is returned on the next answer → closing TTS plays → report page
8. "End & Get Report" button also triggers graceful closing TTS → report page
9. Posture captured via canvas snapshot every 90 seconds → vision AI analysis
10. Report page shows overall score, category breakdown, per-question feedback, improvement tips
