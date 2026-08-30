import { useCallback, useEffect, useState } from 'react';
import { fetchFacilityHours } from '@/lib/facilityHours';
import { HOURS_FACILITY_NAMES } from '@/constants/facilities';
import type { FacilityHours } from '@/constants/types';

// Keyed by facility id, not name — UT names buildings differently on the
// hours page than on reserve_courts.php.
export function useFacilityHours() {
    const [byFacilityId, setByFacilityId] = useState<Record<number, FacilityHours>>({});
    // Every row is written by the same scrape run, so one row's period and
    // timestamp describe the whole table.
    const [meta, setMeta] = useState<{ periodLabel: string | null; scrapedAt: string | null }>({
        periodLabel: null,
        scrapedAt: null,
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const result = await fetchFacilityHours();

        if (result.error) {
            // Same rule as useFacilityOverview: no hours beats wrong hours.
            setByFacilityId({});
            setMeta({ periodLabel: null, scrapedAt: null });
            setError(result.error);
            setLoading(false);
            return;
        }

        const byName: Record<string, FacilityHours> = {};
        result.rows.forEach(row => { byName[row.facility_name] = row; });

        const mapped: Record<number, FacilityHours> = {};
        Object.entries(HOURS_FACILITY_NAMES).forEach(([facilityId, hoursName]) => {
            const row = byName[hoursName];
            if (row) mapped[Number(facilityId)] = row;
        });

        setByFacilityId(mapped);
        setMeta({
            periodLabel: result.rows[0]?.period_label ?? null,
            scrapedAt: result.rows[0]?.scraped_at ?? null,
        });
        setError(null);
        setLoading(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    return { byFacilityId, meta, error, loading, refresh };
}
