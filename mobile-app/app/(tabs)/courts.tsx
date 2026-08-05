import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FACILITIES_BY_SPORT } from '@/constants/facilities';
import { useFacilityOverview } from '@/hooks/useFacilityOverview';
import { upcomingDates, dateLabel, toIsoDateString } from '@/lib/dates';
import { debugLog } from '@/lib/debugLog';

export function openFacility(router: ReturnType<typeof useRouter>, facilityId: number, facilityName: string, selectedDate: Date) {
    debugLog('Courts — opened facility', facilityName, 'date:', toIsoDateString(selectedDate));
    router.push({
        pathname: '/court-availability',
        params: {
            facilityId: String(facilityId),
            facilityName,
            date: selectedDate.toISOString(),
        },
    });
}

export default function CourtsTab() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const dates = useMemo(() => upcomingDates(7), []);
    const { rows: todayRows } = useFacilityOverview();

    const isToday = toIsoDateString(selectedDate) === toIsoDateString(new Date());

    function overviewFor(facilityId: number) {
        if (!isToday) return null;
        return todayRows.find(r => r.facility_id === facilityId) ?? null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Find a court</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateRow}
                contentContainerStyle={styles.dateRowContent}
            >
                {dates.map(d => {
                    const active = toIsoDateString(d) === toIsoDateString(selectedDate);
                    return (
                        <TouchableOpacity
                            key={toIsoDateString(d)}
                            style={[styles.dateChip, active && styles.dateChipActive]}
                            onPress={() => setSelectedDate(d)}
                        >
                            <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                                {dateLabel(d)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {Object.entries(FACILITIES_BY_SPORT).map(([sport, facilities]) => (
                    <View key={sport} style={styles.section}>
                        <Text style={styles.sectionLabel}>{sport}</Text>
                        {facilities.map(({ name, id }) => {
                            const overview = overviewFor(id);
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={styles.card}
                                    onPress={() => openFacility(router, id, name, selectedDate)}
                                >
                                    <View style={styles.cardRow}>
                                        <Text style={styles.cardTitle}>{name.split(' - ')[0]}</Text>
                                        <Text style={styles.chevron}>→</Text>
                                    </View>
                                    {overview ? (
                                        overview.slots.length > 0 ? (
                                            <Text style={styles.cardSub}>
                                                Open at {overview.slots.slice(0, 3).map(s => s.time).join(', ')}
                                                {overview.slots.length > 3 ? ` +${overview.slots.length - 3} more` : ''}
                                            </Text>
                                        ) : (
                                            <Text style={styles.cardSubMuted}>No open slots as of last check</Text>
                                        )
                                    ) : (
                                        <Text style={styles.cardSubMuted}>Tap to check availability</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8,
        backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    title: { fontSize: 20, fontWeight: 'bold', color: '#BF5700' },
    // Explicit height is required here — a horizontal ScrollView with no
    // height constraint stretches to fill the remaining flex space in its
    // column parent, and its row-direction children stretch to match
    // (default cross-axis alignItems is 'stretch'). That's what made the
    // date chips render as full-height bars instead of small pills.
    dateRow: { height: 56, flexGrow: 0, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
    dateRowContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
    dateChip: {
        alignSelf: 'center',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: '#e5e5e5',
    },
    dateChipActive: { backgroundColor: '#BF5700', borderColor: '#BF5700' },
    dateChipText: { fontSize: 13, color: '#444' },
    dateChipTextActive: { color: 'white', fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    section: { marginBottom: 20 },
    sectionLabel: {
        fontSize: 11, fontWeight: '600', color: '#999',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
    card: {
        backgroundColor: 'white', borderRadius: 12, padding: 16,
        borderWidth: 0.5, borderColor: '#e5e5e5', marginBottom: 8,
    },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    cardSub: { fontSize: 12, color: '#3B6D11', marginTop: 4 },
    cardSubMuted: { fontSize: 12, color: '#aaa', marginTop: 4 },
    chevron: { fontSize: 18, color: '#ccc' },
});
