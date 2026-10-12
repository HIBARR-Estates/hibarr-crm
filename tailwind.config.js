const plugin = require("tailwindcss/plugin");
const designTokens = require("./resources/js/Components/Redesign/design-tokens.json");

// design-tokens.json keys are SCREAMING_SNAKE (REDESIGN_TOKENS); Tailwind
// utilities and CSS variables use kebab-case: TEXT_MUTED → dr-text-muted.
const kebab = (key) => key.toLowerCase().replace(/_/g, "-");

const drColors = Object.fromEntries(
    Object.entries(designTokens.colors).map(([key, value]) => [kebab(key), value]),
);

// Button tokens name a palette colour; expose them resolved as dr-button-*
// (bg-dr-button-primary-bg, var(--dr-button-primary-hover-bg), …).
for (const [key, ref] of Object.entries(designTokens.buttons)) {
    if (key === "$comment") continue;
    if (!designTokens.colors[ref]) {
        throw new Error(`design-tokens.json: button token ${key} names unknown colour ${ref}`);
    }
    drColors[`button-${kebab(key)}`] = designTokens.colors[ref];
}

const fontStack = designTokens.fontSans
    .map((font) => (font.includes(" ") ? `"${font}"` : font))
    .join(", ");

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./resources/**/*.blade.php",
        "./resources/**/*.js",
        "./resources/**/*.ts",
        "./resources/**/*.tsx",
        "./resources/**/*.vue",
        "./app/**/*.php",
        "./app/View/Components/**/*.php",
    ],
    theme: {
        extend: {
            // Additive only: redesign screens use dr-* utilities; Tailwind's
            // defaults (and font-sans) are left as-is for legacy screens.
            colors: {
                dr: drColors,
            },
        },
    },
    plugins: [
        // Expose the redesign palette, button tokens and font to plain .css
        // files as --dr-* variables.
        plugin(({ addBase }) => {
            addBase({
                ":root": {
                    ...Object.fromEntries(
                        Object.entries(drColors).map(([key, value]) => [
                            `--dr-${key}`,
                            value,
                        ]),
                    ),
                    "--dr-font-sans": fontStack,
                },
            });
        }),
    ],
    corePlugins: {
        preflight: false,
    },
};
