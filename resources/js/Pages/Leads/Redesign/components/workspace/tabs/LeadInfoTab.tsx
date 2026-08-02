import { useMemo } from "react";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { parseCategorySectionId } from "@/Pages/Deals/Redesign/config/dealInfoSections";
import DealInfoSidebar from "@/Pages/Deals/Redesign/components/deal-info/DealInfoSidebar";
import type { DealInfoSectionId } from "@/Pages/Deals/Redesign/types";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadCustomFieldUpdate from "../../../hooks/useLeadCustomFieldUpdate";
import type { LeadInfoSectionId } from "../../../types";

interface LeadInfoTabProps {
    fields?: any[];
    customFieldCategories?: Array<{ id: number; name: string }>;
    activeSection: LeadInfoSectionId;
    onSectionChange: (section: LeadInfoSectionId) => void;
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
}: LeadInfoTabProps) {
    const { td } = useTd();
    const { lead } = useLeadWorkspace();
    const { updateCustomField, updatingField } = useLeadCustomFieldUpdate();

    const navGroups = useMemo(
        () => [
            {
                label: "Lead fields",
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
                        badge: total > 0 ? `${filled}/${total}` : undefined,
                        completion: total > 0 ? { filled, total } : undefined,
                    };
                }),
            },
        ],
        [customFieldCategories, fields, lead.custom_fields_data],
    );

    const categoryId = parseCategorySectionId(activeSection);
    const activeCategory = customFieldCategories.find(
        (category) => category.id === categoryId,
    );

    if (customFieldCategories.length === 0) {
        return (
            <p className="text-xs text-[#9ca3af]">
                {td("No custom field categories configured for leads.")}
            </p>
        );
    }

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
            />
            <section className="@container pl-[26px] pt-1">
                {activeCategory && categoryId != null ? (
                    <>
                        <div className="mb-3.5">
                            <h3 className="mb-0.5 text-base font-medium text-[#0f172a]">
                                {td(activeCategory.name)}
                            </h3>
                            <p className="text-xs text-[#5b6472]">
                                {td("Click any field to edit.")}
                            </p>
                        </div>
                        <CustomFieldDisplay
                            fields={fields}
                            customFieldsData={lead.custom_fields_data ?? {}}
                            categoryId={categoryId}
                            useContainerQuery
                            bare
                            column={2}
                            editable
                            activateOnSingleClick
                            onUpdate={updateCustomField}
                            loading={Boolean(updatingField)}
                            loadingField={updatingField}
                        />
                    </>
                ) : (
                    <p className="text-xs text-[#8b95a7]">
                        {td("Select a category from the sidebar.")}
                    </p>
                )}
            </section>
        </div>
    );
}
