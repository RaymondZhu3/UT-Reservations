import { supabase } from '@/constants/supabase';
import type { FacilityHours } from '@/constants/types';

// Read-only — only backend/scraper.py writes this table.
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

// One column per day group. getDay(): 0 = Sunday, 6 = Saturday.
export function hoursForDay(row: FacilityHours, date: Date = new Date()): string | null {
    const raw =
        date.getDay() === 0 ? row.sunday
        : date.getDay() === 6 ? row.saturday
        : date.getDay() === 5 ? row.friday
        : row.mon_thu;

    if (!raw) return null;

    // scrape_hours() joins multiple time blocks with " ; ".
    const cleaned = raw.split(' ; ').map(s => s.trim()).filter(Boolean).join(' · ');
    return cleaned || null;
}

// Lots of "Closed" during breaks — worth styling differently.
export function isClosed(hours: string | null): boolean {
    return !!hours && /closed/i.test(hours);
}
