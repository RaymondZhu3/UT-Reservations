import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useReservations } from '@/context/ReservationsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Space, Type } from '@/constants/theme';

const RESERVATION_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

export default function LoginScreen() {
    const router = useRouter();
    const handled = useRef(false);
    const [loading, setLoading] = useState(true);
    const { resetSession } = useReservations();
    const insets = useSafeAreaInsets();

    async function handleNavigationChange(navState: any) {
        const { url, loading: navLoading } = navState;
        if (handled.current) return;
        // Must check loading as well as URL: onNavigationStateChange fires
        // when the page STARTS loading, so a URL-only check matches
        // reserve_courts.php before Duo has run.
        if (!url.includes('reserve_courts.php') || navLoading) return;

        handled.current = true;
        await SecureStore.setItemAsync('has_logged_in', 'true');
        // Clear the stale session flags, or Home renders blank after a logout.
        resetSession();
        router.replace('/(tabs)');
    }

    return (
        <View style={styles.container}>
            {/* Without a native header this is a full-screen embedded website
                with no way out — the guideline 4.2 and 2.1 exposure. Cancel
                returns to the welcome screen rather than trapping the user, or
                a reviewer who cannot pass Duo, on UT's SSO page. */}
            <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
                <TouchableOpacity
                    onPress={() => router.replace('/welcome')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                >
                    <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Sign in</Text>
                {/* Balances the row so the title stays centred. */}
                <Text style={[styles.cancel, styles.hidden]}>Cancel</Text>
            </View>

            <Text style={styles.subtitle}>
                This is UT&rsquo;s official sign-in page, shown inside the app.
            </Text>

            <View style={{ flex: 1 }}>
                <WebView
                    source={{ uri: RESERVATION_URL }}
                    onNavigationStateChange={handleNavigationChange}
                    onLoadEnd={() => setLoading(false)}
                    textZoom={100}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color={Brand.orange} size="large" />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Brand.surface },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Space.lg, paddingBottom: Space.sm + 2,
    },
    title: { ...Type.heading, color: Brand.ink },
    cancel: { ...Type.body, fontWeight: '400', fontSize: 16, color: Brand.orange },
    hidden: { opacity: 0 },
    subtitle: {
        ...Type.caption, color: Brand.inkMuted, textAlign: 'center',
        paddingHorizontal: Space.xl, paddingBottom: Space.sm + 2,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.surface,
    },
});
