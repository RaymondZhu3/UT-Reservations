import WebViewScreen, { WebViewScreenHandle } from '@/components/WebViewScreen';
import { useReservations } from '@/context/ReservationsContext';
import { useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

const MY_RESERVATIONS_URL = 'https://apps.rs.utexas.edu/app/myrecsports/myreservations.php';

// This JS runs on the My Reservations page
// It reads the reservation table and sends data back
const SCRAPE_JS = `
    (function() {
        try {
            var upcoming = [];
            var past = [];

            // Each reservation is a card inside .card-body .row
            var cards = document.querySelectorAll('.card-body .card');
            
            cards.forEach(function(card) {
                var header = card.querySelector('.card-header');
                if (!header) return;

                // Get all text lines from the card header
                var lines = header.innerText.trim().split('\\n')
                    .map(function(l) { return l.trim(); })
                    .filter(function(l) { return l.length > 0; });

                // lines[0] = facility e.g. "GRE - RB - 01"
                // lines[1] = date e.g. "05/22/2026"
                // lines[2] = time e.g. "2:00 PM"
                if (lines.length < 3) return;

                var cancelLink = card.querySelector('a[href*="reservationAction=release"]');
                var cancelUrl = cancelLink ? cancelLink.href : '';

                upcoming.push({
                    facility: lines[0],
                    date: lines[1],
                    time: lines[2],
                    court: lines[0],
                    cancelUrl: cancelUrl
                });
            });

            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'reservations',
                upcoming: upcoming,
                past: past
            }));

        } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: e.toString()
            }));
        }
    })();
    true;
`;

export default function MyReservationsTab() {
    const { setReservations } = useReservations();
    const screenRef = useRef<WebViewScreenHandle>(null);

    useFocusEffect(
        useCallback(() => {
            screenRef.current?.reload();
        }, [])
    );

    function handleMessage(data: string) {
        try {
            const parsed = JSON.parse(data);
            console.log('Reservations scraped:', JSON.stringify(parsed, null, 2));
            
            if (parsed.type === 'reservations') {
                setReservations(parsed.upcoming, parsed.past);
            } else if (parsed.type === 'error') {
                console.log('Scrape error:', parsed.message);
            }
        } catch (e) {
            console.log('Parse error:', e);
        }
    }

    return (
        <WebViewScreen
            ref={screenRef}
            url={MY_RESERVATIONS_URL}
            title="My Bookings"
            scrapeJs={SCRAPE_JS}
            onMessage={handleMessage}
        />
    );
}