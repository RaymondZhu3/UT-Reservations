// Date helpers shared by the facility picker, the scraper, and Supabase
// reads/writes. Two formats matter: UT's pages use MM/DD/YYYY, Postgres date
// columns use YYYY-MM-DD. Conversions live here so they don't drift.

export function toUtDateString(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

// Inverse of toUtDateString. Parses UT's "MM/DD/YYYY" reservation dates back
// into a Date, for anything that compares, labels or schedules against
// reservation data scraped from myreservations.php.
export function parseUtDateString(raw: string): Date {
    const [mm, dd, yyyy] = raw.split('/');
    // Built from numeric components, not a "YYYY-MM-DD" string. The date-only
    // ISO form parses as UTC midnight, which renders back in local time and can
    // roll onto the previous day (a CDT reservation for the 5th showing as the
    // 4th). The (year, month, day) constructor is local, matching dateLabel's
    // own "today" comparison.
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

// Parses UT's "2:00 PM" strings into 24-hour hours/minutes. Shared by anything
// combining a reservation's date and time into one timestamp: reminder
// scheduling (useNotifications.ts) and sorting (lib/reservations.ts).
export function parseUtTime(time: string): { hours: number; minutes: number } {
    const [timePart, meridiem] = time.split(' ');
    const [hoursStr, minutesStr] = timePart.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
}

export function toIsoDateString(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
}

export function dateLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Next `count` days starting today, for a horizontal date picker.
export function upcomingDates(count: number = 8): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

// "4 min ago" / "2 hr ago" for crowdsourced updated_at timestamps, so the user
// can see this is a snapshot rather than a live read.
export function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const minutes = Math.round(diffMs / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}
