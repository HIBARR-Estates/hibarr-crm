import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";
import type { CustomField } from "@/Types";
import { isFieldVisible } from "@/Features/Deals/pipelineScopeUtils";
import {
    isCustomFieldRequired,
    selectFieldsForCompletionCount,
} from "@/lib/customFieldCompletion";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import {
    buildCoreNavItem,
    CORE_SECTION_FIELD_LABELS,
    DEAL_INFO_CORE_SECTION_ORDER,
    DEAL_INFO_NOW_SECTION_COUNT,
    getCategoriesForCoreSection,
    getUnmappedCategories,
    toCategorySectionId,
} from "../config/dealInfoSections";
import type { DealInfoCoreSectionId, DealInfoSectionId } from "../types";

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    values?: unknown;
    custom_field_category_id?: string | number;
    required?: boolean | string;
    show_rule_set?: CustomField["show_rule_set"];
    linked_field_id?: number | null;
}

interface NavGroup {
    label: string;
    items: Array<{
        id: DealInfoSectionId;
        label: string;
        icon: string;
        badge?: string;
        badgeVariant: "blue" | "gray";
        later?: boolean;
        /** Field labels inside the section, matched by the sidebar search. */
        searchTerms?: string[];
        /**
         * Fill count backing `badge` — set whenever `badge` is a real
         * "filled/total" fraction (not a stage label or gdpr's no-badge
         * case), so the sidebar can render a completion dot from it
         * instead of the text when crm.deal-info-count-indicator is on.
         */
        completion?: { filled: number; total: number };
    }>;
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

function getCustomFieldValue(deal: Deal, fieldId: number): unknown {
    return (
        deal.custom_fields_data?.[`field_${fieldId}`] ??
        deal.custom_fields_data?.[fieldId]
    );
}

function getHibarrValue(deal: Deal, key: string): unknown {
    return deal.hibarr_fields?.[key as keyof NonNullable<Deal["hibarr_fields"]>];
}

/**
 * Build the same visibility map CustomFieldDisplay uses, so the sidebar
 * "filled/total" badge only counts fields the user can currently see.
 */
function buildCustomFieldVisibilityMap(
    fields: CustomFieldDefinition[],
    customFieldsData: Deal["custom_fields_data"],
    recordId?: number,
): Record<number, boolean> {
    const fieldValuesForVisibility = buildFieldValueMap({
        customFieldsData,
        fields,
        normalizeMultiSelect: true,
        context: recordId !== undefined ? { recordId } : undefined,
    });

    const customFieldsForEvaluation: CustomField[] = fields.map((field) => {
        let valuesString: string | null = null;
        if (field.values != null) {
            valuesString =
                typeof field.values === "string"
                    ? field.values
                    : JSON.stringify(field.values);
        }

        return {
            id: Number(field.id),
            label: field.label ?? field.name ?? "",
            name: `field_${field.id}`,
            type: field.type ?? "text",
            required: "no",
            values: valuesString,
            custom_field_group_id: 0,
            show_table: "no",
            field_display_name: field.label ?? field.name ?? "",
            field_order: 0,
            display_order: 0,
            show_rule_set: field.show_rule_set,
            linked_field_id: field.linked_field_id ?? undefined,
        };
    });

    return evaluateAllFieldsVisibility(
        customFieldsForEvaluation,
        fieldValuesForVisibility,
    );
}

function isCustomFieldCurrentlyVisible(
    field: CustomFieldDefinition,
    visibleFieldKeys: string[] | null | undefined,
    visibilityMap: Record<number, boolean>,
): boolean {
    if (field.type === "file") return false;
    if (!isFieldVisible(visibleFieldKeys, String(field.id))) return false;
    return visibilityMap[Number(field.id)] !== false;
}

function countSectionCompletion(
    sectionId: DealInfoCoreSectionId,
    deal: Deal,
    fields: CustomFieldDefinition[],
    categories: Array<{ id: number; name: string }>,
    visibleFieldKeys: string[] | null | undefined,
    visibilityMap: Record<number, boolean>,
): { filled: number; total: number } {
    const categoryIds = getCategoriesForCoreSection(sectionId, categories).map(
        (category) => category.id,
    );
    const categoryFields = fields.filter((field) =>
        categoryIds.includes(Number(field.custom_field_category_id)),
    );

    const hibarrKeysBySection: Partial<Record<DealInfoCoreSectionId, string[]>> = {
        preftimeline: [
            "purchase_timeline",
            "motivation",
            "strategy_meeting_booked",
            "downpayment_paid",
            "inspection_trip_date",
            "interested_in",
            "budget_range",
        ],
        funding: [
            "deposit_confirmation",
            "reservation_agreement",
            "sales_contract",
        ],
        support: ["message"],
    };

    const dealKeysBySection: Partial<Record<DealInfoCoreSectionId, string[]>> = {
        // "products" was tracked here but never rendered as a field row in
        // General (it's the separate DealPackagePropertyManager block below
        // the fields) — dropped so the sidebar badge (e.g. "3/3") matches
        // what General actually shows.
        general: ["name", "close_date", "category_id"],
    };

    const visibleCustomFields = categoryFields.filter((field) =>
        isCustomFieldCurrentlyVisible(field, visibleFieldKeys, visibilityMap),
    );
    // Required custom fields narrow the badge to those alone (and drop
    // native/hibarr rows). With none required, keep the legacy count of
    // every visible field including native keys.
    const countOnlyRequired = visibleCustomFields.some(isCustomFieldRequired);
    const customFieldsToCount = selectFieldsForCompletionCount(
        visibleCustomFields,
    );

    let filled = 0;
    let total = 0;

    const track = (value: unknown) => {
        total += 1;
        if (isFilledValue(value)) filled += 1;
    };

    const trackScopedKey = (key: string, value: unknown) => {
        if (!isFieldVisible(visibleFieldKeys, key)) return;
        track(value);
    };

    if (!countOnlyRequired) {
        for (const key of dealKeysBySection[sectionId] ?? []) {
            trackScopedKey(
                key,
                (deal as unknown as Record<string, unknown>)[key],
            );
        }

        for (const key of hibarrKeysBySection[sectionId] ?? []) {
            trackScopedKey(key, getHibarrValue(deal, key));
        }

        if (sectionId === "support") {
            // Team rows are always rendered in the redesign support section.
            track(deal.lead_agent?.user_id ?? deal.agent_id);
            track(
                deal.deal_participants?.length
                    ? deal.deal_participants
                    : null,
            );
            track(deal.deal_watchers?.length ? deal.deal_watchers : null);
        }
    }

    for (const field of customFieldsToCount) {
        track(getCustomFieldValue(deal, field.id));
    }

    return { filled, total };
}

function countCategoryCompletion(
    categoryId: number,
    deal: Deal,
    fields: CustomFieldDefinition[],
    visibleFieldKeys: string[] | null | undefined,
    visibilityMap: Record<number, boolean>,
): { filled: number; total: number } {
    const visibleFields = fields.filter(
        (field) =>
            Number(field.custom_field_category_id) === categoryId &&
            isCustomFieldCurrentlyVisible(
                field,
                visibleFieldKeys,
                visibilityMap,
            ),
    );
    const fieldsToCount = selectFieldsForCompletionCount(visibleFields);

    let filled = 0;
    for (const field of fieldsToCount) {
        if (isFilledValue(getCustomFieldValue(deal, field.id))) {
            filled += 1;
        }
    }

    return { filled, total: fieldsToCount.length };
}

export default function useDealInfoNavigation(
    deal: Deal,
    fields: CustomFieldDefinition[] = [],
    customFieldCategories: Array<{ id: number; name: string }> = [],
    consents: Array<{ name?: string }> = [],
    gdprSetting?: { enable_gdpr?: boolean } | null,
    visibleFieldKeys?: string[] | null,
) {
    return useMemo(() => {
        const nowSections = DEAL_INFO_CORE_SECTION_ORDER.slice(
            0,
            DEAL_INFO_NOW_SECTION_COUNT,
        );
        const laterCoreSections = DEAL_INFO_CORE_SECTION_ORDER.slice(
            DEAL_INFO_NOW_SECTION_COUNT,
        );
        const unmappedCategories = getUnmappedCategories(customFieldCategories);
        const visibilityMap = buildCustomFieldVisibilityMap(
            fields,
            deal.custom_fields_data,
            deal.id,
        );

        const coreSearchTerms = (
            sectionId: (typeof DEAL_INFO_CORE_SECTION_ORDER)[number],
        ) => [
            ...(CORE_SECTION_FIELD_LABELS[sectionId] ?? []),
            ...getCategoriesForCoreSection(sectionId, customFieldCategories)
                .flatMap((category) =>
                    fields
                        .filter(
                            (field) =>
                                Number(field.custom_field_category_id) ===
                                    category.id &&
                                isCustomFieldCurrentlyVisible(
                                    field,
                                    visibleFieldKeys,
                                    visibilityMap,
                                ),
                        )
                        .map((field) => field.label ?? field.name ?? ""),
                )
                .filter(Boolean),
        ];

        const categorySearchTerms = (categoryId: number) =>
            fields
                .filter(
                    (field) =>
                        Number(field.custom_field_category_id) === categoryId &&
                        isCustomFieldCurrentlyVisible(
                            field,
                            visibleFieldKeys,
                            visibilityMap,
                        ),
                )
                .map((field) => field.label ?? field.name ?? "")
                .filter(Boolean);

        const nowItems = nowSections.map((sectionId) => {
            const { filled, total } = countSectionCompletion(
                sectionId,
                deal,
                fields,
                customFieldCategories,
                visibleFieldKeys,
                visibilityMap,
            );
            const item = buildCoreNavItem(sectionId, false);
            return {
                ...item,
                badge: total > 0 ? `${filled}/${total}` : "--",
                completion: { filled, total },
                searchTerms: coreSearchTerms(sectionId),
            };
        });

        const laterItems = [
            ...laterCoreSections.map((sectionId) => {
                const { filled, total } = countSectionCompletion(
                    sectionId,
                    deal,
                    fields,
                    customFieldCategories,
                    visibleFieldKeys,
                    visibilityMap,
                );
                const item = buildCoreNavItem(sectionId, true);
                return {
                    ...item,
                    badge:
                        item.stageBadge ??
                        (total > 0 ? `${filled}/${total}` : "--"),
                    // A stage label (e.g. "Prospect") always wins visually over
                    // the fill count, so there's no dot to show alongside it.
                    completion: item.stageBadge ? undefined : { filled, total },
                    searchTerms: coreSearchTerms(sectionId),
                };
            }),
            ...unmappedCategories.map((category) => {
                const { filled, total } = countCategoryCompletion(
                    category.id,
                    deal,
                    fields,
                    visibleFieldKeys,
                    visibilityMap,
                );
                return {
                    id: toCategorySectionId(category.id),
                    label: category.name,
                    icon: "layers",
                    badge: total > 0 ? `${filled}/${total}` : "--",
                    completion: { filled, total },
                    badgeVariant: "gray" as const,
                    later: true,
                    searchTerms: categorySearchTerms(category.id),
                };
            }),
            // v2.2 places GDPR & consents as the very last nav item. Search
            // terms come from the deal's actual consent purposes (rendered
            // as the GDPR table's rows) — falls back to the generic labels
            // when consents haven't loaded, so the item stays findable.
            // Gated on the app-wide GDPR module toggle, same as the legacy
            // Deal view (Components/DealTabs.tsx:174).
            ...(gdprSetting?.enable_gdpr
                ? [
                      {
                          ...buildCoreNavItem("gdpr", true),
                          badge: undefined,
                          searchTerms: [
                              ...(CORE_SECTION_FIELD_LABELS.gdpr ?? []),
                              ...consents
                                  .map((consent) => consent.name ?? "")
                                  .filter(Boolean),
                          ],
                      },
                  ]
                : []),
        ];

        const navGroups: NavGroup[] = [
            { label: "Overview", items: nowItems },
            { label: "For this pipeline", items: laterItems },
        ];

        return { navGroups };
    }, [
        consents,
        customFieldCategories,
        deal,
        fields,
        gdprSetting,
        visibleFieldKeys,
    ]);
}
