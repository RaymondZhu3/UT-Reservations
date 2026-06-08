import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { IconSymbol } from '@/components/ui/icon-symbol';

const HIDE_NAVBAR_JS = `
    (function() {
        var topNav = document.querySelector('nav.navbar');
        if (topNav) topNav.style.setProperty('display', 'none', 'important');
        var bottomNav = document.querySelector('nav.nav.fixed-bottom');
        if (bottomNav) bottomNav.style.setProperty('display', 'none', 'important');
        document.body.style.setProperty('padding-top', '8px', 'important');
        true;
    })();
`;

type Props = {
    url: string;
    title: string;
    scrapeJs?: string;
    onMessage?: (data: string) => void;
}

export type WebViewScreenHandle = {
    reload: () => void;
}

const WebViewScreen = forwardRef<WebViewScreenHandle, Props>(
    ({ url, title, scrapeJs, onMessage }, ref) => {
        const webviewRef = useRef<WebView>(null);
        const router = useRouter();
        const [canGoBack, setCanGoBack] = useState(false);

        useImperativeHandle(ref, () => ({
            reload: () => webviewRef.current?.reload()
        }));

        function handleNavigationChange(navState: any) {
            setCanGoBack(navState.canGoBack);

            if (navState.url.includes('myrecsports/index.php')) {
                if (title === 'Reserve') {
                    router.push('/(tabs)/myreservations');
                    setTimeout(() => {
                        webviewRef.current?.injectJavaScript(`
                            window.location.href = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';
                            true;
                        `);
                    }, 1000);
                } else {
                    setTimeout(() => {
                        webviewRef.current?.injectJavaScript(`
                            window.location.href = 'https://apps.rs.utexas.edu/app/myrecsports/myreservations.php';
                            true;
                        `);
                    }, 500);
                }
                return;
            }

            if (navState.url.includes('idp/profile/SAML2')) {
                router.replace('/login');
            }
        }

        function handleLoadEnd() {
            webviewRef.current?.injectJavaScript(HIDE_NAVBAR_JS);
            if (scrapeJs) {
                webviewRef.current?.injectJavaScript(scrapeJs);
            }
        }

        function handleMessage(event: any) {
            if (onMessage) {
                onMessage(event.nativeEvent.data);
            }
        }

        function handleLogout() {
            Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Logout',
                        style: 'destructive',
                        onPress: async () => {
                            await SecureStore.deleteItemAsync('has_logged_in');
                            await SecureStore.deleteItemAsync('ut_cookies');
                            router.replace('/login');
                        }
                    }
                ]
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => webviewRef.current?.goBack()}
                        style={[styles.headerButton, !canGoBack && styles.disabled]}
                        disabled={!canGoBack}
                    >
                        <IconSymbol
                            name="chevron.left"
                            size={20}
                            color={canGoBack ? '#BF5700' : '#ccc'}
                        />
                        <Text style={[styles.backText, !canGoBack && styles.disabledText]}>
                            Back
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>{title}</Text>

                    <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>

                <WebView
                    ref={webviewRef}
                    source={{ uri: url }}
                    onNavigationStateChange={handleNavigationChange}
                    onLoadEnd={handleLoadEnd}
                    onMessage={handleMessage}
                    setSupportMultipleWindows={false}
                    pullToRefreshEnabled={true}
                    textZoom={100}
                />
            </View>
        );
    }
);

export default WebViewScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: 50,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: { fontSize: 16, fontWeight: '600', color: '#BF5700' },
    headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
    disabled: { opacity: 0.3 },
    backText: { fontSize: 16, color: '#BF5700' },
    disabledText: { color: '#ccc' },
    logoutText: { fontSize: 16, color: '#cc0000', textAlign: 'right', minWidth: 60 },
});