import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { toUtDateString } from '@/lib/dates';
import type { CourtSlot } from '@/constants/types';

const RESERVE_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

// NOTE: This assumes reserve_courts.php renders a single <table> where each
// column is a time slot (labelled in the header row) and each row is a
// court. Open slots are <td class="success"> containing a link whose href
// has reservationAction=reserve — that part is confirmed in context.md.
// The header/column-index assumption is NOT confirmed against the live
// (authenticated) page — load this in a facility tab and console.log the
// scrape result once to check `time` values look right, and adjust the
// selectors below if the real markup differs.
function buildScrapeJs(facilityId: number) {
    return `
        (function() {
            try {
                var table = document.querySelector('table');
                if (!table) throw new Error('no table found on page');

                // Header row gives us the time label for each column index.
                var headerRow = table.querySelector('thead tr') || table.querySelector('tr');
                var headerCells = headerRow ? headerRow.querySelectorAll('th, td') : [];
                var times = [];
                headerCells.forEach(function(cell) {
                    times.push(cell.innerText.trim());
                });

                // Body rows — fall back to "every row after the first" if
                // there's no explicit <tbody>.
                var bodyRows = table.querySelectorAll('tbody tr');
                if (bodyRows.length === 0) {
                    var allRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
                    bodyRows = allRows.slice(1);
                }

                var slots = [];
                bodyRows.forEach(function(row) {
                    var courtCell = row.querySelector('th') || row.querySelector('td');
                    var courtName = courtCell ? courtCell.innerText.trim() : '';
                    var cells = row.querySelectorAll('td');
                    cells.forEach(function(cell, idx) {
                        if (!cell.classList.contains('success')) return;
                        var link = cell.querySelector('a[href*="reservationAction=reserve"]');
                        if (!link) return;
                        slots.push({
                            court: courtName,
                            time: times[idx] || '',
                            bookUrl: link.href
                        });
                    });
                });

                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'availability',
                    facilityId: ${facilityId},
                    slots: slots
                }));
            } catch (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    facilityId: ${facilityId},
                    message: e.toString()
                }));
            }
        })();
        true;
    `;
}

type Props = {
    facilityId: number;
    date: Date;
    onResult: (facilityId: number, slots: CourtSlot[]) => void;
    onError: (facilityId: number, message: string) => void;
};

export type AvailabilityScraperHandle = {
    reload: () => void;
};

// One invisible WebView pointed at a single facility's availability page
// for a specific date. Mirrors the hidden-WebView pattern already used on
// the home screen for myreservations.php — this does the same thing for
// reserve_courts.php.
//
// Two things here are unverified against the live site (see
// AvailabilityScraper caveat above, and backend/scraper.py which uses
// `facility_id` rather than `fid`):
// 1. Query param is `facility_id`, matching backend/scraper.py's confirmed
//    working scraper — NOT the `fid` this component originally shipped with.
// 2. `date=MM/DD/YYYY` is a best guess for how to request a specific day.
//    UT's page may use a different param name, a different date format, or
//    require clicking a day-forward control instead of a URL param. Test
//    against the real (authenticated) page and adjust buildUrl() below.
function buildUrl(facilityId: number, date: Date): string {
    const dateParam = toUtDateString(date);
    return `${RESERVE_URL}?facility_id=${facilityId}&date=${encodeURIComponent(dateParam)}`;
}

const AvailabilityScraper = forwardRef<AvailabilityScraperHandle, Props>(
    ({ facilityId, date, onResult, onError }, ref) => {
        const webviewRef = useRef<WebView>(null);

        useImperativeHandle(ref, () => ({
            reload: () => webviewRef.current?.reload(),
        }));

        function handleLoadEnd() {
            webviewRef.current?.injectJavaScript(buildScrapeJs(facilityId));
        }

        function handleMessage(event: any) {
            try {
                const parsed = JSON.parse(event.nativeEvent.data);
                if (parsed.type === 'availability') {
                    onResult(parsed.facilityId, parsed.slots);
                } else if (parsed.type === 'error') {
                    onError(parsed.facilityId, parsed.message);
                }
            } catch (e) {
                onError(facilityId, 'Failed to parse scrape result');
            }
        }

        return (
            <View style={{ height: 0, width: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webviewRef}
                    source={{ uri: buildUrl(facilityId, date) }}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    style={{ height: 1, width: 1 }}
                />
            </View>
        );
    }
);

export default AvailabilityScraper;
