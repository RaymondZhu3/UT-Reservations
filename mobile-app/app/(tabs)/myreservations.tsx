import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useReservations } from '@/context/ReservationsContext';
import { sortReservationsByDate } from '@/lib/reservations';
import { debugLog } from '@/lib/debugLog';
import ReservationCard from '@/components/ReservationCard';
import LogoutButton from '@/components/LogoutButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Brand, Radius, Space, Type } from '@/constants/theme';

// The full reservation manager: every upcoming booking, soonest first, each
// with its own Remind/Cancel. Home shows only the next one. Reads the same
// ReservationsContext, so there is no second scrape — one WebView, one source.
export default function MyReservationsTab() {
    const { upcoming, loading, refreshing, refresh } = useReservations();
    const router = useRouter();
    const sorted = sortReservationsByDate(upcoming);

    // `refreshing` is shared context state, so it is true whenever ANY screen
    // triggered a visible refresh. This flag records whether the pull happened
    // here. Without it, pulling on Home and switching tabs mounts this screen's
    // RefreshControl already spinning, and a control born in the refreshing
    // state does not animate away — it sticks until a scroll or a remount.
    const [pulled, setPulled] = useState(false);
    useEffect(() => {
        if (!pulled || refreshing) return;
        setPulled(false);
    }, [pulled, refreshing]);

    // Refresh on every focus
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="My Reservations"
                subtitle={loading ? 'Checking...' : sorted.length > 0 ? `${sorted.length} upcoming` : 'Nothing booked'}
                right={<LogoutButton />}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={pulled && refreshing}
                        onRefresh={() => {
                            debugLog('My Reservations — manual pull-to-refresh');
                            setPulled(true);
                            refresh({ visible: true });
                        }}
                        tintColor={Brand.orange}
                    />
                }
            >
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color={Brand.orange} />
                        <Text style={styles.mutedText}>Loading reservations…</Text>
                    </View>
                ) : sorted.length === 0 ? (
                    <View style={styles.centered}>
                        <Text style={styles.mutedText}>No upcoming reservations</Text>
                        <TouchableOpacity
                            style={styles.btnOrange}
                            onPress={() => router.push('/(tabs)/courts')}
                        >
                            <Text style={styles.btnOrangeText}>Book a court →</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    sorted.map(reservation => (
                        <ReservationCard
                            key={reservation.cancelUrl || `${reservation.date}-${reservation.time}`}
                            reservation={reservation}
                        />
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Brand.bg },
    scrollContent: { padding: Space.lg, paddingBottom: Space.xxl, flexGrow: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, paddingTop: 60 },
    mutedText: { ...Type.bodySm, fontWeight: '400', color: Brand.inkFaint },
    btnOrange: {
        backgroundColor: Brand.orange, borderRadius: Radius.sm,
        paddingVertical: Space.sm + 2, paddingHorizontal: Space.lg,
    },
    btnOrangeText: { ...Type.bodySm, fontWeight: '600', color: Brand.onOrange },
});
