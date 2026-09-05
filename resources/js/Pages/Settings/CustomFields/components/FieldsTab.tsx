import { DragEvent, useMemo, useState } from "react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { FIELD_TYPE_LABELS, ModuleGroup, SettingsField, fieldHasRule } from "../types";

interface Props {
    fields: SettingsField[];
    moduleGroups: ModuleGroup[];
    onEdit: (field: SettingsField) => void;
    onDelete: (field: SettingsField) => void;
    onReorder: (moduleName: string, orderedIds: number[]) => void;
}

const ROW_COLUMNS = "36px 1.6fr 1fr 1.8fr .8fr .8fr 1fr 96px";

export default function FieldsTab({ fields, moduleGroups, onEdit, onDelete, onReorder }: Props) {
    const { td } = useTd();
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [dragId, setDragId] = useState<number | null>(null);

    const term = search.trim().toLowerCase();
    const matches = (f: SettingsField) =>
        !term || `${f.label} ${f.type} ${f.module} ${f.category_name ?? ""}`.toLowerCase().includes(term);

    const moduleBlocks = useMemo(() => {
        return moduleGroups
            .map((group) => {
                const all = fields.filter((f) => f.custom_field_group_id === group.id);
                if (all.length === 0) return null;
                const filtered = all.filter(matches);
                if (term && filtered.length === 0) return null;
                return { group, all, filtered };
            })
            .filter((b): b is { group: ModuleGroup; all: SettingsField[]; filtered: SettingsField[] } => b !== null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields, moduleGroups, term]);

    const noResults = term.length > 0 && moduleBlocks.length === 0;
    const totalMatching = moduleBlocks.reduce((sum, b) => sum + b.filtered.length, 0);
    const fieldCountSummary = term
        ? td(`${totalMatching} matching`, { source: "en" })
        : td(`${fields.length} fields across ${moduleBlocks.length} modules`, { source: "en" });

    const isExpanded = (moduleName: string) => (term ? true : expanded[moduleName] ?? moduleName === moduleGroups[0]?.name);

    const handleDrop = (moduleName: string, orderedFields: SettingsField[], targetId: number) => {
        if (dragId === null || dragId === targetId) {
            setDragId(null);
            return;
        }
        const ids = orderedFields.map((f) => f.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) {
            setDragId(null);
            return;
        }
        const next = [...ids];
        next.splice(from, 1);
        next.splice(to, 0, dragId);
        setDragId(null);
        onReorder(moduleName, next);
    };

    return (
        <div style={{ padding: "20px 22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        width: 340,
                        maxWidth: "100%",
                    }}
                >
                    <Icon name="search" size={15} color={T.TEXT_HINT} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={td("Search fields, types or modules", { source: "en" })}
                        style={{ border: "none", outline: "none", background: "none", fontSize: 14, color: T.TEXT, width: "100%" }}
                    />
                </div>
                <div style={{ fontSize: 13, color: T.TEXT_HINT }}>{fieldCountSummary}</div>
            </div>

            {noResults && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 20px", color: T.TEXT_HINT }}>
                    <div style={{ width: 44, height: 44, borderRadius: 999, background: T.BG, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                        <Icon name="search" size={20} color={T.TEXT_HINT} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                        {td("No fields match your search", { source: "en" })}
                    </div>
                    <div style={{ fontSize: 14 }}>{td("Try a different label, type or module name.", { source: "en" })}</div>
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {moduleBlocks.map(({ group, filtered }) => {
                    const open = isExpanded(group.name);
                    return (
                        <div key={group.id} style={{ border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                            <button
                                type="button"
                                aria-expanded={open}
                                onClick={() => setExpanded((prev) => ({ ...prev, [group.name]: !open }))}
                                style={{
                                    display: "flex",
                                    width: "100%",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "14px 18px",
                                    cursor: "pointer",
                                    background: open ? T.SURFACE_2 : T.WHITE,
                                    border: "none",
                                    font: "inherit",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <span style={{ display: "inline-flex", transition: "transform 0.16s ease", transform: `rotate(${open ? 90 : 0}deg)` }}>
                                        <Icon name="chevron-right" size={18} color={T.TEXT_MUTED} />
                                    </span>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: T.NAVY }}>{group.name}</span>
                                    <span className="dr-pill dr-pill-gray">
                                        {filtered.length} {filtered.length === 1 ? td("field", { source: "en" }) : td("fields", { source: "en" })}
                                    </span>
                                </div>
                                <span style={{ fontSize: 13, color: T.TEXT_HINT }}>
                                    {open ? td("Click to collapse", { source: "en" }) : td("Click to expand", { source: "en" })}
                                </span>
                            </button>

                            {open && (
                                <div style={{ borderTop: `1px solid ${T.BORDER}`, overflowX: "auto" }}>
                                    <div style={{ minWidth: 820 }}>
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: ROW_COLUMNS,
                                                gap: 12,
                                                padding: "11px 18px",
                                                background: T.SURFACE_2,
                                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                color: T.TEXT_HINT,
                                            }}
                                        >
                                            <span />
                                            <span>{td("Label", { source: "en" })}</span>
                                            <span>{td("Type", { source: "en" })}</span>
                                            <span>{td("Values", { source: "en" })}</span>
                                            <span>{td("Required", { source: "en" })}</span>
                                            <span>{td("Export", { source: "en" })}</span>
                                            <span>{td("Category", { source: "en" })}</span>
                                            <span style={{ textAlign: "right" }}>{td("Actions", { source: "en" })}</span>
                                        </div>
                                        {filtered.map((field) => (
                                            <div
                                                key={field.id}
                                                draggable={!term}
                                                onDragStart={() => !term && setDragId(field.id)}
                                                onDragOver={(e: DragEvent) => !term && e.preventDefault()}
                                                onDrop={(e: DragEvent) => {
                                                    if (term) return;
                                                    e.preventDefault();
                                                    handleDrop(group.name, filtered, field.id);
                                                }}
                                                onDragEnd={() => setDragId(null)}
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: ROW_COLUMNS,
                                                    gap: 12,
                                                    padding: "12px 18px",
                                                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                                    alignItems: "center",
                                                    background: dragId === field.id ? T.BLUE_LIGHT : T.WHITE,
                                                    opacity: dragId === field.id ? 0.4 : 1,
                                                }}
                                            >
                                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: T.NAVY_MID }}>
                                                    <Icon name="grip-vertical" size={16} />
                                                </span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: T.TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {field.label}
                                                    </span>
                                                    {fieldHasRule(field) && (
                                                        <span
                                                            title={td("Has a visibility rule", { source: "en" })}
                                                            className="dr-pill dr-pill-teal"
                                                            style={{ flexShrink: 0, padding: "1px 7px" }}
                                                        >
                                                            <Icon name="target" size={12} />
                                                            {td("Rule", { source: "en" })}
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{ display: "flex", alignItems: "center" }}>
                                                    <span className="dr-pill dr-pill-gray" style={{ fontVariant: "small-caps" }}>
                                                        {FIELD_TYPE_LABELS[field.type] ?? field.type}
                                                    </span>
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {field.values.length ? field.values.join(", ") : "—"}
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center" }}>
                                                    <span className={`dr-pill ${field.required === "yes" ? "dr-pill-navy" : "dr-pill-gray"}`}>
                                                        {field.required === "yes" ? td("Yes", { source: "en" }) : td("No", { source: "en" })}
                                                    </span>
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center" }}>
                                                    <span className={`dr-pill ${field.export ? "dr-pill-green" : "dr-pill-gray"}`}>
                                                        {field.export ? td("Yes", { source: "en" }) : td("No", { source: "en" })}
                                                    </span>
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {field.category_name ?? "—"}
                                                </span>
                                                <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                                    <button
                                                        type="button"
                                                        title={td("Edit", { source: "en" })}
                                                        onClick={() => onEdit(field)}
                                                        className="dr-btn dr-btn-ghost"
                                                        style={{ width: 30, height: 30, minHeight: 30, padding: 0, borderRadius: 7, border: "1px solid transparent" }}
                                                    >
                                                        <Icon name="edit" size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title={td("Delete", { source: "en" })}
                                                        onClick={() => onDelete(field)}
                                                        className="dr-btn dr-btn-ghost"
                                                        style={{ width: 30, height: 30, minHeight: 30, padding: 0, borderRadius: 7, border: "1px solid transparent" }}
                                                    >
                                                        <Icon name="trash" size={16} />
                                                    </button>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
