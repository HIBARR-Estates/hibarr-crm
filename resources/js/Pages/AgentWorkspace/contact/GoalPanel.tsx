import { useEffect, useMemo, useRef } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import {
    answersFromQualification,
    buildTokenMap,
    computeWalkSegments,
    hasAnswerContent,
    resolveTokens,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Pages/Leads/Components/Qualification/useTranslatedScriptLabel";
import type { ResolvedLifecycle } from "@/Pages/Leads/Redesign/adapters/lifecycleAdapter";
import { LIFECYCLE_BANNER_CONFIG } from "@/Pages/Leads/Redesign/config/lifecycleBanners";
import type useLeadQualificationWorkspace from "@/Pages/Leads/Redesign/hooks/useLeadQualificationWorkspace";
import type { LeadMissionCtaAction } from "@/Pages/Leads/Redesign/types";
import type { Lead } from "@/Types/api/leads";
import type { Segment } from "@/Types/qualification";

interface GoalPanelProps {
    lead: Lead;
    lifecycle: ResolvedLifecycle;
    qualification: ReturnType<typeof useLeadQualificationWorkspace>;
    /** A qualification call is starting or resuming. */
    busy: boolean;
    onAction: (action: LeadMissionCtaAction) => void;
}

interface Step {
    segment: Segment;
    answered: boolean;
}

/**
 * The lead's next goal and the one action that moves it, from the lifecycle
 * banner the lead page already has (LIFECYCLE_BANNER_CONFIG): start or
 * finish the qualification, create a deal once qualified, open the deal, or
 * reactivate. While a qualification runs, its questions are listed with
 * the ones already answered ticked.
 */
export default function GoalPanel({ lead, lifecycle, qualification, busy, onAction }: GoalPanelProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const mode = lifecycle.bannerMode;
    const config = LIFECYCLE_BANNER_CONFIG[mode];

    const steps = useMemo((): Step[] => {
        const tree = qualification.templateTree;
        const current = qualification.current;
        if (mode !== "qualify_resume" || !tree || !current) return [];
        // Same count as QualifyModal: only questions on the walkable path.
        const answers = answersFromQualification(current.answers ?? [], tree);
        return computeWalkSegments(tree, answers)
            .filter((segment) => segment.type === "question")
            .map((segment) => ({ segment, answered: hasAnswerContent(answers[segment.key]) }));
    }, [mode, qualification.current, qualification.templateTree]);
    const nextIndex = steps.findIndex((step) => !step.answered);

    // Where the steps scroll (sideways on smaller screens), keep the next
    // question in view rather than the answered ones before it.
    const stepsRef = useRef<HTMLOListElement>(null);
    useEffect(() => {
        const list = stepsRef.current;
        const current = list?.querySelector<HTMLElement>("[aria-current='step']");
        if (!list || !current) return;
        // Leave a sliver of the answered step before it showing.
        list.scrollLeft = Math.max(0, current.offsetLeft - list.offsetLeft - 32);
        list.scrollTop = Math.max(0, current.offsetTop - list.offsetTop - 32);
    }, [nextIndex, steps.length]);

    const copy = (() => {
        switch (mode) {
            case "qualify_start":
            case "nurture":
                return { eyebrow: t("pages.agent_workspace.contact.goal.to_qualified"), title: t("pages.agent_workspace.contact.goal.start_title") };
            case "qualify_resume":
                return { eyebrow: t("pages.agent_workspace.contact.goal.to_qualified"), title: t("pages.agent_workspace.contact.goal.resume_title") };
            case "qualified":
                return { eyebrow: t("pages.agent_workspace.contact.goal.qualified_eyebrow"), title: t("pages.agent_workspace.contact.goal.qualified_title") };
            case "converted":
                return { eyebrow: t("pages.agent_workspace.contact.goal.converted_eyebrow"), title: t("pages.agent_workspace.contact.goal.converted_title") };
            default:
                return {
                    eyebrow: t("pages.agent_workspace.contact.goal.closed_eyebrow"),
                    title: t("pages.agent_workspace.contact.goal.closed_title", { status: td(lifecycle.statusLabel, { source: "en" }) }),
                };
        }
    })();

    const primaryLabel = busy
        ? t("pages.agent_workspace.contact.goal.starting")
        : mode === "qualify_resume" && nextIndex >= 0
          ? t("pages.agent_workspace.contact.goal.continue_step", { step: nextIndex + 1 })
          : td(config.primaryCta.label, { source: "en" });
    const secondary = config.secondaryCta && config.secondaryCta.action !== "view_answers" ? config.secondaryCta : null;
    const description = (lead.lead_lifecycle_status as { description?: string | null } | undefined)?.description?.trim();

    return (
        <section className={`agent-goal agent-goal--${mode}`} aria-labelledby="agent-goal-title">
            <p className="agent-goal__eyebrow">{copy.eyebrow}</p>
            <h2 id="agent-goal-title" className="agent-goal__title">
                {copy.title}
            </h2>
            {mode === "qualify_resume" && qualification.current?.template_name ? (
                <p className="agent-goal__sub">{td(qualification.current.template_name, { source: "en" })}</p>
            ) : null}
            {steps.length > 0 ? (
                <ol ref={stepsRef} className="agent-goal__steps" aria-label={t("pages.agent_workspace.contact.goal.steps_aria")}>
                    {steps.map((step, index) => (
                        <GoalStep key={step.segment.key} lead={lead} step={step} index={index} current={index === nextIndex} />
                    ))}
                </ol>
            ) : null}
            {steps.length > 0 ? (
                <p className="agent-goal__progress">
                    {t("pages.agent_workspace.contact.goal.answered", {
                        answered: steps.filter((step) => step.answered).length,
                        total: steps.length,
                    })}
                </p>
            ) : description ? (
                <p className="agent-goal__sub">{td(description, { source: "en" })}</p>
            ) : null}
            <div className="agent-goal__actions">
                <Button
                    variant="ghost"
                    className="agent-goal__primary"
                    onClick={() => onAction(config.primaryCta.action)}
                    disabled={busy}
                >
                    {primaryLabel}
                </Button>
                {secondary ? (
                    <Button variant="navy" className="agent-goal__secondary" onClick={() => onAction(secondary.action)}>
                        {td(secondary.label, { source: "en" })}
                    </Button>
                ) : null}
            </div>
        </section>
    );
}

function GoalStep({ lead, step, index, current }: { lead: Lead; step: Step; index: number; current: boolean }) {
    const { props } = usePage<PageProps>();
    const raw = useTranslatedScriptLabel(step.segment.label || step.segment.key);
    const tokens = useMemo(() => buildTokenMap(lead, props.auth), [lead, props.auth]);
    const label = stripHtmlTags(resolveTokens(raw, tokens, lead, props.auth)) || step.segment.key;

    return (
        <li
            className={`agent-goal__step${step.answered ? " agent-goal__step--done" : ""}${current ? " agent-goal__step--current" : ""}`}
            aria-current={current ? "step" : undefined}
        >
            <span className="agent-goal__mark" aria-hidden="true">
                {step.answered ? <Icon name="check" size={12} /> : index + 1}
            </span>
            <span className="agent-goal__label">{label}</span>
        </li>
    );
}
