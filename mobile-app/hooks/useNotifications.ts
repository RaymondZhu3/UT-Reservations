import * as Notifications from 'expo-notifications';

// This tells the app how to display notifications when it's in the foreground
// (when the user has the app open)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,   // play a sound
        shouldSetBadge: false,   // don't show badge number on app icon
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermission(): Promise<boolean> {
    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;
    
    // If not granted yet, ask the user
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    
    // Return true if permission was granted, false if denied
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
        return null; // user denied permission
    }

    // Convert "05/22/2026" + "2:00 PM" into a JavaScript Date
    const parts = date.split('/');
    const dateStr = `${parts[2]}-${parts[0]}-${parts[1]}`; // YYYY-MM-DD
    // Parse "2:00 PM" into hours and minutes
    const [timePart, meridiem] = time.split(' ');
    const [hoursStr, minutesStr] = timePart.split(':');
    let hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const reservationDate = new Date(`${dateStr}T00:00:00`);
    reservationDate.setHours(hours, minutes, 0, 0);
    
    // Schedule notification according to ActionSheet
    const notifyAt = new Date(reservationDate.getTime() - minutesBefore * 60 * 1000);
    
    // Don't schedule if the reminder time is in the past
    if (notifyAt <= new Date()) {
        return null;
    }

    // Schedule the notification
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

    return notificationId; // save this if you want to cancel later
}

export async function cancelReminder(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}