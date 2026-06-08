import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useRef } from 'react';

const RESERVATION_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

export default function LoginScreen() {
    const router = useRouter();
    const handled = useRef(false);

    async function handleNavigationChange(navState: any) {
        const { url, loading } = navState;
        if (handled.current) return;
        if (!url.includes('reserve_courts.php') || loading) return;

        handled.current = true;
        await SecureStore.setItemAsync('has_logged_in', 'true');
        router.replace('/(tabs)');
    }

    return (
        <View style={{ flex: 1 }}>
            <WebView
                source={{ uri: RESERVATION_URL }}
                onNavigationStateChange={handleNavigationChange}
                textZoom={100}
            />
        </View>
    );
}