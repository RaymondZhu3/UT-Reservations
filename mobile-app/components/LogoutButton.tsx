import { TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import { useReservations } from '@/context/ReservationsContext';

// The real sign-out lives in ReservationsContext, since ending the UT session
// means navigating the shared WebView — that's where the session cookie is.
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
