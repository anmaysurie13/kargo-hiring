-- 0001_init.sql — Kargo hiring dashboard schema (Supabase Postgres).
-- Run ONCE in the Supabase SQL Editor. Future changes go in new, additive migration files.
-- Every table has RLS enabled with NO policies: the publishable/anon key can read nothing.
-- The app talks to the DB only from server code using the secret key (which bypasses RLS).

create extension if not exists pgcrypto;

-- 1. Rubric (seeded by 0002 from rubric.txt; read at runtime, never hardcoded)
create table rubric_criteria (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('PM', 'SPM')),
  name        text not null,
  description text not null,
  weight      int  not null check (weight > 0),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. Candidates (NO personal details here; cv_content is PII-stripped)
create table candidates (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  applied_role         text not null check (applied_role in ('PM', 'SPM')),
  original_filename    text not null,
  status               text not null default 'processing' check (status in ('processing', 'scored', 'error')),
  error_message        text,
  cv_content           text,
  pii_redaction_report jsonb,
  -- Arjun's per-candidate override of the shortlist line (null = follow the line)
  decision_override    text check (decision_override in ('invite', 'rejection')),
  held                 boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- 3. Personal details, structurally separate from everything the AI reads
create table candidate_pii (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id) on delete cascade,
  full_name    text,
  email        text,
  phone        text
);

-- 4. Scores (points = weight * score / 5, computed in code)
create table scores (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  role         text not null check (role in ('PM', 'SPM')),
  criterion_id uuid not null references rubric_criteria(id),
  score        int  not null check (score between 1 and 5),
  reason       text not null,
  points       numeric(6, 2) not null,
  created_at   timestamptz not null default now(),
  unique (candidate_id, role, criterion_id)
);

create view candidate_role_totals with (security_invoker = true) as
  select candidate_id, role, sum(points)::numeric(6, 2) as total, count(*)::int as criteria_scored
  from scores
  group by candidate_id, role;

-- 5. Interview briefs (exactly 3 sentences, enforced in code)
create table briefs (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  role         text not null check (role in ('PM', 'SPM')),
  brief_text   text not null,
  generated_at timestamptz not null default now(),
  unique (candidate_id, role)
);

-- 6. Email drafts (one current draft per candidate; sent drafts are never modified)
create table email_drafts (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null unique references candidates(id) on delete cascade,
  type              text not null check (type in ('invite', 'rejection')),
  subject           text not null,
  body_template     text not null,
  edited_body       text,
  status            text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  error_message     text,
  sent_at           timestamptz,
  resend_message_id text,
  sent_to           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 7. Settings
create table settings (
  key   text primary key,
  value text not null
);
insert into settings (key, value) values ('shortlist_size', '5');

-- Lock everything down for the public API keys
alter table rubric_criteria enable row level security;
alter table candidates      enable row level security;
alter table candidate_pii   enable row level security;
alter table scores          enable row level security;
alter table briefs          enable row level security;
alter table email_drafts    enable row level security;
alter table settings        enable row level security;
revoke all on all tables in schema public from anon, authenticated;

create index on scores (candidate_id);
create index on candidates (applied_role, status);
