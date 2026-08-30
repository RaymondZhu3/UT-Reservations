import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Space, Type } from '@/constants/theme';

// Header bar for a tab root or a pushed screen. Top padding comes from the OS
// safe-area inset, which is the only value correct on every device — a fixed
// number is too large on an SE and too small on a Dynamic Island phone.
type Props = {
    title: string;
    /** ReactNode, not string — Courts passes a color-coded staleness caption. */
    subtitle?: ReactNode;
    /** Trailing control, e.g. the Logout button on My Reservations. */
    right?: ReactNode;
    /** Renders a back affordance above the title. */
    onBack?: () => void;
    /** Tab roots use `title`; pushed screens use `heading` — orange is
     *  reserved for a tab's own identity. */
    size?: 'title' | 'heading';
};

export function ScreenHeader({ title, subtitle, right, onBack, size = 'title' }: Props) {
    const insets = useSafeAreaInsets();
    const isTitle = size === 'title';

    return (
        <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
            {onBack && (
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.back}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                >
                    <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
            )}
            <View style={styles.row}>
                <View style={styles.text}>
                    <Text style={isTitle ? styles.title : styles.heading}>{title}</Text>
                    {typeof subtitle === 'string'
                        ? <Text style={styles.subtitle}>{subtitle}</Text>
                        : subtitle}
                </View>
                {right}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: Space.lg,
        paddingBottom: Space.md,
        backgroundColor: Brand.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Brand.divider,
    },
    back: { marginBottom: Space.sm, alignSelf: 'flex-start' },
    backText: { ...Type.bodySm, fontSize: 15, color: Brand.orange },
    row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    text: { flex: 1 },
    title: { ...Type.title, color: Brand.orange },
    heading: { ...Type.heading, color: Brand.ink },
    subtitle: { ...Type.bodySm, color: Brand.inkMuted, marginTop: Space.xs / 2 },
});
