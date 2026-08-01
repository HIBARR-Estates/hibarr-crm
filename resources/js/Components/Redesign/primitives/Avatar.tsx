import { REDESIGN_TOKENS as T } from "../tokens";

type AvatarType = "agent" | "participant" | "watcher" | "default";

interface AvatarProps {
    initials: string;
    type?: AvatarType;
    size?: number;
    className?: string;
}

/**
 * Solid navy/green/blue fills with white text; watcher is the outlined
 * light-gray variant. Inline-styled so it works outside page-scoped CSS.
 */
export default function Avatar({
    initials,
    type = "default",
    size = 28,
    className,
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
    const c = colors[type] ?? colors.default;

    return (
        <div
            className={className}
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
            }}
        >
            {initials}
        </div>
    );
}
