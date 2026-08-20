import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    assigneeTone,
    type CategoryToken,
    type PriorityToken,
    type StatusToken,
} from "../../config/taskDesignTokens";
import type { TaskPerson } from "../../adapters/taskViewModel";

interface GlyphProps {
    d: string;
    size?: number;
    color?: string;
    strokeWidth?: number;
}

/** Raw path renderer for the design's inline icon set. */
export function TaskGlyph({
    d,
    size = 14,
    color = "currentColor",
    strokeWidth = 2,
}: GlyphProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, display: "block" }}
        >
            <path d={d} />
        </svg>
    );
}

/**
 * The "stripe" priority treatment — a bare coloured arrow glyph sitting
 * between the checkbox and the title, with the label carried by the tooltip.
 */
export function TaskPriorityStripe({
    priority,
    size = 15,
}: {
    priority: PriorityToken;
    size?: number;
}) {
    const { td } = useTd();
    return (
        <span
            title={`${td(priority.label)} ${td("priority")}`}
            className="flex flex-shrink-0 items-center justify-center"
        >
            <TaskGlyph d={priority.d} size={size} color={priority.color} />
        </span>
    );
}

/** The "pill" priority treatment — dot + label in a tinted capsule. */
export function TaskPriorityPill({ priority }: { priority: PriorityToken }) {
    const { td } = useTd();
    return (
        <span
            className="inline-flex flex-shrink-0 items-center gap-1.5"
            style={{
                padding: "2px 9px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                background: priority.bg,
                color: priority.fg,
                border: `1px solid ${priority.border}`,
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: priority.color,
                }}
            />
            {td(priority.label)}
        </span>
    );
}

/** Priority shown as icon + label side by side (board card footer). */
export function TaskPriorityInline({ priority }: { priority: PriorityToken }) {
    const { td } = useTd();
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                color: priority.fg,
            }}
        >
            <TaskGlyph d={priority.d} size={14} color={priority.color} />
            {td(priority.label)}
        </span>
    );
}

/** Square colour chip + category name, shown in the row meta line. Renders
 *  nothing for an uncategorised task rather than inventing a category. */
export function TaskCategoryTag({
    category,
}: {
    category: CategoryToken | null;
}) {
    const { td } = useTd();
    if (!category) return null;
    return (
        <span
            className="inline-flex flex-shrink-0 items-center gap-1.5"
            style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                color: category.fg,
            }}
        >
            <span
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: category.dot,
                }}
            />
            {td(category.label, { source: "en" })}
        </span>
    );
}

/** Read-only status capsule (the list uses the interactive dropdown instead). */
export function TaskStatusPill({ status }: { status: StatusToken }) {
    const { td } = useTd();
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{
                padding: "4px 11px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                background: status.bg,
                color: status.fg,
                border: `1px solid ${status.border}`,
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: status.fg,
                }}
            />
            {td(status.label, { source: "en" })}
        </span>
    );
}

/**
 * Overlapping assignee avatars. Reuses the shared `Avatar` primitive (so the
 * user's photo shows when they have one) with the design's soft per-person
 * tone as the initials fallback.
 */
export function TaskAssigneeStack({
    people,
    size = 24,
    max = 3,
    overlap = -6,
}: {
    people: TaskPerson[];
    size?: number;
    max?: number;
    overlap?: number;
}) {
    if (people.length === 0) return null;
    const shown = people.slice(0, max);
    const remaining = people.length - shown.length;

    return (
        <span
            className="inline-flex items-center"
            title={people.map((person) => person.name).join(", ")}
        >
            {shown.map((person, index) => (
                <span
                    key={person.id}
                    className="flex rounded-full"
                    style={{
                        marginLeft: index === 0 ? 0 : overlap,
                        border: `2px solid ${T.WHITE}`,
                    }}
                >
                    <Avatar
                        size={size}
                        initials={person.initials}
                        src={person.image}
                        tone={assigneeTone(person.id)}
                        title={person.name}
                    />
                </span>
            ))}
            {remaining > 0 && (
                <span
                    className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
                    style={{
                        marginLeft: overlap,
                        width: size,
                        height: size,
                        border: `2px solid ${T.WHITE}`,
                        background: T.BORDER,
                        color: T.TEXT_MUTED,
                        fontSize: Math.max(9, size * 0.38),
                    }}
                >
                    +{remaining}
                </span>
            )}
        </span>
    );
}

/** Round completion checkbox — filled green once the task is done. */
export function TaskCheckCircle({
    done,
    size = 18,
    onToggle,
    label,
}: {
    done: boolean;
    size?: number;
    onToggle?: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={done}
            onClick={(event) => {
                event.stopPropagation();
                onToggle?.();
            }}
            disabled={!onToggle}
            style={{
                width: size,
                height: size,
                padding: 0,
                borderRadius: 999,
                border: `1.5px solid ${done ? "#177a5b" : "#c7d0de"}`,
                background: done ? "#177a5b" : "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: onToggle ? "pointer" : "default",
            }}
        >
            <svg
                viewBox="0 0 24 24"
                width={size * 0.61}
                height={size * 0.61}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: done ? 1 : 0 }}
            >
                <path d="M20 6 9 17l-5-5" />
            </svg>
        </button>
    );
}
