import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";

interface FlowFooterProps {
    /** The step before: its name, or null on the first step (the button is disabled). */
    previousLabel: ReactNode | null;
    onPrevious: () => void;
    /** "Saved 2 s ago", empty before the first save. */
    saved: string;
    /** The way on: "Next: Rental expectations" or the closing action. */
    nextLabel: ReactNode;
    onNext: () => void;
    /** "navy" moves to the next step; "green" finishes the flow. */
    nextTone?: "navy" | "green";
    nextDisabled?: boolean;
}

/**
 * Under a step of a flow under the dock (canvas L7-07, L7-12): back to the
 * step before by name, when the answers were last saved, and on to the next
 * step by name.
 */
export default function FlowFooter({ previousLabel, onPrevious, saved, nextLabel, onNext, nextTone = "navy", nextDisabled }: FlowFooterProps) {
    const { t } = useTranslation();
    return (
        <footer className="agent-flow__foot">
            <button type="button" className="agent-flow__btn" disabled={previousLabel === null} onClick={onPrevious}>
                <span aria-hidden="true">←</span>
                <span className="agent-flow__foot-name">{previousLabel ?? t("pages.agent_workspace.flow.previous")}</span>
            </button>
            <span className="agent-flow__saved" aria-live="polite">
                {saved}
            </span>
            <button type="button" className={`agent-flow__btn agent-flow__btn--${nextTone}`} disabled={nextDisabled} onClick={onNext}>
                <span className="agent-flow__foot-name">{nextLabel}</span>
                <span aria-hidden="true">{nextTone === "green" ? "✓" : "→"}</span>
            </button>
        </footer>
    );
}
