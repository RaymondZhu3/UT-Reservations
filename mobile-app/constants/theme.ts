/**
 * Design tokens for UT Reserve.
 *
 * Rules:
 * - No screen should contain a raw hex string, font size, or spacing number.
 * - Orange is the only accent. Green means "open", red means "closed" or
 *   "destructive". Nothing else gets to be colorful.
 * - Spacing comes off the 4pt grid via `Space`.
 */

import { Platform, type TextStyle } from 'react-native';

/** Named by role, not by value, so a call site reads as intent. */
export const Brand = {
    /** UT burnt orange. The single accent — brand titles, primary buttons, active tab. */
    orange: '#BF5700',
    /** Text/icons that sit ON orange. */
    onOrange: '#FFFFFF',

    /** App background behind cards. */
    bg: '#F5F5F5',
    /** Card and header surfaces. */
    surface: '#FFFFFF',
    /** Hairline around cards. */
    border: '#E5E5E5',
    /** Heavier rule under headers. */
    divider: '#EEEEEE',

    /** Primary text. */
    ink: '#1A1A1A',
    /** Body-weight secondary text — facility hours, date chips. */
    inkSoft: '#666666',
    /** Secondary text — subtitles, card subs, section labels. */
    inkMuted: '#888888',
    /** Tertiary text — empty states, disabled. */
    inkFaint: '#AAAAAA',
    /** Chevrons and other decorative marks. */
    inkGhost: '#CCCCCC',

    /** "Open" / success text. */
    open: '#3B6D11',
    /** Tinted background behind open/success badges. */
    openBg: '#EAF3DE',
    /** Left edge marker on an available slot card. */
    openEdge: '#639922',

    /** "Closed" — a statement about the facility, not about the user's action. */
    closed: '#BB0000',
    /** Destructive action (cancel a reservation). Deliberately not `closed`. */
    danger: '#A32D2D',
    /** Tinted background behind "today" / attention badges. */
    warnBg: '#FAEEDA',
    /** Text on warnBg. */
    warnInk: '#854F0B',
} as const;

/**
 * SF Rounded, used on brand titles only. It's a system face, so no bundle cost
 * and no font-loading gate before first render. Body copy stays on default SF,
 * which iOS optically tunes for small sizes. Other platforms fall through.
 */
const roundedFamily = Platform.select({ ios: 'ui-rounded', default: undefined });

/**
 * Seven steps, replacing eight ad-hoc sizes and four weight spellings.
 * Use as `{ ...Type.title, color: Brand.orange }`.
 */
export const Type = {
    /** Home greeting, welcome screen wordmark. */
    display: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.4,
        fontFamily: roundedFamily,
    },
    /** Screen headers — "Find a court", "My Reservations". */
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
