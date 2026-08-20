-- facility_hours: scraped from https://www.utrecsports.org/hours, which is a
-- PUBLIC page with no login. That distinction matters — the policy objection
-- that ruled out a scheduled court-availability scraper (see context.md
-- section 4) is about circumventing centralized authentication. This page has
-- none, so a scheduled job here is fine.
--
-- Idempotent: safe to run against an existing facility_hours table.

create table if not exists facility_hours (
    facility_name text primary key,
    mon_thu       text,
    friday        text,
    saturday      text,
    sunday        text
);

-- UT's hours page is period-scoped ("August Break Period: 8/15 - 8/22/26").
-- The original schema recorded no period at all, so scraped break hours would
-- be served as if permanent — including after the period ended, which lands
-- squarely on org week. Store what period the row came from and when it was
-- read, so the app can caption it and detect staleness.
alter table facility_hours add column if not exists period_label text;
alter table facility_hours add column if not exists scraped_at   timestamptz not null default now();

alter table facility_hours enable row level security;

-- The app only ever READS this table. Writes come from backend/scraper.py
-- using the service-role key, which bypasses RLS entirely — so unlike
-- facility_availability, there is deliberately no public insert/update/delete
-- policy here. Nothing shipping inside the app binary can modify this data.
drop policy if exists "public can read hours" on facility_hours;
create policy "public can read hours"
    on facility_hours
    for select
    using (true);
