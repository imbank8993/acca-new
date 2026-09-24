-- ==========================================
-- FROM: 001_initial_schema.sql
-- ==========================================
-- =====================================================
-- CBT App - Initial Schema Migration
-- Version: 001
-- Date: 2026-05-07
-- Description: Core database schema for CBT (Computer-Based Test) application
-- =====================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- =====================================================
-- CORE MULTI-TENANT STRUCTURE
-- =====================================================

-- Organizations (tenants)
create table if not exists cbt_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Organization settings
create table if not exists cbt_organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  timezone text default 'Asia/Jakarta',
  exam_warning_limit int default 3,
  auto_submit_on_warning boolean default true,
  created_at timestamptz default now(),
  unique (organization_id)
);

-- User profiles
create table if not exists cbt_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  identity_number text,
  created_at timestamptz default now()
);

-- =====================================================
-- RBAC (Role-Based Access Control)
-- =====================================================

create table if not exists cbt_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  scope text check (scope in ('platform','organization')) not null,
  created_at timestamptz default now()
);

create table if not exists cbt_permissions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

create table if not exists cbt_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references cbt_roles(id) on delete cascade,
  permission_id uuid references cbt_permissions(id) on delete cascade,
  unique (role_id, permission_id)
);

create table if not exists cbt_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  user_id uuid references cbt_profiles(id) on delete cascade,
  is_active boolean default true,
  joined_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table if not exists cbt_member_roles (
  id uuid primary key default gen_random_uuid(),
  organization_member_id uuid references cbt_organization_members(id) on delete cascade,
  role_id uuid references cbt_roles(id) on delete cascade,
  unique (organization_member_id, role_id)
);

-- =====================================================
-- CLASSES & STUDENTS
-- =====================================================

create table if not exists cbt_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  name text not null,
  type text check (type in ('reguler', 'tambahan')) default 'reguler',
  created_at timestamptz default now()
);

create table if not exists cbt_class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references cbt_classes(id) on delete cascade,
  user_id uuid references cbt_profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (class_id, user_id)
);

-- =====================================================
-- SUBJECTS
-- =====================================================

create table if not exists cbt_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  name text not null,
  code text,
  color text default '#6366f1',
  created_at timestamptz default now()
);

-- =====================================================
-- QUESTION BANKS
-- =====================================================

create table if not exists cbt_question_banks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  title text not null,
  description text,
  is_published boolean default false,
  tags text[] default '{}',
  created_by uuid references cbt_profiles(id),
  created_at timestamptz default now()
);

-- =====================================================
-- QUESTIONS
-- =====================================================

create table if not exists cbt_bank_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id) on delete cascade,
  type text check (type in ('mcq','essay')),
  question_text text not null,
  difficulty text check (difficulty in ('easy','medium','hard')),
  score_default int default 1,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists cbt_bank_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references cbt_bank_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean default false,
  weight numeric default 1,
  metadata jsonb default '{}'
);

-- =====================================================
-- EXAMS
-- =====================================================

create table if not exists cbt_exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  question_bank_id uuid references cbt_question_banks(id) on delete set null,
  subject_id uuid references cbt_subjects(id),
  title text not null,
  description text,
  exam_type text check (exam_type in ('daily','pas','pat','pts','pkn')) default 'daily',
  duration_minutes int not null,
  status text check (status in ('draft','scheduled','active','ended','archived','finished')) default 'draft',
  randomize_questions boolean default true,
  randomize_options boolean default true,
  start_time timestamptz,
  end_time timestamptz,
  is_published boolean default false,
  show_results boolean default false,
  metadata jsonb default '{}',
  created_by uuid references cbt_profiles(id),
  created_at timestamptz default now()
);

-- Exam targets (classes that can take the exam)
create table if not exists cbt_exam_targets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references cbt_exams(id) on delete cascade,
  class_id uuid references cbt_classes(id) on delete cascade,
  created_at timestamptz default now(),
  unique (exam_id, class_id)
);

-- Exam participants (individual students)
create table if not exists cbt_exam_participants (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references cbt_exams(id) on delete cascade,
  user_id uuid references cbt_profiles(id),
  created_at timestamptz default now(),
  unique (exam_id, user_id)
);

-- Exam schedules
create table if not exists cbt_exam_schedules (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references cbt_exams(id) on delete cascade,
  start_time timestamptz,
  end_time timestamptz
);

-- Question sources for exam
create table if not exists cbt_exam_question_sources (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references cbt_exams(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id),
  difficulty text,
  question_count int
);

-- =====================================================
-- ATTEMPTS (Exam Sessions)
-- =====================================================

create table if not exists cbt_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  exam_id uuid references cbt_exams(id) on delete cascade,
  user_id uuid references cbt_profiles(id),
  started_at timestamptz,
  personal_end_time timestamptz,
  finished_at timestamptz,
  status text check (status in ('in_progress','submitted','auto_submitted')) default 'in_progress',
  total_score numeric,
  needs_manual_grading boolean default false,
  tab_switch_count int default 0,
  warning_count int default 0,
  ip_address text,
  device_fingerprint text,
  created_at timestamptz default now()
);

create table if not exists cbt_exam_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references cbt_exam_attempts(id) on delete cascade,
  question_id uuid references cbt_bank_questions(id),
  order_number int
);

-- =====================================================
-- ANSWERS
-- =====================================================

create table if not exists cbt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references cbt_exam_attempts(id) on delete cascade,
  question_id uuid references cbt_bank_questions(id),
  selected_option_id uuid references cbt_bank_question_options(id),
  essay_answer text,
  score numeric,
  is_correct boolean,
  is_doubtful boolean default false,
  created_at timestamptz default now(),
  unique (attempt_id, question_id)
);

-- =====================================================
-- SECURITY & PROCTORING
-- =====================================================

create table if not exists cbt_attempt_security_logs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references cbt_exam_attempts(id) on delete cascade,
  event_type text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists cbt_proctoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references cbt_exam_attempts(id) on delete cascade,
  image_url text,
  captured_at timestamptz default now()
);

-- =====================================================
-- CERTIFICATES
-- =====================================================

create table if not exists cbt_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id),
  exam_id uuid references cbt_exams(id),
  user_id uuid references cbt_profiles(id),
  certificate_number text unique,
  file_url text,
  verification_code text unique,
  issued_at timestamptz default now()
);

-- =====================================================
-- PAS / PAT PERIOD MANAGEMENT
-- =====================================================

create table if not exists cbt_pas_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  name text not null,
  type text check (type in ('pas','pat','pts','pkn')) default 'pas',
  school_year text not null,
  semester text check (semester in ('ganjil','genap')) not null,
  start_date date not null,
  end_date date not null,
  is_locked boolean default false,
  created_by uuid references cbt_profiles(id),
  created_at timestamptz default now()
);

create table if not exists cbt_pas_subjects (
  id uuid primary key default gen_random_uuid(),
  pas_period_id uuid references cbt_pas_periods(id) on delete cascade,
  subject_id uuid references cbt_subjects(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id),
  duration_minutes int default 90,
  total_questions int default 40,
  passing_score numeric default 70,
  difficulty_target text check (difficulty_target in ('easy','medium','hard','mixed')) default 'mixed',
  created_at timestamptz default now(),
  unique (pas_period_id, subject_id)
);

create table if not exists cbt_pas_class_schedules (
  id uuid primary key default gen_random_uuid(),
  pas_period_id uuid references cbt_pas_periods(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id),
  subject_id uuid references cbt_subjects(id),
  class_id uuid references cbt_classes(id) on delete cascade,
  exam_id uuid references cbt_exams(id),
  scheduled_date date not null,
  scheduled_time time not null,
  window_end_time time default '23:59',
  duration_minutes int default 90,
  room text,
  status text check (status in ('scheduled','active','finished','cancelled')) default 'scheduled',
  created_at timestamptz default now(),
  unique (pas_period_id, bank_id, class_id)
);

-- =====================================================
-- CUSTOM LABELS (Proctor-defined)
-- =====================================================

create table if not exists cbt_organization_labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade not null,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz default now(),
  unique (organization_id, name)
);

-- =====================================================

create table if not exists cbt_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_users int,
  max_concurrent_users int,
  max_storage_mb int,
  price numeric,
  duration_days int,
  created_at timestamptz default now()
);

create table if not exists cbt_organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  plan_id uuid references cbt_subscription_plans(id),
  start_date date,
  end_date date,
  status text check (status in ('active','expired','cancelled')),
  created_at timestamptz default now()
);

create table if not exists cbt_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  subscription_id uuid references cbt_organization_subscriptions(id),
  amount numeric,
  payment_method text,
  status text,
  external_reference text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_org_members_user on cbt_organization_members(user_id);
create index if not exists idx_org_members_org on cbt_organization_members(organization_id);
create index if not exists idx_exam_org on cbt_exams(organization_id);
create index if not exists idx_exams_subject on cbt_exams(subject_id);
create index if not exists idx_attempt_exam_user on cbt_exam_attempts(exam_id, user_id);
create index if not exists idx_attempt_status on cbt_exam_attempts(status);
create index if not exists idx_attempt_active on cbt_exam_attempts(exam_id) where status = 'in_progress';
create index if not exists idx_answers_attempt on cbt_answers(attempt_id);
create index if not exists idx_bank_questions_bank on cbt_bank_questions(bank_id);
create index if not exists idx_bank_questions_difficulty on cbt_bank_questions(difficulty);
create index if not exists idx_pas_periods_org on cbt_pas_periods(organization_id);
create index if not exists idx_pas_subjects_period on cbt_pas_subjects(pas_period_id);
create index if not exists idx_pas_schedules_period on cbt_pas_class_schedules(pas_period_id);
create index if not exists idx_pas_schedules_bank on cbt_pas_class_schedules(bank_id);
create index if not exists idx_pas_schedules_class on cbt_pas_class_schedules(class_id);
create index if not exists idx_pas_schedules_subject on cbt_pas_class_schedules(subject_id);
create index if not exists idx_subjects_org on cbt_subjects(organization_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if user is platform admin (no organization membership)
create or replace function is_platform_admin()
returns boolean as $$
begin
  return not exists (
    select 1 from cbt_organization_members where user_id = auth.uid()
  );
end;
$$ language plpgsql stable;

-- Profile immutability (except for admin)
create or replace function profiles_set_session()
returns void as $$
begin
  perform set_config('app.is_admin', 'true', true);
end;
$$ language plpgsql;

create or replace function profiles_immutable_fields()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' then
    if current_setting('app.is_admin', true) = 'true' then
      return new;
    end if;
    if old.full_name is distinct from new.full_name then
      raise exception 'Cannot modify full_name after user creation. Contact system administrator.';
    end if;
    if old.identity_number is distinct from new.identity_number then
      raise exception 'Cannot modify identity_number (NISN/NIP) after user creation. Contact system administrator.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_immutability on cbt_profiles;
create trigger profiles_immutability
  before update on cbt_profiles
  for each row execute function profiles_immutable_fields();

-- =====================================================
-- ENABLE RLS
-- =====================================================

alter table cbt_organizations enable row level security;
alter table cbt_organization_settings enable row level security;
alter table cbt_profiles enable row level security;
alter table cbt_roles enable row level security;
alter table cbt_permissions enable row level security;
alter table cbt_role_permissions enable row level security;
alter table cbt_organization_members enable row level security;
alter table cbt_member_roles enable row level security;
alter table cbt_classes enable row level security;
alter table cbt_class_members enable row level security;
alter table cbt_subjects enable row level security;
alter table cbt_question_banks enable row level security;
alter table cbt_bank_questions enable row level security;
alter table cbt_bank_question_options enable row level security;
alter table cbt_exams enable row level security;
alter table cbt_exam_targets enable row level security;
alter table cbt_exam_participants enable row level security;
alter table cbt_exam_schedules enable row level security;
alter table cbt_exam_question_sources enable row level security;
alter table cbt_exam_attempts enable row level security;
alter table cbt_exam_attempt_questions enable row level security;
alter table cbt_answers enable row level security;
alter table cbt_attempt_security_logs enable row level security;
alter table cbt_proctoring_snapshots enable row level security;
alter table cbt_certificates enable row level security;
alter table cbt_pas_periods enable row level security;
alter table cbt_pas_subjects enable row level security;
alter table cbt_pas_class_schedules enable row level security;
alter table cbt_organization_labels enable row level security;


-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Roles (read-only)
drop policy if exists "roles_select" on cbt_roles;
create policy "roles_select" on cbt_roles for select using (true);

-- Permissions (read-only)
drop policy if exists "permissions_select" on cbt_permissions;
create policy "permissions_select" on cbt_permissions for select using (true);

-- Role permissions (read-only)
drop policy if exists "role_permissions_select" on cbt_role_permissions;
create policy "role_permissions_select" on cbt_role_permissions for select using (true);

-- Member roles (read-only)
drop policy if exists "member_roles_select" on cbt_member_roles;
create policy "member_roles_select" on cbt_member_roles for select using (true);

-- Organization members (read-only)
drop policy if exists "org_members_select" on cbt_organization_members;
create policy "org_members_select" on cbt_organization_members for select using (true);

-- Organizations
drop policy if exists "org_select" on cbt_organizations;
create policy "org_select" on cbt_organizations for select using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_organizations.id
  )
);

drop policy if exists "org_insert" on cbt_organizations;
create policy "org_insert" on cbt_organizations for insert with check (is_platform_admin());

drop policy if exists "org_update" on cbt_organizations;
create policy "org_update" on cbt_organizations for update using (is_platform_admin());

drop policy if exists "org_delete" on cbt_organizations;
create policy "org_delete" on cbt_organizations for delete using (is_platform_admin());

-- Question Banks
drop policy if exists "bank_select" on cbt_question_banks;
create policy "bank_select" on cbt_question_banks for select using (
  is_platform_admin() OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid() and om.organization_id = cbt_question_banks.organization_id
  )
);

drop policy if exists "bank_insert" on cbt_question_banks;
create policy "bank_insert" on cbt_question_banks for insert with check (
  is_platform_admin() OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid() and om.organization_id = cbt_question_banks.organization_id
  )
);

drop policy if exists "bank_update" on cbt_question_banks;
create policy "bank_update" on cbt_question_banks for update using (
  is_platform_admin() OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid() and om.organization_id = cbt_question_banks.organization_id
  )
);

drop policy if exists "bank_delete" on cbt_question_banks;
create policy "bank_delete" on cbt_question_banks for delete using (
  is_platform_admin() OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid() and om.organization_id = cbt_question_banks.organization_id
  )
);

-- Bank Questions
drop policy if exists "bank_questions_isolation" on cbt_bank_questions;
create policy "bank_questions_isolation" on cbt_bank_questions for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_bank_questions.organization_id
  )
);

-- Exams
drop policy if exists "exam_isolation" on cbt_exams;
create policy "exam_isolation" on cbt_exams for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_exams.organization_id
  )
);

-- Exam Attempts (all operations)
drop policy if exists "exam_attempt_isolation" on cbt_exam_attempts;
create policy "exam_attempt_isolation" on cbt_exam_attempts for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid() and om.organization_id = cbt_exam_attempts.organization_id
  )
  OR cbt_exam_attempts.user_id = auth.uid()
);

-- Answers (all operations)
drop policy if exists "answers_policy" on cbt_answers;
create policy "answers_policy" on cbt_answers for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_exam_attempts ea
    where ea.id = cbt_answers.attempt_id
    and (
      ea.user_id = auth.uid()
      OR exists (
        select 1 from cbt_organization_members om
        where om.user_id = auth.uid()
        and om.organization_id = ea.organization_id
      )
    )
  )
);

-- Subject Labels
drop policy if exists "labels_select" on cbt_organization_labels;
create policy "labels_select" on cbt_organization_labels for select using (
  is_platform_admin()
  or exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_organization_labels.organization_id
  )
);

drop policy if exists "labels_insert" on cbt_organization_labels;
create policy "labels_insert" on cbt_organization_labels for insert with check (
  is_platform_admin()
  or exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_organization_labels.organization_id
  )
);

drop policy if exists "labels_delete" on cbt_organization_labels;
create policy "labels_delete" on cbt_organization_labels for delete using (
  is_platform_admin()
  or exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_organization_labels.organization_id
  )
);

-- Subjects
drop policy if exists "subjects_isolation" on cbt_subjects;
create policy "subjects_isolation" on cbt_subjects for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_subjects.organization_id
  )
);

-- PAS Periods
drop policy if exists "pas_periods_isolation" on cbt_pas_periods;
create policy "pas_periods_isolation" on cbt_pas_periods for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_pas_periods.organization_id
  )
);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Seed roles
insert into cbt_roles (name, scope) values
  ('Admin', 'platform'),
  ('Proktor', 'organization'),
  ('Guru', 'organization'),
  ('Pengawas', 'organization'),
  ('Siswa', 'organization')
on conflict do nothing;

-- Seed permissions
insert into cbt_permissions (name) values
  ('manage_organization'),
  ('manage_members'),
  ('create_exam'),
  ('edit_exam'),
  ('publish_exam'),
  ('delete_exam'),
  ('monitor_exam'),
  ('grade_exam'),
  ('view_reports'),
  ('take_exam'),
  ('manage_subscription')
on conflict do nothing;

-- Admin → all permissions
insert into cbt_role_permissions (role_id, permission_id)
select r.id, p.id
from cbt_roles r, cbt_permissions p
where r.name = 'Admin'
on conflict do nothing;

-- Proktor permissions
insert into cbt_role_permissions (role_id, permission_id)
select r.id, p.id
from cbt_roles r
join cbt_permissions p on p.name in (
  'manage_members','create_exam','edit_exam','publish_exam','monitor_exam','view_reports'
)
where r.name = 'Proktor'
on conflict do nothing;

-- Guru permissions
insert into cbt_role_permissions (role_id, permission_id)
select r.id, p.id
from cbt_roles r
join cbt_permissions p on p.name in (
  'create_exam','edit_exam','publish_exam','grade_exam'
)
where r.name = 'Guru'
on conflict do nothing;

-- Pengawas permissions
insert into cbt_role_permissions (role_id, permission_id)
select r.id, p.id
from cbt_roles r
join cbt_permissions p on p.name in (
  'monitor_exam','view_reports'
)
where r.name = 'Pengawas'
on conflict do nothing;

-- Siswa permissions
insert into cbt_role_permissions (role_id, permission_id)
select r.id, p.id
from cbt_roles r
join cbt_permissions p on p.name in ('take_exam')
where r.name = 'Siswa'
on conflict do nothing;

-- ==========================================
-- FROM: 002_stimulus.sql
-- ==========================================
-- =====================================================
-- STIMULUS (Shared reading texts/media for questions)
-- =====================================================

create table if not exists cbt_question_stimuli (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id) on delete cascade,
  title text,
  content text not null,
  created_at timestamptz default now()
);

alter table cbt_bank_questions add column if not exists stimulus_id uuid references cbt_question_stimuli(id) on delete set null;

-- RLS for Stimulus
alter table cbt_question_stimuli enable row level security;

drop policy if exists "stimuli_isolation" on cbt_question_stimuli;
create policy "stimuli_isolation" on cbt_question_stimuli for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_question_stimuli.organization_id
  )
);


-- ==========================================
-- FROM: 003_instructions.sql
-- ==========================================
-- Buat tabel untuk menyimpan daftar petunjuk soal
create table if not exists cbt_question_instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id UUID REFERENCES public.cbt_question_banks(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Buat indeks untuk mempercepat pencarian berdasarkan bank_id
CREATE INDEX IF NOT EXISTS idx_question_instructions_bank_id on cbt_question_instructions(bank_id);

-- Tambahkan kolom instruction_id ke tabel bank_questions
ALTER TABLE public.cbt_bank_questions
ADD COLUMN IF NOT EXISTS instruction_id UUID references cbt_question_instructions(id) ON DELETE SET NULL;


-- ==========================================
-- FROM: 004_add_max_students_to_cbt_organizations.sql
-- ==========================================
-- Add max_students column to organizations table
-- This column stores the maximum number of students allowed for each organization

ALTER TABLE cbt_organizations
ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 100 NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN cbt_organizations.max_students IS 'Maximum number of students allowed in this organization';


-- ==========================================
-- FROM: 006_fix_import_bugs.sql
-- ==========================================
-- =====================================================
-- Migration: 006_fix_import_bugs
-- Date: 2026-05-25
-- Description: Fix bugs blocking bulk import of questions
-- =====================================================

-- 1. Drop old restrictive CHECK constraint on cbt_bank_questions.type
-- The old constraint only allowed ('mcq','essay') but import supports many more types
ALTER TABLE cbt_bank_questions DROP CONSTRAINT IF EXISTS bank_questions_type_check;

-- Add new constraint that allows all question types used by the import system
ALTER TABLE cbt_bank_questions ADD CONSTRAINT bank_questions_type_check
  CHECK (type IN (
    'mcq',
    'mcq_complex',
    'true_false',
    'essay',
    'short_answer',
    'matching',
    'categorization'
  ));

-- 2. Fix question_instructions table - add organization_id and RLS
-- (003_instructions.sql created this table without organization_id, causing RLS failures)

ALTER TABLE cbt_question_instructions
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES cbt_organizations(id) ON DELETE CASCADE;

-- Backfill existing rows with NULL organization_id (they won't be accessible via RLS anyway)
-- In production you may want to backfill with the bank owner's org, but NULL is safer for now
-- UPDATE cbt_question_instructions SET organization_id = (
--   SELECT organization_id from cbt_question_banks WHERE cbt_question_banks.id = cbt_question_instructions.bank_id
-- ) WHERE organization_id IS NULL;

ALTER TABLE cbt_question_instructions ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists (no policy was created in 003)
DROP POLICY IF EXISTS "question_instructions_isolation" ON cbt_question_instructions;

-- Create RLS policy for question_instructions
CREATE POLICY "question_instructions_isolation" ON cbt_question_instructions FOR ALL USING (
  is_platform_admin()
  OR EXISTS (
    SELECT 1 from cbt_organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = cbt_question_instructions.organization_id
  )
  OR EXISTS (
    -- Allow access if user is member of the bank owning the instruction
    SELECT 1 from cbt_organization_members om
    join cbt_question_banks qb ON qb.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
    AND qb.id = cbt_question_instructions.bank_id
  )
);

-- 3. Add missing order column to bank_question_options (needed for matching/categorization)
ALTER TABLE cbt_bank_question_options ADD COLUMN IF NOT EXISTS "order" int DEFAULT 0;

-- 4. Add missing columns that bulk-import uses (stimulus_id should already exist per 002)
-- Ensure metadata column exists (should already exist per 001)
ALTER TABLE cbt_bank_questions ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;


-- ==========================================
-- FROM: 007_add_hero_image_url.sql
-- ==========================================
-- =====================================================
-- ADD hero_image_url TO organizations
-- =====================================================

alter table if exists cbt_organizations
  add column if not exists hero_image_url text;

-- RLS: org admins and members can update their org's hero image
drop policy if exists "org_update_hero_image" on cbt_organizations;
create policy "org_update_hero_image" on cbt_organizations for update
  using (
    exists (
      select 1 from cbt_organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = cbt_organizations.id
    )
  )
  with check (
    exists (
      select 1 from cbt_organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = cbt_organizations.id
    )
  );

-- ==========================================
-- FROM: 008_add_profiles_rls_policies.sql
-- ==========================================
-- Migration: Add RLS policies for profiles table
-- Problem: profiles has RLS enabled but no policies defined,
-- causing all client-side queries (including token_balance) to be denied.

-- SELECT: user can read their own profile
DROP POLICY IF EXISTS "profiles_select" ON cbt_profiles;
CREATE POLICY "profiles_select" ON cbt_profiles
    FOR SELECT USING (auth.uid() = id);

-- UPDATE: user can update their own profile (including token_balance)
DROP POLICY IF EXISTS "profiles_update" ON cbt_profiles;
CREATE POLICY "profiles_update" ON cbt_profiles
    FOR UPDATE USING (auth.uid() = id);

-- INSERT: allow service role (webhook) to insert profiles for new users
DROP POLICY IF EXISTS "profiles_insert" ON cbt_profiles;
CREATE POLICY "profiles_insert" ON cbt_profiles
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- FROM: 009_dimensions.sql
-- ==========================================
-- Migration for Question cbt_Dimensions

-- 1. Create table for question_dimensions
create table if not exists cbt_question_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id UUID REFERENCES public.cbt_question_banks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_question_dimensions_bank_id on cbt_question_dimensions(bank_id);

-- 3. Add dimension_id to bank_questions
ALTER TABLE public.cbt_bank_questions
ADD COLUMN IF NOT EXISTS dimension_id UUID references cbt_question_dimensions(id) ON DELETE SET NULL;


-- ==========================================
-- FROM: 010_kisi_kisi.sql
-- ==========================================
-- =====================================================
-- KISI-KISI SOAL
-- =====================================================

create table if not exists cbt_question_kisi_kisi (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references cbt_organizations(id) on delete cascade,
  bank_id uuid references cbt_question_banks(id) on delete cascade,
  nomor_kd text not null,
  kd_cp text,
  materi text,
  indikator_soal text,
  level_kognitif text,
  created_at timestamptz default now()
);

alter table cbt_bank_questions add column if not exists kisi_kisi_id uuid references cbt_question_kisi_kisi(id) on delete set null;

-- RLS for Kisi-Kisi
alter table if exists cbt_question_kisi_kisi enable row level security;

drop policy if exists "kisi_kisi_isolation" on cbt_question_kisi_kisi;
create policy "kisi_kisi_isolation" on cbt_question_kisi_kisi for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    where om.user_id = auth.uid()
    and om.organization_id = cbt_question_kisi_kisi.organization_id
  )
);


-- ==========================================
-- FROM: 011_pas_rooms_and_invigilators.sql
-- ==========================================
-- =====================================================
-- Migration: 011_pas_rooms_and_invigilators
-- Date: 2026-06-05
-- Description: Tables to manage PAS Rooms, Proctors (Invigilators) and Student placement
-- =====================================================

create table if not exists cbt_pas_rooms (
  id uuid primary key default gen_random_uuid(),
  pas_period_id uuid references cbt_pas_periods(id) on delete cascade not null,
  name text not null,
  capacity int default 30,
  created_at timestamptz default now(),
  unique(pas_period_id, name)
);

create table if not exists cbt_pas_room_invigilators (
  id uuid primary key default gen_random_uuid(),
  pas_room_id uuid references cbt_pas_rooms(id) on delete cascade not null,
  user_id uuid references cbt_profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(pas_room_id, user_id)
);

create table if not exists cbt_pas_room_students (
  id uuid primary key default gen_random_uuid(),
  pas_period_id uuid references cbt_pas_periods(id) on delete cascade not null,
  pas_room_id uuid references cbt_pas_rooms(id) on delete cascade not null,
  user_id uuid references cbt_profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  -- Ensure a student is only mapped to one room per PAS period
  unique(pas_period_id, user_id)
);

-- =====================================================
-- ENABLE RLS
-- =====================================================
alter table cbt_pas_rooms enable row level security;
alter table if exists cbt_pas_room_invigilators enable row level security;
alter table if exists cbt_pas_room_students enable row level security;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- For pas_rooms
create policy "pas_rooms_isolation" on cbt_pas_rooms for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_pas_periods pp
    join cbt_organization_members om on om.organization_id = pp.organization_id
    where pp.id = cbt_pas_rooms.pas_period_id
    and om.user_id = auth.uid()
  )
);

-- For pas_room_invigilators
create policy "pas_room_invigilators_isolation" on cbt_pas_room_invigilators for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_pas_rooms pr
    join cbt_pas_periods pp on pp.id = pr.pas_period_id
    join cbt_organization_members om on om.organization_id = pp.organization_id
    where pr.id = cbt_pas_room_invigilators.pas_room_id
    and om.user_id = auth.uid()
  )
);

-- For pas_room_students
create policy "pas_room_students_isolation" on cbt_pas_room_students for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_pas_periods pp
    join cbt_organization_members om on om.organization_id = pp.organization_id
    where pp.id = cbt_pas_room_students.pas_period_id
    and om.user_id = auth.uid()
  )
);

-- =====================================================
-- INDEXES
-- =====================================================
create index if not exists idx_pas_rooms_period on cbt_pas_rooms(pas_period_id);
create index if not exists idx_pas_room_invig_room on cbt_pas_room_invigilators(pas_room_id);
create index if not exists idx_pas_room_students_room on cbt_pas_room_students(pas_room_id);
create index if not exists idx_pas_room_students_period on cbt_pas_room_students(pas_period_id);


-- ==========================================
-- FROM: 012_add_detailed_scores.sql
-- ==========================================
-- =====================================================
-- Migration: 012_add_detailed_scores
-- Date: 2026-06-05
-- Description: Add detailed_scores JSONB column to exam_attempts to support multiple scoring models like IRT 1PL, 2PL, 3PL simultaneously
-- =====================================================

alter table cbt_exam_attempts 
add column if not exists detailed_scores jsonb default '{}'::jsonb;


-- ==========================================
-- FROM: 013_dimension_interpretations.sql
-- ==========================================
-- =====================================================
-- Migration: 013_dimension_interpretations
-- Date: 2026-06-05
-- Description: Add dimension_interpretations table for Professional Personality Grading
-- =====================================================

create table if not exists cbt_dimension_interpretations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_id UUID references cbt_question_dimensions(id) ON DELETE CASCADE,
    min_score NUMERIC NOT NULL,
    max_score NUMERIC NOT NULL,
    title VARCHAR(255) NOT NULL,
    interpretation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_dim_interpretations_dim_id on cbt_dimension_interpretations(dimension_id);


-- ==========================================
-- FROM: 014_pas_sessions.sql
-- ==========================================
-- Create pas_sessions table
create table if not exists cbt_pas_sessions (
  id uuid primary key default gen_random_uuid(),
  pas_period_id uuid references cbt_pas_periods(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  unique (pas_period_id, name)
);

-- Add session_id to pas_class_schedules
alter table cbt_pas_class_schedules add column if not exists session_id uuid references cbt_pas_sessions(id) on delete set null;

-- Enable RLS for pas_sessions
alter table cbt_pas_sessions enable row level security;

-- Drop existing policy if any
drop policy if exists "pas_sessions_isolation" on cbt_pas_sessions;

-- Create policy for pas_sessions
create policy "pas_sessions_isolation" on cbt_pas_sessions for all using (
  is_platform_admin()
  OR exists (
    select 1 from cbt_organization_members om
    join cbt_pas_periods pp on pp.organization_id = om.organization_id
    where om.user_id = auth.uid()
    and pp.id = cbt_pas_sessions.pas_period_id
  )
);


-- ==========================================
-- FROM: create_notifications.sql
-- ==========================================
-- =====================================================
-- CBT App - Notifications System
-- Version: 001
-- Date: 2026-05-07
-- Description: Add notifications table for in-app notifications
-- =====================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS cbt_notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references cbt_profiles(id) on delete cascade not null,
    organization_id uuid references cbt_organizations(id) on delete cascade,
    type text check (type in (
        'exam_reminder',      -- Reminder before exam starts
        'exam_available',      -- Exam is now available
        'exam_started',        -- You have started an exam
        'exam_submitted',     -- Exam has been submitted
        'exam_graded',        -- Exam has been graded
        'exam_result',        -- Result is available
        'class_invite',       -- Invited to join a class
        'class_update',      -- Class information updated
        'assignment_due',    -- Assignment deadline reminder
        'system',            -- System notifications
        'achievement',       -- Achievement unlocked
        'announcement'       -- General announcements
    )) not null,
    title text not null,
    message text,
    data jsonb default '{}', -- Additional data (exam_id, class_id, etc.)
    is_read boolean default false,
    read_at timestamptz,
    expires_at timestamptz, -- Optional expiration
    priority text check (priority in ('low', 'normal', 'high', 'urgent')) default 'normal',
    action_url text, -- URL to navigate when clicked
    created_at timestamptz default now()
);

-- Notification preferences table (per-user settings)
create table if not exists cbt_notification_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references cbt_profiles(id) on delete cascade not null unique,
    email_enabled boolean default true,
    push_enabled boolean default true,
    exam_reminder boolean default true,
    exam_reminder_minutes int default 30, -- Minutes before exam
    class_updates boolean default true,
    results_notifications boolean default true,
    achievement_notifications boolean default true,
    marketing_notifications boolean default false,
    quiet_hours_start time, -- Start of quiet hours (e.g., 22:00)
    quiet_hours_end time,   -- End of quiet hours (e.g., 07:00)
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON cbt_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON cbt_notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON cbt_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON cbt_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON cbt_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE cbt_notifications ENABLE ROW LEVEL SECURITY;
alter table if exists cbt_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "notifications_select" ON cbt_notifications FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "notifications_insert" ON cbt_notifications FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "notifications_update" ON cbt_notifications FOR UPDATE USING (
    user_id = auth.uid()
);

CREATE POLICY "notifications_delete" ON cbt_notifications FOR DELETE USING (
    user_id = auth.uid()
);

-- RLS Policies for notification_preferences
CREATE POLICY "prefs_select" on cbt_notification_preferences FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "prefs_insert" on cbt_notification_preferences FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "prefs_update" on cbt_notification_preferences FOR UPDATE USING (
    user_id = auth.uid()
);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notif_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE cbt_notifications
    SET is_read = true, read_at = now()
    WHERE id = notif_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE cbt_notifications
    SET is_read = true, read_at = now()
    WHERE user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create exam reminder notification (scheduled job helper)
CREATE OR REPLACE FUNCTION create_exam_reminder(
    p_exam_id uuid,
    p_user_id uuid,
    p_minutes_before int
)
RETURNS uuid AS $$
DECLARE
    v_notif_id uuid;
    v_exam record;
    v_title text;
    v_message text;
BEGIN
    -- Get exam info
    SELECT title, start_time INTO v_exam
    FROM cbt_exams WHERE id = p_exam_id;

    IF v_exam.title IS NULL THEN
        RETURN NULL;
    END IF;

    v_title := 'Ujian Akan Dimulai';
    v_message := format('Ujian "%s" akan dimulai dalam %s menit', v_exam.title, p_minutes_before);

    INSERT INTO cbt_notifications (
        user_id,
        type,
        title,
        message,
        data,
        priority,
        action_url
    ) VALUES (
        p_user_id,
        'exam_reminder',
        v_title,
        v_message,
        jsonb_build_object('exam_id', p_exam_id),
        'high',
        '/dashboard/siswa/exam/' || p_exam_id
    ) RETURNING id INTO v_notif_id;

    RETURN v_notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update cbt_notification_preferences updated_at
CREATE OR REPLACE FUNCTION update_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_prefs_updated on cbt_notification_preferences;
CREATE TRIGGER notification_prefs_updated
    BEFORE UPDATE on cbt_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_prefs_timestamp();


