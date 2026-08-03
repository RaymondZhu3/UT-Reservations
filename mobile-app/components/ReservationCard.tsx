import { View, Text, StyleSheet, TouchableOpacity, Alert, ActionSheetIOS } from 'react-native';
import { useReservations } from '@/context/ReservationsContext';
import { scheduleReservationReminder, cancelReminder } from '@/hooks/useNotifications';
import { formatFacility, reservationDateLabel } from '@/lib/reservations';
import { debugLog } from '@/lib/debugLog';
import type { Reservation } from '@/constants/types';

// Shared by the home screen (single "next reservation" card) and the My
// Reservations screen (full list) — used to be two separate copies of this
// JSX + reminder/cancel logic, one per screen. Reads everything it needs
// from ReservationsContext itself rather than taking a pile of callback
// props, since both call sites would otherwise just be forwarding the same
// context values straight through.
type Props = {
    reservation: Reservation;
};

// "15 minutes" / "1 hour" / "2 hours" / "90 minutes" — used in the
// confirmation alert after scheduling a reminder.
function minutesLabel(mins: number): string {
    if (mins === 60) return '1 hour';
    if (mins % 60 === 0) return `${mins / 60} hours`;
    return `${mins} minutes`;
}

export default function ReservationCard({ reservation }: Props) {
    const { notificationIds, setNotificationId, removeNotificationId, cancelReservation } = useReservations();
    const dateText = reservationDateLabel(reservation.date);
    const isToday = dateText === 'Today';

    async function schedule(mins: number) {
        const id = await scheduleReservationReminder(
            formatFacility(reservation.facility), reservation.date, reservation.time, reservation.court, mins
        );
        if (id) {
            setNotificationId(reservation.cancelUrl, id);
            Alert.alert('Reminder set', `We'll remind you ${minutesLabel(mins)} before`);
        }
    }

    function handleRemind() {
        ActionSheetIOS.showActionSheetWithOptions(
            {
                title: `Remind me before ${formatFacility(reservation.facility)}`,
                options: ['Cancel', '15 minutes before', '1 hour before', '2 hours before', 'Custom...'],
                cancelButtonIndex: 0,
            },
            (buttonIndex) => {
                if (buttonIndex === 0) return;

                if (buttonIndex === 4) {
                    Alert.prompt(
                        'Custom reminder',
                        'How many minutes before?',
                        (input) => {
                            const mins = parseInt(input ?? '', 10);
                            if (!mins || mins <= 0) return;
                            schedule(mins);
                        },
                        'plain-text',
                        '60'
                    );
                    return;
                }

                const minutesMap: Record<number, number> = { 1: 15, 2: 60, 3: 120 };
                schedule(minutesMap[buttonIndex]);
            }
        );
    }

    function handleCancel() {
        Alert.alert(
            'Cancel Reservation',
            `Cancel ${formatFacility(reservation.facility)} at ${reservation.time}?`,
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: 'Cancel reservation',
                    style: 'destructive',
                    onPress: async () => {
                        debugLog('User confirmed cancel:', reservation.cancelUrl);
                        const notifId = notificationIds[reservation.cancelUrl];
                        if (notifId) {
                            await cancelReminder(notifId);
                            removeNotificationId(reservation.cancelUrl);
                        }
                        cancelReservation(reservation.cancelUrl);
                    },
                },
            ]
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{formatFacility(reservation.facility)}</Text>
                    <Text style={styles.cardSub}>{dateText} · {reservation.time}</Text>
                </View>
                <View style={[styles.badge, isToday ? styles.badgeRed : styles.badgeGreen]}>
                    <Text style={[styles.badgeText, isToday ? styles.badgeTextRed : styles.badgeTextGreen]}>
                        {dateText}
                    </Text>
                </View>
            </View>
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.btnGhost} onPress={handleRemind}>
                    <Text style={styles.btnGhostText}>Remind me</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnRed} onPress={handleCancel}>
                    <Text style={styles.btnRedText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
    badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    badgeGreen: { backgroundColor: '#EAF3DE' },
    badgeRed: { backgroundColor: '#FAEEDA' },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeTextGreen: { color: '#3B6D11' },
    badgeTextRed: { color: '#854F0B' },
    buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
});
