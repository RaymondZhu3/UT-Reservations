-- v2: keyed by (facility_id, date) instead of just facility_id, and stores
-- the actual open slots (court + time), not just a count. Lets the home
-- screen show "open at 2, 3, 4pm" instead of just "3 open", and lets
-- multiple dates be crowdsourced independently as users browse ahead.
--
-- No real data exists yet from v1, so this drops and recreates rather than
-- migrating in place. Run this in the Supabase SQL Editor.

drop table if exists facility_availability;

create table facility_availability (
    facility_id   integer not null,
    facility_name text not null,
    date          date not null,
    slots         jsonb not null default '[]'::jsonb,
    updated_at    timestamptz not null default now(),
    primary key (facility_id, date)
);

alter table facility_availability enable row level security;

create policy "public can read availability"
    on facility_availability
    for select
    using (true);

create policy "public can write availability"
    on facility_availability
    for insert
    with check (true);

create policy "public can update availability"
    on facility_availability
    for update
    using (true)
    with check (true);
