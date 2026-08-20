import { supabase } from '@/constants/supabase';
import type { FacilityHours } from '@/constants/types';

// Read-only. facility_hours is written exclusively by backend/scraper.py with
// the service-role key; nothing in the app binary can modify it (see
// backend/sql/facility_hours.sql for why the RLS policy is select-only).
export async function fetchFacilityHours(): Promise<FacilityHours[]> {
    const { data, error } = await supabase
        .from('facility_hours')
        .select('*');

    if (error) {
        console.log('fetchFacilityHours failed:', error.message);
        return [];
    }

    return data ?? [];
}

// UT's table has one column per day-group, so picking today's cell is a
// getDay() lookup. getDay(): 0 = Sunday ... 6 = Saturday.
export function hoursForDay(row: FacilityHours, date: Date = new Date()): string | null {
    const raw =
        date.getDay() === 0 ? row.sunday
        : date.getDay() === 6 ? row.saturday
        : date.getDay() === 5 ? row.friday
        : row.mon_thu;

    if (!raw) return null;

    // scrape_hours() joins multi-line cells with " ; " (a cell can hold more
    // than one block, e.g. a morning and an evening window).
    const cleaned = raw.split(' ; ').map(s => s.trim()).filter(Boolean).join(' · ');
    return cleaned || null;
}

// The hours page reads "Closed" a lot during breaks, and normalize_hours()
// turns unparseable cells into "Refer to Site". Neither should be styled like
// a normal open-hours string.
export function isClosed(hours: string | null): boolean {
    return !!hours && /closed/i.test(hours);
}
