import { TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import { useReservations } from '@/context/ReservationsContext';

// Extracted from the old WebViewScreen header (deleted 2026-08-15 along with
// the Study Rooms tab). WebViewScreen was the only place logout existed, so
// removing that tab would have left the app with no way to sign out at all.
//
// The actual sign-out lives in ReservationsContext rather than here, because
// ending the UT session means navigating the shared WebView — the only place
// that holds the session cookie. Clearing SecureStore from this component,
// which is all the old version did, logs you out of the app but not out of UT.
export default function LogoutButton() {
    const { logout } = useReservations();

    function confirmLogout() {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: () => { logout(); } },
            ]
        );
    }

    return (
        <TouchableOpacity onPress={confirmLogout} style={styles.button} hitSlop={8}>
            <Text style={styles.text}>Logout</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: { paddingVertical: 4, paddingHorizontal: 4 },
    text: { fontSize: 15, color: '#cc0000', fontWeight: '500' },
});
