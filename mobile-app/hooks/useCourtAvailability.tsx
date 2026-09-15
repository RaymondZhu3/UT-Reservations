import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AvailabilityScraper, { AvailabilityScraperHandle } from '@/components/AvailabilityScraper';
import { FACILITIES, FACILITY_NAMES_BY_ID } from '@/constants/facilities';
import { pushFacilityAvailability } from '@/lib/facilityAvailability';
import { toIsoDateString } from '@/lib/dates';
import type { CourtSlot, FacilityAvailability } from '@/constants/types';

type Options = {
    // Defaults to all 8. Pass one id once the user has picked a facility;
    // firing 8 hidden WebViews to answer a question about one is wasteful.
    facilityIds?: number[];
    // Defaults to today. Becomes the date param in the page URL.
    date?: Date;
    // See AvailabilityScraper's debugVisible.
    debugVisible?: boolean;
};

// Runs one hidden WebView per requested facility and aggregates the results.
// The caller must render `scrapers` somewhere in the tree (they are clipped,
// zero-height views) or nothing ever loads.
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

        // Crowdsourced write. Only ever fires off a real person's own scrape,
        // never on a timer, which is what UT's authentication policy requires.
        // Fire-and-forget: it must not block or fail the UI.
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

    // A new date changes each scraper's source URL, so the WebViews navigate
    // on their own. Local state still has to be reset, or the UI shows the
    // previous day's slots as current while the new page loads.
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
