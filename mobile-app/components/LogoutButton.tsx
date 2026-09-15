import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useReservations } from '@/context/ReservationsContext';
import { Brand, Space, Type } from '@/constants/theme';

// The real sign-out lives in ReservationsContext: ending the UT session means
// navigating the shared WebView, which is where the session cookie lives.
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
    button: { paddingVertical: Space.xs, paddingHorizontal: Space.xs },
    text: { ...Type.bodySm, fontSize: 15, color: Brand.danger },
});
