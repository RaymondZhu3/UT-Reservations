import WebViewScreen, { WebViewScreenHandle } from '@/components/WebViewScreen';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

const RESERVATION_URL = 'https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php';

export default function ReserveTab() {
    const screenRef = useRef<WebViewScreenHandle>(null);

    useFocusEffect(
        useCallback(() => {
            screenRef.current?.reload();
        }, [])
    );

    return (
        <WebViewScreen
            ref={screenRef}
            url={RESERVATION_URL}
            title="Reserve Courts"
        />
    );
}