import { REDESIGN_TOKENS as T } from "@/Components/Redesign";

/** A status or stage name with its configured colour, as a dot and text. */
export default function StatusDot({
    label,
    color,
}: {
    label: string;
    color?: string | null;
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: T.TEXT,
                whiteSpace: "nowrap",
            }}
        >
            <span
                aria-hidden
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color || T.TEXT_HINT,
                    flexShrink: 0,
                }}
            />
            {label}
        </span>
    );
}
