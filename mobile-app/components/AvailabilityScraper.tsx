import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { toUtDateString } from '@/lib/dates';
import type { CourtSlot } from '@/constants/types';

const RESERVE_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

// Table orientation: rows = time slots, columns = courts. Header row is
// [ "Time", "A", "B", ... ] — first cell is just a label, the rest are
// court names. Each body row is [ time, courtACell, courtBCell, ... ].
// Open slots are <td class="success"> containing a link whose href has
// reservationAction=reserve.
function buildScrapeJs(facilityId: number) {
    return `
        (function() {
            try {
                var table = document.querySelector('table');
                if (!table) throw new Error('no table found on page');

                // Header row: first cell is the "Time" column label, the
                // rest are court names, one per column index.
                var headerRow = table.querySelector('thead tr') || table.querySelector('tr');
                var headerCells = headerRow ? Array.prototype.slice.call(headerRow.querySelectorAll('th, td')) : [];
                var courtNames = headerCells.slice(1).map(function(cell) {
                    return cell.innerText.trim();
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
                    var cells = Array.prototype.slice.call(row.querySelectorAll('th, td'));
                    if (cells.length === 0) return;
                    var time = cells[0].innerText.trim();
                    var courtCells = cells.slice(1);
                    courtCells.forEach(function(cell, idx) {
                        if (!cell.classList.contains('success')) return;
                        var link = cell.querySelector('a[href*="reservationAction=reserve"]');
                        if (!link) return;
                        slots.push({
                            court: courtNames[idx] || '',
                            time: time,
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
    // Debug only: renders the WebView at full size instead of hidden, so
    // you can actually see the page reserve_courts.php loads with the
    // current facility_id/date params. Flip this on temporarily when
    // results look wrong — real markup beats guessing at selectors again.
    debugVisible?: boolean;
};

export type AvailabilityScraperHandle = {
    reload: () => void;
};

// One invisible WebView pointed at a single facility's availability page for a
// given date. Same hidden-WebView pattern as ReservationsContext, aimed at
// reserve_courts.php instead of myreservations.php.
//
// facility_id=<id>&date=MM/DD/YYYY are the parameters the page expects.
function buildUrl(facilityId: number, date: Date): string {
    const dateParam = toUtDateString(date);
    return `${RESERVE_URL}?facility_id=${facilityId}&date=${encodeURIComponent(dateParam)}`;
}

const AvailabilityScraper = forwardRef<AvailabilityScraperHandle, Props>(
    ({ facilityId, date, onResult, onError, debugVisible }, ref) => {
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

        // Constrain height only, never width. innerText (used in
        // buildScrapeJs above) reflects rendered layout, so a ~0px-wide WebView
        // collapses the table's text to empty strings even though DOM-only
        // checks like querySelector and classList still match. A WebView must
        // never render at zero size in either axis.
        return (
            <View style={debugVisible ? { height: 500, width: '100%' } : { height: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webviewRef}
                    source={{ uri: buildUrl(facilityId, date) }}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    style={debugVisible ? { flex: 1 } : { height: 1 }}
                    // Same reasoning as ReservationsContext's WebView — court
                    // availability changes constantly, a cached response is
                    // never the right answer, and reload() (used by
                    // useCourtAvailability's refresh()) can otherwise serve
                    // a stale page.
                    cacheEnabled={false}
                />
            </View>
        );
    }
);

export default AvailabilityScraper;
