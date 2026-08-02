// Date helpers shared by the facility picker, the scraper, and Supabase
// reads/writes. Two formats matter here: UT's own pages use MM/DD/YYYY
// (see parseDate in app/(tabs)/index.tsx), Postgres date columns use
// YYYY-MM-DD. Keep conversions in one place so they don't drift.

export function toUtDateString(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
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
export function upcomingDates(count: number = 7): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

// "4 min ago" / "2 hr ago" for crowdsourced updated_at timestamps — makes
// clear to the user this is a snapshot, not a live read.
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
