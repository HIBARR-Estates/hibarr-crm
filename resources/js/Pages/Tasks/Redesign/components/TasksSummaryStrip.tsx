import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface SummaryClause {
    label: string;
    value: string;
}

interface TasksSummaryStripProps {
    clauses: SummaryClause[];
    count: number;
    onClearAll: () => void;
}

/**
 * "Showing tasks where … — N tasks" band. Sits full-width directly beneath
 * the white header bar (its own tinted strip with a top hairline), matching
 * the handoff, with the text itself constrained to the page's 1280 column.
 */
export default function TasksSummaryStrip({
    clauses,
    count,
    onClearAll,
}: TasksSummaryStripProps) {
    const { td } = useTd();

    if (clauses.length === 0) return null;

    return (
        <div
            style={{
                background: T.SURFACE_2,
                borderTop: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <div className="mx-auto flex w-full max-w-[1280px] items-center gap-2.5 px-7 py-[9px]">
                <span
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: T.BLUE,
                        flexShrink: 0,
                    }}
                />
                <div
                    className="min-w-0 flex-1"
                    style={{ fontSize: 13, color: T.TEXT_MUTED }}
                >
                    {td("Showing tasks where")}{" "}
                    {clauses.map((clause, index) => (
                        <span key={`${clause.label}-${clause.value}`}>
                            {index > 0 && ` ${td("and")} `}
                            {td(clause.label)}{" "}
                            <strong
                                style={{
                                    color: T.NAVY,
                                    fontWeight: 700,
                                    borderBottom: `1px dotted ${T.TEXT_HINT}`,
                                }}
                            >
                                {clause.value}
                            </strong>
                        </span>
                    ))}
                    <span style={{ color: T.NAVY_MID }}> — </span>
                    <strong style={{ color: T.NAVY, fontWeight: 700 }}>
                        {count} {count === 1 ? td("task") : td("tasks")}
                    </strong>
                </div>
                <button
                    type="button"
                    onClick={onClearAll}
                    style={{
                        padding: "4px 2px",
                        background: "transparent",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.BLUE,
                        cursor: "pointer",
                        flexShrink: 0,
                    }}
                >
                    {td("Clear all")}
                </button>
            </div>
        </div>
    );
}
