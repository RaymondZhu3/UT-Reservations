import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ReservationsProvider } from '@/context/ReservationsContext';

export const unstable_settings = {
    anchor: '(tabs)',
};

export default function RootLayout() {
    return (
        // SafeAreaProvider so ScreenHeader can ask the OS for the real status
        // bar inset. `initialWindowMetrics` seeds the first frame, so nothing
        // renders at inset 0 and then jumps.
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ReservationsProvider>
                {/* Light-only. No screen has a dark variant, so following the
                    system scheme would wrap light content in dark navigation
                    chrome. Real dark mode is a v1.1 item. */}
                <ThemeProvider value={DefaultTheme}>
                    <Stack>
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="welcome" options={{ headerShown: false }} />
                        <Stack.Screen name="login" options={{ headerShown: false }} />
                        <Stack.Screen name="court-availability" options={{ headerShown: false }} />
                    </Stack>
                    <StatusBar style="dark" />
                </ThemeProvider>
            </ReservationsProvider>
        </SafeAreaProvider>
    );
}
