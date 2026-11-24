import { useEffect, useMemo, useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import CollapsibleGroup from "@/Components/Redesign/primitives/CollapsibleGroup";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import ToggleField from "@/Components/Redesign/primitives/ToggleField";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { ApiSuccessResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import ScopePicker from "./components/ScopePicker";
import type {
    PipelineEditorPayload,
    PipelineOfferingType,
    PipelineStageRow,
} from "./types";

const DEFAULT_COLOR = "#0284C7";
const STAGE_ROW =
    "grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2 border-b last:border-b-0";

export default function PipelineEditModal({
    pipelineId,
    open,
    onClose,
    onSaved,
    onDeleted,
}: {
    pipelineId: number | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    const [name, setName] = useState("");
    const [labelColor, setLabelColor] = useState(DEFAULT_COLOR);
    const [offeringType, setOfferingType] =
        useState<PipelineOfferingType>("property");
    const [hideAllCategories, setHideAllCategories] = useState(false);
    const [hiddenFromNav, setHiddenFromNav] = useState(false);
    const [hiddenFromSystem, setHiddenFromSystem] = useState(false);
    const [pipelineCategoryIds, setPipelineCategoryIds] = useState<number[]>([]);
    const [stageCategoryIds, setStageCategoryIds] = useState<Record<string, number[]>>({});
    const [pipelineFieldKeys, setPipelineFieldKeys] = useState<string[]>([]);
    const [stageFieldKeys, setStageFieldKeys] = useState<Record<string, string[]>>({});
    const [stages, setStages] = useState<PipelineStageRow[]>([]);
    const [isDefault, setIsDefault] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [newStageName, setNewStageName] = useState("");
    const [newStageColor, setNewStageColor] = useState(DEFAULT_COLOR);
    const [editingStageId, setEditingStageId] = useState<number | null>(null);
    const [editStageName, setEditStageName] = useState("");
    const [editStageColor, setEditStageColor] = useState(DEFAULT_COLOR);
    const [pendingDeleteStageId, setPendingDeleteStageId] = useState<number | null>(null);
    const [pendingDeletePipeline, setPendingDeletePipeline] = useState(false);

    const editorQuery = useApiQuery<PipelineEditorPayload>({
        path: pipelineId && open ? route("lead-pipeline-setting.show", pipelineId) : "",
        options: { enabled: !!pipelineId && open, retry: false },
    });

    useEffect(() => {
        if (!open) {
            setDirty(false);
            setEditingStageId(null);
            setPendingDeleteStageId(null);
            setPendingDeletePipeline(false);
            setNewStageName("");
            return;
        }
        const data = editorQuery.data;
        if (!data || data.pipeline.id !== pipelineId) return;
        setName(data.pipeline.name);
        setLabelColor(data.pipeline.label_color || DEFAULT_COLOR);
        setOfferingType(
            data.pipeline.offering_type === "package" ||
                data.pipeline.offering_type === "both"
                ? data.pipeline.offering_type
                : "property",
        );
        setHideAllCategories(!!data.pipeline.hide_all_categories);
        setHiddenFromNav(!!data.pipeline.hidden_from_nav);
        setHiddenFromSystem(!!data.pipeline.hidden_from_system);
        setIsDefault(!!data.pipeline.default);
        setPipelineCategoryIds(data.category_scopes.__pipeline__ ?? []);
        setStageCategoryIds(data.category_scopes.stages ?? {});
        setPipelineFieldKeys(data.field_scopes.__pipeline__ ?? []);
        setStageFieldKeys(data.field_scopes.stages ?? {});
        setStages(data.stages ?? []);
        setDirty(false);
    }, [editorQuery.data, open, pipelineId]);

    const markDirty = () => setDirty(true);

    const saveMutation = useApiMutate<
        {
            name: string;
            label_color: string;
            offering_type: PipelineOfferingType;
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
            setDirty(false);
            onSaved();
            void editorQuery.refetch();
        },
    );

    const createStageMutation = useApiMutate<
        { name: string; label_color: string; pipeline: number[] },
        string,
        ApiSuccessResponse<string>
    >(route("lead-stage-setting.store"), "POST", () => {
        setNewStageName("");
        setNewStageColor(DEFAULT_COLOR);
        void editorQuery.refetch();
        onSaved();
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
        onSaved();
    });

    const deleteStagePath = pendingDeleteStageId
        ? route("lead-stage-setting.destroy", pendingDeleteStageId)
        : "";
    const deleteStageMutation = useApiMutate<
        Record<string, never>,
        string,
        ApiSuccessResponse<string>
    >(deleteStagePath, "DELETE", () => {
        setPendingDeleteStageId(null);
        void editorQuery.refetch();
        onSaved();
    });

    const deletePipelineMutation = useApiMutate<
        Record<string, never>,
        string,
        ApiSuccessResponse<string>
    >(pipelineId ? route("lead-pipeline-setting.destroy", pipelineId) : "", "DELETE", () => {
        setPendingDeletePipeline(false);
        onDeleted();
    });

    const categories = editorQuery.data?.categories ?? [];
    const fieldOptions = editorQuery.data?.field_options ?? [];
    const categoryItems = useMemo(
        () => categories.map((c) => ({ value: c.id, label: c.name })),
        [categories],
    );

    /** Flat field list with model prefix so one searchable picker covers everything. */
    const flatFieldItems = useMemo(
        () =>
            fieldOptions.flatMap((group) =>
                group.items.map((item) => ({
                    value: item.value,
                    label: `${group.label} · ${item.label}`,
                })),
            ),
        [fieldOptions],
    );

    const categorySelectedCount =
        pipelineCategoryIds.length +
        Object.values(stageCategoryIds).reduce((n, ids) => n + ids.length, 0);
    const fieldSelectedCount =
        pipelineFieldKeys.length +
        Object.values(stageFieldKeys).reduce((n, keys) => n + keys.length, 0);

    const handleSave = () => {
        if (!pipelineId || !name.trim()) return;
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
            offering_type: offeringType,
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

    const handleUpdateStage = () => {
        if (!pipelineId || !editingStageId) return;
        const stage = stages.find((s) => s.id === editingStageId);
        if (!stage || !editStageName.trim()) return;
        updateStageMutation.mutate({
            name: editStageName.trim(),
            label_color: editStageColor,
            pipeline: pipelineId,
            priority: stage.priority,
        });
    };

    const sectionLabel = {
        fontSize: 12,
        fontWeight: 600,
        color: T.TEXT_MUTED,
        lineHeight: 1.3,
    } as const;

    return (
        <>
            <Modal
                open={open && !!pipelineId}
                title={t("modules.deal.pipeline")}
                subtitle={editorQuery.data?.pipeline.name}
                onClose={onClose}
                dirty={dirty}
                maxWidth={640}
                fixedHeight={720}
                footer={
                    <>
                        {!isDefault && (
                            <Button
                                variant="ghost"
                                size="sm"
                                style={{ marginRight: "auto", color: T.RED }}
                                onClick={() => setPendingDeletePipeline(true)}
                            >
                                {t("app.delete")}
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            {t("app.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={
                                saveMutation.isPending || !name.trim() || editorQuery.isLoading
                            }
                            onClick={handleSave}
                        >
                            {saveMutation.isPending
                                ? td("Saving…", { source: "en" })
                                : t("app.save")}
                        </Button>
                    </>
                }
            >
                <div
                    style={{
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflowY: "auto",
                        padding: "18px 22px 20px",
                    }}
                >
                    {editorQuery.isLoading ? (
                        <div style={{ fontSize: 14, color: T.TEXT_MUTED }}>
                            {td("Loading…", { source: "en" })}
                        </div>
                    ) : editorQuery.isError || !editorQuery.data ? (
                        <div style={{ fontSize: 14, color: T.RED }}>
                            {td("Could not load pipeline. Close and try again.", {
                                source: "en",
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col" style={{ gap: 18 }}>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="flex flex-col gap-1.5">
                                    <span style={sectionLabel}>{t("app.name")}</span>
                                    <input
                                        className="dr-input"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            markDirty();
                                        }}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span style={sectionLabel}>
                                        {t("modules.tasks.labelColor")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={labelColor}
                                            onChange={(e) => {
                                                setLabelColor(e.target.value);
                                                markDirty();
                                            }}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                padding: 0,
                                                border: `1px solid ${T.BORDER}`,
                                                borderRadius: 8,
                                                background: T.WHITE,
                                                cursor: "pointer",
                                            }}
                                        />
                                        <input
                                            className="dr-input"
                                            value={labelColor}
                                            onChange={(e) => {
                                                setLabelColor(e.target.value);
                                                markDirty();
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>

                            <section>
                                <div style={{ ...sectionLabel, marginBottom: 8 }}>
                                    {t("modules.deal.pipelineOfferingType")}
                                </div>
                                <Segmented<PipelineOfferingType>
                                    value={offeringType}
                                    onChange={(next) => {
                                        setOfferingType(next);
                                        markDirty();
                                    }}
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
                                    {offeringType === "package"
                                        ? t("modules.deal.offeringTypePackageHint")
                                        : offeringType === "both"
                                          ? t("modules.deal.offeringTypeBothHint")
                                          : t("modules.deal.offeringTypePropertyHint")}
                                </p>
                            </section>

                            <section
                                style={{
                                    border: `1px solid ${T.BORDER_SOFT}`,
                                    borderRadius: 10,
                                    padding: "12px 14px",
                                    background: T.SURFACE_2,
                                }}
                            >
                                <div style={{ ...sectionLabel, marginBottom: 10 }}>
                                    {t("modules.deal.pipelineVisibility")}
                                </div>
                                <div className="flex flex-col gap-3">
                                    <ToggleField
                                        checked={hiddenFromNav}
                                        onChange={() => {
                                            if (isDefault) return;
                                            setHiddenFromNav((v) => !v);
                                            markDirty();
                                        }}
                                        disabled={isDefault}
                                        title={t("modules.deal.hideFromNav")}
                                        description={
                                            isDefault
                                                ? t(
                                                      "modules.deal.pipelineDefaultNavVisibilityHint",
                                                  )
                                                : t("modules.deal.hideFromNavHint")
                                        }
                                    />
                                    <ToggleField
                                        checked={hiddenFromSystem}
                                        onChange={() => {
                                            if (isDefault) return;
                                            setHiddenFromSystem((v) => !v);
                                            markDirty();
                                        }}
                                        disabled={isDefault}
                                        title={t("modules.deal.hideFromSystem")}
                                        description={
                                            isDefault
                                                ? t(
                                                      "modules.deal.pipelineDefaultSystemVisibilityHint",
                                                  )
                                                : t("modules.deal.hideFromSystemHint")
                                        }
                                    />
                                </div>
                            </section>

                            <section>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <div style={{ ...sectionLabel, marginBottom: 0 }}>
                                        {t("modules.deal.stages")}
                                    </div>
                                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                        {stages.length}
                                    </span>
                                </div>

                                <div
                                    className="overflow-hidden rounded-[10px] border"
                                    style={{ borderColor: T.BORDER }}
                                >
                                    {stages.length === 0 ? (
                                        <div
                                            style={{
                                                padding: "14px 12px",
                                                fontSize: 13,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {td("No stages yet — add the first one below.", {
                                                source: "en",
                                            })}
                                        </div>
                                    ) : (
                                        stages.map((stage) => (
                                            <div
                                                key={stage.id}
                                                className={STAGE_ROW}
                                                style={{
                                                    borderColor: T.BORDER_SOFT,
                                                    background:
                                                        editingStageId === stage.id
                                                            ? T.SURFACE_2
                                                            : T.SURFACE,
                                                }}
                                            >
                                                {editingStageId === stage.id ? (
                                                    <>
                                                        <input
                                                            type="color"
                                                            value={editStageColor}
                                                            onChange={(e) =>
                                                                setEditStageColor(e.target.value)
                                                            }
                                                            style={{
                                                                width: 20,
                                                                height: 20,
                                                                padding: 0,
                                                                border: "none",
                                                                background: "transparent",
                                                                cursor: "pointer",
                                                            }}
                                                        />
                                                        <input
                                                            className="dr-input"
                                                            value={editStageName}
                                                            autoFocus
                                                            onChange={(e) =>
                                                                setEditStageName(e.target.value)
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    handleUpdateStage();
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setEditingStageId(null);
                                                                }
                                                            }}
                                                        />
                                                        <span className="flex items-center gap-1">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                disabled={
                                                                    updateStageMutation.isPending ||
                                                                    !editStageName.trim()
                                                                }
                                                                onClick={handleUpdateStage}
                                                            >
                                                                {t("app.save")}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setEditingStageId(null)
                                                                }
                                                            >
                                                                {t("app.cancel")}
                                                            </Button>
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span
                                                            aria-hidden="true"
                                                            style={{
                                                                width: 10,
                                                                height: 10,
                                                                borderRadius: 999,
                                                                background:
                                                                    stage.label_color ||
                                                                    DEFAULT_COLOR,
                                                                justifySelf: "center",
                                                            }}
                                                        />
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <span
                                                                className="truncate text-sm font-medium"
                                                                style={{ color: T.TEXT }}
                                                                title={stage.name}
                                                            >
                                                                {stage.name}
                                                            </span>
                                                            {stage.default && (
                                                                <Badge variant="gray">
                                                                    {t("app.default")}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={
                                                                    <Icon name="edit" size={14} />
                                                                }
                                                                aria-label={t("app.edit")}
                                                                onClick={() => {
                                                                    setEditingStageId(stage.id);
                                                                    setEditStageName(stage.name);
                                                                    setEditStageColor(
                                                                        stage.label_color ||
                                                                            DEFAULT_COLOR,
                                                                    );
                                                                }}
                                                            />
                                                            {!stage.default && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={
                                                                        <Icon
                                                                            name="trash"
                                                                            size={14}
                                                                        />
                                                                    }
                                                                    aria-label={t("app.delete")}
                                                                    onClick={() =>
                                                                        setPendingDeleteStageId(
                                                                            stage.id,
                                                                        )
                                                                    }
                                                                />
                                                            )}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div
                                    className="mt-2.5 flex flex-wrap items-center gap-2"
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        border: `1px dashed ${T.BORDER}`,
                                        background: T.SURFACE_SUBTLE,
                                    }}
                                >
                                    <input
                                        type="color"
                                        value={newStageColor}
                                        onChange={(e) => setNewStageColor(e.target.value)}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            padding: 0,
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 6,
                                            background: T.WHITE,
                                            cursor: "pointer",
                                            flexShrink: 0,
                                        }}
                                        aria-label={t("modules.tasks.labelColor")}
                                    />
                                    <input
                                        className="dr-input"
                                        style={{ flex: 1, minWidth: 140 }}
                                        value={newStageName}
                                        placeholder={t("modules.deal.addStages")}
                                        onChange={(e) => setNewStageName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddStage();
                                        }}
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={<Icon name="plus" size={14} />}
                                        disabled={
                                            createStageMutation.isPending || !newStageName.trim()
                                        }
                                        onClick={handleAddStage}
                                    >
                                        {t("app.add")}
                                    </Button>
                                </div>
                            </section>

                            {(categories.length > 0 || fieldOptions.length > 0) && (
                                <div
                                    className="overflow-hidden rounded-[10px] border"
                                    style={{ borderColor: T.BORDER }}
                                >
                                    <div style={{ padding: "2px 14px 4px" }}>
                                        {categories.length > 0 && (
                                            <CollapsibleGroup
                                                title={t("app.menu.customFieldCategories")}
                                                summary={
                                                    hideAllCategories
                                                        ? t("modules.deal.hideAllCategories")
                                                        : t(
                                                              "modules.deal.pipelineScopeSelectedCount",
                                                              {
                                                                  count: String(
                                                                      categorySelectedCount,
                                                                  ),
                                                              },
                                                          )
                                                }
                                            >
                                                <div className="flex flex-col gap-3 pb-3">
                                                    <ToggleField
                                                        checked={hideAllCategories}
                                                        onChange={() => {
                                                            setHideAllCategories((v) => !v);
                                                            markDirty();
                                                        }}
                                                        title={t("modules.deal.hideAllCategories")}
                                                        description={t(
                                                            "modules.deal.hideAllCategoriesHint",
                                                        )}
                                                    />
                                                    <div
                                                        style={{
                                                            opacity: hideAllCategories ? 0.5 : 1,
                                                            pointerEvents: hideAllCategories
                                                                ? "none"
                                                                : undefined,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                ...sectionLabel,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            {t(
                                                                "modules.deal.pipelineWideCategories",
                                                            )}
                                                        </div>
                                                        <ScopePicker
                                                            items={categoryItems}
                                                            selected={pipelineCategoryIds}
                                                            onChange={(next) => {
                                                                setPipelineCategoryIds(
                                                                    next.map(Number),
                                                                );
                                                                markDirty();
                                                            }}
                                                            disabled={hideAllCategories}
                                                        />
                                                        <p
                                                            style={{
                                                                fontSize: 12,
                                                                color: T.TEXT_MUTED,
                                                                margin: "8px 0 0",
                                                                lineHeight: 1.45,
                                                            }}
                                                        >
                                                            {t("modules.deal.pipelineCategoryHint")}
                                                        </p>

                                                        {stages.length > 0 && (
                                                            <div style={{ marginTop: 12 }}>
                                                                <CollapsibleGroup
                                                                    title={t(
                                                                        "modules.deal.stageCategories",
                                                                    )}
                                                                    summary={`${stages.length}`}
                                                                >
                                                                    <div className="flex flex-col gap-3 pb-1">
                                                                        {stages.map((stage) => (
                                                                            <div key={stage.id}>
                                                                                <div
                                                                                    className="mb-1.5 flex items-center gap-2"
                                                                                    style={{
                                                                                        fontSize: 12,
                                                                                        fontWeight: 600,
                                                                                        color: T.TEXT,
                                                                                    }}
                                                                                >
                                                                                    <span
                                                                                        style={{
                                                                                            width: 8,
                                                                                            height: 8,
                                                                                            borderRadius: 999,
                                                                                            background:
                                                                                                stage.label_color ||
                                                                                                DEFAULT_COLOR,
                                                                                        }}
                                                                                    />
                                                                                    {stage.name}
                                                                                </div>
                                                                                <ScopePicker
                                                                                    items={
                                                                                        categoryItems
                                                                                    }
                                                                                    selected={
                                                                                        stageCategoryIds[
                                                                                            String(
                                                                                                stage.id,
                                                                                            )
                                                                                        ] ?? []
                                                                                    }
                                                                                    onChange={(
                                                                                        next,
                                                                                    ) => {
                                                                                        setStageCategoryIds(
                                                                                            (
                                                                                                prev,
                                                                                            ) => ({
                                                                                                ...prev,
                                                                                                [String(
                                                                                                    stage.id,
                                                                                                )]:
                                                                                                    next.map(
                                                                                                        Number,
                                                                                                    ),
                                                                                            }),
                                                                                        );
                                                                                        markDirty();
                                                                                    }}
                                                                                    disabled={
                                                                                        hideAllCategories
                                                                                    }
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </CollapsibleGroup>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CollapsibleGroup>
                                        )}

                                        {fieldOptions.length > 0 && (
                                            <CollapsibleGroup
                                                title={t("modules.deal.pipelineWideFields")}
                                                summary={t(
                                                    "modules.deal.pipelineScopeSelectedCount",
                                                    {
                                                        count: String(fieldSelectedCount),
                                                    },
                                                )}
                                            >
                                                <div className="flex flex-col gap-3 pb-3">
                                                    <div
                                                        style={{
                                                            ...sectionLabel,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        {t("modules.deal.pipelineWideFields")}
                                                    </div>
                                                    <ScopePicker
                                                        items={flatFieldItems}
                                                        selected={pipelineFieldKeys}
                                                        onChange={(next) => {
                                                            setPipelineFieldKeys(next.map(String));
                                                            markDirty();
                                                        }}
                                                        placeholder={t("app.search")}
                                                    />
                                                    <p
                                                        style={{
                                                            fontSize: 12,
                                                            color: T.TEXT_MUTED,
                                                            margin: 0,
                                                            lineHeight: 1.45,
                                                        }}
                                                    >
                                                        {t("modules.deal.pipelineFieldHint")}
                                                    </p>

                                                    {stages.length > 0 && (
                                                        <CollapsibleGroup
                                                            title={t("modules.deal.stageFields")}
                                                            summary={`${stages.length}`}
                                                        >
                                                            <div className="flex flex-col gap-3 pb-1">
                                                                {stages.map((stage) => (
                                                                    <div key={stage.id}>
                                                                        <div
                                                                            className="mb-1.5 flex items-center gap-2"
                                                                            style={{
                                                                                fontSize: 12,
                                                                                fontWeight: 600,
                                                                                color: T.TEXT,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    width: 8,
                                                                                    height: 8,
                                                                                    borderRadius: 999,
                                                                                    background:
                                                                                        stage.label_color ||
                                                                                        DEFAULT_COLOR,
                                                                                }}
                                                                            />
                                                                            {stage.name}
                                                                        </div>
                                                                        <ScopePicker
                                                                            items={flatFieldItems}
                                                                            selected={
                                                                                stageFieldKeys[
                                                                                    String(stage.id)
                                                                                ] ?? []
                                                                            }
                                                                            onChange={(next) => {
                                                                                setStageFieldKeys(
                                                                                    (prev) => ({
                                                                                        ...prev,
                                                                                        [String(
                                                                                            stage.id,
                                                                                        )]:
                                                                                            next.map(
                                                                                                String,
                                                                                            ),
                                                                                    }),
                                                                                );
                                                                                markDirty();
                                                                            }}
                                                                            placeholder={t(
                                                                                "app.search",
                                                                            )}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CollapsibleGroup>
                                                    )}
                                                </div>
                                            </CollapsibleGroup>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

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
        </>
    );
}
