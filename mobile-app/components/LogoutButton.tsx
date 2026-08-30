import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useReservations } from '@/context/ReservationsContext';
import { Brand, Space, Type } from '@/constants/theme';

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
    button: { paddingVertical: Space.xs, paddingHorizontal: Space.xs },
    // Was #cc0000, a third red alongside #A32D2D and #b00. Destructive
    // actions share one token now.
    text: { ...Type.bodySm, fontSize: 15, color: Brand.danger },
});
