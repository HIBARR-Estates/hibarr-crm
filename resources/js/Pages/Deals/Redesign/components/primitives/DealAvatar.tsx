import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type AvatarType = "agent" | "participant" | "watcher" | "default";

interface DealAvatarProps {
    initials: string;
    type?: AvatarType;
    size?: number;
    className?: string;
}

export default function DealAvatar({
    initials,
    type = "default",
    size = 28,
    className,
}: DealAvatarProps) {
    const colors: Record<AvatarType, { bg: string; color: string }> = {
        agent: { bg: T.BLUE_MID, color: "#0c447c" },
        participant: { bg: T.GREEN_MID, color: "#085041" },
        watcher: { bg: "#d1d5db", color: "#374151" },
        default: { bg: T.BLUE_MID, color: "#0c447c" },
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
                fontSize: size * 0.38,
                fontWeight: 500,
                flexShrink: 0,
                border: `1.5px solid ${T.WHITE}`,
                letterSpacing: "0.02em",
            }}
        >
            {initials}
        </div>
    );
}
