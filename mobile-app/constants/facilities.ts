// Facility name -> fid used in reserve_courts.php?facility_id=XX
// Pulled from context.md / backend/scraper.py — verify against the live
// site if UT ever re-numbers facilities.
export const FACILITIES: Record<string, number> = {
    'Bellmont Hall - Squash': 28,
    'Caven-Clark - Pickleball': 30,
    'Gregory Gym - Racquetball': 35,
    'Gregory Gym - Squash': 40,
    'RSC - Squash': 55,
    'RSC - Racquetball': 50,
    'Whitaker - Tennis': 60,
    'Whitaker - Pickleball/Tennis': 65,
};

// Facility code (as it appears in court labels like "GRE - RB - 01") -> full
// name. Single source of truth — lib/reservations.ts's formatFacility()
// imports this rather than keeping its own copy.
export const FACILITY_CODE_MAP: Record<string, string> = {
    GRE: 'Gregory Gym',
    CCF: 'Caven-Clark',
    WC: 'Whitaker Courts',
    BEL: 'Bellmont Hall',
    RSC: 'Rec Sports Center',
};

// Reverse of FACILITIES (id -> name), for scrape results that only have an
// id and need a name to write back to Supabase.
export const FACILITY_NAMES_BY_ID: Record<number, string> = Object.fromEntries(
    Object.entries(FACILITIES).map(([name, id]) => [id, name])
);

// UT names the same buildings differently on reserve_courts.php and on the
// public hours page at utrecsports.org/hours, so joining the two needs an
// explicit map — string matching would fail on every entry here except
// Gregory Gym. Note "Caven Clark Courts" has no hyphen on the hours page, and
// "Recreational Sports Center" is spelled out rather than "RSC"/"Rec Sports
// Center". Two facility ids can share one building (squash and racquetball
// courts are both inside Gregory Gym), so this is many-to-one by design.
//
// If a facility ever shows no hours in the app, check here first: UT renaming
// a row on the hours page breaks the join silently, since a missing key just
// yields no hours rather than an error.
export const HOURS_FACILITY_NAMES: Record<number, string> = {
    28: 'Bellmont Hall',
    30: 'Caven Clark Courts',
    35: 'Gregory Gym',
    40: 'Gregory Gym',
    50: 'Recreational Sports Center',
    55: 'Recreational Sports Center',
    60: 'Whitaker Courts',
    65: 'Whitaker Courts',
};

export type FacilityEntry = { name: string; id: number };

// FACILITIES grouped by the sport in its name ("Location - Sport" ->
// sport). Drives the picker screen's grouped list.
export const FACILITIES_BY_SPORT: Record<string, FacilityEntry[]> = (() => {
    const groups: Record<string, FacilityEntry[]> = {};
    Object.entries(FACILITIES).forEach(([name, id]) => {
        const sport = name.split(' - ')[1] ?? 'Other';
        if (!groups[sport]) groups[sport] = [];
        groups[sport].push({ name, id });
    });
    return groups;
})();
