# Kargo Hiring Dashboard

An internal tool for Arjun Mehta (Founder, Kargo) to work through ~60 CVs for **Product Manager** and **Senior Product Manager** roles.

**The system recommends, Arjun decides.** Nothing is sent, rejected or finalised without Arjun clicking a button. There is no auto-send and no auto-reject anywhere in the codebase: the only code path that sends email is `lib/send.ts`, reachable only from `POST /api/send/[candidateId]`, which the UI calls only from **Confirm & Send** (a two-step confirm) or the bulk-rejection dialog (which lists every name and requires a tick box).

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind), deployed on Vercel
- Supabase Postgres, accessed **only from server code** with the secret key (`lib/db.ts`, guarded by `server-only`). Every table has Row Level Security on with no policies, so the publishable key can read nothing.
- Google Gemini Flash (`@google/genai`) with JSON structured output (`responseMimeType: application/json` + `responseJsonSchema`), validated with zod.
- Resend for email.

## Pipeline

1. **Parse + PII separation (no AI).** `lib/parse.ts` (unpdf / mammoth / txt) → `lib/pii.ts` extracts name / email / phone deterministically and replaces every occurrence of the full name, first name, last name, emails, phones and URLs with `[REDACTED]`. `assertNoPII()` must pass or the candidate goes to `error` and nothing is stored. PII goes to `candidate_pii`; stripped text to `candidates.cv_content`; counts only to `pii_redaction_report`.
2. **Score against both rubrics (AI).** Criteria are read from `rubric_criteria` at runtime. Temperature 0, one call per role, zod-validated, one retry on invalid output, exponential backoff on 429/5xx. Points (`weight × score / 5`) and totals are computed in code.
3. **Rank + draft.** Ranked within the **applied** role. Top N (`settings.shortlist_size`) are above the line. Above-the-line candidates get a 3-sentence interview brief. Every candidate gets an invite or rejection draft containing the literal `{{FIRST_NAME}}`, which is substituted server-side from `candidate_pii` only at preview/send time. When ranks or overrides change, unsent drafts of the wrong type are regenerated; sent emails are never touched.

All prompts are in [`lib/prompts.ts`](lib/prompts.ts). Job descriptions (background only, never scored against) are in [`lib/jd.ts`](lib/jd.ts).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
```

### Environment variables

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (server only; never `NEXT_PUBLIC_`) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | Default `gemini-3.8-flash` |
| `RESEND_API_KEY` | Blank = Send buttons show "Email not configured" |
| `EMAIL_FROM` | Default `Kargo Hiring <onboarding@resend.dev>` |
| `TEST_RECIPIENT_EMAIL` | While set, **every** email goes here, subject prefixed `[TEST → original@email]`. While blank, sending is blocked unless `ALLOW_REAL_SEND=true`. |
| `ALLOW_REAL_SEND` | Leave blank in the course environment |
| `DASHBOARD_PASSWORD` | Password for the cookie session that protects every page and API route |

With the `onboarding@resend.dev` sender and no verified domain, Resend only delivers to the address that owns the Resend account, so set `TEST_RECIPIENT_EMAIL` to that address. Any 403 is shown on the card with that explanation.

### Database migration and seed

Migrations are plain SQL in `db/migrations/`, run once each, in order, in the **Supabase dashboard → SQL Editor**:

1. `0001_init.sql`: all tables, the `candidate_role_totals` view, RLS, `shortlist_size = 5`.
2. `0002_seed_rubric.sql`: the 8 rubric rows (4 PM + 4 SPM, weights sum to 100 per role) from `rubric.txt`.

Future schema changes go in new numbered files and must be additive (`ALTER ... ADD`). The rubric is validated on server start (`instrumentation.ts`), on the dashboard, and before every scoring call; if weights don't sum to 100 per role, scoring is disabled and the dashboard shows the error.

### Run locally

```bash
npm run dev     # http://localhost:3000, sign in with DASHBOARD_PASSWORD
npm test        # PII redaction tests + the PII import-boundary test
npm run lint    # includes the rule blocking lib/ai/* from importing pii-store or the DB
```

## Deploying to Vercel

1. Push the repo to GitHub (private).
2. In Vercel: **Add New → Project → Import** the repo. The framework is detected as Next.js automatically.
3. In **Project Settings → Environment Variables**, add every variable from the table above (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY`, `EMAIL_FROM`, `TEST_RECIPIENT_EMAIL`, `DASHBOARD_PASSWORD`) for Production (and Preview if you use it).
4. Deploy. Uploads call one API route per CV (concurrency 2), and each route has `maxDuration = 60`, which is inside Vercel's limits.
5. Note that Vercel caps request bodies at about 4.5 MB. For large batches upload individual files or several smaller zips rather than one big zip.

## Data privacy

- **PII is separated before any AI call.** Name, email and phone are extracted with deterministic code (regex + heuristics), never by Gemini, because the raw text is the very thing being protected. They are stored in a separate `candidate_pii` table. The text sent to Gemini has every occurrence of the name (full, first and last), emails, phone numbers and profile/portfolio URLs replaced with `[REDACTED]`, and `assertNoPII()` re-checks it immediately before every AI call (scoring, briefs, emails). If anything survives, the call is aborted and the candidate is marked `error`.
- **Structural boundary.** Only `lib/pii-store.ts` queries `candidate_pii`. `lib/ai/*` and `lib/prompts.ts` cannot import it or the DB. This is enforced by an ESLint rule and by `tests/pii-boundary.test.ts`, which walks the import graph.
- **The AI never sees names.** Emails are drafted with `{{FIRST_NAME}}`; the real first name is substituted on the server at preview/send time. Sends are blocked if the final body still contains `{{`, `[NAME]` or `[REDACTED]`.
- **Exports** omit email and phone unless "include contact details" is ticked.
- **Gemini data use.** On the **free tier** of the Gemini API, Google may use submitted inputs and outputs to improve its products and models (and human reviewers may read them). On the **paid tier** (a billing-enabled Cloud project), Google does not use prompts or responses to improve its products. Even though CVs are PII-stripped before sending, use a billing-enabled key for real candidate data.
- All pages and API routes require the dashboard password (an HMAC session cookie, checked in `proxy.ts` and again in each route handler).
