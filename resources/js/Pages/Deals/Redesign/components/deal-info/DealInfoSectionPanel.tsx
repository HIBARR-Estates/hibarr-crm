import { type ReactNode, useState } from "react";
import { message } from "antd";
import axios from "axios";
import dayjs from "dayjs";
import { formatCompanyDate } from "@/lib/companyDateTime";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { DetailField } from "@/Components/DetailSection";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal, HibarrDealFields } from "@/Types/api/deals";
import DealPackagePropertyManager from "./DealPackagePropertyManager";
import {
    DEAL_INFO_SECTION_TITLES,
    getCategoriesForCoreSection,
    isCategorySectionId,
    parseCategorySectionId,
} from "../../config/dealInfoSections";
import type { DealInfoCoreSectionId, DealInfoSectionId } from "../../types";
import DealButton from "../primitives/DealButton";
import DealEditableField from "../primitives/DealEditableField";
import DealSwitch from "../primitives/DealSwitch";
import DealInfoGroupTitle from "./DealInfoGroupTitle";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface DealInfoSectionPanelProps {
    sectionId: DealInfoSectionId;
    deal: Deal;
    fields: any[];
    customFieldCategories: Array<{ id: number; name: string }>;
    visibleFieldKeys?: string[] | null;
    canEdit: boolean;
    isLocked: boolean;
    isFieldLoading: (fieldName: string) => boolean;
    updatingField: string | null;
    onFieldUpdate: (
        fieldName: string,
        value: unknown,
        type?: "details" | "contact" | "custom_field" | "hibarr_field",
    ) => Promise<void>;
    /** Batched save for edit mode — persists every changed field grouped by
     * type in ≤4 requests instead of one PATCH per field. */
    onFieldsUpdate: (
        changes: Array<{
            fieldName: string;
            value: unknown;
            type?: "details" | "contact" | "custom_field" | "hibarr_field";
        }>,
    ) => Promise<void>;
    restrictPackageOrProperty?: boolean;
    consents?: any[];
    gdprSetting?: { enable_gdpr?: boolean } | null;
}

function FieldGrid({ children }: { children: ReactNode }) {
    // @lg here queries this panel's own rendered width (see the @container on
    // the <section> root below), not the viewport — the panel sits next to a
    // fixed sidebar/rail, so it can stay narrow on a wide screen and vice
    // versa; a viewport breakpoint was switching to 2 columns even when the
    // panel itself had no room, making fields hard to fill.
    return (
        <div className="mb-5 grid grid-cols-1 gap-4 gap-x-6 @lg:grid-cols-2">
            {children}
        </div>
    );
}

export default function DealInfoSectionPanel({
    sectionId,
    deal,
    fields,
    customFieldCategories,
    visibleFieldKeys,
    canEdit,
    isLocked,
    isFieldLoading,
    updatingField,
    onFieldUpdate,
    onFieldsUpdate,
    restrictPackageOrProperty = false,
    consents = [],
    gdprSetting = null,
}: DealInfoSectionPanelProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    // Tracks unsaved edits made while the section is in bulk "Edit fields"
    // mode (v2.2's "switch the whole section into edit mode" — see
    // sectionSubtitle below), keyed by field name so Save can persist all of
    // them and Cancel can discard them without touching the deal. Mirrors
    // the pendingChanges/handleSaveAll pattern already established in the
    // legacy Deal info tab (Pages/Deals/Components/DealInfoSection.tsx).
    const [pendingChanges, setPendingChanges] = useState<
        Record<
            string,
            {
                value: unknown;
                type?: "details" | "contact" | "custom_field" | "hibarr_field";
            }
        >
    >({});
    const [isSavingAll, setIsSavingAll] = useState(false);
    const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;
    const { t } = useTranslation();
    const { td } = useTd();
    const { setDeal } = useDealWorkspace();
    const hibarrFields: Partial<HibarrDealFields> = deal.hibarr_fields || {};
    const editing = isEditing && canEdit;

    const refreshDeal = async () => {
        const response = await axios.get(route("deals.refresh", deal.id));
        if (response.data?.status === "success" && response.data?.data) {
            setDeal(response.data.data);
        }
    };

    const handleFieldChange = (
        fieldName: string,
        value: unknown,
        type?: "details" | "contact" | "custom_field" | "hibarr_field",
    ) => {
        setPendingChanges((previous) => ({
            ...previous,
            [fieldName]: { value, type },
        }));
    };

    const handleEnterEdit = () => {
        setPendingChanges({});
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setPendingChanges({});
        setIsEditing(false);
    };

    const handleSaveAll = async () => {
        if (!hasUnsavedChanges) return;
        setIsSavingAll(true);
        try {
            // One batched save: onFieldsUpdate groups every change by type and
            // sends a single request per type (≤4 total), rather than a PATCH
            // per field.
            await onFieldsUpdate(
                Object.entries(pendingChanges).map(([fieldName, change]) => ({
                    fieldName,
                    value: change.value,
                    type: change.type,
                })),
            );
            message.success(t("pages.deals.info.save_all_success"));
            setPendingChanges({});
            setIsEditing(false);
        } catch {
            message.error(t("pages.deals.info.save_all_error"));
        } finally {
            setIsSavingAll(false);
        }
    };

    const categoryId = isCategorySectionId(sectionId)
        ? parseCategorySectionId(sectionId)
        : null;

    const sectionTitle = categoryId
        ? customFieldCategories.find((category) => category.id === categoryId)
            ?.name || "Custom fields"
        : DEAL_INFO_SECTION_TITLES[sectionId as DealInfoCoreSectionId];

    // v2.2's lock/gdpr-aware subtitle copy (deal-v2-2.jsx:3417-3420) — no
    // per-section static text, since none of it was actually per-section.
    const sectionSubtitle =
        sectionId === "gdpr"
            ? "Lead-level consent records — read only"
            : isLocked
                ? "Deal is locked — fields are read only"
                : "Click any field to edit, or switch the whole section into edit mode";

    const mappedCategories = !categoryId
        ? getCategoriesForCoreSection(
            sectionId as DealInfoCoreSectionId,
            customFieldCategories,
        )
        : [];

    const renderCustomFields = (
        categoryIds: number[],
        showGroupTitles = true,
    ) =>
        categoryIds.map((id) => {
            const category = customFieldCategories.find(
                (item) => item.id === id,
            );
            if (!category) return null;
            return (
                <div key={id} className="mb-4">
                    {showGroupTitles && mappedCategories.length > 1 ? (
                        <DealInfoGroupTitle>{td(category.name)}</DealInfoGroupTitle>
                    ) : null}
                    <CustomFieldDisplay
                        fields={fields}
                        customFieldsData={deal.custom_fields_data || {}}
                        categoryId={id}
                        visibleFieldKeys={visibleFieldKeys}
                        useContainerQuery
                        bare
                        column={2}
                        onUpdate={(field, value) =>
                            onFieldUpdate(field, value, "custom_field")
                        }
                        editable={editing}
                        onChange={handleFieldChange}
                        loadingField={updatingField}
                        disabled={!canEdit}
                        activateOnSingleClick
                    />
                </div>
            );
        });

    const renderGeneral = () => (
        <>
            <DealInfoGroupTitle>
                {t("pages.deals.info.sections.overview")}
            </DealInfoGroupTitle>
            <FieldGrid>
                <DetailField label={t("pages.deals.info.fields.deal_name")}>
                    <DealEditableField
                        value={deal.name}
                        fieldName="name"
                        fieldType="text"
                        onSave={(value) => onFieldUpdate("name", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("name")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.close_date")}>
                    <DealEditableField
                        value={deal.close_date}
                        fieldName="close_date"
                        fieldType="date"
                        onSave={(value) => onFieldUpdate("close_date", value)}
                        formatValue={(value) =>
                            value
                                ? formatCompanyDate(String(value))
                                : t("pages.deals.common.not_set")
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("close_date")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.deal_category")}>
                    <DealEditableField
                        value={deal.category_id}
                        fieldName="category_id"
                        selectorType="categories"
                        displayValue={
                            deal.category?.category_name ? (
                                <span className="text-gray-700">
                                    {deal.category.category_name}
                                </span>
                            ) : (
                                <span className="italic text-gray-400">
                                    {t("pages.deals.common.not_set")}
                                </span>
                            )
                        }
                        onSave={(value) => onFieldUpdate("category_id", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("category_id")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            <DealPackagePropertyManager
                deal={deal}
                canEdit={canEdit}
                restrictPackageOrProperty={restrictPackageOrProperty}
                onFieldUpdate={onFieldUpdate}
                packagesLoading={isFieldLoading("package_id")}
                onManageProperties={() => setPropertyModalOpen(true)}
                onRefresh={refreshDeal}
            />

            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}

            <ManageDealPropertiesModal
                open={propertyModalOpen}
                onClose={() => setPropertyModalOpen(false)}
                deal={deal}
                onRefresh={refreshDeal}
            />
        </>
    );

    const renderPrefTimeline = () => (
        <>
            <FieldGrid>
                <DetailField label={t("pages.deals.info.fields.interested_in")}>
                    <DealEditableField
                        value={hibarrFields.interested_in}
                        fieldName="interested_in"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("interested_in", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        onChange={(fieldName, value) =>
                            handleFieldChange(fieldName, value, "hibarr_field")
                        }
                        loading={isFieldLoading("interested_in")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.budget_range")}>
                    <DealEditableField
                        value={hibarrFields.budget_range}
                        fieldName="budget_range"
                        fieldType="currency_range"
                        onSave={(value) =>
                            onFieldUpdate("budget_range", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        onChange={(fieldName, value) =>
                            handleFieldChange(fieldName, value, "hibarr_field")
                        }
                        loading={isFieldLoading("budget_range")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.purchase_timeline")}>
                    <DealEditableField
                        value={hibarrFields.purchase_timeline}
                        fieldName="purchase_timeline"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate(
                                "purchase_timeline",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        onChange={(fieldName, value) =>
                            handleFieldChange(fieldName, value, "hibarr_field")
                        }
                        loading={isFieldLoading("purchase_timeline")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.inspection_trip_date")}
                >
                    <DealEditableField
                        value={hibarrFields.inspection_trip_date}
                        fieldName="inspection_trip_date"
                        fieldType="date"
                        onSave={(value) =>
                            onFieldUpdate(
                                "inspection_trip_date",
                                value,
                                "hibarr_field",
                            )
                        }
                        formatValue={(value) =>
                            value
                                ? formatCompanyDate(String(value))
                                : t("pages.deals.common.not_set")
                        }
                        alwaysEditing={editing}
                        onChange={(fieldName, value) =>
                            handleFieldChange(fieldName, value, "hibarr_field")
                        }
                        loading={isFieldLoading("inspection_trip_date")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.strategy_meeting_booked")}
                >
                    <DealSwitch
                        checked={!!hibarrFields.strategy_meeting_booked}
                        onChange={() =>
                            onFieldUpdate(
                                "strategy_meeting_booked",
                                hibarrFields.strategy_meeting_booked ? 0 : 1,
                                "hibarr_field",
                            )
                        }
                        label={
                            hibarrFields.strategy_meeting_booked
                                ? t("pages.deals.common.yes")
                                : t("pages.deals.common.no")
                        }
                        aria-label={t(
                            "pages.deals.info.fields.strategy_meeting_booked",
                        )}
                        disabled={!canEdit}
                        loading={isFieldLoading("strategy_meeting_booked")}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.downpayment_paid")}>
                    <DealSwitch
                        checked={!!hibarrFields.downpayment_paid}
                        onChange={() =>
                            onFieldUpdate(
                                "downpayment_paid",
                                hibarrFields.downpayment_paid ? 0 : 1,
                                "hibarr_field",
                            )
                        }
                        label={
                            hibarrFields.downpayment_paid
                                ? t("pages.deals.common.yes")
                                : t("pages.deals.common.no")
                        }
                        aria-label={t(
                            "pages.deals.info.fields.downpayment_paid",
                        )}
                        disabled={!canEdit}
                        loading={isFieldLoading("downpayment_paid")}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.motivation")}
                    span={2}
                    useContainerQuery
                >
                    <DealEditableField
                        value={hibarrFields.motivation}
                        fieldName="motivation"
                        fieldType="textarea"
                        onSave={(value) =>
                            onFieldUpdate("motivation", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        onChange={(fieldName, value) =>
                            handleFieldChange(fieldName, value, "hibarr_field")
                        }
                        loading={isFieldLoading("motivation")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}
        </>
    );

    // v2.2 GDPR & consents section (deal-v2-2.jsx:3513-3541) — read-only table.
    const renderGdpr = () => {
        if (!gdprSetting?.enable_gdpr) {
            return (
                <p className="text-[13px] italic text-[#9ca3af]">
                    {t("pages.deals.info.gdpr.not_enabled")}
                </p>
            );
        }
        if (consents.length === 0) {
            return (
                <p className="text-[13px] italic text-[#9ca3af]">
                    {t("pages.deals.info.gdpr.no_consents")}
                </p>
            );
        }
        return (
            <div style={{ maxWidth: 640 }}>
                <div className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                    <table className="dr-table">
                        <thead>
                            <tr>
                                <th scope="col">{t("pages.deals.info.gdpr.purpose")}</th>
                                <th scope="col">{t("pages.deals.info.gdpr.description")}</th>
                                <th scope="col">{t("pages.deals.info.gdpr.status")}</th>
                                <th scope="col">{t("pages.deals.info.gdpr.date")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {consents.map((consent) => {
                                const granted =
                                    Array.isArray(consent.lead) &&
                                    consent.lead.length > 0;
                                return (
                                    <tr key={consent.id}>
                                        <td className="font-semibold text-[#1a1f2e]">
                                            {td(consent.name)}
                                        </td>
                                        <td className="text-[#5b6472]">
                                            {td(consent.description)}
                                        </td>
                                        <td>
                                            <span
                                                className={`dr-pill ${granted
                                                    ? "dr-pill-green"
                                                    : "dr-pill-red"
                                                    }`}
                                            >
                                                {granted
                                                    ? t("pages.deals.info.gdpr.granted")
                                                    : t(
                                                        "pages.deals.info.gdpr.not_granted",
                                                    )}
                                            </span>
                                        </td>
                                        <td className="text-[#5b6472]">
                                            {granted && consent.lead[0]?.created_at
                                                ? formatCompanyDate(
                                                    consent.lead[0].created_at,
                                                )
                                                : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-2 text-[12px] leading-normal text-[#5b6472]">
                    {t("pages.deals.info.gdpr.consent_hint")}
                </div>
            </div>
        );
    };

    const renderMappedOnly = () =>
        mappedCategories.length > 0 ? (
            renderCustomFields(
                mappedCategories.map((category) => category.id),
                true,
            )
        ) : (
            <p className="text-xs text-[#8b95a7]">
                {t("pages.deals.info.mapped_only_hint_prefix")}{" "}
                <code className="text-[12px]">DEAL_INFO_CATEGORY_SECTION_MAP</code>{" "}
                {t("pages.deals.info.mapped_only_hint_suffix")}
            </p>
        );

    const renderCategorySection = () => {
        if (!categoryId) return null;
        return (
            <CustomFieldDisplay
                fields={fields}
                customFieldsData={deal.custom_fields_data || {}}
                categoryId={categoryId}
                visibleFieldKeys={visibleFieldKeys}
                useContainerQuery
                bare
                column={2}
                onUpdate={(field, value) =>
                    onFieldUpdate(field, value, "custom_field")
                }
                editable={editing}
                onChange={handleFieldChange}
                loadingField={updatingField}
                disabled={!canEdit}
                activateOnSingleClick
            />
        );
    };

    const renderSectionBody = () => {
        if (categoryId) return renderCategorySection();
        switch (sectionId as DealInfoCoreSectionId) {
            case "general":
                return renderGeneral();
            case "preftimeline":
                return renderPrefTimeline();
            case "gdpr":
                return renderGdpr();
            default:
                return renderMappedOnly();
        }
    };

    // v2.2: GDPR is a read-only section with no edit toggle.
    const editableSection = sectionId !== "gdpr";

    return (
        <section className="@container pl-[26px] pt-1">
            <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                    <h3 className="mb-0.5 text-base font-medium text-[#0f172a]">
                        {td(sectionTitle)}
                    </h3>
                    <p className="text-xs text-[#5b6472]">
                        {td(sectionSubtitle)}
                    </p>
                </div>
                {canEdit && editableSection && (
                    isEditing ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {hasUnsavedChanges && (
                                <span className="text-xs text-amber-600">
                                    {t("pages.deals.info.unsaved_changes", {
                                        count: Object.keys(pendingChanges)
                                            .length,
                                    })}
                                </span>
                            )}
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={isSavingAll}
                            >
                                {t("pages.deals.info.actions.cancel_edit")}
                            </DealButton>
                            <DealButton
                                variant="primary"
                                size="sm"
                                onClick={handleSaveAll}
                                disabled={!hasUnsavedChanges || isSavingAll}
                                loading={isSavingAll}
                            >
                                {t("pages.deals.info.actions.save_all_tooltip")}
                            </DealButton>
                        </div>
                    ) : (
                        <DealButton
                            variant="ghost"
                            size="sm"
                            onClick={handleEnterEdit}
                        >
                            {t("pages.deals.info.edit_fields")}
                        </DealButton>
                    )
                )}
            </div>
            {renderSectionBody()}
        </section>
    );
}
