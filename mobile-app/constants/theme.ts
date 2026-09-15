// Design tokens. Screens should not contain raw hex strings, font sizes or
// spacing numbers. Orange is the only accent; green is "open", red is "closed"
// or destructive.

import { Platform, type TextStyle } from 'react-native';

export const Brand = {
    orange: '#BF5700',
    onOrange: '#FFFFFF',

    // Surfaces, lightest to heaviest.
    bg: '#F5F5F5',
    surface: '#FFFFFF',
    border: '#E5E5E5',
    divider: '#EEEEEE',

    // Text, darkest to faintest. inkGhost is decorative only (chevrons).
    ink: '#1A1A1A',
    inkSoft: '#666666',
    inkMuted: '#888888',
    inkFaint: '#AAAAAA',
    inkGhost: '#CCCCCC',

    open: '#3B6D11',
    openBg: '#EAF3DE',
    openEdge: '#639922',

    // `closed` describes the facility, `danger` describes the user's action
    // (cancelling). Keeping them separate stops a closed badge reading as a
    // destructive button.
    closed: '#BB0000',
    danger: '#A32D2D',
    warnBg: '#FAEEDA',
    warnInk: '#854F0B',
} as const;

// SF Rounded on brand titles only. A system face, so no bundle cost and no
// font-loading gate before first render. Non-iOS falls through to the default.
const roundedFamily = Platform.select({ ios: 'ui-rounded', default: undefined });

/** Spread into a style, e.g. `{ ...Type.title, color: Brand.orange }`. */
export const Type = {
    /** Home greeting, welcome screen wordmark. */
    display: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.4,
        fontFamily: roundedFamily,
    },
    /** Screen headers: "Find a court", "My Reservations". */
    title: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.2,
        fontFamily: roundedFamily,
    },
    /** Sub-screen headers pushed onto a stack (court-availability). */
    heading: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    /** Card titles. */
    body: {
        fontSize: 15,
        fontWeight: '600',
    },
    /** Buttons, links, header subtitles. */
    bodySm: {
        fontSize: 13,
        fontWeight: '500',
    },
    /** Card subtitles, hours, empty-state copy. */
    caption: {
        fontSize: 12,
        fontWeight: '400',
    },
    /** Section labels, badges, staleness captions, disclaimers. */
    micro: {
        fontSize: 11,
        fontWeight: '600',
    },
} satisfies Record<string, TextStyle>;

/** 4pt grid. */
export const Space = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 36,
} as const;

export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    /** Date chips, badges. */
    pill: 20,
} as const;

/** The one shadow in the app. */
export const Elevation = {
    card: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
} as const;
