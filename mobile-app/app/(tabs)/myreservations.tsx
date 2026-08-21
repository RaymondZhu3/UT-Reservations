import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useReservations } from '@/context/ReservationsContext';
import { sortReservationsByDate } from '@/lib/reservations';
import { debugLog } from '@/lib/debugLog';
import ReservationCard from '@/components/ReservationCard';
import LogoutButton from '@/components/LogoutButton';

// The full reservation manager — every upcoming booking, sorted soonest
// first, each with its own Remind/Cancel. Home only ever shows the single
// next one; this is where you come to check or manage everything you've
// got booked. Reads the same ReservationsContext the home screen does, so
// there's no separate scrape happening here — same WebView, same data.
export default function MyReservationsTab() {
    const { upcoming, loading, refreshing, refresh } = useReservations();
    const router = useRouter();
    const sorted = sortReservationsByDate(upcoming);

    // Refresh on every focus
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>My Reservations</Text>
                        <Text style={styles.subtitle}>
                            {loading ? 'Checking...' : sorted.length > 0 ? `${sorted.length} upcoming` : 'Nothing booked'}
                        </Text>
                    </View>
                    <LogoutButton />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { debugLog('My Reservations — manual pull-to-refresh'); refresh(); }}
                        tintColor="#BF5700"
                    />
                }
            >
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color="#BF5700" />
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
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
        backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    headerText: { flex: 1 },
    title: { fontSize: 20, fontWeight: '700', color: '#BF5700' },
    subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
    scrollContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
    mutedText: { fontSize: 14, color: '#aaa' },
    btnOrange: {
        backgroundColor: '#BF5700', borderRadius: 8,
        paddingVertical: 10, paddingHorizontal: 16,
    },
    btnOrangeText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
