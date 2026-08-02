import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import DealInfoSidebar from "@/Pages/Deals/Redesign/components/deal-info/DealInfoSidebar";
import type { DealInfoSectionId } from "@/Pages/Deals/Redesign/types";
import { countFilledFields } from "../../../adapters/dossierAdapter";
import { LEAD_INFO_CORE_SECTIONS } from "../../../config/leadInfoSections";
import LeadInfoSectionPanel from "../../lead-info/LeadInfoSectionPanel";
import useLeadInfoFieldUpdate from "../../../hooks/useLeadInfoFieldUpdate";
import type { LeadInfoSectionId } from "../../../types";

interface LeadInfoTabProps {
    fields?: any[];
    customFieldCategories?: Array<{ id: number; name: string }>;
    activeSection: LeadInfoSectionId;
    onSectionChange: (section: LeadInfoSectionId) => void;
    editLeadPermission?: string;
}

function isFilledValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "boolean") return value === true;
    if (typeof value === "number") return true;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return Boolean(value);
}

function countCategoryCompletion(
    categoryId: number,
    fields: any[],
    customFieldsData: Record<string, unknown> | undefined,
): { filled: number; total: number } {
    const categoryFields = fields.filter(
        (field) =>
            Number(field.custom_field_category_id) === categoryId &&
            field.type !== "file",
    );
    let filled = 0;

    for (const field of categoryFields) {
        const value =
            customFieldsData?.[`field_${field.id}`] ??
            customFieldsData?.[field.id];
        if (isFilledValue(value)) filled += 1;
    }

    return { filled, total: categoryFields.length };
}

export default function LeadInfoTab({
    fields = [],
    customFieldCategories = [],
    activeSection,
    onSectionChange,
    editLeadPermission = "all",
}: LeadInfoTabProps) {
    const { t } = useTranslation();
    const canEdit = ["all", "added", "owned", "both"].includes(
        editLeadPermission,
    );
    const {
        lead,
        isFieldLoading,
        updatingField,
        handleFieldUpdate,
        handleFieldsUpdate,
    } = useLeadInfoFieldUpdate(canEdit);

    const navGroups = useMemo(
        () => [
            {
                label: "Lead profile",
                items: LEAD_INFO_CORE_SECTIONS.map((section) => {
                    const completionKeys = section.fields
                        .filter((field) => !field.readOnly)
                        .map((field) => field.key);
                    const { filled, total } = countFilledFields(
                        lead,
                        completionKeys,
                    );
                    return {
                        id: section.id as DealInfoSectionId,
                        label: section.title,
                        icon: section.icon,
                        badgeVariant: "gray" as const,
                        badge: total > 0 ? `${filled}/${total}` : undefined,
                        completion: total > 0 ? { filled, total } : undefined,
                        searchTerms: section.fields.map((field) => field.label),
                    };
                }),
            },
            ...(customFieldCategories.length > 0
                ? [
                      {
                          label: "Custom fields",
                          items: customFieldCategories.map((category) => {
                              const { filled, total } = countCategoryCompletion(
                                  category.id,
                                  fields,
                                  lead.custom_fields_data ?? {},
                              );
                              return {
                                  id: `category-${category.id}` as DealInfoSectionId,
                                  label: category.name,
                                  icon: "layers",
                                  badgeVariant: "gray" as const,
                                  badge:
                                      total > 0
                                          ? `${filled}/${total}`
                                          : undefined,
                                  completion:
                                      total > 0
                                          ? { filled, total }
                                          : undefined,
                              };
                          }),
                      },
                  ]
                : []),
        ],
        [customFieldCategories, fields, lead],
    );

    return (
        <div
            className="grid min-h-[500px] gap-0"
            style={{ gridTemplateColumns: "210px minmax(0, 1fr)" }}
        >
            <DealInfoSidebar
                navGroups={navGroups}
                activeSection={activeSection as DealInfoSectionId}
                onSectionChange={(section) =>
                    onSectionChange(section as LeadInfoSectionId)
                }
                showCompletionDot
                title={t("pages.leads.info.title")}
            />
            <LeadInfoSectionPanel
                sectionId={activeSection}
                lead={lead}
                fields={fields}
                customFieldCategories={customFieldCategories}
                canEdit={canEdit}
                isFieldLoading={isFieldLoading}
                updatingField={updatingField}
                onFieldUpdate={handleFieldUpdate}
                onFieldsUpdate={handleFieldsUpdate}
            />
        </div>
    );
}
