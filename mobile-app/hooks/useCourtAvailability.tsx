import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AvailabilityScraper, { AvailabilityScraperHandle } from '@/components/AvailabilityScraper';
import { FACILITIES, FACILITY_NAMES_BY_ID } from '@/constants/facilities';
import { pushFacilityAvailability } from '@/lib/facilityAvailability';
import { toIsoDateString } from '@/lib/dates';
import type { CourtSlot, FacilityAvailability } from '@/constants/types';

type Options = {
    // Which facilities to scrape. Defaults to all of them. Pass a single id
    // once the user has picked a facility — there is no reason to fire 8
    // hidden WebViews to answer a question about one.
    facilityIds?: number[];
    // Defaults to today. Passed straight to AvailabilityScraper, which
    // builds it into the page URL.
    date?: Date;
    // Debug only — see AvailabilityScraper's debugVisible comment.
    debugVisible?: boolean;
};

// Runs one hidden WebView per requested facility and aggregates the results.
// Render `scrapers` somewhere in the tree (it renders clipped, zero-height
// views) and read `availability`.
//
// Usage in a screen:
//   const { availability, loading, refresh, scrapers } = useCourtAvailability({ facilityIds: [40], date });
//   return <View style={{ flex: 1 }}>{scrapers}<YourAvailabilityGrid data={availability} /></View>;
export function useCourtAvailability(options: Options = {}) {
    const date = options.date ?? new Date();
    const dateKey = toIsoDateString(date);

    const facilityIds = useMemo(
        () => options.facilityIds ?? Object.values(FACILITIES),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options.facilityIds ? options.facilityIds.join(',') : 'all']
    );

    const [results, setResults] = useState<Record<number, FacilityAvailability>>(() => {
        const initial: Record<number, FacilityAvailability> = {};
        facilityIds.forEach(id => {
            initial[id] = { facilityId: id, facilityName: FACILITY_NAMES_BY_ID[id] ?? String(id), slots: [], loading: true };
        });
        return initial;
    });

    const scraperRefs = useRef<Record<number, AvailabilityScraperHandle | null>>({});

    const handleResult = useCallback((facilityId: number, slots: CourtSlot[]) => {
        setResults(prev => ({
            ...prev,
            [facilityId]: { ...prev[facilityId], slots, loading: false, error: undefined },
        }));

        // Crowdsourced write: this only fires because a real person's own
        // scrape just succeeded, so it's a byproduct of normal use, not a
        // background job. Fire-and-forget — never blocks or fails the UI.
        const facilityName = FACILITY_NAMES_BY_ID[facilityId] ?? String(facilityId);
        pushFacilityAvailability(facilityId, facilityName, date, slots);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateKey]);

    const handleError = useCallback((facilityId: number, message: string) => {
        setResults(prev => ({
            ...prev,
            [facilityId]: { ...prev[facilityId], loading: false, error: message },
        }));
    }, []);

    const refresh = useCallback(() => {
        setResults(prev => {
            const updated: Record<number, FacilityAvailability> = { ...prev };
            facilityIds.forEach(id => {
                updated[id] = { ...updated[id], loading: true, error: undefined };
            });
            return updated;
        });
        facilityIds.forEach(id => scraperRefs.current[id]?.reload());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facilityIds]);

    // Changing the date changes each scraper's source URL, which makes the
    // WebView navigate on its own — but we still need to reset our own
    // loading/result state so the UI doesn't keep showing yesterday's slots
    // labeled as fresh while the new page loads.
    useEffect(() => {
        setResults(prev => {
            const updated: Record<number, FacilityAvailability> = {};
            facilityIds.forEach(id => {
                updated[id] = { facilityId: id, facilityName: FACILITY_NAMES_BY_ID[id] ?? String(id), slots: [], loading: true };
            });
            return updated;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateKey, facilityIds]);

    const scrapers = (
        <>
            {facilityIds.map(id => (
                <AvailabilityScraper
                    key={`${id}-${dateKey}`}
                    ref={(handle) => { scraperRefs.current[id] = handle; }}
                    facilityId={id}
                    date={date}
                    onResult={handleResult}
                    onError={handleError}
                    debugVisible={options.debugVisible}
                />
            ))}
        </>
    );

    const availability = facilityIds.map(id => results[id]);
    const loading = availability.some(a => a?.loading);

    return { availability, loading, refresh, scrapers };
}
