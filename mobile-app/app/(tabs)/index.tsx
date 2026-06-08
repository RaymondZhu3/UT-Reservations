import { View, Text, StyleSheet, TouchableOpacity,
         ScrollView, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useReservations } from '@/context/ReservationsContext';
import { useRef, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const MY_RESERVATIONS_URL = 'https://apps.rs.utexas.edu/app/myrecsports/myreservations.php';

const SCRAPE_JS = `
    (function() {
        try {
            var upcoming = [];
            var past = [];
            var cards = document.querySelectorAll('.card-body .card');
            cards.forEach(function(card) {
                var header = card.querySelector('.card-header');
                if (!header) return;
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
                upcoming: upcoming,
                past: past
            }));
        } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error', message: e.toString()
            }));
        }
    })();
    true;
`;

function formatFacility(raw: string): string {
    const facilityMap: Record<string, string> = {
        'GRE': 'Gregory Gym',
        'CCF': 'Caven-Clark',
        'WC': 'Whitaker Courts',
        'BEL': 'Bellmont Hall',
        'RSC': 'Rec Sports Center',
    };
    const parts = raw.split(' - ');
    const code = parts[0];
    const court = parts[parts.length - 1];
    const name = facilityMap[code] || code;
    return `${name} · Court ${court}`;
}

function parseDate(raw: string): Date {
    const parts = raw.split('/');
    return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
}

function formatDate(raw: string): string {
    return parseDate(raw).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
    });
}

function getDateLabel(raw: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resDate = parseDate(raw);
    resDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
        (resDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return formatDate(raw);
}

// session states:
// 'unknown'  = haven't checked yet
// 'valid'    = session is good, show home screen
// 'invalid'  = session expired, redirect to login
type SessionState = 'unknown' | 'valid' | 'invalid';

export default function HomeScreen() {
    const router = useRouter();
    const { upcoming, past, setReservations } = useReservations();
    const webviewRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showUpdated, setShowUpdated] = useState(false);
    const [session, setSession] = useState<SessionState>('unknown');
    const sessionRef = useRef<SessionState>('unknown');
    const redirectedRef = useRef(false);

    // Check if user has ever logged in
    // If not, go straight to login without loading anything
    useEffect(() => {
        async function checkAuth() {
            const hasLoggedIn = await SecureStore.getItemAsync('has_logged_in');
            if (!hasLoggedIn) {
                router.replace('/login');
            }
        }
        checkAuth();

        // Fallback — if WebView doesn't respond in 10 seconds, go to login
        // Uses a ref so the closure always reads the current session value
        const timeout = setTimeout(() => {
            if (sessionRef.current === 'unknown') {
                console.log('WebView timeout — redirecting to login');
                router.replace('/login');
            }
        }, 10000);

        return () => clearTimeout(timeout);
    }, []);

    function refresh() {
        if (session === 'invalid') return; // don't refresh if we know session is dead
        setRefreshing(true);
        webviewRef.current?.reload();
    }

    function handleLoadEnd() {
        webviewRef.current?.injectJavaScript(SCRAPE_JS);
    }

    function handleMessage(event: any) {
        try {
            const parsed = JSON.parse(event.nativeEvent.data);
            if (parsed.type === 'reservations') {
                sessionRef.current = 'valid';
                setSession('valid');
                setReservations(parsed.upcoming, parsed.past);
                setLoading(false);
                setRefreshing(false);
                setShowUpdated(true);
                setTimeout(() => setShowUpdated(false), 2000);
            }
        } catch (e) {
            setLoading(false);
            setRefreshing(false);
        }
    }

    function handleNavigationChange(navState: any) {
        if (navState.url.includes('idp/profile/SAML2')) {
            if (redirectedRef.current) return;
            redirectedRef.current = true;
            sessionRef.current = 'invalid';
            setSession('invalid');
            setLoading(false);
            router.replace('/login');
        }
    }

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    // Show nothing while checking auth
    if (session === 'invalid') return null;

    return (
        <View style={{ flex: 1 }}>
            {/* Hidden WebView */}
            <View style={{ height: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webviewRef}
                    source={{ uri: MY_RESERVATIONS_URL }}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    onNavigationStateChange={handleNavigationChange}
                    style={{ height: 1 }}
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#BF5700"
                    />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.greeting}>{greeting()}</Text>
                    <Text style={styles.date}>
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric'
                        })}
                    </Text>
                </View>

                {showUpdated && (
                    <View style={styles.updatedBanner}>
                        <Text style={styles.updatedText}>✓ Up to date</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Upcoming</Text>
                    {loading ? (
                        <View style={styles.card}>
                            <ActivityIndicator color="#BF5700" style={{ marginBottom: 8 }} />
                            <Text style={styles.emptyText}>Loading reservations...</Text>
                        </View>
                    ) : upcoming.length > 0 ? (
                        upcoming.map((res, i) => (
                            <View key={i} style={styles.card}>
                                <View style={styles.cardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>
                                            {formatFacility(res.facility)}
                                        </Text>
                                        <Text style={styles.cardSub}>
                                            {getDateLabel(res.date)} · {res.time}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.badge,
                                        getDateLabel(res.date) === 'Today'
                                            ? styles.badgeRed
                                            : styles.badgeGreen
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            getDateLabel(res.date) === 'Today'
                                                ? styles.badgeTextRed
                                                : styles.badgeTextGreen
                                        ]}>
                                            {getDateLabel(res.date)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={styles.btnGhost}
                                        onPress={() => Alert.alert(
                                            '🔔 Reminder set',
                                            `We'll remind you 1 hour before your ${res.time} reservation`
                                        )}
                                    >
                                        <Text style={styles.btnGhostText}>Remind me</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.btnRed}
                                        onPress={() => Alert.alert(
                                            'Cancel Reservation',
                                            `Cancel ${formatFacility(res.facility)} at ${res.time}?`,
                                            [
                                                { text: 'Keep it', style: 'cancel' },
                                                {
                                                    text: 'Cancel reservation',
                                                    style: 'destructive',
                                                    onPress: () => router.push('/(tabs)/myreservations')
                                                }
                                            ]
                                        )}
                                    >
                                        <Text style={styles.btnRedText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.emptyText}>No upcoming reservations</Text>
                            <TouchableOpacity
                                style={[styles.btnOrange, { marginTop: 12 }]}
                                onPress={() => router.push('/(tabs)/courts')}
                            >
                                <Text style={styles.btnOrangeText}>Book a court →</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {past.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Quick rebook</Text>
                        <View style={styles.card}>
                            <View style={styles.cardRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>
                                        {formatFacility(past[0].facility)}
                                    </Text>
                                    <Text style={styles.cardSub}>
                                        Last played {formatDate(past[0].date)} · {past[0].time}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.btnOrange}
                                    onPress={() => router.push('/(tabs)/courts')}
                                >
                                    <Text style={styles.btnOrangeText}>Rebook</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Find a court</Text>
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push('/(tabs)/courts')}
                    >
                        <View style={styles.cardRow}>
                            <Text style={styles.cardTitle}>Browse available courts</Text>
                            <Text style={styles.chevron}>→</Text>
                        </View>
                        <Text style={styles.cardSub}>
                            See all open slots across every facility
                        </Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: '#f5f5f5' },
    container: { padding: 16, paddingBottom: 40 },
    header: { paddingTop: 56, paddingBottom: 16 },
    greeting: { fontSize: 28, fontWeight: 'bold', color: '#BF5700' },
    date: { fontSize: 14, color: '#888', marginTop: 2 },
    section: { marginBottom: 20 },
    sectionLabel: {
        fontSize: 11, fontWeight: '600', color: '#999',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
    card: {
        backgroundColor: 'white', borderRadius: 12, padding: 16,
        borderWidth: 0.5, borderColor: '#e5e5e5',
        shadowColor: '#000', shadowOpacity: 0.04,
        shadowRadius: 4, elevation: 1, marginBottom: 8,
    },
    cardRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', gap: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    cardSub: { fontSize: 12, color: '#888', marginTop: 3 },
    emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
    chevron: { fontSize: 18, color: '#ccc' },
    buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    badgeGreen: { backgroundColor: '#EAF3DE' },
    badgeRed: { backgroundColor: '#FAEEDA' },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeTextGreen: { color: '#3B6D11' },
    badgeTextRed: { color: '#854F0B' },
    btnOrange: {
        backgroundColor: '#BF5700', borderRadius: 8,
        paddingVertical: 8, paddingHorizontal: 14,
    },
    btnOrangeText: { color: 'white', fontSize: 13, fontWeight: '600' },
    btnGhost: {
        flex: 1, borderRadius: 8, paddingVertical: 8,
        borderWidth: 1, borderColor: '#BF5700', alignItems: 'center',
    },
    btnGhostText: { color: '#BF5700', fontSize: 13 },
    btnRed: {
        flex: 1, borderRadius: 8, paddingVertical: 8,
        borderWidth: 1, borderColor: '#A32D2D', alignItems: 'center',
    },
    btnRedText: { color: '#A32D2D', fontSize: 13 },
    updatedBanner: {
        backgroundColor: '#EAF3DE',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    updatedText: { fontSize: 12, color: '#3B6D11', fontWeight: '600' },
});