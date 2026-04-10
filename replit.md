# AI Job Interview Platform

## Overview

A full-stack AI-powered job interview simulator. Users enter a job role and optional job description, then conduct a realistic 30-45 minute simulated interview with 2-3 AI interviewer avatars in a Zoom/Teams-style video call layout. At the end, a detailed performance report is generated.

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
- **AI**: OpenAI (GPT-4o for questions/evaluation/reports/posture, TTS for audio, gpt-4o-mini-transcribe for STT)
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
- `artifacts/api-server/src/lib/interviewAI.ts` — OpenAI integrations (question gen, TTS, STT, posture, reports)
- `lib/db/src/schema/index.ts` — DB schema (interviewers, sessions, questions, posture)
- `artifacts/interview-platform/src/pages/home.tsx` — Setup page
- `artifacts/interview-platform/src/pages/interview.tsx` — Interview room (Zoom-style layout)
- `artifacts/interview-platform/src/pages/report.tsx` — Performance report page

## API Endpoints

- `GET /api/interview/interviewers` — List all interviewer personas
- `POST /api/interview/sessions` — Create a new interview session
- `GET /api/interview/sessions/:id` — Get session with questions & interviewers
- `POST /api/interview/sessions/:id/next-question` — Submit answer + get next question
- `POST /api/interview/sessions/:id/complete` — End session, generate report
- `GET /api/interview/sessions/:id/report` — Get performance report
- `POST /api/interview/tts` — Text-to-Speech (OpenAI tts-1)
- `POST /api/interview/sessions/:id/transcribe` — Speech-to-Text (gpt-4o-mini-transcribe)
- `POST /api/interview/sessions/:id/posture` — Posture analysis via vision
- `GET /api/users/me` — Get current user info (requires auth)
- `GET /api/users/me/sessions` — Get user's interview history (requires auth)
- `GET /api/dev/status` — Dev mode status (BYPASS_AUTH flag)
- `POST /api/interview/heygen/token` — Get a short-lived HeyGen streaming avatar token

## HeyGen Streaming Avatar Integration

When `HEYGEN_API_KEY` is set as a Replit secret, the platform enables live AI avatar video streaming:

- **Session creation**: Fetches available HeyGen avatars via `GET /v2/avatars`, assigns gender-appropriate avatar IDs to each dynamic interviewer, stores as `heygen_avatar_id` in DB
- **Token endpoint**: Backend generates a short-lived streaming token via `POST /v1/streaming.create_token`
- **Frontend hook**: `useHeyGenAvatar(avatarId)` — lazy WebRTC init via LiveKit, exposes `videoRef`, `speak(text)`, `stop()`, `destroy()`, `status`, `isSpeaking`
- **InterviewerCard component**: Self-contained card with HeyGen video stream (or static avatar fallback). Exposes `speak/stop/destroy` via `useImperativeHandle` ref
- **Graceful fallback**: If HeyGen API key not set, returns 503; frontend falls back to OpenAI TTS + static images seamlessly
- **SDK**: `@heygen/streaming-avatar@^2.1.0` (uses LiveKit under the hood)

## Database Tables

- `users` — Clerk user IDs, emails, session credits (for Stripe integration later)
- `interviewers` — Dynamic interviewer personas with avatars, voices, personalities, `heygen_avatar_id`
- `interview_sessions` — Session config (job role, desc, duration, status, userId FK)
- `interview_questions` — All questions/answers per session
- `posture_analysis` — Periodic webcam snapshots analyzed by vision AI
- `interview_reports` — Generated performance reports (userId FK for history queries)

## Interviewers

6 pre-seeded AI interviewer personas:
1. Sarah Chen — Senior Engineering Manager (voice: nova)
2. Marcus Williams — Head of Product (voice: onyx)
3. Elena Rodriguez — VP of Engineering (voice: alloy)
4. David Kim — Technical Lead (voice: echo)
5. Priya Sharma — HR Director (voice: shimmer)
6. James O'Brien — CTO (voice: fable)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Interview Flow

1. User enters job role + optional job description on home page
2. Session created → 2-3 interviewers selected randomly
3. First question generated by GPT-4o based on job role
4. Questions auto-play via TTS with interviewer's voice
5. User answers by clicking mic button (MediaRecorder → base64 → STT transcription)
6. Answer sent to backend → GPT-4o evaluates → generates next question or follow-up
7. Posture captured via canvas snapshot every 90 seconds → vision AI analysis
8. Session ends (timer or End Session button) → GPT-4o generates full report
9. Report page shows overall score, category breakdown, per-question feedback, improvement tips
