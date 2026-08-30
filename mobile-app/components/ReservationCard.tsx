import { View, Text, StyleSheet, TouchableOpacity, Alert, ActionSheetIOS } from 'react-native';

import { Card, CardRow } from '@/components/ui/Card';
import { Brand, Radius, Space, Type } from '@/constants/theme';
import { useReservations } from '@/context/ReservationsContext';
import { scheduleReservationReminder, cancelReminder } from '@/hooks/useNotifications';
import { formatFacility, reservationDateLabel } from '@/lib/reservations';
import { debugLog } from '@/lib/debugLog';
import type { Reservation } from '@/constants/types';

// Shared by Home (the single next reservation) and My Reservations (the full
// list). Reads what it needs from ReservationsContext rather than taking
// callback props, since both call sites would only forward the same values.
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
        <Card>
            <CardRow>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{formatFacility(reservation.facility)}</Text>
                    <Text style={styles.cardSub}>{dateText} · {reservation.time}</Text>
                </View>
                <View style={[styles.badge, isToday ? styles.badgeRed : styles.badgeGreen]}>
                    <Text style={[styles.badgeText, isToday ? styles.badgeTextRed : styles.badgeTextGreen]}>
                        {dateText}
                    </Text>
                </View>
            </CardRow>
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.btnGhost} onPress={handleRemind}>
                    <Text style={styles.btnGhostText}>Remind me</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnRed} onPress={handleCancel}>
                    <Text style={styles.btnRedText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    cardTitle: { ...Type.body, color: Brand.ink },
    cardSub: { ...Type.caption, color: Brand.inkMuted, marginTop: Space.xs },
    badge: { borderRadius: Radius.pill, paddingHorizontal: Space.md, paddingVertical: Space.xs },
    badgeGreen: { backgroundColor: Brand.openBg },
    badgeRed: { backgroundColor: Brand.warnBg },
    badgeText: { ...Type.micro },
    badgeTextGreen: { color: Brand.open },
    badgeTextRed: { color: Brand.warnInk },
    buttonRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
    btnGhost: {
        flex: 1, borderRadius: Radius.sm, paddingVertical: Space.sm,
        borderWidth: 1, borderColor: Brand.orange, alignItems: 'center',
    },
    btnGhostText: { ...Type.bodySm, color: Brand.orange },
    btnRed: {
        flex: 1, borderRadius: Radius.sm, paddingVertical: Space.sm,
        borderWidth: 1, borderColor: Brand.danger, alignItems: 'center',
    },
    btnRedText: { ...Type.bodySm, color: Brand.danger },
});
