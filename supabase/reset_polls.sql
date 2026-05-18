-- Server-side reset at 22:30 UK local time (Europe/London), DST-safe.
-- Run in Supabase SQL Editor once.

-- Ensure pg_cron is available.
create extension if not exists pg_cron;

-- Tracks which UK-local date has already been reset.
create table if not exists public.poll_reset_runs (
  reset_date date primary key,
  executed_at timestamptz not null default now()
);

-- Reset poll counts once per UK-local day at 22:30.
create or replace function public.run_prayer_poll_reset_if_due_uk()
returns void
language plpgsql
security definer
as $$
declare
  london_now timestamp;
  london_date date;
  london_time time;
  already_ran boolean;
begin
  london_now := now() at time zone 'Europe/London';
  london_date := london_now::date;
  london_time := london_now::time;

  -- Run only during 22:30 minute in UK local time.
  if london_time < time '22:30:00' or london_time >= time '22:31:00' then
    return;
  end if;

  select exists (
    select 1
    from public.poll_reset_runs
    where reset_date = london_date
  ) into already_ran;

  if already_ran then
    return;
  end if;

  update public.polls
  set vote_count = 0
  where day_date = london_date;

  insert into public.poll_reset_runs (reset_date)
  values (london_date);

  -- Keep tracker table small.
  delete from public.poll_reset_runs
  where reset_date < (london_date - 30);
end;
$$;

-- Remove existing job if it already exists.
do $$
declare
  existing_job_id integer;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'reset-prayer-polls-2230';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

-- Schedule every minute; function itself enforces UK-local 22:30 once/day.
select cron.schedule(
  'reset-prayer-polls-2230',
  '* * * * *',
  $$select public.run_prayer_poll_reset_if_due_uk();$$
);