import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { ANALYSIS_FIELD_META } from "@/Pages/Deals/Redesign/config/analysisFieldMeta";
import { makeKey, type BuilderRow, type ScriptItemType } from "./types";

export interface PaletteCustomField {
    id: number;
    label: string;
    type: string;
    category_id: number | null;
    category_name: string | null;
}

export interface PaletteCategory {
    id: number;
    name: string;
}

/** A thing you can put into the script. Blocks create sections, entries create rows. */
interface PaletteEntry {
    id: string;
    label: string;
    context: string | null;
    group: string;
    make: () => BuilderRow;
}

interface Props {
    dealCustomFields: PaletteCustomField[];
    leadCustomFields: PaletteCustomField[];
    categories: PaletteCategory[];
    loading?: boolean;
    onAddRow: (row: BuilderRow) => void;
    onAddSection: () => void;
    onAddCategorySection: (category: PaletteCategory) => void;
}

const row = (
    type: ScriptItemType,
    item_key: string,
    displayLabel: string,
    contextLabel: string | null = null,
): BuilderRow => ({
    key: makeKey(),
    type,
    item_key,
    label_override: null,
    guide_text: null,
    is_required: false,
    displayLabel,
    contextLabel,
});

function DraggableEntry({
    entry,
    onAdd,
}: {
    entry: PaletteEntry;
    onAdd: () => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `pal:${entry.id}`,
        data: { kind: "palette", make: entry.make },
    });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            // Click-to-add as well as drag: drag-only would leave keyboard users with
            // no way to build a script at all.
            onClick={onAdd}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAdd();
                }
            }}
            title={entry.context ? `${entry.label} — ${entry.context}` : entry.label}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "grab",
                background: isDragging ? T.BLUE_LIGHT : "transparent",
                opacity: isDragging ? 0.5 : 1,
                border: "1px solid transparent",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = T.SURFACE_2;
                e.currentTarget.style.borderColor = T.BORDER;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = isDragging ? T.BLUE_LIGHT : "transparent";
                e.currentTarget.style.borderColor = "transparent";
            }}
        >
            <Icon name="plus" size={16} color={T.TEXT_HINT} />
            <span
                style={{
                    fontSize: 14,
                    color: T.TEXT,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                }}
            >
                {entry.label}
            </span>
            {entry.context && (
                <span style={{ fontSize: 12, color: T.TEXT_HINT, flexShrink: 0, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.context}
                </span>
            )}
        </div>
    );
}

export default function FieldPalette({
    dealCustomFields,
    leadCustomFields,
    categories,
    loading,
    onAddRow,
    onAddSection,
    onAddCategorySection,
}: Props) {
    const [query, setQuery] = useState("");

    const entries = useMemo<PaletteEntry[]>(() => {
        const out: PaletteEntry[] = [];

        out.push({
            id: "question",
            label: "Question",
            context: null,
            group: "Prompts",
            make: () => row("question", `q_${Date.now()}`, "Question"),
        });
        out.push({
            id: "instruction",
            label: "Instruction",
            context: null,
            group: "Prompts",
            make: () => row("instruction", `i_${Date.now()}`, "Instruction"),
        });

        for (const [key, meta] of Object.entries(ANALYSIS_FIELD_META)) {
            const group =
                meta.source === "deal"
                    ? "Deal Fields"
                    : meta.source === "hibarrFields"
                      ? "HIBARR Fields"
                      : "Lead Contact Fields";
            const type: ScriptItemType =
                meta.source === "deal"
                    ? "native_field"
                    : meta.source === "hibarrFields"
                      ? "hibarr_field"
                      : "lead_field";
            out.push({
                id: `${type}:${key}`,
                label: meta.label,
                context: null,
                group,
                make: () => row(type, key, meta.label),
            });
        }

        for (const f of dealCustomFields) {
            out.push({
                id: `dcf:${f.id}`,
                label: f.label,
                context: f.category_name,
                group: "Deal Custom Fields",
                make: () => row("deal_custom_field", String(f.id), f.label, f.category_name),
            });
        }

        for (const f of leadCustomFields) {
            out.push({
                id: `lcf:${f.id}`,
                label: f.label,
                context: f.category_name,
                group: "Lead Custom Fields",
                make: () => row("lead_custom_field", String(f.id), f.label, f.category_name),
            });
        }

        return out;
    }, [dealCustomFields, leadCustomFields]);

    const { grouped, matchCount } = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? entries.filter(
                  (e) =>
                      e.label.toLowerCase().includes(q) ||
                      (e.context ?? "").toLowerCase().includes(q) ||
                      e.group.toLowerCase().includes(q),
              )
            : entries;

        const map = new Map<string, PaletteEntry[]>();
        for (const e of filtered) {
            if (!map.has(e.group)) map.set(e.group, []);
            map.get(e.group)!.push(e);
        }
        return { grouped: map, matchCount: filtered.length };
    }, [entries, query]);

    const q = query.trim().toLowerCase();
    const matchingCategories = q
        ? categories.filter((c) => c.name.toLowerCase().includes(q))
        : categories;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                background: T.WHITE,
                overflow: "hidden",
                height: "100%",
                minHeight: 0,
            }}
        >
            <div style={{ padding: 10, borderBottom: `1px solid ${T.BORDER}`, flexShrink: 0 }}>
                <input
                    className="dr-input"
                    type="search"
                    placeholder="Search fields…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ fontSize: 14 }}
                />
                <p style={{ fontSize: 12, color: T.TEXT_HINT, margin: "6px 2px 0" }}>
                    Drag onto a section, or click to add.
                </p>
            </div>

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: 8 }}>
                {/* Section creators — these make sections, not rows */}
                {!q && (
                    <>
                        <GroupLabel>Sections</GroupLabel>
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            style={{ width: "100%", justifyContent: "flex-start", marginBottom: 8 }}
                            onClick={onAddSection}
                        >
                            <Icon name="plus" size={16} />
                            New section
                        </button>
                    </>
                )}

                {matchingCategories.length > 0 && (
                    <>
                        <GroupLabel>Field Group Sections</GroupLabel>
                        <div style={{ marginBottom: 10 }}>
                            {matchingCategories.map((c) => (
                                <div
                                    key={c.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onAddCategorySection(c)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            onAddCategorySection(c);
                                        }
                                    }}
                                    title={`Add "${c.name}" as its own section`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 8px",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        fontSize: 14,
                                        color: T.TEXT,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = T.SURFACE_2)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    <Icon name="layers" size={16} color={T.TEXT_HINT} />
                                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {c.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {loading && (
                    <p style={{ fontSize: 14, color: T.TEXT_MUTED, padding: 8 }}>Loading fields…</p>
                )}

                {!loading && matchCount === 0 && matchingCategories.length === 0 && (
                    <p style={{ fontSize: 14, color: T.TEXT_MUTED, padding: 8, fontStyle: "italic" }}>
                        No fields match “{query.trim()}”.
                    </p>
                )}

                {[...grouped.entries()].map(([group, list]) => (
                    <div key={group} style={{ marginBottom: 10 }}>
                        <GroupLabel>{group}</GroupLabel>
                        {list.map((entry) => (
                            <DraggableEntry
                                key={entry.id}
                                entry={entry}
                                onAdd={() => onAddRow(entry.make())}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                padding: "4px 8px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: T.TEXT_HINT,
            }}
        >
            {children}
        </div>
    );
}
