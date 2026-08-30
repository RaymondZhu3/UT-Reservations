import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Elevation, Radius, Space } from '@/constants/theme';

// The app's standard content block. `onPress` picks the element, so a
// non-interactive card cannot dim on tap and do nothing.
//
// court-availability's slot tiles are intentionally not Cards: a two-column
// grid of small tiles is a different shape from a full-width block.
type CardProps = {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
};

export function Card({ children, style, onPress }: CardProps) {
    if (onPress) {
        return (
            <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>
        );
    }
    return <View style={[styles.card, style]}>{children}</View>;
}

/** Title on the left, status/hours/chevron on the right. */
export function CardRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Brand.surface,
        borderRadius: Radius.md,
        padding: Space.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Brand.border,
        marginBottom: Space.sm,
        ...Elevation.card,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Space.sm,
    },
});
