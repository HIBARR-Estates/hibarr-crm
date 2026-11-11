import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { normalizeFieldKey } from "@/Pages/Deals/Redesign/components/header/DealPipelineStepper";
import type { StageRequirementCondition } from "@/Pages/Deals/Redesign/adapters/stageRequirementEvaluator";
import type { NextStageConditions } from "./stageConditions";

const OPERATOR_LABEL: Record<string, string> = {
    "=": "is",
    ">": "is more than",
    "<": "is less than",
    contains: "contains",
    exists: "is filled in",
    changed: "has changed",
};

const humanize = (field: string) =>
    (field.split(".").pop() ?? field).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => (Array.isArray(value) ? value.map(formatValue).join(", ") : String(value ?? ""));

interface StageConditionsPanelProps {
    stage: NextStageConditions;
    /** The analysis, counted as one more row when it is on for this company. */
    analysis?: { done: number; total: number; onOpen: () => void };
    /** Moves the deal to the next stage; left out without the permission or on the last stage. */
    onMove?: () => void;
    moving: boolean;
    /** Won, lost or locked: the stage can't change. */
    closedLabel?: string | null;
    onOpenField: (condition: StageRequirementCondition) => void;
}

/**
 * The blue panel beside the deal (canvas L7-10): what the next stage asks for,
 * each condition as a row that is ticked once the deal meets it, and the one
 * button that moves the deal on. Conditions guide the move; they never block it.
 */
export default function StageConditionsPanel({ stage, analysis, onMove, moving, closedLabel, onOpenField }: StageConditionsPanelProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const next = stage.next ? td(stage.next.name, { source: "en" }) : "";
    const total = stage.conditions.length;

    return (
        <section className="agent-deal__conditions" aria-labelledby="agent-deal-conditions-title">
            <p className="agent-deal__conditions-cap">
                {stage.next
                    ? total > 0
                        ? t("pages.agent_workspace.deal.conditions.cap_count", { stage: next, met: stage.met, total })
                        : t("pages.agent_workspace.deal.conditions.cap", { stage: next })
                    : t("pages.agent_workspace.deal.conditions.cap_last")}
            </p>
            <h2 id="agent-deal-conditions-title" className="agent-deal__conditions-title">
                {closedLabel ?? (stage.next ? t("pages.agent_workspace.deal.conditions.title") : t("pages.agent_workspace.deal.conditions.last_title"))}
            </h2>

            {stage.next && !closedLabel ? (
                <ul className="agent-deal__conditions-list">
                    {!stage.loaded ? (
                        <li className="agent-deal__condition agent-deal__condition--skeleton" aria-hidden="true" />
                    ) : null}
                    {stage.conditions.map(({ condition, met }, index) => {
                        const label = td(condition.label?.trim() || humanize(condition.field), { source: "en" });
                        const operator = td(OPERATOR_LABEL[condition.operator] ?? condition.operator, { source: "en" });
                        const showValue = condition.operator !== "exists" && condition.operator !== "changed";
                        const sub = [operator, showValue ? formatValue(condition.value) : ""].filter(Boolean).join(" ");
                        return (
                            <li key={`${condition.field}-${index}`}>
                                <button
                                    type="button"
                                    className={`agent-deal__condition${met ? " agent-deal__condition--met" : ""}`}
                                    onClick={() => onOpenField(condition)}
                                    aria-label={met ? `${label}: ${t("pages.agent_workspace.deal.conditions.met")}` : undefined}
                                    data-field={normalizeFieldKey(condition.field)}
                                >
                                    <span className="agent-deal__tick" aria-hidden="true">
                                        {met ? <Icon name="check" size={13} /> : null}
                                    </span>
                                    <span className="agent-deal__condition-body">
                                        <span className="agent-deal__condition-label">{label}</span>
                                        <span className="agent-deal__condition-sub">{sub}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                    {analysis ? (
                        <li>
                            <button
                                type="button"
                                className={`agent-deal__condition${analysis.done >= analysis.total ? " agent-deal__condition--met" : ""}`}
                                onClick={analysis.onOpen}
                            >
                                <span className="agent-deal__tick" aria-hidden="true">
                                    {analysis.done >= analysis.total ? <Icon name="check" size={13} /> : null}
                                </span>
                                <span className="agent-deal__condition-body">
                                    <span className="agent-deal__condition-label">{t("pages.agent_workspace.deal.conditions.analysis")}</span>
                                    <span className="agent-deal__condition-sub">
                                        {t("pages.agent_workspace.deal.analysis.answered", { done: analysis.done, total: analysis.total })}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ) : null}
                </ul>
            ) : null}

            {stage.next && !closedLabel ? (
                <>
                    <p className="agent-deal__conditions-note">
                        {stage.loaded && total === 0 && !analysis
                            ? t("pages.agent_workspace.deal.conditions.none")
                            : t("pages.agent_workspace.deal.conditions.note")}
                    </p>
                    {onMove ? (
                        <button type="button" className="agent-deal__move" onClick={onMove} disabled={moving}>
                            {t("pages.agent_workspace.deal.conditions.move", { stage: next })}
                        </button>
                    ) : null}
                </>
            ) : null}
        </section>
    );
}
