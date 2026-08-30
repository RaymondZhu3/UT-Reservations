import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { FACILITIES_BY_SPORT } from '@/constants/facilities';
import { useFacilityOverview } from '@/hooks/useFacilityOverview';
import { useFacilityHours } from '@/hooks/useFacilityHours';
import { hoursForDay, isClosed, parsePeriodLabel, periodCovers } from '@/lib/facilityHours';
import { describeOpenSlots } from '@/lib/facilityAvailability';
import { upcomingDates, dateLabel, toIsoDateString, timeAgo } from '@/lib/dates';
import { debugLog } from '@/lib/debugLog';
import { Card, CardRow } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Brand, Radius, Space, Type } from '@/constants/theme';

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
    // Recomputed on focus rather than memoised at mount: this tab stays mounted
    // once visited. Reservations open exactly 7 days out, so the furthest chip is
    // the day whose slots are being released, and a frozen list stops offering
    // it.
    const [dates, setDates] = useState(() => upcomingDates(8));
    const { rows: todayRows, refresh: refreshOverview } = useFacilityOverview();
    const {
        byFacilityId: hoursByFacility,
        meta: hoursMeta,
        error: hoursError,
        refresh: refreshHours,
    } = useFacilityHours();

    // Separate from the hooks' own `loading`. `refreshing` means "the user pulled
    // and it hasn't finished"; driving it from any load also fires it for focus
    // refetches, and iOS then adds the control's ~60pt inset to an already
    // laid-out scroll view.
    const [pullRefreshing, setPullRefreshing] = useState(false);

    async function handlePullRefresh() {
        debugLog('Courts — manual pull-to-refresh');
        setPullRefreshing(true);
        try {
            await Promise.all([refreshOverview(), refreshHours()]);
        } finally {
            setPullRefreshing(false);
        }
    }

    // Refetch on focus: a mount-only fetch would pin the hours to whatever the
    // table held on this tab's first visit, for the life of the app. This effect
    // has no cleanup: a teardown on this screen causes a blank render.
    const isFocused = useIsFocused();
    useEffect(() => {
        if (!isFocused) return;

        // Roll the window forward if the day changed while the app sat idle.
        // Compared by ISO day so an unchanged day keeps array identity.
        const next = upcomingDates(8);
        setDates(prev => (toIsoDateString(prev[0]) === toIsoDateString(next[0]) ? prev : next));
        // Yesterday's selection is now in the past — snap it forward.
        setSelectedDate(prev => (toIsoDateString(prev) < toIsoDateString(next[0]) ? next[0] : prev));

        refreshOverview();
        refreshHours();
    }, [isFocused, refreshOverview, refreshHours]);

    const isToday = toIsoDateString(selectedDate) === toIsoDateString(new Date());

    function overviewFor(facilityId: number) {
        if (!isToday) return null;
        return todayRows.find(r => r.facility_id === facilityId) ?? null;
    }

    // Every row comes from the same scrape run, so one label covers the table.
    const hoursPeriod = parsePeriodLabel(hoursMeta.periodLabel);
    // True a week before every period rollover, because the picker runs 8 days
    // out — not only when the scraper stops.
    const outsidePeriod = !!hoursPeriod && !periodCovers(hoursPeriod, selectedDate);

    // Say which period the hours came from
    const hoursCaption = hoursError ? (
        <Text style={styles.headerSubWarn}>Hours unavailable — pull to retry</Text>
    ) : outsidePeriod ? (
        <Text style={styles.headerSubWarn}>
            No published hours for {dateLabel(selectedDate)} — UT lists {hoursMeta.periodLabel} only
        </Text>
    ) : hoursMeta.scrapedAt ? (
        <Text style={styles.headerSub}>
            {hoursMeta.periodLabel ? `Hours ${hoursMeta.periodLabel} · ` : 'Hours '}
            updated {timeAgo(hoursMeta.scrapedAt)}
        </Text>
    ) : null;

    return (
        <View style={styles.container}>
            <ScreenHeader title="Find a court" subtitle={hoursCaption} />

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

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={pullRefreshing}
                        onRefresh={handlePullRefresh}
                        tintColor={Brand.orange}
                    />
                }
            >
                {Object.entries(FACILITIES_BY_SPORT).map(([sport, facilities]) => (
                    <View key={sport} style={styles.section}>
                        <Text style={styles.sectionLabel}>{sport}</Text>
                        {facilities.map(({ name, id }) => {
                            const overview = overviewFor(id);
                            // Slots whose start time has passed are not
                            // availability. describeOpenSlots filters them and
                            // collapses duplicate times across courts, so a
                            // facility with three free courts at 4pm reads
                            // "Open at 4:00 PM" rather than repeating it.
                            const openSummary = overview ? describeOpenSlots(overview) : null;
                            // Hours track the date the user is browsing, not
                            // today — picking Saturday should show Saturday's.
                            const hoursRow = hoursByFacility[id];
                            const day = hoursRow ? hoursForDay(hoursRow, selectedDate) : null;
                            // 'stale' = these hours describe a different period
                            // than the date being browsed, so don't assert them.
                            // The header caption says why.
                            const hours = day && day.status !== 'stale' ? day.hours : null;
                            const closed = isClosed(hours);
                            return (
                                <Card key={id} onPress={() => openFacility(router, id, name, selectedDate)}>
                                    <CardRow>
                                        <Text style={styles.cardTitle}>{name.split(' - ')[0]}</Text>
                                        {hours ? (
                                            <Text style={closed ? styles.hoursClosed : styles.hours}>{hours}</Text>
                                        ) : (
                                            <Text style={styles.chevron}>→</Text>
                                        )}
                                    </CardRow>
                                    {!overview ? (
                                        <Text style={styles.cardSubMuted}>Tap to check availability</Text>
                                    ) : openSummary ? (
                                        <Text style={styles.cardSub}>{openSummary}</Text>
                                    ) : (
                                        <Text style={styles.cardSubMuted}>Nothing open for the rest of today</Text>
                                    )}
                                </Card>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Brand.bg },
    headerSub: { ...Type.micro, fontWeight: '400', color: Brand.inkMuted, marginTop: 2 },
    headerSubWarn: { ...Type.micro, color: Brand.closed, marginTop: 2 },
    dateRow: {
        height: 56, flexGrow: 0, backgroundColor: Brand.surface,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.divider,
    },
    dateRowContent: { paddingHorizontal: Space.lg, alignItems: 'center', gap: Space.sm },
    dateChip: {
        alignSelf: 'center',
        paddingHorizontal: Space.lg - 2, paddingVertical: Space.sm,
        borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Brand.border,
    },
    dateChipActive: { backgroundColor: Brand.orange, borderColor: Brand.orange },
    dateChipText: { ...Type.bodySm, fontWeight: '400', color: Brand.inkSoft },
    dateChipTextActive: { color: Brand.onOrange, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { padding: Space.lg, paddingBottom: Space.xxl },
    section: { marginBottom: Space.xl - Space.xs },
    sectionLabel: {
        ...Type.micro, color: Brand.inkMuted,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Space.sm,
    },
    cardTitle: { ...Type.body, color: Brand.ink },
    cardSub: { ...Type.caption, color: Brand.open, marginTop: Space.xs },
    cardSubMuted: { ...Type.caption, color: Brand.inkFaint, marginTop: Space.xs },
    chevron: { fontSize: 18, color: Brand.inkGhost },
    hours: { ...Type.caption, color: Brand.inkSoft },
    hoursClosed: { ...Type.caption, fontWeight: '500', color: Brand.closed },
});
