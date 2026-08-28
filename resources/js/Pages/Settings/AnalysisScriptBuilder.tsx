import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import { ANALYSIS_FIELD_META } from "@/Pages/Deals/Redesign/config/analysisFieldMeta";
import type { AnalysisScriptItem } from "@/Pages/Deals/Redesign/components/analysis/types/analysisTypes";
import FieldPalette, {
    type PaletteCategory,
    type PaletteCustomField,
} from "./AnalysisScript/FieldPalette";
import ScriptCanvas from "./AnalysisScript/ScriptCanvas";
import {
    itemsToSections,
    makeKey,
    sectionsToItems,
    type BuilderRow,
    type BuilderSection,
} from "./AnalysisScript/types";

import "@/Components/Redesign/redesign.css";

interface Pipeline {
    id: number;
    name: string;
}

/** Stable identities so a not-yet-loaded query doesn't churn memos every render. */
const NO_PIPELINES: Pipeline[] = [];
const NO_FIELDS: PaletteCustomField[] = [];
const NO_CATEGORIES: PaletteCategory[] = [];

export default function AnalysisScriptBuilder({ pageTitle }: { pageTitle: string }) {
    const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
    const [sections, setSections] = useState<BuilderSection[]>([]);
    const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
    const [loadedPipelineId, setLoadedPipelineId] = useState<number | null>(null);
    const [justSaved, setJustSaved] = useState(false);
    /** Serialised payload as last loaded/saved, for the unsaved-changes guard. */
    const baselineRef = useRef("");
    const [pendingPipelineId, setPendingPipelineId] = useState<number | null>(null);

    const pipelinesQuery = useApiQuery<{ pipelines: Pipeline[] }>({
        path: route("pipeline.analysis-script.pipelines"),
    });
    const pipelines = pipelinesQuery.data?.pipelines ?? NO_PIPELINES;

    useEffect(() => {
        if (selectedPipelineId === null && pipelines.length > 0) {
            setSelectedPipelineId(pipelines[0].id);
        }
    }, [pipelines, selectedPipelineId]);

    const paletteQuery = useApiQuery<{ deal: PaletteCustomField[]; lead: PaletteCustomField[] }>({
        path: route("pipeline.analysis-script.palette-fields"),
    });
    const dealCustomFields = paletteQuery.data?.deal ?? NO_FIELDS;
    const leadCustomFields = paletteQuery.data?.lead ?? NO_FIELDS;

    const categoriesQuery = useApiQuery<{ categories: PaletteCategory[] }>({
        path: selectedPipelineId
            ? route("pipeline.analysis-script.categories", selectedPipelineId)
            : "",
        options: { enabled: !!selectedPipelineId },
    });
    const categories = categoriesQuery.data?.categories ?? NO_CATEGORIES;

    const scriptQuery = useApiQuery<{ items: AnalysisScriptItem[] }>({
        path: selectedPipelineId
            ? route("pipeline.analysis-script.show", selectedPipelineId)
            : "",
        options: { enabled: !!selectedPipelineId },
    });

    // Label lookup for saved items, which store only a type + key.
    const resolveLabel = useCallback(
        (item: AnalysisScriptItem): { label: string; context?: string | null } => {
            if (item.type === "custom_field_category") {
                return {
                    label:
                        categories.find((c) => String(c.id) === item.item_key)?.name ??
                        `Category #${item.item_key}`,
                };
            }
            if (item.type === "deal_custom_field" || item.type === "lead_custom_field") {
                const pool =
                    item.type === "deal_custom_field" ? dealCustomFields : leadCustomFields;
                const f = pool.find((x) => String(x.id) === item.item_key);
                return {
                    label: f?.label ?? `Field #${item.item_key}`,
                    context: f?.category_name ?? null,
                };
            }
            if (item.type === "question") return { label: "Question" };
            if (item.type === "instruction") return { label: "Instruction" };
            return { label: ANALYSIS_FIELD_META[item.item_key]?.label ?? item.item_key };
        },
        [categories, dealCustomFields, leadCustomFields],
    );

    // Build editable state once the script and both label sources have landed.
    useEffect(() => {
        if (!selectedPipelineId) return;
        if (loadedPipelineId === selectedPipelineId) return;
        if (!scriptQuery.data || !categoriesQuery.data || !paletteQuery.data) return;

        const next = itemsToSections(scriptQuery.data.items, resolveLabel);
        setSections(next);
        setActiveSectionKey(next.find((s) => s.kind === "custom")?.key ?? null);
        baselineRef.current = JSON.stringify(sectionsToItems(next));
        setLoadedPipelineId(selectedPipelineId);
    }, [
        selectedPipelineId,
        loadedPipelineId,
        scriptQuery.data,
        categoriesQuery.data,
        paletteQuery.data,
        resolveLabel,
    ]);

    // Read inside the save callback and the unload handler, both of which would
    // otherwise close over a stale `sections`.
    const sectionsRef = useRef(sections);
    sectionsRef.current = sections;

    const saveMutation = useApiMutate<
        { items: ReturnType<typeof sectionsToItems> },
        string,
        ApiSuccessResponse<string>
    >(
        selectedPipelineId
            ? route("pipeline.analysis-script.upsert", selectedPipelineId)
            : "",
        "PUT",
        () => {
            baselineRef.current = JSON.stringify(sectionsToItems(sectionsRef.current));
            setJustSaved(true);
            window.setTimeout(() => setJustSaved(false), 3000);
        },
    );

    const isDirty = useMemo(
        () => loadedPipelineId !== null && JSON.stringify(sectionsToItems(sections)) !== baselineRef.current,
        [sections, loadedPipelineId],
    );

    // Browser-level guard; the in-app pipeline switch is confirmed separately below.
    useEffect(() => {
        if (!isDirty) return undefined;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [isDirty]);

    /** Switching pipeline replaces the whole canvas — don't drop edits silently. */
    const requestPipelineChange = useCallback(
        (id: number) => {
            if (id === selectedPipelineId) return;
            if (isDirty) {
                setPendingPipelineId(id);
                return;
            }
            setSelectedPipelineId(id);
            setLoadedPipelineId(null);
        },
        [isDirty, selectedPipelineId],
    );

    // ── Mutators ──────────────────────────────────────────────────────────────

    const addSection = useCallback((): string => {
        const key = makeKey();
        setSections((prev) => [
            ...prev,
            { key, kind: "custom", title: "", description: null, categoryId: null, rows: [] },
        ]);
        setActiveSectionKey(key);
        return key;
    }, []);

    const addCategorySection = useCallback((category: PaletteCategory) => {
        setSections((prev) => [
            ...prev,
            {
                key: makeKey(),
                kind: "category",
                title: category.name,
                description: null,
                categoryId: category.id,
                rows: [],
            },
        ]);
    }, []);

    /** Click-to-add: lands in the selected section, creating one if there isn't any. */
    const addRow = useCallback(
        (row: BuilderRow) => {
            setSections((prev) => {
                const target =
                    prev.find((s) => s.key === activeSectionKey && s.kind === "custom") ??
                    [...prev].reverse().find((s) => s.kind === "custom");

                if (!target) {
                    const key = makeKey();
                    setActiveSectionKey(key);
                    return [
                        ...prev,
                        {
                            key,
                            kind: "custom" as const,
                            title: "",
                            description: null,
                            categoryId: null,
                            rows: [row],
                        },
                    ];
                }

                return prev.map((s) =>
                    s.key === target.key ? { ...s, rows: [...s.rows, row] } : s,
                );
            });
        },
        [activeSectionKey],
    );

    const changeSection = useCallback((key: string, patch: Partial<BuilderSection>) => {
        setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    }, []);

    const removeSection = useCallback((key: string) => {
        setSections((prev) => prev.filter((s) => s.key !== key));
    }, []);

    const changeRow = useCallback(
        (sectionKey: string, rowKey: string, patch: Partial<BuilderRow>) => {
            setSections((prev) =>
                prev.map((s) =>
                    s.key !== sectionKey
                        ? s
                        : {
                              ...s,
                              rows: s.rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)),
                          },
                ),
            );
        },
        [],
    );

    const removeRow = useCallback((sectionKey: string, rowKey: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.key !== sectionKey ? s : { ...s, rows: s.rows.filter((r) => r.key !== rowKey) },
            ),
        );
    }, []);

    // ── Drag ──────────────────────────────────────────────────────────────────

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
        if (!over) return;
        const a = active.data.current as any;
        const o = over.data.current as any;
        if (!a) return;

        setSections((prev) => {
            // Which section is being dropped into, and at which index
            const targetKey: string | undefined =
                o?.kind === "row" || o?.kind === "zone" || o?.kind === "section"
                    ? o.sectionKey
                    : undefined;
            const target = prev.find((s) => s.key === targetKey);

            if (a.kind === "section") {
                if (o?.kind !== "section" || a.sectionKey === o.sectionKey) return prev;
                const from = prev.findIndex((s) => s.key === a.sectionKey);
                const to = prev.findIndex((s) => s.key === o.sectionKey);
                if (from === -1 || to === -1) return prev;
                return arrayMove(prev, from, to);
            }

            // Category sections hold no rows of their own.
            if (!target || target.kind === "category") return prev;

            const insertAt =
                o?.kind === "row"
                    ? Math.max(0, target.rows.findIndex((r) => r.key === o.rowKey))
                    : target.rows.length;

            if (a.kind === "palette") {
                const row: BuilderRow = a.make();
                return prev.map((s) =>
                    s.key !== target.key
                        ? s
                        : { ...s, rows: [...s.rows.slice(0, insertAt), row, ...s.rows.slice(insertAt)] },
                );
            }

            if (a.kind === "row") {
                const source = prev.find((s) => s.key === a.sectionKey);
                if (!source) return prev;
                const moving = source.rows.find((r) => r.key === a.rowKey);
                if (!moving) return prev;

                if (source.key === target.key) {
                    const from = source.rows.findIndex((r) => r.key === a.rowKey);
                    if (from === -1 || from === insertAt) return prev;
                    return prev.map((s) =>
                        s.key !== source.key ? s : { ...s, rows: arrayMove(s.rows, from, insertAt) },
                    );
                }

                return prev.map((s) => {
                    if (s.key === source.key) {
                        return { ...s, rows: s.rows.filter((r) => r.key !== a.rowKey) };
                    }
                    if (s.key === target.key) {
                        return {
                            ...s,
                            rows: [...s.rows.slice(0, insertAt), moving, ...s.rows.slice(insertAt)],
                        };
                    }
                    return s;
                });
            }

            return prev;
        });
    }, []);

    const handleSave = () => {
        if (!selectedPipelineId) return;
        saveMutation.mutate(
            { items: sectionsToItems(sections) },
            { suppressSuccessToast: true },
        );
    };

    const stepCount = useMemo(
        () => sections.reduce((n, s) => n + (s.kind === "category" ? 1 : s.rows.length), 0),
        [sections],
    );

    const loading =
        scriptQuery.isLoading || categoriesQuery.isLoading || paletteQuery.isLoading;

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Settings", url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
            config={{ showTitle: true }}
        >
            <div className="flex flex-col gap-4 w-full max-w-[1536px] mx-auto">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                            Pipeline
                        </div>
                        <MenuSelect
                            value={selectedPipelineId}
                            options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                            onChange={(v) => requestPipelineChange(Number(v))}
                            placeholder={pipelinesQuery.isLoading ? "Loading…" : "Select a pipeline…"}
                            width={240}
                        />
                    </div>
                    {selectedPipelineId && (
                        <div className="flex items-center gap-3">
                            <span style={{ fontSize: 14, color: T.TEXT_MUTED }}>
                                {sections.length} section{sections.length === 1 ? "" : "s"} · {stepCount} step
                                {stepCount === 1 ? "" : "s"}
                            </span>
                            {justSaved && (
                                <span style={{ fontSize: 14, color: T.GREEN, fontWeight: 600 }}>✓ Saved</span>
                            )}
                            <button
                                type="button"
                                className="dr-btn dr-btn-navy"
                                disabled={saveMutation.isPending}
                                onClick={handleSave}
                            >
                                {saveMutation.isPending ? "Saving…" : "Save Analysis Script"}
                            </button>
                        </div>
                    )}
                </div>

                <p style={{ fontSize: 14, color: T.TEXT_MUTED, margin: 0 }}>
                    Build the call script as sections. Drag fields, questions and instructions from the
                    palette into a section, or add a field group to include a whole custom-field category.
                </p>

                {!selectedPipelineId ? (
                    <EmptyState
                        title="Select a pipeline"
                        description="Choose a pipeline above to edit its analysis script."
                    />
                ) : loading ? (
                    <div style={{ fontSize: 15, color: T.TEXT_MUTED }}>Loading…</div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
                                gap: 16,
                                alignItems: "start",
                            }}
                        >
                            <div style={{ position: "sticky", top: 16, height: "calc(100vh - 220px)" }}>
                                <FieldPalette
                                    dealCustomFields={dealCustomFields}
                                    leadCustomFields={leadCustomFields}
                                    categories={categories}
                                    loading={paletteQuery.isLoading}
                                    onAddRow={addRow}
                                    onAddSection={() => addSection()}
                                    onAddCategorySection={addCategorySection}
                                />
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <ScriptCanvas
                                    sections={sections}
                                    activeSectionKey={activeSectionKey}
                                    onSelectSection={setActiveSectionKey}
                                    onAddSection={() => addSection()}
                                    onChangeSection={changeSection}
                                    onRemoveSection={removeSection}
                                    onChangeRow={changeRow}
                                    onRemoveRow={removeRow}
                                />

                                {sections.length === 0 && (
                                    <EmptyState
                                        title="No sections yet"
                                        description="Add a section, then drag fields into it from the palette."
                                    />
                                )}
                            </div>
                        </div>
                    </DndContext>
                )}
            </div>
            <ConfirmDialog
                open={pendingPipelineId !== null}
                title="Discard unsaved changes?"
                message="This script has edits you haven't saved. Switching pipeline will discard them."
                confirmLabel="Discard and switch"
                cancelLabel="Keep editing"
                danger
                onConfirm={() => {
                    setSelectedPipelineId(pendingPipelineId);
                    setLoadedPipelineId(null);
                    setPendingPipelineId(null);
                }}
                onCancel={() => setPendingPipelineId(null)}
            />
        </PageLayout>
    );
}

AnalysisScriptBuilder.layout = (page: React.ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
