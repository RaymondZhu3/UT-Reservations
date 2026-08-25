-- Harden facility_hours

-- 1. Remove every existing policy by DISCOVERY, not by name, so no
--    hand-created leftover can survive this file again.
do $$
declare p record;
begin
    for p in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'facility_hours'
    loop
        execute format('drop policy %I on public.facility_hours', p.policyname);
    end loop;
end $$;

alter table public.facility_hours enable row level security;

-- 2. The app reads. That is all it may do.
create policy "public can read hours"
    on public.facility_hours
    for select
    to anon, authenticated
    using (true);

revoke insert, update, delete on public.facility_hours from anon, authenticated;


