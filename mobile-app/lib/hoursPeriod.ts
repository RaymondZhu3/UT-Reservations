// Pure date math for UT's hours periods. Kept free of imports so
// scripts/check-hours-period.js can exercise it without a network layer.
// lib/facilityHours.ts is the data-access layer on top and re-exports these.

/** Inclusive local-time range that a scraped set of hours actually applies to. */
export interface HoursPeriod {
    /** Local midnight on the first day the hours apply to. */
    start: Date;
    /** Local end-of-day on the last day they apply to. */
    end: Date;
}

export type HoursStatus =
    /** The requested date falls inside the scraped period. Safe to state as fact. */
    | 'current'
    /** The requested date is outside the period these hours describe. */
    | 'stale'
    /** No period label, or one we couldn't parse — we cannot judge either way. */
    | 'unknown';

// UT writes the period as a bare date range, e.g. "8/24 - 10/31/26" — the
// start carries no year of its own and the separator may be a hyphen or an
// en dash. scraper.py's find_period_label() captures the whole heading, so a
// leading word or two ("Fall 8/24 - 10/31/26") can be present.
const PERIOD_RE = /(\d{1,2})\/(\d{1,2})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

function fullYear(raw: string): number {
    const n = Number(raw);
    return n < 100 ? 2000 + n : n;
}

/**
 * Turn `period_label` into a date range, or null if it's missing or unparseable.
 * `reference` supplies the year when the label omits one.
 *
 * Built with `new Date(y, m, d)`, never from a string — a date-only ISO string
 * parses as UTC midnight, which in Central is the previous evening.
 */
export function parsePeriodLabel(
    label: string | null | undefined,
    reference: Date = new Date()
): HoursPeriod | null {
    if (!label) return null;

    const match = PERIOD_RE.exec(label);
    if (!match) return null;

    const [, startMonth, startDay, endMonth, endDay, rawYear] = match;

    // Only the end date carries a year, so the start's is inferred. The wrap
    // test is narrow — late start AND early end — because a looser rule reads a
    // reversed label like "10/31 - 8/24/26" as a real 10-month range, and a
    // too-wide period marks every date 'current' and defeats the check. Erring
    // strict only yields `unknown`, which still renders the hours.
    const endYear = rawYear ? fullYear(rawYear) : reference.getFullYear();
    const wrapsNewYear =
        Number(startMonth) > Number(endMonth) &&
        Number(startMonth) >= 11 &&
        Number(endMonth) <= 2;
    const startYear = wrapsNewYear ? endYear - 1 : endYear;

    const start = new Date(startYear, Number(startMonth) - 1, Number(startDay));
    // Inclusive: the hours apply through the whole of the last day.
    const end = new Date(endYear, Number(endMonth) - 1, Number(endDay), 23, 59, 59, 999);

    // `new Date` silently rolls impossible values over (month 13 -> next
    // January, 2/30 -> March 2), so read the components back and reject
    // anything that moved.
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (start.getMonth() !== Number(startMonth) - 1 || start.getDate() !== Number(startDay)) return null;
    if (end.getMonth() !== Number(endMonth) - 1 || end.getDate() !== Number(endDay)) return null;
    if (end < start) return null;

    return { start, end };
}

/** Does `date` fall inside `period`, compared at day granularity? */
export function periodCovers(period: HoursPeriod, date: Date): boolean {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return day >= period.start && day <= period.end;
}
