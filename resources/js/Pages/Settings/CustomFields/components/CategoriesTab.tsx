import { DragEvent, useState } from "react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { SettingsCategory, SettingsField } from "../types";

interface Props {
    categories: SettingsCategory[];
    fields: SettingsField[];
    onEdit: (category: SettingsCategory) => void;
    onDelete: (category: SettingsCategory) => void;
    onReorder: (orderedIds: number[]) => void;
}

const ROW_COLUMNS = "36px 2fr 1.2fr 1fr 96px";

export default function CategoriesTab({ categories, fields, onEdit, onDelete, onReorder }: Props) {
    const { td } = useTd();
    const [dragId, setDragId] = useState<number | null>(null);

    const fieldCount = (category: SettingsCategory) =>
        fields.filter((f) => f.custom_field_group_id === category.custom_field_group_id && f.category_name === category.name).length;

    const handleDrop = (targetId: number) => {
        if (dragId === null || dragId === targetId) {
            setDragId(null);
            return;
        }
        const ids = categories.map((c) => c.id);
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
        onReorder(next);
    };

    return (
        <div style={{ padding: "20px 22px 24px" }}>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: T.TEXT_MUTED, maxWidth: 620 }}>
                {td(
                    "Categories group related fields inside a module — they become sections on the record form. Drag to reorder how they appear.",
                    { source: "en" },
                )}
            </p>

            {categories.length === 0 ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        padding: "48px 20px",
                        color: T.TEXT_HINT,
                        border: `1px dashed ${T.BORDER}`,
                        borderRadius: 10,
                    }}
                >
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                        {td("No categories yet", { source: "en" })}
                    </div>
                    <div style={{ fontSize: 14 }}>{td("Categories you add will appear here.", { source: "en" })}</div>
                </div>
            ) : (
                <div style={{ border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
                    <div style={{ minWidth: 640 }}>
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
                            <span>{td("Name", { source: "en" })}</span>
                            <span>{td("Module", { source: "en" })}</span>
                            <span>{td("Fields", { source: "en" })}</span>
                            <span style={{ textAlign: "right" }}>{td("Actions", { source: "en" })}</span>
                        </div>
                        {categories.map((category) => {
                            const count = fieldCount(category);
                            return (
                                <div
                                    key={category.id}
                                    draggable
                                    onDragStart={() => setDragId(category.id)}
                                    onDragOver={(e: DragEvent) => e.preventDefault()}
                                    onDrop={(e: DragEvent) => {
                                        e.preventDefault();
                                        handleDrop(category.id);
                                    }}
                                    onDragEnd={() => setDragId(null)}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: ROW_COLUMNS,
                                        gap: 12,
                                        padding: "12px 18px",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                        alignItems: "center",
                                        background: dragId === category.id ? T.BLUE_LIGHT : T.WHITE,
                                        opacity: dragId === category.id ? 0.4 : 1,
                                    }}
                                >
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: T.NAVY_MID }}>
                                        <Icon name="grip-vertical" size={16} />
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                                        {category.name}
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center" }}>
                                        <span className="dr-pill dr-pill-navy">{category.module}</span>
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.TEXT_MUTED }}>
                                        {count} {count === 1 ? td("field", { source: "en" }) : td("fields", { source: "en" })}
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                        <button
                                            type="button"
                                            title={td("Edit", { source: "en" })}
                                            onClick={() => onEdit(category)}
                                            className="dr-btn dr-btn-ghost"
                                            style={{ width: 30, height: 30, minHeight: 30, padding: 0, borderRadius: 7, border: "1px solid transparent" }}
                                        >
                                            <Icon name="edit" size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            title={td("Delete", { source: "en" })}
                                            onClick={() => onDelete(category)}
                                            className="dr-btn dr-btn-ghost"
                                            style={{ width: 30, height: 30, minHeight: 30, padding: 0, borderRadius: 7, border: "1px solid transparent" }}
                                        >
                                            <Icon name="trash" size={16} />
                                        </button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
