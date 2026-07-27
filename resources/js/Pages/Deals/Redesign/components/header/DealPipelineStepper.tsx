import { useState } from "react";
import { Popover } from "antd";
import { usePage } from "@inertiajs/react";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import useDealPipeline from "../../hooks/useDealPipeline";
import useHScroll from "../../hooks/useHScroll";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DealModal } from "../primitives/DealModal";
import DealScrollArrow from "../primitives/DealScrollArrow";
import {
    DEAL_REDESIGN_RADIUS as R,
    DEAL_REDESIGN_TOKENS as T,
    DEAL_REDESIGN_TYPE as TYPE,
} from "../../tokens";

interface DealPipelineStepperProps {
    deal: Deal;
    permissions: Record<string, string>;
}

interface StageRequirementCondition {
    field: string;
    label?: string;
    operator: string;
    value: unknown;
}

function hasAllPermission(permissions: Record<string, string>, key: string) {
    return permissions?.[key] === "all";
}

const OPERATOR_LABEL: Record<string, string> = {
    "=": "is",
    ">": "is more than",
    "<": "is less than",
    contains: "contains",
    exists: "is filled in",
    changed: "has changed",
};

function humanizeField(field: string) {
    const last = field.split(".").pop() ?? field;
    return last
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatConditionValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(formatConditionValue).join(", ");
    }
    return String(value ?? "");
}

function RequirementConditionRows({
    requirements,
}: {
    requirements: StageRequirementCondition[];
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {requirements.map((condition, i) => {
                const label =
                    condition.label?.trim() || humanizeField(condition.field);
                const opLabel =
                    OPERATOR_LABEL[condition.operator] ?? condition.operator;
                const showValue =
                    condition.operator !== "exists" &&
                    condition.operator !== "changed";
                const valueText = showValue
                    ? formatConditionValue(condition.value)
                    : "";

                return (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            padding: "8px 10px",
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: R.SM,
                        }}
                    >
                        <span
                            style={{
                                fontSize: TYPE.CAPTION,
                                fontWeight: 600,
                                color: T.TEXT_MUTED,
                                letterSpacing: "0.02em",
                                lineHeight: 1.3,
                            }}
                        >
                            {label}
                        </span>
                        <span
                            style={{
                                fontSize: TYPE.BODY,
                                lineHeight: 1.35,
                                color: T.TEXT,
                            }}
                        >
                            <span style={{ color: T.TEXT_HINT, fontWeight: 500 }}>
                                {opLabel}
                            </span>
                            {showValue && valueText !== "" ? (
                                <>
                                    {" "}
                                    <span style={{ fontWeight: 700, color: T.NAVY }}>
                                        {valueText}
                                    </span>
                                </>
                            ) : null}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function StageRequirementsPopup({
    stageName,
    requirementsLabel,
    requirements,
}: {
    stageName: string;
    requirementsLabel: string;
    requirements: StageRequirementCondition[];
}) {
    return (
        <div style={{ width: 280, maxWidth: "calc(100vw - 32px)" }}>
            <div
                style={{
                    fontSize: TYPE.BODY,
                    fontWeight: 700,
                    color: T.TEXT,
                    lineHeight: 1.3,
                }}
            >
                {stageName}
            </div>
            <div
                style={{
                    marginTop: 4,
                    marginBottom: 10,
                    fontSize: TYPE.CAPTION,
                    color: T.TEXT_MUTED,
                    lineHeight: 1.3,
                }}
            >
                {requirementsLabel}
            </div>
            <RequirementConditionRows requirements={requirements} />
        </div>
    );
}

/** Ported from v2.2's Stepper card (deal-v2-2.jsx:1137-1189). */
export default function DealPipelineStepper({
    deal,
    permissions,
}: DealPipelineStepperProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const canChangeStages = hasAllPermission(permissions, "change_deal_stages");
    const pipeline = useDealPipeline(deal, canChangeStages);
    const stageRequirements = usePage<any>().props
        .stageAutomationRequirements as
        | Record<number, StageRequirementCondition[]>
        | undefined;
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;
    const [pendingStageId, setPendingStageId] = useState<number | null>(null);
    const [progressionOpen, setProgressionOpen] = useState(false);

    const currentIdx = pipeline.stages.findIndex(
        (stage) => stage.id === pipeline.currentStageId,
    );
    const dealLocked = isDealEffectivelyLocked(deal);
    const hasAnyRequirements = Object.values(stageRequirements ?? {}).some(
        (conditions) => !!conditions?.length,
    );

    const handleClick = (
        stage: (typeof pipeline.stages)[number],
        index: number,
    ) => {
        if (index === currentIdx || !canChangeStages || dealLocked) return;
        const isJump = Math.abs(index - currentIdx) > 1 || index < currentIdx;
        if (isJump) setPendingStageId(stage.id);
        else pipeline.updateStage(stage.id);
    };

    const pendingStage = pipeline.stages.find(
        (stage) => stage.id === pendingStageId,
    );

    return (
        <div
            data-tour={
                // Fallback tour target when no stage currently exposes an
                // info icon (deferred requirements not loaded yet, or none
                // configured). The first real icon steals this attribute.
                hasAnyRequirements ? undefined : "deal-stage-requirements"
            }
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 12,
                padding: "12px 16px",
            }}
        >
            <div
                className="dr-label"
                style={{
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                }}
            >
                {deal.pipeline?.name ? td(deal.pipeline.name) : t("app.menu.pipeline")}
                {pipeline.isUpdating && (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                        style={{ width: 10, height: 10, color: T.TEXT_MUTED }}
                    />
                )}
                <DealButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setProgressionOpen(true)}
                    icon={<DealIcon name="info" size={12} color="currentColor" />}
                    style={{ marginLeft: "auto", color: T.TEXT_MUTED }}
                    aria-label={t(
                        "pages.deals.header.pipeline.progression_open",
                    )}
                    data-tour="deal-stage-progression"
                >
                    {t("pages.deals.header.pipeline.progression_button")}
                </DealButton>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                {hasOverflow && (
                    <DealScrollArrow
                        dir="left"
                        enabled={scroll.overflow.left}
                        onClick={() => scroll.nudge(-1)}
                        label={t("pages.deals.header.pipeline.scroll_left")}
                    />
                )}
                <div
                    ref={scroll.ref}
                    onScroll={scroll.update}
                    className="dr-hscroll"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        flex: 1,
                        minWidth: 0,
                        overflowX: "auto",
                    }}
                >
                    {pipeline.stages.map((stage, index) => {
                        const isDone = index < currentIdx;
                        const isActive = index === currentIdx;
                        const accent = stage.label_color || T.BLUE;
                        const requirements = stageRequirements?.[stage.id];
                        const hasRequirements = !!requirements?.length;
                        const isTourTarget =
                            hasRequirements &&
                            !pipeline.stages
                                .slice(0, index)
                                .some((s) => !!stageRequirements?.[s.id]?.length);

                        const pillColor = isActive
                            ? "#ffffff"
                            : isDone
                              ? accent
                              : T.TEXT_MUTED;
                        const pillBackground = isActive
                            ? accent
                            : isDone
                              ? `${accent}22`
                              : T.BG;
                        const pillBorder = `1px solid ${
                            isActive || isDone ? accent : T.BORDER
                        }`;
                        const pillOpacity = pipeline.isUpdating
                            ? 0.6
                            : isDone
                              ? 0.45
                              : 1;

                        return (
                            <div
                                key={stage.id}
                                style={{ display: "flex", alignItems: "center" }}
                            >
                                <div
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: hasRequirements
                                            ? "5px 8px 5px 13px"
                                            : "7px 13px",
                                        borderRadius: 20,
                                        whiteSpace: "nowrap",
                                        minHeight: 28,
                                        opacity: pillOpacity,
                                        background: pillBackground,
                                        color: pillColor,
                                        border: pillBorder,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleClick(stage, index)}
                                        aria-current={isActive ? "step" : undefined}
                                        title={td(stage.name)}
                                        disabled={
                                            !canChangeStages ||
                                            dealLocked ||
                                            pipeline.isUpdating
                                        }
                                        style={{
                                            fontFamily: "inherit",
                                            fontSize: 12,
                                            padding: 0,
                                            margin: 0,
                                            border: "none",
                                            background: "transparent",
                                            color: "inherit",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            fontWeight: isActive ? 700 : 500,
                                            cursor:
                                                !canChangeStages ||
                                                dealLocked ||
                                                pipeline.isUpdating
                                                    ? "default"
                                                    : "pointer",
                                            lineHeight: 1,
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                display: "inline-block",
                                                flexShrink: 0,
                                                background: isActive
                                                    ? "#ffffff"
                                                    : isDone
                                                      ? accent
                                                      : T.BORDER,
                                            }}
                                        />
                                        {td(stage.name)}
                                    </button>
                                    {hasRequirements ? (
                                        <Popover
                                            trigger={["hover", "click"]}
                                            placement="bottomLeft"
                                            arrow={false}
                                            mouseEnterDelay={0.2}
                                            mouseLeaveDelay={0.15}
                                            styles={{
                                                body: {
                                                    padding: 12,
                                                    borderRadius: R.MD,
                                                    border: `1px solid ${T.BORDER}`,
                                                    boxShadow:
                                                        "0 8px 24px rgba(22, 41, 77, 0.12)",
                                                },
                                            }}
                                            content={
                                                <StageRequirementsPopup
                                                    stageName={td(stage.name)}
                                                    requirementsLabel={t(
                                                        "pages.deals.header.pipeline.requirements_label",
                                                    )}
                                                    requirements={requirements!}
                                                />
                                            }
                                        >
                                            <button
                                                type="button"
                                                data-tour={
                                                    isTourTarget
                                                        ? "deal-stage-requirements"
                                                        : undefined
                                                }
                                                aria-label={t(
                                                    "pages.deals.header.pipeline.requirements_open",
                                                )}
                                                style={{
                                                    fontFamily: "inherit",
                                                    width: 18,
                                                    height: 18,
                                                    padding: 0,
                                                    margin: 0,
                                                    borderRadius: "50%",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                    cursor: "pointer",
                                                    lineHeight: 0,
                                                    // Keep the icon darker than the stage
                                                    // chrome so it reads as a separate control.
                                                    background: isActive
                                                        ? T.WHITE
                                                        : T.SURFACE,
                                                    color: T.NAVY,
                                                    border: `1px solid ${
                                                        isActive
                                                            ? "rgba(255,255,255,0.7)"
                                                            : T.BORDER
                                                    }`,
                                                }}
                                            >
                                                <DealIcon
                                                    name="info"
                                                    size={12}
                                                    color="currentColor"
                                                />
                                            </button>
                                        </Popover>
                                    ) : null}
                                </div>
                                {index < pipeline.stages.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 12,
                                            height: 1,
                                            background: T.BORDER,
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                {hasOverflow && (
                    <DealScrollArrow
                        dir="right"
                        enabled={scroll.overflow.right}
                        onClick={() => scroll.nudge(1)}
                        label={t("pages.deals.header.pipeline.scroll_right")}
                    />
                )}
            </div>

            <DealConfirmDialog
                open={pendingStage != null}
                title={t("pages.deals.stage_jump_confirm_title")}
                message={t("pages.deals.stage_jump_confirm_message", {
                    stage: pendingStage ? td(pendingStage.name) : "",
                })}
                confirmLabel={t("pages.deals.stage_jump_confirm_action")}
                onCancel={() => setPendingStageId(null)}
                onConfirm={() => {
                    if (pendingStage) pipeline.updateStage(pendingStage.id);
                    setPendingStageId(null);
                }}
            />

            <DealModal
                open={progressionOpen}
                title={t("pages.deals.header.pipeline.progression_title")}
                onClose={() => setProgressionOpen(false)}
            >
                <p
                    style={{
                        margin: "0 0 16px",
                        fontSize: TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                    }}
                >
                    {t("pages.deals.header.pipeline.progression_intro")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {pipeline.stages.map((stage, index) => {
                        const isActive = stage.id === pipeline.currentStageId;
                        const accent = stage.label_color || T.BLUE;
                        const requirements = stageRequirements?.[stage.id] ?? [];
                        const hasRequirements = requirements.length > 0;

                        return (
                            <div
                                key={stage.id}
                                style={{
                                    border: `1px solid ${
                                        isActive ? accent : T.BORDER
                                    }`,
                                    borderRadius: R.MD,
                                    padding: 12,
                                    background: isActive
                                        ? `${accent}12`
                                        : T.SURFACE,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: hasRequirements ? 10 : 0,
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            flexShrink: 0,
                                            background: accent,
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: TYPE.BODY,
                                            fontWeight: 700,
                                            color: T.TEXT,
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {td(stage.name)}
                                    </span>
                                    {isActive ? (
                                        <span
                                            style={{
                                                marginLeft: "auto",
                                                fontSize: TYPE.CAPTION,
                                                fontWeight: 600,
                                                color: accent,
                                            }}
                                        >
                                            {t(
                                                "pages.deals.header.pipeline.progression_current",
                                            )}
                                        </span>
                                    ) : (
                                        <span
                                            style={{
                                                marginLeft: "auto",
                                                fontSize: TYPE.CAPTION,
                                                color: T.TEXT_HINT,
                                            }}
                                        >
                                            {t(
                                                "pages.deals.header.pipeline.progression_step",
                                                { n: index + 1 },
                                            )}
                                        </span>
                                    )}
                                </div>
                                {hasRequirements ? (
                                    <>
                                        <div
                                            style={{
                                                marginBottom: 8,
                                                fontSize: TYPE.CAPTION,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {t(
                                                "pages.deals.header.pipeline.requirements_label",
                                            )}
                                        </div>
                                        <RequirementConditionRows
                                            requirements={requirements}
                                        />
                                    </>
                                ) : (
                                    <div
                                        style={{
                                            fontSize: TYPE.CAPTION,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        {t(
                                            "pages.deals.header.pipeline.progression_none",
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DealModal>
        </div>
    );
}
