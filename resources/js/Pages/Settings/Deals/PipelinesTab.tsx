import { useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import PipelineEditModal from "./PipelineEditModal";
import type { DealPipelineRow, PipelineOfferingType } from "./types";

const DEFAULT_COLOR = "#0284C7";
const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-3 border-b last:border-b-0";

export default function PipelinesTab({
    pipelines,
    loading,
    onRefresh,
}: {
    pipelines: DealPipelineRow[];
    loading: boolean;
    onRefresh: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    const [editId, setEditId] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR);
    const [createOffering, setCreateOffering] =
        useState<PipelineOfferingType>("property");

    const createMutation = useApiMutate<
        { name: string; label_color: string; offering_type: PipelineOfferingType },
        string,
        ApiSuccessResponse<string>
    >(route("lead-pipeline-setting.store"), "POST", () => {
        setCreateOpen(false);
        setCreateName("");
        setCreateColor(DEFAULT_COLOR);
        setCreateOffering("property");
        onRefresh();
    });

    const closeCreate = () => {
        setCreateOpen(false);
        setCreateName("");
        setCreateColor(DEFAULT_COLOR);
        setCreateOffering("property");
    };

    const handleCreate = () => {
        if (!createName.trim()) return;
        createMutation.mutate({
            name: createName.trim(),
            label_color: createColor,
            offering_type: createOffering,
        });
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 16,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                        flex: "1 1 220px",
                    }}
                >
                    {t("modules.deal.pipelinesTabIntro")}
                </p>
                {pipelines.length > 0 && (
                    <Button
                        variant="primary"
                        size="sm"
                        icon={<Icon name="plus" size={14} />}
                        onClick={() => setCreateOpen(true)}
                    >
                        {t("modules.deal.addPipeline")}
                    </Button>
                )}
            </div>

            {loading ? (
                <div style={{ fontSize: 14, color: T.TEXT_MUTED }}>{td("Loading…", { source: "en" })}</div>
            ) : pipelines.length === 0 ? (
                <EmptyState
                    icon="list"
                    title={t("modules.deal.noPipelinesTitle")}
                    description={t("modules.deal.noPipelinesDescription")}
                    action={{
                        label: t("modules.deal.addPipeline"),
                        onClick: () => setCreateOpen(true),
                    }}
                />
            ) : (
                <div
                    className="overflow-hidden rounded-[10px] border"
                    style={{ borderColor: T.BORDER }}
                >
                    {pipelines.map((pipeline) => (
                        <div
                            key={pipeline.id}
                            className={ROW_GRID}
                            style={{
                                borderColor: T.BORDER_SOFT,
                                background: T.SURFACE,
                            }}
                        >
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 999,
                                            background: pipeline.label_color || DEFAULT_COLOR,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span
                                        className="min-w-0 truncate text-sm font-medium"
                                        style={{ color: T.TEXT }}
                                        title={pipeline.name}
                                    >
                                        {pipeline.name}
                                    </span>
                                    {pipeline.default && (
                                        <Badge variant="gray">{t("app.default")}</Badge>
                                    )}
                                    <Badge variant="blue">
                                        {pipeline.offering_type === "package"
                                            ? t("modules.deal.offeringTypePackage")
                                            : pipeline.offering_type === "both"
                                              ? t("modules.deal.offeringTypeBoth")
                                              : t("modules.deal.offeringTypeProperty")}
                                    </Badge>
                                </div>
                                <div
                                    className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    <span>
                                        {pipeline.stages_count === 1
                                            ? t("modules.deal.stageCountOne")
                                            : t("modules.deal.stageCountMany", {
                                                  count: String(pipeline.stages_count),
                                              })}
                                    </span>
                                    {pipeline.hidden_from_nav && (
                                        <span>· {t("modules.deal.hideFromNav")}</span>
                                    )}
                                    {pipeline.hidden_from_system && (
                                        <span>· {t("modules.deal.hideFromSystem")}</span>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="edit" size={14} />}
                                aria-label={t("app.edit")}
                                onClick={() => setEditId(pipeline.id)}
                            >
                                {t("app.edit")}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <PipelineEditModal
                pipelineId={editId}
                open={editId !== null}
                onClose={() => setEditId(null)}
                onSaved={onRefresh}
                onDeleted={() => {
                    setEditId(null);
                    onRefresh();
                }}
            />

            <Modal
                open={createOpen}
                title={t("modules.deal.addPipeline")}
                onClose={closeCreate}
                maxWidth={440}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={closeCreate}>
                            {t("app.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={createMutation.isPending || !createName.trim()}
                            onClick={handleCreate}
                        >
                            {createMutation.isPending
                                ? td("Saving…", { source: "en" })
                                : t("app.save")}
                        </Button>
                    </>
                }
            >
                <ModalField label={t("app.name")}>
                    <input
                        className="dr-input"
                        value={createName}
                        autoFocus
                        onChange={(e) => setCreateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreate();
                        }}
                    />
                </ModalField>
                <ModalField label={t("modules.tasks.labelColor")}>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={createColor}
                            onChange={(e) => setCreateColor(e.target.value)}
                            style={{
                                width: 40,
                                height: 36,
                                border: "none",
                                background: "transparent",
                            }}
                        />
                        <input
                            className="dr-input"
                            value={createColor}
                            onChange={(e) => setCreateColor(e.target.value)}
                        />
                    </div>
                </ModalField>
                <ModalField label={t("modules.deal.pipelineOfferingType")}>
                    <Segmented<PipelineOfferingType>
                        value={createOffering}
                        onChange={setCreateOffering}
                        fullWidth
                        ariaLabel={t("modules.deal.pipelineOfferingType")}
                        options={[
                            {
                                value: "property",
                                label: t("modules.deal.offeringTypeProperty"),
                            },
                            {
                                value: "package",
                                label: t("modules.deal.offeringTypePackage"),
                            },
                            {
                                value: "both",
                                label: t("modules.deal.offeringTypeBoth"),
                            },
                        ]}
                    />
                    <p
                        style={{
                            margin: "8px 0 0",
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                        }}
                    >
                        {createOffering === "package"
                            ? t("modules.deal.offeringTypePackageHint")
                            : createOffering === "both"
                              ? t("modules.deal.offeringTypeBothHint")
                              : t("modules.deal.offeringTypePropertyHint")}
                    </p>
                </ModalField>
            </Modal>
        </div>
    );
}
