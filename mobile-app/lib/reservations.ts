// Formatting helpers for Reservation data (scraped from myreservations.php).
// Pulled out of index.tsx so Home and My Reservations both use one copy
// instead of two near-identical implementations.
import { FACILITY_CODE_MAP } from '@/constants/facilities';
import { dateLabel, parseUtDateString, parseUtTime } from './dates';
import type { Reservation } from '@/constants/types';

// "GRE - RB - 01" -> "Gregory Gym · Court 01"
export function formatFacility(raw: string): string {
    const parts = raw.split(' - ');
    const code = parts[0];
    const court = parts[parts.length - 1];
    const name = FACILITY_CODE_MAP[code] || code;
    return `${name} · Court ${court}`;
}

// "Today" / "Tomorrow" / "Wed, Aug 5" for a reservation's raw MM/DD/YYYY
// date string. Thin wrapper around dates.ts's dateLabel so screens never
// need to parse the date themselves.
export function reservationDateLabel(raw: string): string {
    return dateLabel(parseUtDateString(raw));
}

// Full weekday + month + day, e.g. "Wednesday, August 5" — used where the
// short label isn't enough context (e.g. "Last played ...").
export function formatReservationDate(raw: string): string {
    return parseUtDateString(raw).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });
}

// Combines date + time into one comparable timestamp, since myreservations.php
// isn't guaranteed to list cards in chronological order.
function reservationTimestamp(r: Pick<Reservation, 'date' | 'time'>): number {
    const { hours, minutes } = parseUtTime(r.time);
    const timestamp = parseUtDateString(r.date);
    timestamp.setHours(hours, minutes, 0, 0);
    return timestamp.getTime();
}

// Soonest first — used by the home screen (pick just the next one) and My
// Reservations (show the full list in order).
export function sortReservationsByDate<T extends Pick<Reservation, 'date' | 'time'>>(reservations: T[]): T[] {
    return [...reservations].sort((a, b) => reservationTimestamp(a) - reservationTimestamp(b));
}
