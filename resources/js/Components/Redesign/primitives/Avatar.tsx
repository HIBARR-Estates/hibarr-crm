import { useEffect, useState } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

type AvatarType = "agent" | "participant" | "watcher" | "default";

interface AvatarProps {
    initials: string;
    type?: AvatarType;
    size?: number;
    className?: string;
    /** When set, renders the photo instead of initials. */
    src?: string | null;
    /**
     * Overrides the `type` palette with an explicit pair — used by the soft
     * per-person assignee tones in the Tasks workspace.
     */
    tone?: { bg: string; fg: string } | null;
    title?: string;
}

/**
 * Solid navy/green/blue fills with white text; watcher is the outlined
 * light-gray variant. Inline-styled so it works outside page-scoped CSS.
 * Optional `src` shows a photo (e.g. lead avatar on the deal dossier).
 */
export default function Avatar({
    initials,
    type = "default",
    size = 28,
    className,
    src,
    tone,
    title,
}: AvatarProps) {
    const colors: Record<
        AvatarType,
        { bg: string; color: string; border?: string }
    > = {
        agent: { bg: T.NAVY, color: T.WHITE },
        participant: { bg: T.GREEN, color: T.WHITE },
        watcher: { bg: T.BG, color: T.TEXT_MUTED, border: T.BORDER },
        default: { bg: T.BLUE, color: T.WHITE },
    };
    const c = tone
        ? { bg: tone.bg, color: tone.fg, border: undefined }
        : (colors[type] ?? colors.default);

    // A broken/expired photo URL should fall back to the initials, not the
    // browser's broken-image glyph.
    const [imgFailed, setImgFailed] = useState(false);
    useEffect(() => setImgFailed(false), [src]);
    const photoUrl = !imgFailed && src?.trim() ? src.trim() : null;

    return (
        <div
            className={className}
            title={title}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: c.bg,
                color: c.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: Math.max(10, size * 0.38),
                fontWeight: 700,
                flexShrink: 0,
                border: c.border ? `1px solid ${c.border}` : "none",
                overflow: "hidden",
            }}
        >
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt=""
                    onError={() => setImgFailed(true)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            ) : (
                initials
            )}
        </div>
    );
}
