import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import DragHandle from "./DragHandle";
import ScriptItemRow from "./ScriptItemRow";
import type { BuilderRow, BuilderSection } from "./types";

interface Props {
    sections: BuilderSection[];
    /** Section currently receiving click-to-add from the palette. */
    activeSectionKey: string | null;
    onSelectSection: (key: string) => void;
    onAddSection: () => void;
    onChangeSection: (key: string, patch: Partial<BuilderSection>) => void;
    onRemoveSection: (key: string) => void;
    onChangeRow: (sectionKey: string, rowKey: string, patch: Partial<BuilderRow>) => void;
    onRemoveRow: (sectionKey: string, rowKey: string) => void;
}

function SectionCard({
    section,
    isActive,
    collapsed,
    onToggleCollapsed,
    onSelect,
    onChange,
    onRemove,
    onChangeRow,
    onRemoveRow,
}: {
    section: BuilderSection;
    isActive: boolean;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    onSelect: () => void;
    onChange: (patch: Partial<BuilderSection>) => void;
    onRemove: () => void;
    onChangeRow: (rowKey: string, patch: Partial<BuilderRow>) => void;
    onRemoveRow: (rowKey: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `sec:${section.key}`,
        data: { kind: "section", sectionKey: section.key },
    });

    // Separate droppable so an empty section (and the area below its last row) is
    // still a valid drop target for palette items.
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `zone:${section.key}`,
        data: { kind: "zone", sectionKey: section.key },
        disabled: section.kind === "category",
    });

    const isCategory = section.kind === "category";

    return (
        <div
            ref={setNodeRef}
            onClick={onSelect}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
                border: `1px solid ${isActive && !isCategory ? T.BLUE : T.BORDER}`,
                borderRadius: 10,
                background: isCategory ? T.SURFACE_2 : T.WHITE,
                marginBottom: 12,
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: 10,
                    borderBottom: isCategory || collapsed ? "none" : `1px solid ${T.BORDER_SOFT}`,
                    background: isCategory ? T.SURFACE_2 : T.WHITE,
                }}
            >
                <DragHandle attributes={attributes} listeners={listeners} label="Drag to reorder section" />

                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleCollapsed(); }}
                    aria-expanded={!collapsed}
                    aria-label={`${collapsed ? "Expand" : "Collapse"} section ${section.title}`}
                    style={{ color: T.TEXT_HINT, background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
                >
                    <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={16} />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                    {collapsed ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isCategory && <Badge variant="gray">Field group</Badge>}
                            <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                                {section.title || "Untitled section"}
                            </span>
                            {!isCategory && (
                                <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                                    {section.rows.length} {section.rows.length === 1 ? "step" : "steps"}
                                </span>
                            )}
                        </div>
                    ) : isCategory ? (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Badge variant="gray">Field group</Badge>
                                <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT }}>
                                    {section.title}
                                </span>
                            </div>
                            <p style={{ fontSize: 13, color: T.TEXT_MUTED, margin: "6px 0 0" }}>
                                Shows every field in this category, in category order.
                            </p>
                        </>
                    ) : (
                        <>
                            <input
                                className="dr-input"
                                placeholder="Section title"
                                value={section.title}
                                onChange={(e) => onChange({ title: e.target.value })}
                                style={{ fontSize: 15, fontWeight: 600 }}
                            />
                            <input
                                className="dr-input"
                                placeholder="Short description (optional)"
                                value={section.description ?? ""}
                                onChange={(e) => onChange({ description: e.target.value || null })}
                                style={{ fontSize: 14, marginTop: 6 }}
                            />
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={`Remove section ${section.title}`}
                    style={{ color: T.TEXT_HINT, background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.RED)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.TEXT_HINT)}
                >
                    <Icon name="trash" size={16} />
                </button>
            </div>

            {/* Rows — category sections have none by definition */}
            {!isCategory && !collapsed && (
                <div
                    ref={setDropRef}
                    style={{
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        minHeight: 64,
                        background: isOver ? T.BLUE_LIGHT : "transparent",
                        transition: "background 120ms",
                    }}
                >
                    <SortableContext
                        items={section.rows.map((r) => `row:${r.key}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        {section.rows.map((row) => (
                            <ScriptItemRow
                                key={row.key}
                                row={row}
                                sectionKey={section.key}
                                onChange={(patch) => onChangeRow(row.key, patch)}
                                onRemove={() => onRemoveRow(row.key)}
                            />
                        ))}
                    </SortableContext>

                    {section.rows.length === 0 && (
                        <p
                            style={{
                                fontSize: 14,
                                color: T.TEXT_HINT,
                                fontStyle: "italic",
                                textAlign: "center",
                                margin: 0,
                                padding: "12px 0",
                            }}
                        >
                            Drag fields here, or click them in the palette.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ScriptCanvas({
    sections,
    activeSectionKey,
    onSelectSection,
    onAddSection,
    onChangeSection,
    onRemoveSection,
    onChangeRow,
    onRemoveRow,
}: Props) {
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

    const toggleCollapsed = (key: string) =>
        setCollapsedKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const allCollapsed = sections.length > 0 && sections.every((s) => collapsedKeys.has(s.key));

    return (
        <>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                }}
            >
                <h2 style={{ fontSize: 15, fontWeight: 600, color: T.TEXT, margin: 0 }}>
                    Sections
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {sections.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                setCollapsedKeys(allCollapsed ? new Set() : new Set(sections.map((s) => s.key)))
                            }
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 13,
                                color: T.TEXT_MUTED,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 4,
                            }}
                        >
                            <Icon name={allCollapsed ? "chevron-down" : "chevron-right"} size={14} />
                            {allCollapsed ? "Expand all" : "Collapse all"}
                        </button>
                    )}
                    <button type="button" className="dr-btn dr-btn-ghost" onClick={onAddSection}>
                        <Icon name="plus" size={14} />
                        Add section
                    </button>
                </div>
            </div>

            <SortableContext
                items={sections.map((s) => `sec:${s.key}`)}
                strategy={verticalListSortingStrategy}
            >
                {sections.map((section) => (
                    <SectionCard
                        key={section.key}
                        section={section}
                        isActive={section.key === activeSectionKey}
                        collapsed={collapsedKeys.has(section.key)}
                        onToggleCollapsed={() => toggleCollapsed(section.key)}
                        // Selecting is how you pick the target for palette clicks — a
                        // collapsed section would swallow the row it just received.
                        onSelect={() => {
                            setCollapsedKeys((prev) => {
                                if (!prev.has(section.key)) return prev;
                                const next = new Set(prev);
                                next.delete(section.key);
                                return next;
                            });
                            onSelectSection(section.key);
                        }}
                        onChange={(patch) => onChangeSection(section.key, patch)}
                        onRemove={() => onRemoveSection(section.key)}
                        onChangeRow={(rowKey, patch) => onChangeRow(section.key, rowKey, patch)}
                        onRemoveRow={(rowKey) => onRemoveRow(section.key, rowKey)}
                    />
                ))}
            </SortableContext>
        </>
    );
}
