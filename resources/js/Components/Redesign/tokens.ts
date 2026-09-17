import designTokens from "./design-tokens.json";

/**
 * The CRM colour palette. Values live in `design-tokens.json`, which also
 * feeds Tailwind (`text-dr-text-muted`, `bg-dr-surface-2`, …), the `--dr-*`
 * CSS variables on `:root` (for plain .css files) and the antd theme — so
 * every design surface resolves to the same colours. Add colours there.
 *
 * Accent notes:
 * - BLUE_DARK: icons/numerals on light blue surfaces. BLUE_HOVER: hover for
 *   BLUE links and ghost buttons.
 * - AMBER_TEXT / AMBER_BG / AMBER_BORDER: warning banners.
 * - ORANGE / YELLOW (+ _TEXT, _SOFT): task priority scale.
 * - SKY / EMERALD: analysis + qualification progress accents.
 */
export const REDESIGN_TOKENS = designTokens.colors;

export type RedesignColor = keyof typeof REDESIGN_TOKENS;

type ButtonTokenKey = Exclude<keyof typeof designTokens.buttons, "$comment">;

/**
 * v2 button colours (design-tokens.json "buttons"), each resolved from the
 * palette key it names — e.g. PRIMARY_HOVER_BG → BLUE_PRESSED. The CSS side
 * reads the same values as `--dr-button-*` (`.dr-btn-*` in redesign.css).
 */
export const REDESIGN_BUTTON_TOKENS = Object.fromEntries(
    Object.entries(designTokens.buttons)
        .filter(([key]) => key !== "$comment")
        .map(([key, ref]) => [key, REDESIGN_TOKENS[ref as RedesignColor]]),
) as Record<ButtonTokenKey, string>;

/**
 * Meeting platforms' own brand colours (third-party identities, so outside
 * the palette). Every platform icon/chip reads from here.
 */
export const MEETING_PLATFORM_COLORS: Record<string, string> =
    designTokens.meetingPlatformColors;

/** Brand colour for a meeting location; neutral hint grey for phone/on-site/unknown. */
export function meetingPlatformColor(location: string | null | undefined): string {
    return (location && MEETING_PLATFORM_COLORS[location]) || REDESIGN_TOKENS.TEXT_HINT;
}

/**
 * Type scale. The redesign had drifted to 17 distinct sizes across three
 * notations (`text-[13px]`, `text-xs`, `fontSize: 13`); these are the only
 * sizes new code should use.
 *
 * CAPTION is the floor - nothing smaller than 12px for readable text, which
 * is also the practical minimum for sustained reading on the web.
 */
export const REDESIGN_TYPE = {
    /** Uppercase field labels, meta rows. */
    CAPTION: 12,
    /** Default body / table / form text. */
    BODY: 14,
    /** Emphasised body, card titles. */
    BODY_LG: 15,
    /** Panel + modal headings. */
    HEADING: 16,
    /** Prominent facts (meeting date, task title). */
    DISPLAY: 19,
} as const;

/**
 * Radius scale. Replaces the previous 8 ad-hoc values (5/6/8/10/12/20/999
 * plus four Tailwind classes).
 */
export const REDESIGN_RADIUS = {
    /** Inputs, small chips. */
    SM: 6,
    /** Buttons, cards, panels - the default. */
    MD: 8,
    /** Emphasis containers (date tile, highlight panels). */
    LG: 12,
    /** Pills and avatars. */
    FULL: 999,
} as const;

/** The one font stack for every design surface (also Tailwind `font-sans`). */
export const REDESIGN_FONT_STACK = designTokens.fontSans
    .map((font) => (font.includes(" ") ? `'${font}'` : font))
    .join(", ");
