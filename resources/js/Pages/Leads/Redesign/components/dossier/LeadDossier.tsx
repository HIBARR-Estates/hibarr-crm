import { useCallback, useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    DOSSIER_SECTIONS,
    type DossierFieldDef,
    type DossierFieldKey,
} from "../../config/dossierSections";
import {
    ageRangeFromAge,
    countFilledFields,
    getDossierFieldValue,
} from "../../adapters/dossierAdapter";
import useLeadFieldUpdate from "../../hooks/useLeadFieldUpdate";
import DossierField from "./DossierField";
import DossierSection from "./DossierSection";

function patchFieldName(field: DossierFieldDef): string | null {
    if (!field.leadField) return null;
    if (field.key === "email") return "client_email";
    if (field.key === "nextFollowUp") return "next_follow_up";
    return field.leadField;
}

function rawEditValue(lead: Lead, key: DossierFieldKey): string {
    const record = lead as unknown as Record<string, unknown>;
    if (key === "email") return String(record.client_email ?? "");
    if (key === "age") return String(record.age ?? "");
    if (key === "languages") {
        const languages = record.languages;
        return Array.isArray(languages)
            ? languages.map(String).filter(Boolean).join(", ")
            : String(languages ?? "");
    }
    const field = DOSSIER_SECTIONS.flatMap((section) => section.fields).find(
        (item) => item.key === key,
    );
    if (field?.leadField) {
        return String(record[field.leadField] ?? "");
    }
    return getDossierFieldValue(lead, key);
}

interface LeadDossierProps {
    lead: Lead;
}

export default function LeadDossier({ lead }: LeadDossierProps) {
    const { td } = useTd();
    const { updateField, updatingField } = useLeadFieldUpdate();
    const [editAll, setEditAll] = useState(false);
    const [activeKey, setActiveKey] = useState<DossierFieldKey | null>(null);
    const [openSections, setOpenSections] = useState<Set<string>>(
        () => new Set(["contact"]),
    );

    const toggleSection = useCallback((sectionId: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    }, []);

    const setEditMode = useCallback((next: boolean) => {
        setEditAll(next);
        setActiveKey(null);
        if (next) {
            setOpenSections(new Set(DOSSIER_SECTIONS.map((section) => section.id)));
        }
    }, []);

    const commit = useCallback(
        async (field: DossierFieldDef, next: string) => {
            const patchName = patchFieldName(field);
            if (!patchName) {
                setActiveKey(null);
                return;
            }

            const trimmed = next.trim();
            try {
                if (field.key === "languages") {
                    const languages = trimmed
                        ? trimmed.split(",").map((part) => part.trim()).filter(Boolean)
                        : [];
                    await updateField("languages", languages);
                } else if (field.key === "age") {
                    await updateField("age", trimmed ? Number(trimmed) : null);
                    const range = ageRangeFromAge(trimmed);
                    if (range) await updateField("age_range", range);
                } else if (
                    field.key === "leadValue" ||
                    patchName === "value" ||
                    patchName === "currency_id"
                ) {
                    await updateField(
                        patchName,
                        patchName === "value"
                            ? trimmed
                                ? Number(trimmed)
                                : null
                            : trimmed
                              ? Number(trimmed)
                              : null,
                    );
                } else {
                    await updateField(patchName, trimmed || null);
                }
            } finally {
                setActiveKey(null);
            }
        },
        [updateField],
    );

    const sectionCounts = useMemo(
        () =>
            DOSSIER_SECTIONS.map((section) => ({
                id: section.id,
                ...countFilledFields(
                    lead,
                    section.fields.map((field) => field.key),
                ),
            })),
        [lead],
    );

    return (
        <aside
            className="v2-dossier"
            style={{
                padding: "14px 16px",
                alignSelf: "start",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 4,
                }}
            >
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                    {td("Dossier")}
                </h2>
                <button
                    type="button"
                    onClick={() => setEditMode(!editAll)}
                    style={{
                        background: "none",
                        border: "none",
                        color: "var(--lr-blue)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    {editAll ? td("Done") : td("Edit")}
                </button>
            </div>

            {DOSSIER_SECTIONS.map((section, index) => {
                const counts = sectionCounts.find((item) => item.id === section.id);
                const isOpen = openSections.has(section.id);

                return (
                    <DossierSection
                        key={section.id}
                        title={section.title}
                        filled={counts?.filled ?? 0}
                        total={counts?.total ?? section.fields.length}
                        open={isOpen}
                        onToggle={() => toggleSection(section.id)}
                        isLast={index === DOSSIER_SECTIONS.length - 1}
                    >
                        {section.fields.map((field) => {
                            const canEdit = !section.readOnly && !!field.leadField;
                            const isEditing =
                                canEdit && (editAll || activeKey === field.key);
                            const rawValue = rawEditValue(lead, field.key);
                            const displayValue = field.displayWithRange
                                ? getDossierFieldValue(lead, field.key)
                                : rawValue;
                            const patchName = patchFieldName(field);
                            const saving = patchName
                                ? updatingField === patchName
                                : false;

                            return (
                                <div
                                    key={field.key}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "88px 1fr",
                                        gap: 8,
                                        padding: "5px 0",
                                        fontSize: 13,
                                        alignItems: "center",
                                        opacity: saving ? 0.6 : 1,
                                    }}
                                >
                                    <span style={{ color: "var(--lr-text-dim)" }}>
                                        {td(field.label)}
                                    </span>
                                    {isEditing ? (
                                        <DossierField
                                            value={rawValue}
                                            placeholder={
                                                field.placeholder ||
                                                (field.displayWithRange
                                                    ? "e.g. 41"
                                                    : "Not set")
                                            }
                                            tone={field.tone}
                                            editing
                                            autoFocus={activeKey === field.key}
                                            onCommit={(next) =>
                                                void commit(field, next)
                                            }
                                            onCancel={() => setActiveKey(null)}
                                        />
                                    ) : canEdit ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveKey(field.key)
                                            }
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                margin: 0,
                                                textAlign: "left",
                                                cursor: "text",
                                                fontFamily: "inherit",
                                            }}
                                            title={td(
                                                field.displayWithRange
                                                    ? "Edit age — range updates automatically"
                                                    : "Click to edit",
                                            )}
                                        >
                                            <DossierField
                                                value={displayValue}
                                                placeholder={
                                                    field.placeholder || "Not set"
                                                }
                                                tone={field.tone}
                                                editing={false}
                                            />
                                        </button>
                                    ) : (
                                        <DossierField
                                            value={displayValue}
                                            placeholder={
                                                field.placeholder || "Not set"
                                            }
                                            tone={field.tone}
                                            editing={false}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </DossierSection>
                );
            })}

            <p
                style={{
                    fontSize: 11,
                    color: "var(--lr-text-dim)",
                    marginTop: 8,
                    marginBottom: 0,
                }}
            >
                {td("Click any value to edit · Enter saves · Esc cancels")}
            </p>
        </aside>
    );
}
