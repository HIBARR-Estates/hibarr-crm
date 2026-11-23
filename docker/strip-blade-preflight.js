// Tailwind v4 ignores corePlugins.preflight: false and emits a reset that
// Bootstrap screens were not built against. Inertia keeps that reset via
// Vite. The file Blade loads (public/css/tailwind.css) must not.
function stripBladePreflight(css) {
    const marker = "*, ::after, ::before, ::backdrop, ::file-selector-button";
    let cursor = 0;
    let out = "";

    while (cursor < css.length) {
        const start = css.indexOf("@layer base", cursor);
        if (start === -1) {
            out += css.slice(cursor);
            break;
        }

        out += css.slice(cursor, start);
        const open = css.indexOf("{", start);
        let depth = 0;
        let end = open;

        for (; end < css.length; end++) {
            const ch = css.charAt(end);
            if (ch === "{") {
                depth++;
            } else if (ch === "}") {
                depth--;
                if (depth === 0) {
                    end++;
                    break;
                }
            }
        }

        const block = css.slice(start, end);
        if (!block.includes(marker)) {
            out += block;
        }
        cursor = end;
    }

    return out;
}

module.exports = stripBladePreflight;
