import { useState } from "react";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealPipeline from "../../hooks/useDealPipeline";
import useHScroll from "../../hooks/useHScroll";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealScrollArrow from "../primitives/DealScrollArrow";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealPipelineStepperProps {
    deal: Deal;
    permissions: Record<string, string>;
}

function hasAllPermission(permissions: Record<string, string>, key: string) {
    return permissions?.[key] === "all";
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
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;
    const [pendingStageId, setPendingStageId] = useState<number | null>(null);

    const currentIdx = pipeline.stages.findIndex(
        (stage) => stage.id === pipeline.currentStageId,
    );

    const handleClick = (
        stage: (typeof pipeline.stages)[number],
        index: number,
    ) => {
        if (index === currentIdx || !canChangeStages || deal.is_locked) return;
        const isJump = Math.abs(index - currentIdx) > 1 || index < currentIdx;
        if (isJump) setPendingStageId(stage.id);
        else pipeline.updateStage(stage.id);
    };

    const pendingStage = pipeline.stages.find(
        (stage) => stage.id === pendingStageId,
    );

    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 12,
                padding: "12px 16px",
            }}
        >
            <div
                className="dr-label"
                style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}
            >
                {deal.pipeline?.name ? td(deal.pipeline.name) : t("app.menu.pipeline")}
                {pipeline.isUpdating && (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-current border-t-transparent"
                        style={{ width: 10, height: 10, color: T.TEXT_MUTED }}
                    />
                )}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                {hasOverflow && (
                    <DealScrollArrow
                        dir="left"
                        enabled={scroll.overflow.left}
                        onClick={() => scroll.nudge(-1)}
                        label="Scroll pipeline stages left"
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
                        return (
                            <div
                                key={stage.id}
                                style={{ display: "flex", alignItems: "center" }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleClick(stage, index)}
                                    aria-current={isActive ? "step" : undefined}
                                    title={td(stage.name)}
                                    disabled={
                                        !canChangeStages ||
                                        deal.is_locked ||
                                        pipeline.isUpdating
                                    }
                                    style={{
                                        fontFamily: "inherit",
                                        fontSize: 12,
                                        padding: "7px 13px",
                                        borderRadius: 20,
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontWeight: isActive ? 700 : 500,
                                        opacity: pipeline.isUpdating ? 0.6 : 1,
                                        cursor:
                                            !canChangeStages ||
                                            deal.is_locked ||
                                            pipeline.isUpdating
                                                ? "default"
                                                : "pointer",
                                        minHeight: 30,
                                        background: isActive
                                            ? `${accent}59`
                                            : isDone
                                              ? `${accent}22`
                                              : T.BG,
                                        color:
                                            isActive || isDone ? T.TEXT : T.TEXT_MUTED,
                                        border: `1px solid ${
                                            isActive || isDone ? accent : T.BORDER
                                        }`,
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            display: "inline-block",
                                            background:
                                                isActive || isDone ? accent : T.BORDER,
                                        }}
                                    />
                                    {td(stage.name)}
                                </button>
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
                        label="Scroll pipeline stages right"
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
        </div>
    );
}
