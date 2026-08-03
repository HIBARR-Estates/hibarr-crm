import { useCallback, useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { DOSSIER_SECTIONS } from "../../config/dossierSections";
import {
    countFilledFields,
    getDossierFieldValue,
} from "../../adapters/dossierAdapter";
import DossierField from "./DossierField";
import DossierSection from "./DossierSection";

interface LeadDossierProps {
    lead: Lead;
    onOpenLeadInfo?: () => void;
}

export default function LeadDossier({ lead, onOpenLeadInfo }: LeadDossierProps) {
    const { td } = useTd();
    const [openSections, setOpenSections] = useState<Set<string>>(
        () =>
            new Set(
                DOSSIER_SECTIONS.filter((section) => section.defaultOpen).map(
                    (section) => section.id,
                ),
            ),
    );

    const toggleSection = useCallback((sectionId: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    }, []);

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

    const createdLabel = lead.created_at
        ? formatCompanyDateTime(lead.created_at)
        : null;
    const updatedLabel = lead.updated_at
        ? formatCompanyDateTime(lead.updated_at)
        : null;

    return (
        <aside
            className="v2-dossier"
            data-tour="lead-dossier"
            style={{
                padding: "14px 16px",
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
                {onOpenLeadInfo && (
                    <button
                        type="button"
                        onClick={onOpenLeadInfo}
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
                        {td("Edit in Lead info")}
                    </button>
                )}
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
                            const displayValue = getDossierFieldValue(
                                lead,
                                field.key,
                            );

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
                                    }}
                                >
                                    <span style={{ color: "var(--lr-text-dim)" }}>
                                        {td(field.label)}
                                    </span>
                                    <DossierField
                                        value={displayValue}
                                        placeholder={
                                            field.placeholder || "Not set"
                                        }
                                        tone={field.tone}
                                        copyable={section.copyable !== false}
                                    />
                                </div>
                            );
                        })}
                    </DossierSection>
                );
            })}

            {(createdLabel || updatedLabel) && (
                <footer className="v2-dossier-footnote">
                    {createdLabel ? (
                        <div>
                            {td("Created")} {createdLabel}
                        </div>
                    ) : null}
                    {updatedLabel ? (
                        <div>
                            {td("Updated")} {updatedLabel}
                        </div>
                    ) : null}
                </footer>
            )}
        </aside>
    );
}
