import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useReservations } from '@/context/ReservationsContext';
import { useFacilityOverview } from '@/hooks/useFacilityOverview';
import { sortReservationsByDate } from '@/lib/reservations';
import { timeAgo } from '@/lib/dates';
import { openFacility } from './courts';
import { debugLog } from '@/lib/debugLog';
import ReservationCard from '@/components/ReservationCard';
import { useState, useEffect } from 'react';

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

// Home is a dashboard, not the full reservation manager — it shows just
// the single next upcoming reservation (if any) plus a link to My
// Reservations for the full list. Managing everything you've booked lives
// there instead, so this screen stays a quick glance rather than
// duplicating that whole UI.
export default function HomeScreen() {
    const router = useRouter();
    const { upcoming, loading, refreshing, session, refresh } = useReservations();
    const { rows: openNowRows } = useFacilityOverview();
    const [showUpdated, setShowUpdated] = useState(false);

    useEffect(() => {
        if (!loading && !refreshing) {
            setShowUpdated(true);
            const timeout = setTimeout(() => setShowUpdated(false), 2000);
            return () => clearTimeout(timeout);
        }
    }, [loading, refreshing]);

    if (session === 'invalid') return null;

    const nextReservation = sortReservationsByDate(upcoming)[0];

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { debugLog('Home — manual pull-to-refresh'); refresh(); }}
                        tintColor="#BF5700"
                    />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.greeting}>{greeting()}</Text>
                    <Text style={styles.date}>
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric',
                        })}
                    </Text>
                </View>

                {showUpdated && (
                    <View style={styles.updatedBanner}>
                        <Text style={styles.updatedText}>✓ Up to date</Text>
                    </View>
                )}

                {openNowRows.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Open now</Text>
                        {openNowRows.map(row => (
                            <TouchableOpacity
                                key={row.facility_id}
                                style={styles.card}
                                onPress={() => openFacility(router, row.facility_id, row.facility_name, new Date())}
                            >
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardTitle}>{row.facility_name}</Text>
                                    <Text style={row.slots.length > 0 ? styles.openCount : styles.openCountMuted}>
                                        {row.slots.length > 0 ? `${row.slots.length} open` : '0 open'}
                                    </Text>
                                </View>
                                <Text style={styles.cardSub}>
                                    {row.slots.length > 0
                                        ? `Open at ${row.slots.slice(0, 3).map(s => s.time).join(', ')}${row.slots.length > 3 ? ` +${row.slots.length - 3} more` : ''}`
                                        : 'No open slots as of last check'}
                                    {'  ·  '}Updated {timeAgo(row.updated_at)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Upcoming</Text>
                    {loading ? (
                        <View style={styles.card}>
                            <ActivityIndicator color="#BF5700" style={{ marginBottom: 8 }} />
                            <Text style={styles.emptyText}>Loading reservations...</Text>
                        </View>
                    ) : nextReservation ? (
                        <>
                            <ReservationCard reservation={nextReservation} />
                            <TouchableOpacity onPress={() => router.push('/(tabs)/myreservations')}>
                                <Text style={styles.seeAllText}>
                                    {upcoming.length > 1 ? `See all ${upcoming.length} reservations →` : 'See My Reservations →'}
                                </Text>
                            </TouchableOpacity>
                        </>
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
    seeAllText: { fontSize: 13, color: '#BF5700', fontWeight: '500', textAlign: 'center', marginTop: 2 },
    openCount: { fontSize: 11, fontWeight: '600', color: '#3B6D11' },
    openCountMuted: { fontSize: 11, fontWeight: '600', color: '#aaa' },
    btnOrange: {
        backgroundColor: '#BF5700', borderRadius: 8,
        paddingVertical: 8, paddingHorizontal: 14,
    },
    btnOrangeText: { color: 'white', fontSize: 13, fontWeight: '600' },
    updatedBanner: {
        backgroundColor: '#EAF3DE',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    updatedText: { fontSize: 12, color: '#3B6D11', fontWeight: '600' },
});
