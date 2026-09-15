import * as Notifications from 'expo-notifications';
import { parseUtDateString, parseUtTime } from '@/lib/dates';

// Without a handler, iOS suppresses notifications while the app is foregrounded.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermission(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

export async function scheduleReservationReminder(
    facilityName: string,
    date: string,        // e.g. "05/22/2026"
    time: string,        // e.g. "2:00 PM"
    courtName: string,
    minutesBefore: number = 60
): Promise<string | null> {

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
        return null;
    }

    const { hours, minutes } = parseUtTime(time);
    const reservationDate = parseUtDateString(date);
    reservationDate.setHours(hours, minutes, 0, 0);

    const notifyAt = new Date(reservationDate.getTime() - minutesBefore * 60 * 1000);

    if (notifyAt <= new Date()) {
        return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: '🎾 Court reminder',
            body: `${facilityName} at ${time} — still going?`,
            data: { date, time, facilityName, courtName },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: notifyAt,
        },
    });

    return notificationId;
}

export async function cancelReminder(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}
