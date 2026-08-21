// A row from facility_hours. period_label is the date range the hours apply
// to — UT changes them at breaks, so the hours alone aren't enough.
export interface FacilityHours {
    facility_name: string;
    mon_thu: string | null;
    friday: string | null;
    saturday: string | null;
    sunday: string | null;
    period_label: string | null;
    scraped_at: string;
}

// A single open, bookable slot found on reserve_courts.php for one facility.
export interface CourtSlot {
    court: string;      // e.g. "GRE - RB - 01"
    time: string;       // column header text, e.g. "2:00 PM"
    bookUrl: string;    // reserve_courts.php?id=XXXX&reservationAction=reserve&courtType=XX
}

// Scrape result for one facility (one hidden WebView).
export interface FacilityAvailability {
    facilityId: number;
    facilityName: string;
    slots: CourtSlot[];
    loading: boolean;
    error?: string;
}

// A row from Supabase's facility_availability table — the crowdsourced
// read model. Field names match the Postgres columns (snake_case) since
// this comes straight back from supabase-js, unlike the camelCase types
// above which are internal to the on-device scraper. Keyed by
// (facility_id, date) — one row per facility per day.
export interface FacilityOverviewRow {
    facility_id: number;
    facility_name: string;
    date: string;       // "YYYY-MM-DD"
    slots: CourtSlot[];
    updated_at: string;
}

// A booked reservation scraped from myreservations.php. Moved here from
// ReservationsContext.tsx so it lives with the other shared types instead
// of being defined inline in one file and imported everywhere else.
export interface Reservation {
    facility: string;   // e.g. "GRE - RB - 01"
    date: string;       // "MM/DD/YYYY"
    time: string;       // e.g. "2:00 PM"
    court: string;      // currently always equal to `facility`
    cancelUrl: string;
}