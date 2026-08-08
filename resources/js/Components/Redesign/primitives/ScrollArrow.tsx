import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface ScrollArrowProps {
    dir: "left" | "right";
    enabled: boolean;
    onClick: () => void;
    label: string;
}

/** Left/right chevron for horizontal scroll regions. */
export default function ScrollArrow({
    dir,
    enabled,
    onClick,
    label,
}: ScrollArrowProps) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={!enabled}
            onClick={onClick}
            className="flex shrink-0 items-center px-1 py-2"
            style={{
                background: "none",
                border: "none",
                cursor: enabled ? "pointer" : "default",
                color: enabled ? T.TEXT_MUTED : T.BORDER,
                minHeight: 36,
            }}
        >
            <Icon
                name={dir === "left" ? "chevron-left" : "chevron-right"}
                size={15}
            />
        </button>
    );
}
