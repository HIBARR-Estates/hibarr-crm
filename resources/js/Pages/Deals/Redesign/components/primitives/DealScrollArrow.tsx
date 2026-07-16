import DealIcon from "./DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealScrollArrowProps {
    dir: "left" | "right";
    enabled: boolean;
    onClick: () => void;
    label: string;
}

/** Ported from v2.2's ScrollArrow (deal-v2-2.jsx:697-710). */
export default function DealScrollArrow({
    dir,
    enabled,
    onClick,
    label,
}: DealScrollArrowProps) {
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
            <DealIcon name={dir === "left" ? "chevron-left" : "chevron-right"} size={15} />
        </button>
    );
}
