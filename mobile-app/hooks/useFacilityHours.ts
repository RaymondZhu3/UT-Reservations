import { useCallback, useEffect, useState } from 'react';
import { fetchFacilityHours } from '@/lib/facilityHours';
import { HOURS_FACILITY_NAMES } from '@/constants/facilities';
import type { FacilityHours } from '@/constants/types';

// Unlike useFacilityOverview, this has no cold-start problem: the data comes
// from a scheduled scrape of a public page, so it's populated on day one with
// zero users. Keyed by the app's facility id rather than by name, since UT's
// hours page and reserve_courts.php name the same buildings differently.
export function useFacilityHours() {
    const [byFacilityId, setByFacilityId] = useState<Record<number, FacilityHours>>({});
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const rows = await fetchFacilityHours();

        const byName: Record<string, FacilityHours> = {};
        rows.forEach(row => { byName[row.facility_name] = row; });

        const mapped: Record<number, FacilityHours> = {};
        Object.entries(HOURS_FACILITY_NAMES).forEach(([facilityId, hoursName]) => {
            const row = byName[hoursName];
            if (row) mapped[Number(facilityId)] = row;
        });

        setByFacilityId(mapped);
        setLoading(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    return { byFacilityId, loading, refresh };
}
