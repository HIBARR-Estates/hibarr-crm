import { useCallback, useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { DOSSIER_SECTIONS } from "../../config/dossierSections";
import type { DossierFieldKey } from "../../config/dossierSections";
import {
    countFilledFields,
    getDossierFieldValue,
} from "../../adapters/dossierAdapter";
import useLeadInfoFieldUpdate from "../../hooks/useLeadInfoFieldUpdate";
import {
    LeadCategoryField,
    LeadPreferredContactTimeField,
    LeadSourceField,
    LeadTemperatureField,
} from "../lead-info/LeadAttributionFields";
import DossierField from "./DossierField";
import DossierSection from "./DossierSection";

/** Dossier keys that edit in place instead of rendering a read-only value. */
const EDITABLE_FIELDS: Partial<
    Record<DossierFieldKey, typeof LeadSourceField>
> = {
    source: LeadSourceField,
    category: LeadCategoryField,
    temperature: LeadTemperatureField,
    preferredContactTime: LeadPreferredContactTimeField,
};

interface LeadDossierProps {
    lead: Lead;
    onOpenLeadInfo?: () => void;
    /** Record-scoped edit permission, from the parent's `canEditLead` check. */
    canEdit?: boolean;
}

export default function LeadDossier({
    lead,
    onOpenLeadInfo,
    canEdit = false,
}: LeadDossierProps) {
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const { isFieldLoading, handleFieldUpdate } =
        useLeadInfoFieldUpdate(canEdit);
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
        ? formatDateTime(lead.created_at)
        : null;
    const updatedLabel = lead.updated_at
        ? formatDateTime(lead.updated_at)
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
                    {td("Dossier", { source: "en" })}
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
                        {td("Edit in Lead info", { source: "en" })}
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
                            const EditableField = EDITABLE_FIELDS[field.key];

                            return (
                                <div key={field.key} className="v2-dossier-row">
                                    <span style={{ color: "var(--lr-text-dim)" }}>
                                        {td(field.label, { source: "en" })}
                                    </span>
                                    {EditableField ? (
                                        <EditableField
                                            lead={lead}
                                            onFieldUpdate={handleFieldUpdate}
                                            isFieldLoading={isFieldLoading}
                                            disabled={!canEdit}
                                        />
                                    ) : (
                                        <DossierField
                                            value={displayValue}
                                            placeholder={
                                                field.placeholder || "Not set"
                                            }
                                            tone={field.tone}
                                            copyable={
                                                field.copyable !== false &&
                                                section.copyable !== false
                                            }
                                        />
                                    )}
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
                            {td("Created", { source: "en" })} {createdLabel}
                        </div>
                    ) : null}
                    {updatedLabel ? (
                        <div>
                            {td("Updated", { source: "en" })} {updatedLabel}
                        </div>
                    ) : null}
                </footer>
            )}
        </aside>
    );
}
