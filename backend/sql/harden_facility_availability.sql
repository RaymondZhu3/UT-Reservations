-- Pre-launch RLS hardening for facility_availability.
-- 1. Remove public DELETE entirely.

drop policy if exists "public can delete availability" on facility_availability;

-- 2. Constrain what public INSERT / UPDATE may write.

drop policy if exists "public can write availability"  on facility_availability;
drop policy if exists "public can update availability" on facility_availability;

create policy "public can insert availability"
    on facility_availability
    for insert
    to anon, authenticated
    with check (
        facility_id in (28, 30, 35, 40, 50, 55, 60, 65)

        and date between current_date - 1 and current_date + 14
        and length(facility_name) <= 64
        
        and jsonb_typeof(slots) = 'array'
        and jsonb_array_length(slots) <= 400
    );

create policy "public can update availability"
    on facility_availability
    for update
    to anon, authenticated
    using (
        facility_id in (28, 30, 35, 40, 50, 55, 60, 65)
        and date between current_date - 1 and current_date + 14
    )
    with check (
        facility_id in (28, 30, 35, 40, 50, 55, 60, 65)
        and date between current_date - 1 and current_date + 14
        and length(facility_name) <= 64
        and jsonb_typeof(slots) = 'array'
        and jsonb_array_length(slots) <= 400
    );

-- SELECT stays fully public and unchanged: the data is non-personal aggregate
-- court availability, and the home screen has to read it with no session.

-- ---------------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------------
-- Expect exactly three rows: select (public), insert, update. No delete.
select polname            as policy,
       polcmd             as command,
       pg_get_expr(polqual,      polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
from   pg_policy
where  polrelid = 'facility_availability'::regclass
order  by polcmd, polname;
