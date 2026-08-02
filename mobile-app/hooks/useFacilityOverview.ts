import { useCallback, useEffect, useState } from 'react';
import { fetchTodayOverview } from '@/lib/facilityAvailability';
import type { FacilityOverviewRow } from '@/constants/types';

// Home-screen-facing hook: reads today's crowdsourced Supabase rows
// directly, no scraping, no WebView. Freshness depends entirely on how
// recently some user's on-device scrape wrote to a given facility today —
// that's the tradeoff of this approach, and why `updated_at` is included
// so the UI can show "updated X min ago" instead of implying live data.
export function useFacilityOverview() {
    const [rows, setRows] = useState<FacilityOverviewRow[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const data = await fetchTodayOverview();
        setRows(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { rows, loading, refresh };
}
