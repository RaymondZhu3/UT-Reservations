import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReservations } from '@/context/ReservationsContext';
import { useFacilityOverview } from '@/hooks/useFacilityOverview';
import { futureSlots, describeOpenSlots } from '@/lib/facilityAvailability';
import { sortReservationsByDate } from '@/lib/reservations';
import { timeAgo } from '@/lib/dates';
import { openFacility } from './courts';
import { debugLog } from '@/lib/debugLog';
import ReservationCard from '@/components/ReservationCard';
import { Card, CardRow } from '@/components/ui/Card';
import { Brand, Radius, Space, Type } from '@/constants/theme';
import { useState, useEffect, useMemo } from 'react';

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
    const insets = useSafeAreaInsets();
    const { upcoming, loading, refreshing, session, refresh } = useReservations();
    const {
        rows: openNowRows,
        error: overviewError,
        loading: overviewLoading,
        refresh: refreshOverview,
    } = useFacilityOverview();
    const [showUpdated, setShowUpdated] = useState(false);
    // "Up to date" confirms a refresh the user asked for. Without this flag the
    // banner fires whenever the loading flags settle, which the focus refetch
    // does on every switch to this tab — flashing green and shifting the layout
    // to answer a question nobody asked.
    const [pullRequested, setPullRequested] = useState(false);

    const isFocused = useIsFocused();
    useEffect(() => {
        if (isFocused) refreshOverview();
    }, [isFocused, refreshOverview]);

    // Raises the banner when a pull finishes. Does NOT own how long it stays up.
    useEffect(() => {
        if (!pullRequested) return;
        // Both refresh calls flip their loading flags in the same batch as
        // setPullRequested, so this sees them true first and waits.
        if (loading || refreshing || overviewLoading) return;

        setPullRequested(false);
        // A failed read is not something to congratulate; renderOpenNow says so
        // in place instead.
        if (!overviewError) setShowUpdated(true);
    }, [pullRequested, loading, refreshing, overviewLoading, overviewError]);

    // The banner's lifetime is keyed on the banner itself. Scheduling this
    // timeout in the effect above cannot work: that effect clears
    // `pullRequested`, which is one of its own dependencies, so React runs its
    // cleanup on the very next render and the timeout is cancelled before it
    // can fire. An effect that writes to its own dependency list cannot also
    // own a timer.
    useEffect(() => {
        if (!showUpdated) return;
        const timeout = setTimeout(() => setShowUpdated(false), 2000);
        return () => clearTimeout(timeout);
    }, [showUpdated]);

    // Recomputed on every refetch. A screen left untouched across a slot
    // boundary holds the previous cut until the next focus or pull, which the
    // "Updated X ago" caption discloses.
    const openNow = useMemo(
        () => openNowRows
            .map(row => ({ row, open: futureSlots(row) }))
            .filter(entry => entry.open.length > 0),
        [openNowRows]
    );

    if (session === 'invalid') return null;

    const nextReservation = sortReservationsByDate(upcoming)[0];

    // Four states, kept distinct. "Database unreachable", "nobody has checked a
    // court today" and "everything left today has already started" are different
    // facts and must not render identically.
    function renderOpenNow() {
        if (overviewError) {
            return (
                <Card>
                    <Text style={styles.emptyText}>Couldn’t load availability</Text>
                    <Text style={styles.emptySub}>Pull down to try again.</Text>
                </Card>
            );
        }

        if (overviewLoading && openNowRows.length === 0) {
            return (
                <Card>
                    <ActivityIndicator color={Brand.orange} />
                </Card>
            );
        }

        if (openNow.length === 0) {
            return openNowRows.length === 0 ? (
                <Card>
                    <Text style={styles.emptyText}>No court checks yet today</Text>
                    <Text style={styles.emptySub}>
                        Checking a facility on the Courts tab fills this in for everyone.
                    </Text>
                </Card>
            ) : (
                <Card>
                    <Text style={styles.emptyText}>Nothing open right now</Text>
                    <Text style={styles.emptySub}>Based on the last check of each facility today.</Text>
                </Card>
            );
        }

        return openNow.map(({ row, open }) => (
            <Card
                key={row.facility_id}
                onPress={() => openFacility(router, row.facility_id, row.facility_name, new Date())}
            >
                <CardRow>
                    <Text style={styles.cardTitle}>{row.facility_name}</Text>
                    <Text style={styles.openCount}>{open.length} open</Text>
                </CardRow>
                <Text style={styles.cardSub}>
                    {describeOpenSlots(row)}
                    {'  ·  '}Updated {timeAgo(row.updated_at)}
                </Text>
            </Card>
        ));
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        // `refreshing` is context state — a fact about the app,
                        // not about this screen. Gate it on this screen having
                        // been the one pulled, or the spinner follows the
                        // refresh onto whatever tab you switch to.
                        refreshing={pullRequested && refreshing}
                        onRefresh={() => {
                            debugLog('Home — manual pull-to-refresh');
                            setPullRequested(true);
                            refresh({ visible: true });
                            // The crowdsourced section has its own data source;
                            // refreshing reservations alone left it untouched.
                            refreshOverview();
                        }}
                        tintColor={Brand.orange}
                    />
                }
            >
                {/* Status bar inset from the OS. */}
                <View style={[styles.header, { paddingTop: insets.top + Space.md }]}>
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

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Open now</Text>
                    {renderOpenNow()}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Upcoming</Text>
                    {loading ? (
                        <Card>
                            <ActivityIndicator color={Brand.orange} style={{ marginBottom: Space.sm }} />
                            <Text style={styles.emptyText}>Loading reservations...</Text>
                        </Card>
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
                        <Card>
                            <Text style={styles.emptyText}>No upcoming reservations</Text>
                            <TouchableOpacity
                                style={[styles.btnOrange, { marginTop: Space.md }]}
                                onPress={() => router.push('/(tabs)/courts')}
                            >
                                <Text style={styles.btnOrangeText}>Book a court →</Text>
                            </TouchableOpacity>
                        </Card>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Find a court</Text>
                    <Card onPress={() => router.push('/(tabs)/courts')}>
                        <CardRow>
                            <Text style={styles.cardTitle}>Browse available courts</Text>
                            <Text style={styles.chevron}>→</Text>
                        </CardRow>
                        <Text style={styles.cardSub}>
                            See all open slots across every facility
                        </Text>
                    </Card>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: Brand.bg },
    container: { padding: Space.lg, paddingBottom: Space.xxl },
    header: { paddingBottom: Space.lg },
    greeting: { ...Type.display, color: Brand.orange },
    date: { ...Type.bodySm, fontWeight: '400', fontSize: 14, color: Brand.inkMuted, marginTop: 2 },
    section: { marginBottom: Space.xl - Space.xs },
    sectionLabel: {
        ...Type.micro, color: Brand.inkMuted,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Space.sm,
    },
    cardTitle: { ...Type.body, color: Brand.ink },
    cardSub: { ...Type.caption, color: Brand.inkMuted, marginTop: Space.xs },
    emptyText: { ...Type.bodySm, fontWeight: '400', fontSize: 14, color: Brand.inkFaint, textAlign: 'center' },
    emptySub: { ...Type.caption, color: Brand.inkGhost, textAlign: 'center', marginTop: Space.xs },
    chevron: { fontSize: 18, color: Brand.inkGhost },
    seeAllText: { ...Type.bodySm, color: Brand.orange, textAlign: 'center', marginTop: 2 },
    openCount: { ...Type.micro, color: Brand.open },
    btnOrange: {
        backgroundColor: Brand.orange, borderRadius: Radius.sm,
        paddingVertical: Space.sm, paddingHorizontal: Space.lg - 2,
    },
    btnOrangeText: { ...Type.bodySm, fontWeight: '600', color: Brand.onOrange },
    updatedBanner: {
        backgroundColor: Brand.openBg,
        borderRadius: Radius.sm,
        padding: Space.sm,
        alignItems: 'center',
        marginBottom: Space.md,
    },
    updatedText: { ...Type.caption, fontWeight: '600', color: Brand.open },
});
