export const REDESIGN_TOKENS = {
    BG: "#f5f6f8",
    SURFACE: "#ffffff",
    SURFACE_2: "#f8f9fb",
    NAVY: "#16294d",
    BLUE: "#1a6bb5",
    BLUE_LIGHT: "#e8f1fb",
    BLUE_MID: "#b8d4f0",
    GREEN: "#177a5b",
    GREEN_LIGHT: "#e1f5ee",
    GREEN_MID: "#9fe1cb",
    AMBER: "#92400e",
    AMBER_SOFT: "#fff7ed",
    AMBER_BANNER: "#fef3c7",
    AMBER_MID: "#fed7aa",
    RED: "#b91c1c",
    RED_SOFT: "#fef2f2",
    RED_MID: "#fecaca",
    TEAL: "#0f766e",
    TEAL_SOFT: "#e6f7f5",
    TEAL_MID: "#99e2d8",
    GRAY: "#f5f6f8",
    GRAY_MID: "#e8eaed",
    GRAY_DARK: "#5b6472",
    GRAY_DARKER: "#374151",
    BORDER: "#e2e5ea",
    BORDER_SOFT: "#eef0f3",
    TEXT: "#1a1f2e",
    TEXT_MUTED: "#5b6472",
    TEXT_HINT: "#9ca3af",
    WHITE: "#ffffff",

    /** Deep blue for icons/numerals on light blue surfaces. */
    BLUE_DARK: "#14538c",
    /** Hover state for BLUE links and ghost buttons. */
    BLUE_HOVER: "#145890",
    /** Skeleton / shimmer fill. */
    SKELETON: "#eef1f5",
    /** Warning banner (recommendations incomplete-data notice). */
    AMBER_TEXT: "#b45309",
    AMBER_BG: "#fffbeb",
    AMBER_BORDER: "#fde68a",
    /** Navy pill (dr-pill-navy). */
    NAVY_SOFT: "#e8ecf2",
    NAVY_MID: "#c7d0de",
} as const;

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

export const REDESIGN_FONT_STACK =
    "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
