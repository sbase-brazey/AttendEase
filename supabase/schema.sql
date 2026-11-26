create extension if not exists pg_cron;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  full_name text not null,
  student_number text unique,
  created_at timestamptz not null default now(),
  constraint student_number_required_for_students
    check (role <> 'student' or nullif(trim(student_number), '') is not null)
);

create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  class_date date not null,
  class_name text not null check (length(trim(class_name)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint class_schedule_end_after_start check (ends_at > starts_at)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.class_schedule (id),
  student_id uuid not null references public.profiles (id),
  status text not null check (status in ('Present', 'Late', 'Absent')),
  scanned_at timestamptz,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attendance_one_record_per_student_schedule unique (schedule_id, student_id)
);

create index if not exists attendance_student_id_idx
  on public.attendance (student_id);
create index if not exists class_schedule_starts_at_idx
  on public.class_schedule (starts_at);
create unique index if not exists class_schedule_date_name_start_unique
  on public.class_schedule (class_date, class_name, starts_at);

alter table public.profiles enable row level security;
alter table public.class_schedule enable row level security;
alter table public.attendance enable row level security;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
  );
$$;

revoke all on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

drop policy if exists "profiles_read_self_or_teacher" on public.profiles;
create policy "profiles_read_self_or_teacher"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.is_teacher());

drop policy if exists "schedule_read_authenticated" on public.class_schedule;
create policy "schedule_read_authenticated"
  on public.class_schedule
  for select
  to authenticated
  using (true);

drop policy if exists "schedule_insert_teacher" on public.class_schedule;
create policy "schedule_insert_teacher"
  on public.class_schedule
  for insert
  to authenticated
  with check (public.is_teacher() and created_by = (select auth.uid()));

drop policy if exists "schedule_update_teacher" on public.class_schedule;
create policy "schedule_update_teacher"
  on public.class_schedule
  for update
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher() and created_by = (select auth.uid()));

drop policy if exists "attendance_read_self_or_teacher" on public.attendance;
create policy "attendance_read_self_or_teacher"
  on public.attendance
  for select
  to authenticated
  using (student_id = (select auth.uid()) or public.is_teacher());

revoke all on public.profiles, public.class_schedule, public.attendance
  from public, anon, authenticated;
grant select on public.profiles, public.class_schedule, public.attendance to authenticated;
grant insert, update on public.class_schedule to authenticated;

create or replace function public.record_attendance(
  p_student_number text,
  p_schedule_id uuid
)
returns table (
  student_id uuid,
  student_name text,
  status text,
  scanned_at timestamptz,
  class_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.profiles%rowtype;
  v_schedule public.class_schedule%rowtype;
  v_status text;
  v_scanned_at timestamptz;
begin
  if not public.is_teacher() then
    raise exception 'Only teachers can record student attendance.';
  end if;

  select *
    into v_student
    from public.profiles
    where student_number = trim(p_student_number)
      and role = 'student';
  if not found then
    raise exception 'No student account matches this QR code.';
  end if;

  select *
    into v_schedule
    from public.class_schedule
    where id = p_schedule_id;
  if not found then
    raise exception 'The class schedule could not be found.';
  end if;

  v_status := case
    when now() <= v_schedule.starts_at + interval '15 minutes' then 'Present'
    when now() <= v_schedule.ends_at then 'Late'
    else 'Absent'
  end;

  insert into public.attendance as existing (
    schedule_id,
    student_id,
    status,
    scanned_at,
    auto_generated
  )
  values (
    v_schedule.id,
    v_student.id,
    v_status,
    now(),
    false
  )
  on conflict on constraint attendance_one_record_per_student_schedule
  do update set
    status = case
      when existing.auto_generated or existing.scanned_at is null then excluded.status
      else existing.status
    end,
    scanned_at = coalesce(existing.scanned_at, excluded.scanned_at),
    auto_generated = false
  returning existing.status, existing.scanned_at
    into v_status, v_scanned_at;

  return query
    select v_student.id, v_student.full_name, v_status, v_scanned_at, v_schedule.class_name;
end;
$$;

revoke all on function public.record_attendance(text, uuid) from public, anon;
grant execute on function public.record_attendance(text, uuid) to authenticated;

create or replace function public.generate_due_attendance_absences()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer;
begin
  if auth.uid() is not null and not public.is_teacher() then
    raise exception 'Only teachers can generate attendance records.';
  end if;

  insert into public.attendance (schedule_id, student_id, status, auto_generated)
  select schedule.id, student.id, 'Absent', true
    from public.class_schedule as schedule
    cross join public.profiles as student
    where student.role = 'student'
      and now() > schedule.ends_at
  on conflict (schedule_id, student_id) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function public.generate_due_attendance_absences() from public, anon;
grant execute on function public.generate_due_attendance_absences() to authenticated;

select cron.unschedule('attendease-generate-due-absences');

select cron.schedule(
  'attendease-generate-due-absences',
  '* * * * *',
  'select public.generate_due_attendance_absences();'
);

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['class_schedule', 'attendance']
    loop
      if not exists (
        select 1
          from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;



-----------------------------------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------------------------------

-- 1. CREATE TEACHER (Email: teacher@gmail.com | Password: teacher123)
DO $$
DECLARE
  new_teacher_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'teacher@gmail.com') THEN
    new_teacher_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (
      new_teacher_id, '00000000-0000-0000-0000-000000000000', 'teacher@gmail.com',
      crypt('teacher123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'
    );
  END IF;
  
  INSERT INTO public.profiles (id, role, full_name)
  SELECT id, 'teacher', 'Teacher' FROM auth.users WHERE email = 'teacher@gmail.com'
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 2. CREATE STUDENTS (Email: [id]@attendease.local | Password: [id])
DO $$
DECLARE
  student_record RECORD;
  new_student_id uuid;
  student_email text;
BEGIN
  FOR student_record IN 
    SELECT * FROM (VALUES 
      ('2023302044', 'Ken Jan Vanzuela'),
      ('2023301303', 'James Baldonado'),
      ('2023302650', 'Angel Verallo'),
      ('2021305389', 'Marbien Sambaan'),
      ('2024300507', 'Alfranz Gabriel Veloz')
    ) AS t(sid, sname)
  LOOP
    student_email := student_record.sid || '@attendease.local';

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = student_email) THEN
      new_student_id := gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
      VALUES (
        new_student_id, '00000000-0000-0000-0000-000000000000', student_email,
        crypt(student_record.sid, gen_salt('bf')), -- Password is set to their Student ID
        now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'
      );
    END IF;

    -- Link to profiles table
    INSERT INTO public.profiles (id, role, full_name, student_number)
    SELECT id, 'student', student_record.sname, student_record.sid
    FROM auth.users WHERE email = student_email
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, student_number = EXCLUDED.student_number;
  END LOOP;
END $$;