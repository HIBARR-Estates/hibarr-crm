import type { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

export interface WorkspaceTabSectionHeaderProps {
    /** Uppercase section label (same vocabulary as Overview columns). */
    title: string;
    count?: number;
    /** One line under the label — orients someone who landed on the tab cold. */
    hint?: ReactNode;
    className?: string;
}

/**
 * Section chrome for Deal/Lead workspace tabs (notes, tasks, meetings, …).
 * Overview uses {@link OverviewColumn} with the same `dr-label` + count pattern;
 * full tabs use this so lists are scannable without already knowing the layout.
 */
export default function WorkspaceTabSectionHeader({
    title,
    count,
    hint,
    className,
}: WorkspaceTabSectionHeaderProps) {
    return (
        <div className={className ?? "mb-2.5"}>
            <div className="dr-label">
                {title}
                {count != null ? (
                    <span style={{ fontWeight: 400 }}> · {count}</span>
                ) : null}
            </div>
            {hint ? (
                <p
                    className="mt-1 mb-0 text-xs leading-relaxed"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
