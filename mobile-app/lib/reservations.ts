// Formatting helpers for Reservation data (scraped from myreservations.php).
// Shared by Home and My Reservations so the two can't drift.
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

// "Today" / "Tomorrow" / "Wed, Aug 5" from a reservation's raw MM/DD/YYYY
// string. Wraps dates.ts's dateLabel so screens never parse dates themselves.
export function reservationDateLabel(raw: string): string {
    return dateLabel(parseUtDateString(raw));
}

// Combines date + time into one comparable timestamp, since myreservations.php
// isn't guaranteed to list cards in chronological order.
function reservationTimestamp(r: Pick<Reservation, 'date' | 'time'>): number {
    const { hours, minutes } = parseUtTime(r.time);
    const timestamp = parseUtDateString(r.date);
    timestamp.setHours(hours, minutes, 0, 0);
    return timestamp.getTime();
}

// Soonest first. Home takes the head of this; My Reservations shows it all.
export function sortReservationsByDate<T extends Pick<Reservation, 'date' | 'time'>>(reservations: T[]): T[] {
    return [...reservations].sort((a, b) => reservationTimestamp(a) - reservationTimestamp(b));
}
