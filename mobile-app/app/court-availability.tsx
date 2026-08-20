import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useCourtAvailability } from '@/hooks/useCourtAvailability';
import { useReservations } from '@/context/ReservationsContext';
import { dateLabel, toUtDateString } from '@/lib/dates';
import { reservationDateLabel } from '@/lib/reservations';
import { debugLog } from '@/lib/debugLog';
import type { CourtSlot } from '@/constants/types';

// UT enforces "one reservation per day" server-side. When it rejects a
// booking it does NOT run the normal reserve_courts.php -> index.php ->
// myreservations.php redirect chain — it stays put on reserve_courts.php
// and renders an error banner instead. So the booking WebView sees no
// recognized navigation at all and would otherwise sit spinning until the
// 15s timeout, then show an "we couldn't confirm" message, even though UT
// stated the exact reason immediately. This reads that banner back out.
const BOOKING_RESULT_JS = `
    (function() {
        try {
            var el = document.querySelector('.alert-danger, .alert, [role="alert"]');
            var text = el ? (el.innerText || '').trim() : '';
            if (text) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'booking-error',
                    message: text
                }));
            }
        } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'booking-error',
                message: ''
            }));
        }
    })();
    true;
`;

export default function CourtAvailabilityScreen() {
    const router = useRouter();
    const { facilityId, facilityName, date } = useLocalSearchParams<{
        facilityId: string;
        facilityName: string;
        date: string;
    }>();

    const parsedFacilityId = Number(facilityId);
    const parsedDate = useMemo(() => new Date(date), [date]);
    const facilityIds = useMemo(() => [parsedFacilityId], [parsedFacilityId]);

    // Flip to false once the scraper's selectors are confirmed working —
    // this makes the normally-hidden WebView visible so you can see and
    // screenshot exactly what reserve_courts.php loads with the current
    // facility_id/date params.
    const DEBUG_VISIBLE_SCRAPER = false;

    // Reservations the user already holds — used to catch UT's one-per-day
    // limit before firing a booking that's guaranteed to be rejected.
    const { upcoming } = useReservations();

    const { availability, scrapers } = useCourtAvailability({
        facilityIds,
        date: parsedDate,
        debugVisible: DEBUG_VISIBLE_SCRAPER,
    });
    const result = availability[0];

    // Set once the user confirms a slot — mounting this WebView is what
    // actually places the reservation, silently, using the user's own
    // live session. Same pattern as the home screen's cancel flow: no
    // visible browser, just a hidden WebView hitting the action URL and
    // watching for UT's own post-action redirect.
    const [bookingSlot, setBookingSlot] = useState<CourtSlot | null>(null);

    // Set true to visually inspect the booking WebView (same trick as
    // AvailabilityScraper.tsx's debugVisible).
    const DEBUG_VISIBLE_BOOKING = false;

    const bookingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bookingWebviewRef = useRef<WebView>(null);

    function clearBookingTimeout() {
        if (bookingTimeoutRef.current) {
            clearTimeout(bookingTimeoutRef.current);
            bookingTimeoutRef.current = null;
        }
    }

    // Fallback in case handleBookingNavChange never sees a recognized
    // redirect (error page, re-auth, etc.) — without this the UI could
    // spin on "Booking your court..." forever with no indication anything
    // went wrong.
    useEffect(() => {
        if (!bookingSlot) return;
        bookingTimeoutRef.current = setTimeout(() => {
            debugLog('Booking WebView — timed out waiting for a recognized redirect');
            setBookingSlot(null);
            Alert.alert(
                "Still processing?",
                "We couldn't confirm whether that booking went through. Check My Reservations, or try again.",
                [
                    { text: 'Check My Reservations', onPress: () => router.replace('/(tabs)/myreservations') },
                    { text: 'OK', style: 'cancel' },
                ]
            );
        }, 15000);
        return clearBookingTimeout;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookingSlot]);

    // UT allows one reservation per calendar day. Both dates here are UT's
    // own MM/DD/YYYY form, so this is a plain string compare — no parsing,
    // no timezone edge case (see parseUtDateString's writeup in dates.ts).
    const existingThatDay = upcoming.find(r => r.date === toUtDateString(parsedDate));

    function confirmBooking(slot: CourtSlot) {
        if (existingThatDay) {
            Alert.alert(
                'You already have a court that day',
                `UT allows one reservation per day, and you're booked for ${reservationDateLabel(existingThatDay.date)} at ${existingThatDay.time}. Cancel that one first if you'd rather have this slot.`,
                [
                    { text: 'OK', style: 'cancel' },
                    { text: 'My Reservations', onPress: () => router.push('/(tabs)/myreservations') },
                ]
            );
            return;
        }

        Alert.alert(
            'Book this court?',
            `${facilityName}\n${slot.court} · ${slot.time}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Book', onPress: () => {
                        debugLog('User confirmed booking:', facilityName, slot.court, slot.time, slot.bookUrl);
                        setBookingSlot(slot);
                    }
                },
            ]
        );
    }

    // Fires when UT rejected the booking and stayed on reserve_courts.php.
    function handleBookingMessage(event: any) {
        let message = '';
        try {
            const parsed = JSON.parse(event.nativeEvent.data);
            if (parsed.type !== 'booking-error') return;
            message = parsed.message || '';
        } catch {
            return;
        }

        debugLog('Booking WebView — UT rejected the booking:', message);
        clearBookingTimeout();
        setBookingSlot(null);
        Alert.alert(
            "Couldn't book that court",
            message || 'UT rejected the reservation without saying why. Check My Reservations before trying again.',
            [
                { text: 'OK', style: 'cancel' },
                { text: 'My Reservations', onPress: () => router.replace('/(tabs)/myreservations') },
            ]
        );
    }

    function handleBookingNavChange(navState: any) {
        debugLog('Booking WebView nav:', navState.url, 'loading:', navState.loading);
        if (navState.url.includes('idp/profile/SAML2')) {
            debugLog('Booking WebView — session expired mid-booking');
            clearBookingTimeout();
            router.replace('/login');
            return;
        }
        if (navState.url.includes('myrecsports/index.php')) {
            debugLog('Booking WebView — success redirect seen, navigating to My Reservations');
            clearBookingTimeout();
            router.replace('/(tabs)/myreservations');
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>{facilityName}</Text>
                    <Text style={styles.subtitle}>{dateLabel(parsedDate)}</Text>
                </View>
            </View>

            {scrapers}

            {result?.loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#BF5700" />
                    <Text style={styles.mutedText}>Checking availability…</Text>
                </View>
            ) : result?.error ? (
                <View style={styles.centered}>
                    <Text style={styles.mutedText}>Couldn't load availability. Go back and try again.</Text>
                </View>
            ) : result && result.slots.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.mutedText}>No open courts for this day.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.grid}>
                    {result?.slots.map((slot, i) => (
                        <TouchableOpacity
                            key={`${slot.court}-${slot.time}-${i}`}
                            style={styles.slot}
                            onPress={() => confirmBooking(slot)}
                        >
                            <Text style={styles.slotCourt}>{slot.court}</Text>
                            <Text style={styles.slotTime}>{slot.time}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {bookingSlot && (
                <View style={styles.bookingOverlay}>
                    <ActivityIndicator color="white" />
                    <Text style={styles.bookingText}>Booking your court…</Text>
                    {/* Never let the WebView's own rendered size hit zero in
                        either axis (stalls navigation, not just innerText) —
                        clip via the wrapper only, keep the WebView at a real
                        non-zero height. */}
                    <View style={DEBUG_VISIBLE_BOOKING ? { height: 400, width: '100%', backgroundColor: 'white' } : { height: 0, overflow: 'hidden' }}>
                        <WebView
                            source={{ uri: bookingSlot.bookUrl }}
                            onNavigationStateChange={handleBookingNavChange}
                            onLoadEnd={() => {
                                // innerText needs real layout — this WebView is
                                // clipped by its wrapper but keeps a non-zero
                                // height and its natural width, so text reads.
                                bookingWebviewRef.current?.injectJavaScript(BOOKING_RESULT_JS);
                            }}
                            onMessage={handleBookingMessage}
                            ref={bookingWebviewRef}
                            style={DEBUG_VISIBLE_BOOKING ? { flex: 1 } : { height: 1 }}
                            cacheEnabled={false}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
        backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    backButton: { marginBottom: 8 },
    backText: { fontSize: 15, color: '#BF5700' },
    title: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
    subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    mutedText: { fontSize: 13, color: '#aaa' },
    grid: {
        padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    },
    slot: {
        width: '47%', backgroundColor: 'white', borderRadius: 12,
        borderWidth: 0.5, borderColor: '#e5e5e5', padding: 12,
        borderLeftWidth: 3, borderLeftColor: '#639922',
    },
    slotCourt: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
    slotTime: { fontSize: 12, color: '#666', marginTop: 2 },
    bookingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    bookingText: { color: 'white', fontSize: 14, fontWeight: '500' },
});
