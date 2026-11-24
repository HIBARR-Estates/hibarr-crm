import React, { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import ChipToggle from "@/Components/Redesign/primitives/ChipToggle";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import ToggleField from "@/Components/Redesign/primitives/ToggleField";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface PipelineStageRow {
    id: number;
    name: string;
    label_color: string;
    priority: number;
    default: boolean;
}

interface CategoryOption {
    id: number;
    name: string;
}

interface FieldOptionGroup {
    model: string;
    label: string;
    items: Array<{ value: string; label: string }>;
}

interface PipelineEditorPayload {
    pipeline: {
        id: number;
        name: string;
        label_color: string;
        default: boolean;
        hidden_from_nav: boolean;
        hidden_from_system: boolean;
        hide_all_categories: boolean;
    };
    stages: PipelineStageRow[];
    categories: CategoryOption[];
    category_scopes: {
        __pipeline__: number[];
        stages: Record<string, number[]>;
    };
    field_scopes: {
        __pipeline__: string[];
        stages: Record<string, string[]>;
    };
    field_options: FieldOptionGroup[];
}

interface Props {
    pipelineId: number | null;
    pipelineName?: string;
    onPipelineUpdated?: () => void;
}

const DEFAULT_STAGE_COLOR = "#0284C7";

function ScopeChipGroup({
    items,
    selected,
    onChange,
    disabled,
}: {
    items: Array<{ value: string | number; label: string }>;
    selected: Array<string | number>;
    onChange: (next: Array<string | number>) => void;
    disabled?: boolean;
}) {
    const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

    if (!items.length) {
        return <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>—</div>;
    }

    return (
        <div
            className="flex flex-wrap gap-2"
            style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : undefined }}
        >
            {items.map((item) => {
                const key = String(item.value);
                const active = selectedSet.has(key);
                return (
                    <ChipToggle
                        key={key}
                        active={active}
                        shape="pill"
                        onClick={() => {
                            if (active) {
                                onChange(selected.filter((v) => String(v) !== key));
                            } else {
                                onChange([...selected, item.value]);
                            }
                        }}
                    >
                        {item.label}
                    </ChipToggle>
                );
            })}
        </div>
    );
}

export default function PipelineManagementPanel({
    pipelineId,
    pipelineName,
    onPipelineUpdated,
}: Props) {
    const { t } = useTranslation();
    const { td } = useTd();

    const [name, setName] = useState("");
    const [labelColor, setLabelColor] = useState("#0284C7");
    const [hideAllCategories, setHideAllCategories] = useState(false);
    const [hiddenFromNav, setHiddenFromNav] = useState(false);
    const [hiddenFromSystem, setHiddenFromSystem] = useState(false);
    const [pipelineCategoryIds, setPipelineCategoryIds] = useState<number[]>([]);
    const [stageCategoryIds, setStageCategoryIds] = useState<Record<string, number[]>>({});
    const [pipelineFieldKeys, setPipelineFieldKeys] = useState<string[]>([]);
    const [stageFieldKeys, setStageFieldKeys] = useState<Record<string, string[]>>({});
    const [stages, setStages] = useState<PipelineStageRow[]>([]);
    const [isDefault, setIsDefault] = useState(false);

    const [newStageName, setNewStageName] = useState("");
    const [newStageColor, setNewStageColor] = useState(DEFAULT_STAGE_COLOR);
    const [editingStageId, setEditingStageId] = useState<number | null>(null);
    const [editStageName, setEditStageName] = useState("");
    const [editStageColor, setEditStageColor] = useState(DEFAULT_STAGE_COLOR);
    const [pendingDeleteStageId, setPendingDeleteStageId] = useState<number | null>(null);
    const [pendingDeletePipeline, setPendingDeletePipeline] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const editorQuery = useApiQuery<PipelineEditorPayload>({
        path: pipelineId ? route("lead-pipeline-setting.show", pipelineId) : "",
        options: { enabled: !!pipelineId },
    });

    useEffect(() => {
        const data = editorQuery.data;
        if (!data) return;
        setName(data.pipeline.name);
        setLabelColor(data.pipeline.label_color || "#0284C7");
        setHideAllCategories(!!data.pipeline.hide_all_categories);
        setHiddenFromNav(!!data.pipeline.hidden_from_nav);
        setHiddenFromSystem(!!data.pipeline.hidden_from_system);
        setIsDefault(!!data.pipeline.default);
        setPipelineCategoryIds(data.category_scopes.__pipeline__ ?? []);
        setStageCategoryIds(data.category_scopes.stages ?? {});
        setPipelineFieldKeys(data.field_scopes.__pipeline__ ?? []);
        setStageFieldKeys(data.field_scopes.stages ?? {});
        setStages(data.stages ?? []);
        setJustSaved(false);
    }, [editorQuery.data]);

    const saveMutation = useApiMutate<
        {
            name: string;
            label_color: string;
            hide_all_categories: boolean;
            hidden_from_nav: boolean;
            hidden_from_system: boolean;
            category_scopes: Record<string, number[]>;
            field_scopes: Record<string, string[]>;
        },
        string,
        ApiSuccessResponse<string>
    >(
        pipelineId ? route("lead-pipeline-setting.update", pipelineId) : "",
        "PUT",
        () => {
            setJustSaved(true);
            onPipelineUpdated?.();
            void editorQuery.refetch();
            window.setTimeout(() => setJustSaved(false), 2000);
        },
    );

    const createStageMutation = useApiMutate<
        { name: string; label_color: string; pipeline: number[] },
        string,
        ApiSuccessResponse<string>
    >(route("lead-stage-setting.store"), "POST", () => {
        setNewStageName("");
        setNewStageColor(DEFAULT_STAGE_COLOR);
        void editorQuery.refetch();
    });

    const updateStagePath = editingStageId
        ? route("lead-stage-setting.update", editingStageId)
        : "";
    const updateStageMutation = useApiMutate<
        { name: string; label_color: string; pipeline: number; priority: number },
        string,
        ApiSuccessResponse<string>
    >(updateStagePath, "PUT", () => {
        setEditingStageId(null);
        void editorQuery.refetch();
    });

    const deleteStagePath = pendingDeleteStageId
        ? route("lead-stage-setting.destroy", pendingDeleteStageId)
        : "";
    const deleteStageMutation = useApiMutate<Record<string, never>, string, ApiSuccessResponse<string>>(
        deleteStagePath,
        "DELETE",
        () => {
            setPendingDeleteStageId(null);
            void editorQuery.refetch();
        },
    );

    const deletePipelineMutation = useApiMutate<
        Record<string, never>,
        string,
        ApiSuccessResponse<string>
    >(pipelineId ? route("lead-pipeline-setting.destroy", pipelineId) : "", "DELETE", () => {
        setPendingDeletePipeline(false);
        onPipelineUpdated?.();
    });

    const categories = editorQuery.data?.categories ?? [];
    const fieldOptions = editorQuery.data?.field_options ?? [];

    const categoryItems = useMemo(
        () => categories.map((c) => ({ value: c.id, label: c.name })),
        [categories],
    );

    const handleSave = () => {
        if (!pipelineId) return;

        const category_scopes: Record<string, number[]> = {
            __pipeline__: pipelineCategoryIds,
        };
        for (const stage of stages) {
            category_scopes[String(stage.id)] = stageCategoryIds[String(stage.id)] ?? [];
        }

        const field_scopes: Record<string, string[]> = {
            __pipeline__: pipelineFieldKeys,
        };
        for (const stage of stages) {
            field_scopes[String(stage.id)] = stageFieldKeys[String(stage.id)] ?? [];
        }

        saveMutation.mutate({
            name: name.trim(),
            label_color: labelColor,
            hide_all_categories: hideAllCategories,
            hidden_from_nav: hiddenFromNav,
            hidden_from_system: hiddenFromSystem,
            category_scopes,
            field_scopes,
        });
    };

    const handleAddStage = () => {
        if (!pipelineId || !newStageName.trim()) return;
        createStageMutation.mutate({
            name: newStageName.trim(),
            label_color: newStageColor,
            pipeline: [pipelineId],
        });
    };

    const startEditStage = (stage: PipelineStageRow) => {
        setEditingStageId(stage.id);
        setEditStageName(stage.name);
        setEditStageColor(stage.label_color || DEFAULT_STAGE_COLOR);
    };

    const handleUpdateStage = () => {
        if (!pipelineId || !editingStageId) return;
        const stage = stages.find((s) => s.id === editingStageId);
        if (!stage) return;
        updateStageMutation.mutate({
            name: editStageName.trim(),
            label_color: editStageColor,
            pipeline: pipelineId,
            priority: stage.priority,
        });
    };

    if (!pipelineId) {
        return (
            <EmptyState
                title={t("modules.deal.selectPipeline")}
                description={t("modules.deal.selectPipelineHint")}
            />
        );
    }

    if (editorQuery.isLoading) {
        return (
            <div style={{ fontSize: 15, color: T.TEXT_MUTED }}>{td("Loading…", { source: "en" })}</div>
        );
    }

    if (editorQuery.isError || !editorQuery.data) {
        return (
            <EmptyState
                title={td("Could not load pipeline", { source: "en" })}
                description={td("Refresh the page and try again.", { source: "en" })}
            />
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.TEXT }}>
                        {pipelineName || name}
                    </div>
                    <div style={{ fontSize: 13, color: T.TEXT_MUTED, marginTop: 2 }}>
                        {t("modules.deal.pipelineManagementHint")}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {justSaved && (
                        <span style={{ fontSize: 14, color: T.GREEN, fontWeight: 600 }}>
                            {td("✓ Saved", { source: "en" })}
                        </span>
                    )}
                    {!isDefault && (
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            style={{ color: T.RED }}
                            onClick={() => setPendingDeletePipeline(true)}
                        >
                            {t("app.delete")}
                        </button>
                    )}
                    <button
                        type="button"
                        className="dr-btn dr-btn-navy"
                        disabled={saveMutation.isPending || !name.trim()}
                        onClick={handleSave}
                    >
                        {saveMutation.isPending ? td("Saving…", { source: "en" }) : t("app.save")}
                    </button>
                </div>
            </div>

            <section
                className="flex flex-col gap-4"
                style={{
                    background: T.WHITE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.TEXT }}>{t("app.details")}</div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT_MUTED }}>
                            {t("app.name")}
                        </span>
                        <input
                            className="dr-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT_MUTED }}>
                            {t("modules.tasks.labelColor")}
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={labelColor}
                                onChange={(e) => setLabelColor(e.target.value)}
                                style={{
                                    width: 40,
                                    height: 36,
                                    border: "none",
                                    background: "transparent",
                                }}
                            />
                            <input
                                className="dr-input"
                                value={labelColor}
                                onChange={(e) => setLabelColor(e.target.value)}
                            />
                        </div>
                    </label>
                </div>
            </section>

            <section
                className="flex flex-col gap-4"
                style={{
                    background: T.WHITE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                    {t("modules.deal.pipelineVisibility")}
                </div>
                <ToggleField
                    checked={hiddenFromNav}
                    onChange={() => !isDefault && setHiddenFromNav((v) => !v)}
                    disabled={isDefault}
                    title={t("modules.deal.hideFromNav")}
                    description={
                        isDefault
                            ? t("modules.deal.pipelineDefaultNavVisibilityHint")
                            : t("modules.deal.hideFromNavHint")
                    }
                />
                <ToggleField
                    checked={hiddenFromSystem}
                    onChange={() => !isDefault && setHiddenFromSystem((v) => !v)}
                    disabled={isDefault}
                    title={t("modules.deal.hideFromSystem")}
                    description={
                        isDefault
                            ? t("modules.deal.pipelineDefaultSystemVisibilityHint")
                            : t("modules.deal.hideFromSystemHint")
                    }
                />
            </section>

            <section
                className="flex flex-col gap-4"
                style={{
                    background: T.WHITE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                    {t("modules.deal.stages")}
                </div>

                <div className="flex flex-col gap-2">
                    {stages.map((stage) => (
                        <div
                            key={stage.id}
                            className="flex flex-wrap items-center gap-3"
                            style={{
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                padding: "10px 12px",
                            }}
                        >
                            {editingStageId === stage.id ? (
                                <>
                                    <input
                                        type="color"
                                        value={editStageColor}
                                        onChange={(e) => setEditStageColor(e.target.value)}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            border: "none",
                                            background: "transparent",
                                        }}
                                    />
                                    <input
                                        className="dr-input"
                                        style={{ flex: 1, minWidth: 140 }}
                                        value={editStageName}
                                        onChange={(e) => setEditStageName(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-navy"
                                        disabled={
                                            updateStageMutation.isPending || !editStageName.trim()
                                        }
                                        onClick={handleUpdateStage}
                                    >
                                        {t("app.save")}
                                    </button>
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost"
                                        onClick={() => setEditingStageId(null)}
                                    >
                                        {t("app.cancel")}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: 999,
                                            background: stage.label_color || DEFAULT_STAGE_COLOR,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: T.TEXT,
                                        }}
                                    >
                                        {stage.name}
                                        {stage.default ? (
                                            <span
                                                style={{
                                                    marginLeft: 8,
                                                    fontSize: 12,
                                                    color: T.TEXT_MUTED,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                ({t("app.default")})
                                            </span>
                                        ) : null}
                                    </span>
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost"
                                        onClick={() => startEditStage(stage)}
                                    >
                                        {t("app.edit")}
                                    </button>
                                    {!stage.default && (
                                        <button
                                            type="button"
                                            className="dr-btn dr-btn-ghost"
                                            style={{ color: T.RED }}
                                            onClick={() => setPendingDeleteStageId(stage.id)}
                                        >
                                            {t("app.delete")}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div
                    className="flex flex-wrap items-end gap-2"
                    style={{ borderTop: `1px solid ${T.BORDER}`, paddingTop: 12 }}
                >
                    <label className="flex flex-col gap-1" style={{ flex: 1, minWidth: 160 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                            {t("modules.deal.addStages")}
                        </span>
                        <input
                            className="dr-input"
                            value={newStageName}
                            placeholder={t("app.name")}
                            onChange={(e) => setNewStageName(e.target.value)}
                        />
                    </label>
                    <input
                        type="color"
                        value={newStageColor}
                        onChange={(e) => setNewStageColor(e.target.value)}
                        style={{ width: 36, height: 36, border: "none", background: "transparent" }}
                    />
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost"
                        disabled={createStageMutation.isPending || !newStageName.trim()}
                        onClick={handleAddStage}
                    >
                        {t("app.add")}
                    </button>
                </div>
            </section>

            {categories.length > 0 && (
                <section
                    className="flex flex-col gap-4"
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                        {t("app.menu.customFieldCategories")}
                    </div>
                    <ToggleField
                        checked={hideAllCategories}
                        onChange={() => setHideAllCategories((v) => !v)}
                        title={t("modules.deal.hideAllCategories")}
                        description={t("modules.deal.hideAllCategoriesHint")}
                    />
                    <div
                        style={{
                            opacity: hideAllCategories ? 0.5 : 1,
                            pointerEvents: hideAllCategories ? "none" : undefined,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: T.TEXT_MUTED,
                                marginBottom: 8,
                            }}
                        >
                            {t("modules.deal.pipelineWideCategories")}
                        </div>
                        <ScopeChipGroup
                            items={categoryItems}
                            selected={pipelineCategoryIds}
                            onChange={(next) => setPipelineCategoryIds(next.map(Number))}
                            disabled={hideAllCategories}
                        />
                        <p style={{ fontSize: 12, color: T.TEXT_MUTED, marginTop: 8 }}>
                            {t("modules.deal.pipelineCategoryHint")}
                        </p>

                        {stages.map((stage) => (
                            <div key={stage.id} style={{ marginTop: 16 }}>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: T.TEXT_MUTED,
                                        marginBottom: 8,
                                    }}
                                >
                                    {t("modules.deal.stageCategories")}:{" "}
                                    <span style={{ color: stage.label_color || T.TEXT }}>
                                        {stage.name}
                                    </span>
                                </div>
                                <ScopeChipGroup
                                    items={categoryItems}
                                    selected={stageCategoryIds[String(stage.id)] ?? []}
                                    onChange={(next) =>
                                        setStageCategoryIds((prev) => ({
                                            ...prev,
                                            [String(stage.id)]: next.map(Number),
                                        }))
                                    }
                                    disabled={hideAllCategories}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {fieldOptions.length > 0 && (
                <section
                    className="flex flex-col gap-4"
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                        {t("modules.deal.pipelineWideFields")}
                    </div>
                    {fieldOptions.map((group) => (
                        <div key={group.model}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.TEXT_MUTED,
                                    marginBottom: 8,
                                }}
                            >
                                {group.label}
                            </div>
                            <ScopeChipGroup
                                items={group.items}
                                selected={pipelineFieldKeys}
                                onChange={(next) => setPipelineFieldKeys(next.map(String))}
                            />
                        </div>
                    ))}
                    <p style={{ fontSize: 12, color: T.TEXT_MUTED, margin: 0 }}>
                        {t("modules.deal.pipelineFieldHint")}
                    </p>

                    {stages.map((stage) => (
                        <div key={stage.id} style={{ marginTop: 8 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.TEXT_MUTED,
                                    marginBottom: 8,
                                }}
                            >
                                {t("modules.deal.stageFields")}:{" "}
                                <span style={{ color: stage.label_color || T.TEXT }}>
                                    {stage.name}
                                </span>
                            </div>
                            {fieldOptions.map((group) => (
                                <div key={`${stage.id}-${group.model}`} style={{ marginBottom: 10 }}>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: T.TEXT_MUTED,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {group.label}
                                    </div>
                                    <ScopeChipGroup
                                        items={group.items}
                                        selected={stageFieldKeys[String(stage.id)] ?? []}
                                        onChange={(next) =>
                                            setStageFieldKeys((prev) => ({
                                                ...prev,
                                                [String(stage.id)]: next.map(String),
                                            }))
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </section>
            )}

            <ConfirmDialog
                open={pendingDeleteStageId !== null}
                title={td("Delete this stage?", { source: "en" })}
                message={td(
                    "Deals on this stage may need to be moved. This cannot be undone.",
                    { source: "en" },
                )}
                confirmLabel={t("app.delete")}
                cancelLabel={t("app.cancel")}
                danger
                onConfirm={() => deleteStageMutation.mutate({})}
                onCancel={() => setPendingDeleteStageId(null)}
            />
            <ConfirmDialog
                open={pendingDeletePipeline}
                title={td("Delete this pipeline?", { source: "en" })}
                message={td(
                    "Unlocked deals and all stages in this pipeline will be removed.",
                    { source: "en" },
                )}
                confirmLabel={t("app.delete")}
                cancelLabel={t("app.cancel")}
                danger
                onConfirm={() => deletePipelineMutation.mutate({})}
                onCancel={() => setPendingDeletePipeline(false)}
            />
        </div>
    );
}
