import { useCallback, useEffect, useState } from 'react';
import { fetchTodayOverview } from '@/lib/facilityAvailability';
import type { FacilityOverviewRow } from '@/constants/types';

// Reads today's crowdsourced rows from Supabase — no scraping, no WebView.
// Freshness depends on how recently some user's on-device scrape wrote to a
// facility, which is why `updated_at` is exposed: the UI must say "updated X
// ago" rather than imply a live read.
//
// Callers must wire `refresh` to both focus and pull-to-refresh: this hook's
// consumers stay mounted, so a mount-only fetch is frozen for the app's life.
export function useFacilityOverview() {
    const [rows, setRows] = useState<FacilityOverviewRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const result = await fetchTodayOverview();

        // On failure, drop the rows rather than keeping the last good copy.
        // Showing nothing is survivable; showing a stale snapshot as if it
        // were current is what sends someone to a closed gym.
        setRows(result.error ? [] : result.rows);
        setError(result.error);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { rows, error, loading, refresh };
}
