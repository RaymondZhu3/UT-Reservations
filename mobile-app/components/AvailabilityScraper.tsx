import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { toUtDateString } from '@/lib/dates';
import type { CourtSlot } from '@/constants/types';

const RESERVE_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

// Table orientation: rows = time slots, columns = courts. Header row is
// [ "Time", "A", "B", ... ]; the first cell is a label, the rest are court
// names. Each body row is [ time, courtACell, courtBCell, ... ].
// Open slots are <td class="success"> containing a link whose href has
// reservationAction=reserve.
function buildScrapeJs(facilityId: number) {
    return `
        (function() {
            try {
                var table = document.querySelector('table');
                if (!table) throw new Error('no table found on page');

                // First cell is the "Time" label; the rest are court names.
                var headerRow = table.querySelector('thead tr') || table.querySelector('tr');
                var headerCells = headerRow ? Array.prototype.slice.call(headerRow.querySelectorAll('th, td')) : [];
                var courtNames = headerCells.slice(1).map(function(cell) {
                    return cell.innerText.trim();
                });

                // Body rows. Falls back to "every row after the first" when
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
    // Renders the WebView at full size instead of hidden, to inspect the real page.
    debugVisible?: boolean;
};

export type AvailabilityScraperHandle = {
    reload: () => void;
};

// One hidden WebView per facility+date, on reserve_courts.php. Same pattern as
// ReservationsContext. The page expects facility_id=<id>&date=MM/DD/YYYY.
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

        // Constrain height only, never width. innerText (used in buildScrapeJs
        // above) reflects rendered layout, so a ~0px-wide WebView collapses the
        // table's text to empty strings, while DOM-only checks like
        // querySelector and classList keep matching and hide the problem.
        return (
            <View style={debugVisible ? { height: 500, width: '100%' } : { height: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webviewRef}
                    source={{ uri: buildUrl(facilityId, date) }}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    style={debugVisible ? { flex: 1 } : { height: 1 }}
                    // Same reasoning as ReservationsContext's WebView. Court
                    // availability changes constantly, so a cached response is
                    // always wrong, and reload() (from useCourtAvailability's
                    // refresh()) will otherwise serve a stale page.
                    cacheEnabled={false}
                />
            </View>
        );
    }
);

export default AvailabilityScraper;
