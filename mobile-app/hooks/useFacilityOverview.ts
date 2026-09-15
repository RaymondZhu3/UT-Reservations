import { useCallback, useEffect, useState } from 'react';
import { fetchTodayOverview } from '@/lib/facilityAvailability';
import type { FacilityOverviewRow } from '@/constants/types';

// Reads today's crowdsourced rows from Supabase. `updated_at` is exposed so
// the UI can say "updated X ago" rather than imply a live read.
//
// Callers must wire `refresh` to both focus and pull-to-refresh: consumers of
// this hook stay mounted, so a mount-only fetch never runs again.
export function useFacilityOverview() {
    const [rows, setRows] = useState<FacilityOverviewRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const result = await fetchTodayOverview();

        // On failure, drop the rows rather than keeping the last good copy.
        // A stale snapshot rendered as current sends someone to a closed gym.
        setRows(result.error ? [] : result.rows);
        setError(result.error);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { rows, error, loading, refresh };
}
