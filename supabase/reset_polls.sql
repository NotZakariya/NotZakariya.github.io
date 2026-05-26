-- Server-side reset at configurable UK local time (Europe/London), DST-safe.
-- Run in Supabase SQL Editor once.

-- Ensure pg_cron is available.
create extension if not exists pg_cron;

-- Stores the reset time so it can be changed quickly without editing the cron job.
create table if not exists public.poll_settings (
  id boolean primary key default true,
  reset_time time not null default time '22:45:00',
  constraint poll_settings_single_row check (id)
);

insert into public.poll_settings (id, reset_time)
values (true, time '22:45:00')
on conflict (id) do nothing;

revoke all on public.poll_settings from anon, authenticated;
grant select on public.poll_settings to anon, authenticated;

-- Tracks which UK-local date has already been reset.
create table if not exists public.poll_reset_runs (
  reset_date date primary key,
  executed_at timestamptz not null default now()
);

-- Reset poll counts once per UK-local day at the configured reset time.
create or replace function public.run_prayer_poll_reset_if_due_uk()
returns void
language plpgsql
security definer
as $$
declare
  london_now timestamp;
  london_date date;
  london_time time;
  configured_reset_time time;
  already_ran boolean;
begin
  london_now := now() at time zone 'Europe/London';
  london_date := london_now::date;
  london_time := london_now::time;

  select reset_time
  into configured_reset_time
  from public.poll_settings
  where id = true;

  -- Run only during the configured reset minute in UK local time.
  if london_time < configured_reset_time or london_time >= (configured_reset_time + interval '1 minute')::time then
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

-- Remove existing jobs if they already exist, including old reset-time jobs.
do $$
declare
  existing_job_id integer;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname in ('reset-prayer-polls', 'reset-prayer-polls-2215', 'reset-prayer-polls-2230', 'reset-prayer-polls-2245')
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end
$$;

-- Schedule every minute; function itself enforces the configured reset time once/day.
select cron.schedule(
  'reset-prayer-polls',
  '* * * * *',
  $$select public.run_prayer_poll_reset_if_due_uk();$$
);
