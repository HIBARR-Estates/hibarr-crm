import { useEffect, useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import DealInfoSidebar from "@/Pages/Deals/Redesign/components/deal-info/DealInfoSidebar";
import type { DealInfoSectionId } from "@/Pages/Deals/Redesign/types";
import { parseCategorySectionId } from "@/Pages/Deals/Redesign/config/dealInfoSections";
import { selectFieldsForCompletionCount } from "@/lib/customFieldCompletion";
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
    const visibleFields = fields.filter(
        (field) =>
            Number(field.custom_field_category_id) === categoryId &&
            field.type !== "file",
    );
    const fieldsToCount = selectFieldsForCompletionCount(visibleFields);
    let filled = 0;

    for (const field of fieldsToCount) {
        const value =
            customFieldsData?.[`field_${field.id}`] ??
            customFieldsData?.[field.id];
        if (isFilledValue(value)) filled += 1;
    }

    return { filled, total: fieldsToCount.length };
}

/** Categories that only contain file fields live on the Files tab — hide here. */
function categoryHasVisibleFields(categoryId: number, fields: any[]): boolean {
    return fields.some(
        (field) =>
            Number(field.custom_field_category_id) === categoryId &&
            field.type !== "file",
    );
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

    const visibleCategories = useMemo(
        () =>
            customFieldCategories.filter((category) =>
                categoryHasVisibleFields(category.id, fields),
            ),
        [customFieldCategories, fields],
    );

    // File-only categories are hidden — bounce off a stale URL/section id.
    useEffect(() => {
        const categoryId = parseCategorySectionId(String(activeSection));
        if (categoryId == null) return;
        if (visibleCategories.some((category) => category.id === categoryId)) {
            return;
        }
        onSectionChange("personal");
    }, [activeSection, onSectionChange, visibleCategories]);

    const navGroups = useMemo(() => {
        const coreItems = LEAD_INFO_CORE_SECTIONS.map((section) => {
            const completionKeys = section.fields
                .filter((field) => !field.readOnly)
                .map((field) => field.key);
            const { filled, total } = countFilledFields(lead, completionKeys);
            return {
                id: section.id as DealInfoSectionId,
                label: section.title,
                icon: section.icon,
                badgeVariant: "gray" as const,
                badge: total > 0 ? `${filled}/${total}` : undefined,
                completion: total > 0 ? { filled, total } : undefined,
                searchTerms: section.fields.map((field) => field.label),
            };
        });

        const categoryItems = visibleCategories.map((category) => {
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
        });

        // One flat list — no Overview / Custom fields group split.
        return [{ label: "", items: [...coreItems, ...categoryItems] }];
    }, [fields, lead, visibleCategories]);

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
                tourTarget="lead-info-sidebar"
            />
            <LeadInfoSectionPanel
                sectionId={activeSection}
                lead={lead}
                fields={fields}
                customFieldCategories={visibleCategories}
                canEdit={canEdit}
                isFieldLoading={isFieldLoading}
                updatingField={updatingField}
                onFieldUpdate={handleFieldUpdate}
                onFieldsUpdate={handleFieldsUpdate}
            />
        </div>
    );
}
