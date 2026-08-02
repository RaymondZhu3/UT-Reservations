import { supabase } from '@/constants/supabase';
import { toIsoDateString } from '@/lib/dates';
import type { CourtSlot, FacilityOverviewRow } from '@/constants/types';

// Fire-and-forget write: called after a real on-device scrape completes
// (see hooks/useCourtAvailability.tsx), so this only ever runs as a side
// effect of a human actively using the app — never on a timer, never
// unattended. Stores the actual slots (not just a count) so other users'
// home screens can show real times, not just "3 open".
//
// Never throws — a failed write is a lost data point, not a reason to
// break the screen the user is actually looking at.
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

// Read model for the home screen's "open now" section — today's
// crowdsourced snapshot per facility, no scraping involved. Freshness
// depends entirely on when some user last scraped that facility today.
export async function fetchTodayOverview(): Promise<FacilityOverviewRow[]> {
    const { data, error } = await supabase
        .from('facility_availability')
        .select('*')
        .eq('date', toIsoDateString(new Date()))
        .order('facility_name', { ascending: true });

    if (error) {
        console.log('fetchTodayOverview failed:', error.message);
        return [];
    }

    return data ?? [];
}
