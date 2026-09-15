import { supabase } from '@/constants/supabase';
import { toIsoDateString, parseUtTime } from '@/lib/dates';
import type { CourtSlot, FacilityOverviewRow } from '@/constants/types';

const SLOT_LENGTH_MS = 60 * 60 * 1000;

// Fire-and-forget write, called after an on-device scrape completes
// (hooks/useCourtAvailability.tsx), so it only ever runs as a side effect of
// someone actively using the app, never on a timer. That is what UT's
// authentication policy requires. Stores the slots themselves rather than a
// count, so other users' home screens can show real times.
//
// Never throws: a failed write costs one data point and must not break the
// screen in front of the user.
export async function pushFacilityAvailability(
    facilityId: number,
    facilityName: string,
    date: Date,
    slots: CourtSlot[]
): Promise<void> {
    try {
        const { error } = await supabase
            .from('facility_availability')
            .upsert({
                facility_id: facilityId,
                facility_name: facilityName,
                date: toIsoDateString(date),
                slots,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.log('pushFacilityAvailability failed:', error.message);
        }
    } catch (e) {
        console.log('pushFacilityAvailability threw:', e);
    }
}

// The read path must not swallow errors. "No courts are open" and "the
// database was unreachable" lead a user to do different things, so the failure
// is returned rather than erased. The write path above may fail quietly.
export interface OverviewResult {
    rows: FacilityOverviewRow[];
    error: string | null;
}

// Read model for the home screen's "open now" section: today's crowdsourced
// snapshot per facility, no scraping involved. Freshness depends entirely on
// when some user last scraped that facility today.
export async function fetchTodayOverview(): Promise<OverviewResult> {
    const { data, error } = await supabase
        .from('facility_availability')
        .select('*')
        .eq('date', toIsoDateString(new Date()))
        .order('facility_name', { ascending: true });

    if (error) {
        console.log('fetchTodayOverview failed:', error.message);
        return { rows: [], error: error.message };
    }

    return { rows: data ?? [], error: null };
}

// A row holds every slot that was open when someone last scraped that facility
// today, including slots whose start time has since passed. Those have to be
// filtered out, or a heading reading "OPEN NOW" advertises noon courts at 3pm.
//
// Only today's rows need it: a row for a future date is entirely ahead of
// `now` by definition.
export function futureSlots(row: FacilityOverviewRow, now: Date = new Date()): CourtSlot[] {
    if (row.date !== toIsoDateString(now)) return row.slots;

    return row.slots.filter(slot => {
        const { hours, minutes } = parseUtTime(slot.time);
        // Keep anything that fails to parse rather than dropping it. Hiding
        // real availability is worse than showing one odd row, and a parse
        // that starts returning NaN should be visible.
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return true;

        const start = new Date(now);
        start.setHours(hours, minutes, 0, 0);
        return start.getTime() + SLOT_LENGTH_MS > now.getTime();
    });
}

// Slots are per (court, time), so three free courts at 4pm would read
// "Open at 4:00 PM, 4:00 PM, 4:00 PM". The user is picking a time, not a
// court, so collapse to distinct times in chronological order.
export function distinctTimes(slots: CourtSlot[]): string[] {
    const seen = new Set<string>();
    const times: string[] = [];

    for (const slot of slots) {
        if (seen.has(slot.time)) continue;
        seen.add(slot.time);
        times.push(slot.time);
    }

    return times.sort((a, b) => {
        const left = parseUtTime(a);
        const right = parseUtTime(b);
        return (left.hours * 60 + left.minutes) - (right.hours * 60 + right.minutes);
    });
}

// Shared by Home and the Courts tab so the two can't drift on what "open"
// means. Returns null when nothing is still open, which the caller must render
// differently from "no data". See OverviewResult.
export function describeOpenSlots(row: FacilityOverviewRow, now: Date = new Date()): string | null {
    const open = futureSlots(row, now);
    if (open.length === 0) return null;

    const times = distinctTimes(open);
    const shown = times.slice(0, 3).join(', ');
    const extra = times.length - 3;

    return extra > 0 ? `Open at ${shown} +${extra} more` : `Open at ${shown}`;
}
