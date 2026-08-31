import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface Props {
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
    label?: string;
}

/** Six-dot grip shared by sortable rows and section headers. */
export default function DragHandle({ attributes, listeners, label = "Drag to reorder" }: Props) {
    return (
        <span
            {...attributes}
            {...listeners}
            aria-label={label}
            style={{
                display: "flex",
                alignItems: "center",
                cursor: "grab",
                color: T.TEXT_HINT,
                padding: "4px 2px",
                touchAction: "none",
                flexShrink: 0,
            }}
        >
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.4" />
                <circle cx="8" cy="2" r="1.4" />
                <circle cx="2" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="2" cy="14" r="1.4" />
                <circle cx="8" cy="14" r="1.4" />
            </svg>
        </span>
    );
}
