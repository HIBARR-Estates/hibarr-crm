import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../../primitives/Icon";

export interface FlowStep {
    key: string;
    label: ReactNode;
    state: "done" | "current" | "todo";
    /** Not reached yet: shown, but it cannot be opened. */
    locked?: boolean;
}

interface FlowStepListProps {
    steps: FlowStep[];
    onJump: (key: string) => void;
}

/**
 * The script's steps down the left of a flow under the dock (canvas L7-07,
 * L7-12): a green tick for a step that is done, the current step in navy,
 * numbers for the rest. Each one opens its step.
 */
export default function FlowStepList({ steps, onJump }: FlowStepListProps) {
    const { t } = useTranslation();

    return (
        <nav className="agent-flow__steps" aria-label={t("pages.agent_workspace.flow.steps")}>
            <ol className="agent-flow__step-list">
                {steps.map((step, index) => (
                    <li key={step.key}>
                        <button
                            type="button"
                            className={`agent-flow__step agent-flow__step--${step.state}`}
                            aria-current={step.state === "current" ? "step" : undefined}
                            disabled={step.locked}
                            onClick={() => onJump(step.key)}
                        >
                            <span className="agent-flow__step-mark" aria-hidden="true">
                                {step.state === "done" ? <Icon name="check" size={12} /> : index + 1}
                            </span>
                            <span className="agent-flow__step-label">{step.label}</span>
                        </button>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
