import { supabase } from '@/constants/supabase';
import type { FacilityHours } from '@/constants/types';
import { parsePeriodLabel, periodCovers, type HoursPeriod, type HoursStatus } from '@/lib/hoursPeriod';

// Re-exported so callers have one import site for everything about hours.
export { parsePeriodLabel, periodCovers };
export type { HoursPeriod, HoursStatus };

// Read-only — only backend/scraper.py writes this table.
// Returns the error rather than swallowing it, for the same reason as
// fetchTodayOverview: "UT lists no hours" and "we couldn't reach the
// database" must not render identically.
export interface HoursResult {
    rows: FacilityHours[];
    error: string | null;
}

export async function fetchFacilityHours(): Promise<HoursResult> {
    const { data, error } = await supabase
        .from('facility_hours')
        .select('*');

    if (error) {
        console.log('fetchFacilityHours failed:', error.message);
        return { rows: [], error: error.message };
    }

    return { rows: data ?? [], error: null };
}

export interface DayHours {
    /** Formatted hours for the requested day, or null when the column is empty. */
    hours: string | null;
    status: HoursStatus;
    period: HoursPeriod | null;
}

/**
 * Hours for one facility on one date, plus a verdict on whether they can
 * honestly be called current.
 *
 * `unknown` still carries `hours`: a missing or unparseable label is absence of
 * evidence, not evidence of staleness, and refusing to render on it would let
 * one UT page redesign strip hours from the whole app.
 */
export function hoursForDay(row: FacilityHours, date: Date = new Date()): DayHours {
    // One column per day group. getDay(): 0 = Sunday, 6 = Saturday.
    const raw =
        date.getDay() === 0 ? row.sunday
        : date.getDay() === 6 ? row.saturday
        : date.getDay() === 5 ? row.friday
        : row.mon_thu;

    // scrape_hours() joins multiple time blocks with " ; ".
    const cleaned = raw
        ? raw.split(' ; ').map(s => s.trim()).filter(Boolean).join(' · ')
        : '';
    const hours = cleaned || null;

    const period = parsePeriodLabel(row.period_label, date);
    if (!period) return { hours, status: 'unknown', period: null };

    return {
        hours,
        status: periodCovers(period, date) ? 'current' : 'stale',
        period,
    };
}

// Lots of "Closed" during breaks — worth styling differently.
export function isClosed(hours: string | null): boolean {
    return !!hours && /closed/i.test(hours);
}
