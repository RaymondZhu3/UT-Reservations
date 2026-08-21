import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { debugLog } from '@/lib/debugLog';
import type { Reservation } from '@/constants/types';

const MY_RESERVATIONS_URL = 'https://apps.rs.utexas.edu/app/myrecsports/myreservations.php';

// Ends UT's session too. Clearing SecureStore alone leaves you logged into
// UT, so the next person to tap Login lands in your account. context.md §6.
const LOGOUT_URL = 'https://apps.rs.utexas.edu/logout';

// Scrapes myreservations.php's reservation cards. Used to be duplicated
// almost verbatim in both index.tsx and myreservations.tsx, each running
// its own separate hidden/visible WebView against the same URL. Now there's
// one WebView (below, mounted once here) and one copy of this script —
// every screen that needs reservation data just reads it from context.
const SCRAPE_JS = `
    (function() {
        try {
            var upcoming = [];
            var cards = document.querySelectorAll('.card-body .card');
            cards.forEach(function(card) {
                var header = card.querySelector('.card-header');
                if (!header) return;

                // lines[0] = facility e.g. "GRE - RB - 01"
                // lines[1] = date e.g. "05/22/2026"
                // lines[2] = time e.g. "2:00 PM"
                var lines = header.innerText.trim().split('\\n')
                    .map(function(l) { return l.trim(); })
                    .filter(function(l) { return l.length > 0; });
                if (lines.length < 3) return;

                var cancelLink = card.querySelector('a[href*="reservationAction=release"]');
                upcoming.push({
                    facility: lines[0],
                    date: lines[1],
                    time: lines[2],
                    court: lines[0],
                    cancelUrl: cancelLink ? cancelLink.href : ''
                });
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'reservations',
                upcoming: upcoming
            }));
        } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: e.toString()
            }));
        }
    })();
    true;
`;

// session states:
// 'unknown'  = haven't heard back from the WebView yet
// 'valid'    = session is good
// 'invalid'  = session expired, user's been sent to login
type SessionState = 'unknown' | 'valid' | 'invalid';

type ReservationsContextType = {
    upcoming: Reservation[];
    loading: boolean;
    refreshing: boolean;
    session: SessionState;
    refresh: () => void;
    cancelReservation: (cancelUrl: string) => void;
    logout: () => Promise<void>;
    resetSession: () => void;
    notificationIds: Record<string, string>;
    setNotificationId: (cancelUrl: string, id: string) => void;
    removeNotificationId: (cancelUrl: string) => void;
};

const ReservationsContext = createContext<ReservationsContextType>({
    upcoming: [],
    loading: true,
    refreshing: false,
    session: 'unknown',
    refresh: () => {},
    cancelReservation: () => {},
    logout: async () => {},
    resetSession: () => {},
    notificationIds: {},
    setNotificationId: () => {},
    removeNotificationId: () => {},
});

export function ReservationsProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const webviewRef = useRef<WebView>(null);
    const redirectedRef = useRef(false);
    const sessionRef = useRef<SessionState>('unknown');

    const [upcoming, setUpcoming] = useState<Reservation[]>([]);
    const [notificationIds, setNotificationIds] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [session, setSession] = useState<SessionState>('unknown');
    // Guards against overlapping reload() calls — real risk now that
    // My Reservations fires several retries in quick succession (2s, 4s,
    // 7s) to ride out UT's post-booking propagation delay. A ref (not the
    // refreshing state) because it needs to be read/written synchronously
    // at call time regardless of which render's closure of refresh()
    // happens to be invoked.
    const isRefreshingRef = useRef(false);

    // Moved from index.tsx: skip straight to login if we've never logged
    // in, and fall back to login if the WebView never responds at all.
    useEffect(() => {
        async function checkAuth() {
            const hasLoggedIn = await SecureStore.getItemAsync('has_logged_in');
            if (!hasLoggedIn) {
                router.replace('/login');
            }
        }
        checkAuth();

        const timeout = setTimeout(() => {
            if (sessionRef.current === 'unknown') {
                debugLog('Reservations WebView timeout (10s) — redirecting to login');
                router.replace('/login');
            }
        }, 10000);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Navigates explicitly to MY_RESERVATIONS_URL rather than calling
    // .reload() — .reload() reloads whatever page the WebView is currently
    // on, and UT's cancel redirect chain can strand it on index.php (zero
    // reservation cards, so it silently "confirms" zero upcoming forever).
    // Full root-cause writeup: context.md section 6.
    function refresh() {
        if (session === 'invalid') {
            debugLog('refresh() skipped — session invalid');
            return;
        }
        if (isRefreshingRef.current) {
            debugLog('refresh() skipped — already in flight');
            return;
        }
        debugLog('refresh() — navigating shared WebView back to', MY_RESERVATIONS_URL);
        isRefreshingRef.current = true;
        setRefreshing(true);
        webviewRef.current?.injectJavaScript(`
            window.location.href = '${MY_RESERVATIONS_URL}';
            true;
        `);
    }

    // Executes a cancel by navigating the same hidden WebView to UT's release URL.
    function cancelReservation(cancelUrl: string) {
        debugLog('cancelReservation() — navigating shared WebView to', cancelUrl);
        webviewRef.current?.injectJavaScript(`
            window.location.href = '${cancelUrl}';
            true;
        `);
    }

    // Signs out of UT first, then drops local state. Confirmed on device:
    // logging back in asks for the EID again.
    async function logout() {
        debugLog('logout() — navigating shared WebView to', LOGOUT_URL);

        // Stop the expiry handler from redirecting too — we're already going.
        redirectedRef.current = true;
        sessionRef.current = 'invalid';
        setSession('invalid');
        setUpcoming([]);

        webviewRef.current?.injectJavaScript(`
            window.location.href = '${LOGOUT_URL}';
            true;
        `);

        await SecureStore.deleteItemAsync('has_logged_in');
        await SecureStore.deleteItemAsync('ut_cookies');

        // Give UT's logout a moment to land before the login screen loads.
        setTimeout(() => router.replace('/login'), 1200);
    }

    // This provider never unmounts, so the 'invalid' flags set on logout
    // survive re-login and leave Home blank. login.tsx calls this. context.md §6.
    function resetSession() {
        debugLog('resetSession() — clearing session guards after login');
        redirectedRef.current = false;
        sessionRef.current = 'unknown';
        isRefreshingRef.current = false;
        setSession('unknown');
        setUpcoming([]);
        setLoading(true);

        // WebView is sitting on the login page — send it back.
        webviewRef.current?.injectJavaScript(`
            window.location.href = '${MY_RESERVATIONS_URL}';
            true;
        `);
    }

    function handleLoadEnd() {
        debugLog('Reservations WebView onLoadEnd — injecting scrape JS');
        webviewRef.current?.injectJavaScript(SCRAPE_JS);
    }

    function handleMessage(event: any) {
        try {
            const parsed = JSON.parse(event.nativeEvent.data);
            if (parsed.type === 'reservations') {
                // Logs id (parsed out of cancelUrl) alongside facility/date/
                // time, not just the latter — a rebooked identical slot
                // looks textually identical to the original otherwise, and
                // the id is what actually tells "same reservation, cancel
                // silently failed" apart from "new reservation, just slow
                // to show up."
                debugLog('Reservations scrape result:', parsed.upcoming.length, 'upcoming —', parsed.upcoming.map((r: Reservation) => {
                    const idMatch = r.cancelUrl.match(/[?&]id=(\d+)/);
                    return `${r.facility} ${r.date} ${r.time} (id=${idMatch ? idMatch[1] : '?'})`;
                }));
                sessionRef.current = 'valid';
                setSession('valid');
                setUpcoming(parsed.upcoming);
                setLoading(false);
                setRefreshing(false);
                isRefreshingRef.current = false;
            } else if (parsed.type === 'error') {
                debugLog('Reservations scrape error:', parsed.message);
                setLoading(false);
                setRefreshing(false);
                isRefreshingRef.current = false;
            }
        } catch (e) {
            debugLog('Reservations scrape: failed to parse WebView message', e);
            setLoading(false);
            setRefreshing(false);
            isRefreshingRef.current = false;
        }
    }

    function handleNavigationChange(navState: any) {
        debugLog('Reservations WebView nav:', navState.url, 'loading:', navState.loading);
        if (navState.url.includes('idp/profile/SAML2')) {
            if (redirectedRef.current) return; // useRef, not useState — needs
            redirectedRef.current = true;       // to block a second redirect
            sessionRef.current = 'invalid';     // synchronously, before the
            setSession('invalid');              // next nav event fires.
            setLoading(false);
            debugLog('Reservations WebView — session expired, redirecting to login');
            router.replace('/login');
        }
    }

    function setNotificationId(cancelUrl: string, id: string) {
        setNotificationIds(prev => ({ ...prev, [cancelUrl]: id }));
    }

    function removeNotificationId(cancelUrl: string) {
        setNotificationIds(prev => {
            const updated = { ...prev };
            delete updated[cancelUrl];
            return updated;
        });
    }

    return (
        <ReservationsContext.Provider
            value={{
                upcoming, loading, refreshing, session,
                refresh, cancelReservation, logout, resetSession,
                notificationIds, setNotificationId, removeNotificationId,
            }}
        >
            <View style={{ height: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webviewRef}
                    source={{ uri: MY_RESERVATIONS_URL }}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    onNavigationStateChange={handleNavigationChange}
                    style={{ height: 1 }}
                    // This WebView exists purely to reflect current server
                    // state (reservations change from booking/cancelling
                    // constantly) — a cached response is never correct here,
                    // only ever stale. Without this, .reload() can silently
                    // serve a cached myreservations.php from before the
                    // most recent booking/cancel.
                    cacheEnabled={false}
                />
            </View>
            {children}
        </ReservationsContext.Provider>
    );
}

export function useReservations() {
    return useContext(ReservationsContext);
}
