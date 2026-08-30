import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Brand, Radius, Space, Type } from '@/constants/theme';

// Native pre-login screen, and the only part of the app App Review can reach:
// a reviewer has no UT EID and cannot pass Duo. Hence branding, an explanation
// and a way out, rather than dropping straight into UT's login page, which
// reads as a repackaged website (guideline 4.2) and a dead end (2.1).
const FEATURES = [
    {
        title: 'Every court, one list',
        body: 'Squash, racquetball, pickleball and tennis across all eight RecSports facilities, with today’s open times.',
    },
    {
        title: 'Book in a tap',
        body: 'Pick a time and confirm. No pinching and zooming through the desktop reservation site.',
    },
    {
        title: 'Manage what you booked',
        body: 'See upcoming reservations, cancel without leaving the app, and set a reminder before you play.',
    },
];

export default function WelcomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Space.xxl }]}>
                <View style={styles.hero}>
                    <Image source={require('@/assets/images/icon.png')} style={styles.icon} />
                    <Text style={styles.title}>UT Reserve</Text>
                    <Text style={styles.tagline}>A faster way to book RecSports courts</Text>
                </View>

                <View style={styles.features}>
                    {FEATURES.map(feature => (
                        <Card key={feature.title} style={styles.feature}>
                            <Text style={styles.featureTitle}>{feature.title}</Text>
                            <Text style={styles.featureBody}>{feature.body}</Text>
                        </Card>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.signInButton}
                    onPress={() => router.push('/login')}
                    accessibilityRole="button"
                >
                    <Text style={styles.signInText}>Sign in with UT EID</Text>
                </TouchableOpacity>

                {/* Says plainly what the app is and what it does not do with
                    credentials. Both are review-relevant: the affiliation line
                    is the guideline 5.2.1 mitigation for using "UT" in the
                    name, and the credential line is accurate — the EID and
                    password are typed into UT's own page inside the WebView,
                    and the session cookie is HttpOnly, so the app could not
                    read them even if it tried. */}
                <Text style={styles.disclaimer}>
                    Sign-in happens on UT&rsquo;s own page. Your EID and password are never
                    seen or stored by this app.
                </Text>
                <Text style={styles.disclaimer}>
                    Unofficial. Not affiliated with or endorsed by The University of Texas
                    at Austin or UT RecSports.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Brand.bg },
    scrollContent: { paddingHorizontal: Space.xl, paddingBottom: Space.xl },
    hero: { alignItems: 'center', marginBottom: Space.xxl },
    icon: { width: 84, height: 84, borderRadius: 19, marginBottom: Space.lg },
    title: { ...Type.display, fontSize: 30, color: Brand.orange },
    tagline: { ...Type.body, fontWeight: '400', color: Brand.inkSoft, marginTop: 6, textAlign: 'center' },
    features: { gap: Space.lg + 2 },
    // The container already spaces these with `gap`; Card's own bottom
    // margin would double it.
    feature: { marginBottom: 0 },
    featureTitle: { ...Type.body, color: Brand.ink },
    featureBody: { ...Type.bodySm, fontWeight: '400', color: Brand.inkMuted, marginTop: Space.xs, lineHeight: 19 },
    footer: {
        paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: Space.xxl,
        backgroundColor: Brand.surface,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.divider,
    },
    signInButton: {
        backgroundColor: Brand.orange, borderRadius: Radius.sm + 2,
        paddingVertical: 15, alignItems: 'center',
    },
    signInText: { ...Type.body, fontSize: 16, color: Brand.onOrange },
    disclaimer: {
        ...Type.micro, fontWeight: '400', color: Brand.inkMuted, textAlign: 'center',
        marginTop: Space.sm + 2, lineHeight: 15,
    },
});
