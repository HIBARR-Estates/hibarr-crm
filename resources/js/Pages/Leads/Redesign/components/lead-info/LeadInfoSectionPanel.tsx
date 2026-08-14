import { type ReactNode, useCallback, useMemo, useState } from "react";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { DetailField } from "@/Components/DetailSection";
import LeadAgeFieldsGroup from "@/Components/LeadAgeFieldsGroup";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useFormData } from "@/Hooks/useFormData";
import useTranslation from "@/Hooks/useTranslation";
import {
    resolveLeadAgeFields,
} from "@/lib/leadAge";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import { parseCategorySectionId } from "@/Pages/Deals/Redesign/config/dealInfoSections";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import DealEditableField from "@/Pages/Deals/Redesign/components/primitives/DealEditableField";
import DealInfoGroupTitle from "@/Pages/Deals/Redesign/components/deal-info/DealInfoGroupTitle";
import type { Lead } from "@/Types/api/leads";
import { getDossierFieldValue } from "../../adapters/dossierAdapter";
import {
    getLeadInfoSection,
    isLeadInfoCoreSection,
} from "../../config/leadInfoSections";
import {
    LeadCategoryField,
    LeadReferrerField,
    LeadSourceField,
    LeadTemperatureField,
} from "./LeadAttributionFields";
import type { LeadFieldChange } from "../../hooks/useLeadInfoFieldUpdate";
import type { LeadInfoSectionId } from "../../types";

type AppLanguage = {
    language_code: string;
    language_name: string;
};

interface LeadInfoSectionPanelProps {
    sectionId: LeadInfoSectionId;
    lead: Lead;
    fields?: any[];
    customFieldCategories?: Array<{ id: number; name: string }>;
    canEdit: boolean;
    isFieldLoading: (fieldName: string) => boolean;
    updatingField: string | null;
    onFieldUpdate: (
        fieldName: string,
        value: unknown,
        type?: "custom_field",
    ) => Promise<void>;
    onFieldsUpdate: (changes: LeadFieldChange[]) => Promise<void>;
}

function FieldGrid({ children }: { children: ReactNode }) {
    return (
        <div className="mb-5 grid grid-cols-1 gap-4 gap-x-6 @lg:grid-cols-2">
            {children}
        </div>
    );
}

export default function LeadInfoSectionPanel({
    sectionId,
    lead,
    fields = [],
    customFieldCategories = [],
    canEdit,
    isFieldLoading,
    updatingField,
    onFieldUpdate,
    onFieldsUpdate,
}: LeadInfoSectionPanelProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage<any>();

    const [isEditing, setIsEditing] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<
        Record<string, { value: unknown; type?: "custom_field" }>
    >({});
    const [isSavingAll, setIsSavingAll] = useState(false);

    const editing = isEditing && canEdit;
    const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

    // Prefer shared page languages when present; otherwise fetch enabled
    // LanguageSetting rows from app language settings (same source as lead forms).
    const pageLanguages = useMemo(
        () => (props.languages as AppLanguage[]) || [],
        [props.languages],
    );
    const { data: fetchedLanguages } = useFormData<AppLanguage>("languages", {
        paginate: false,
        enabled: pageLanguages.length === 0,
    });
    const languageOptions = useMemo(() => {
        const source: AppLanguage[] =
            pageLanguages.length > 0 ? pageLanguages : fetchedLanguages || [];
        return source.map((lang: AppLanguage) => ({
            value: lang.language_code,
            label: lang.language_name,
        }));
    }, [pageLanguages, fetchedLanguages]);

    const resolveLanguageLabel = (code: string) =>
        languageOptions.find(
            (option: { value: string; label: string }) =>
                String(option.value).toLowerCase() === code.toLowerCase(),
        )?.label || code;

    const ageRangeOptions = useMemo(
        () =>
            (
                (props.ageRanges as Array<{ value: string; label: string }>) ||
                []
            ).map((option) => ({
                value: option.value,
                label: option.label,
            })),
        [props.ageRanges],
    );

    const resolveAgeRangeLabel = useCallback(
        (value: string) =>
            ageRangeOptions.find((option) => option.value === value)?.label ||
            value,
        [ageRangeOptions],
    );

    const resolvedAgeFields = useMemo(() => {
        const pendingDob = pendingChanges.date_of_birth?.value;
        const pendingAge = pendingChanges.age?.value;
        const pendingRange = pendingChanges.age_range?.value;

        return resolveLeadAgeFields({
            dateOfBirth:
                pendingDob !== undefined
                    ? ((pendingDob as string | null) ?? null)
                    : (lead.date_of_birth as string | null) ?? null,
            age:
                pendingAge !== undefined
                    ? pendingAge === null || pendingAge === ""
                        ? null
                        : Number(pendingAge)
                    : lead.age ?? null,
            ageRange:
                pendingRange !== undefined
                    ? ((pendingRange as string | null) ?? null)
                    : ((lead.age_range as string | null) ?? null),
        });
    }, [lead.age, lead.age_range, lead.date_of_birth, pendingChanges]);

    const handleFieldChange = (
        fieldName: string,
        value: unknown,
        type?: "custom_field",
    ) => {
        setPendingChanges((previous) => ({
            ...previous,
            [fieldName]: { value, type },
        }));
    };

    const attributionFieldProps = {
        lead,
        onFieldUpdate,
        isFieldLoading,
        disabled: !canEdit,
        alwaysEditing: editing,
        onChange: handleFieldChange,
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
            await onFieldsUpdate(
                Object.entries(pendingChanges).map(([fieldName, change]) => ({
                    fieldName,
                    value: change.value,
                    type: change.type,
                })),
            );
            message.success(t("pages.leads.info.save_all_success"));
            setPendingChanges({});
            setIsEditing(false);
        } catch {
            message.error(t("pages.leads.info.save_all_error"));
        } finally {
            setIsSavingAll(false);
        }
    };

    const categoryId = parseCategorySectionId(sectionId);
    const isCore = isLeadInfoCoreSection(sectionId);
    const coreSection = isCore ? getLeadInfoSection(sectionId) : undefined;
    const category = customFieldCategories.find(
        (item) => item.id === categoryId,
    );

    const sectionTitle = category?.name || coreSection?.title || "Lead info";
    const sectionSubtitle =
        coreSection?.subtitle ||
        "Click any field to edit, or switch the whole section into edit mode";

    const renderPersonal = () => (
        <>
            <FieldGrid>
                <DetailField label={td("Salutation", { source: "en" })}>
                    <DealEditableField
                        value={lead.salutation || ""}
                        fieldName="salutation"
                        selectorType="salutations"
                        displayValue={
                            getDossierFieldValue(lead, "salutation") ? (
                                <span className="capitalize">
                                    {getDossierFieldValue(lead, "salutation")}
                                </span>
                            ) : undefined
                        }
                        onSave={(value) => onFieldUpdate("salutation", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("salutation")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("Full name", { source: "en" })}>
                    <DealEditableField
                        value={lead.client_name || ""}
                        fieldName="client_name"
                        fieldType="text"
                        onSave={(value) => onFieldUpdate("client_name", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("client_name")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={td("Date of Birth & Age", { source: "en" })}
                    span={2}
                >
                    <LeadAgeFieldsGroup
                        dateOfBirth={resolvedAgeFields.dateOfBirth}
                        age={resolvedAgeFields.age}
                        ageRange={
                            (resolvedAgeFields.ageRange as string) || null
                        }
                        ageRangeOptions={ageRangeOptions}
                        resolveAgeRangeLabel={resolveAgeRangeLabel}
                        alwaysEditing={editing}
                        disabled={!canEdit}
                        loading={
                            isSavingAll ||
                            updatingField === "date_of_birth" ||
                            updatingField === "age" ||
                            updatingField === "age_range" ||
                            isFieldLoading("date_of_birth") ||
                            isFieldLoading("age") ||
                            isFieldLoading("age_range")
                        }
                        onSave={async (values) => {
                            await onFieldsUpdate([
                                {
                                    fieldName: "date_of_birth",
                                    value: values.date_of_birth,
                                },
                                {
                                    fieldName: "age",
                                    value: values.age,
                                },
                                {
                                    fieldName: "age_range",
                                    value: values.age_range,
                                },
                            ]);
                        }}
                        onChange={handleFieldChange}
                    />
                </DetailField>
                <DetailField label={td("Nationality", { source: "en" })}>
                    <DealEditableField
                        value={(lead as any).nationality || ""}
                        fieldName="nationality"
                        fieldType="country"
                        onSave={(value) => onFieldUpdate("nationality", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("nationality")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.leads.info.fields.gender")}>
                    <DealEditableField
                        value={lead.gender || ""}
                        fieldName="gender"
                        fieldType="select"
                        options={[
                            {
                                label: t("pages.leads.info.fields.gender_male"),
                                value: "male",
                            },
                            {
                                label: t(
                                    "pages.leads.info.fields.gender_female",
                                ),
                                value: "female",
                            },
                        ]}
                        displayValue={
                            lead.gender ? (
                                <span className="capitalize">
                                    {lead.gender}
                                </span>
                            ) : undefined
                        }
                        onSave={(value) => onFieldUpdate("gender", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("gender")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("Languages", { source: "en" })}>
                    <DealEditableField
                        value={(lead as any).languages || []}
                        fieldName="languages"
                        fieldType="multiselect"
                        options={languageOptions}
                        displayValue={
                            Array.isArray((lead as any).languages) &&
                                (lead as any).languages.length ? (
                                <span>
                                    {(lead as any).languages
                                        .map((code: string) =>
                                            resolveLanguageLabel(String(code)),
                                        )
                                        .join(", ")}
                                </span>
                            ) : undefined
                        }
                        onSave={(value) => onFieldUpdate("languages", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("languages")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("Occupation", { source: "en" })}>
                    <DealEditableField
                        value={(lead as any).occupation || ""}
                        fieldName="occupation"
                        fieldType="text"
                        onSave={(value) => onFieldUpdate("occupation", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        loading={isFieldLoading("occupation")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.leads.info.fields.company")}>
                    <DealEditableField
                        value={lead.company_name || ""}
                        fieldName="company_name"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("company_name", value)
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={t(
                            "pages.leads.info.placeholders.company",
                        )}
                        loading={isFieldLoading("company_name")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            <DealInfoGroupTitle>{td("Contact", { source: "en" })}</DealInfoGroupTitle>
            <FieldGrid>
                <DetailField
                    label={t("pages.leads.info.fields.email")}
                    copyValue={lead.client_email || undefined}
                >
                    <DealEditableField
                        value={lead.client_email || ""}
                        fieldName="client_email"
                        fieldType="email"
                        onSave={(value) =>
                            onFieldUpdate("client_email", value)
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={t("pages.leads.info.placeholders.email")}
                        loading={isFieldLoading("client_email")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.leads.info.fields.mobile")}
                    copyValue={
                        resolveLeadPhoneDisplay(
                            lead.mobile,
                            lead.mobile_with_phonecode,
                        ) || undefined
                    }
                >
                    <DealEditableField
                        value={resolveLeadPhoneDisplay(
                            lead.mobile,
                            lead.mobile_with_phonecode,
                        )}
                        fieldName="mobile"
                        fieldType="phone"
                        onSave={(value) => onFieldUpdate("mobile", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={t("pages.leads.info.placeholders.mobile")}
                        loading={isFieldLoading("mobile")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.leads.info.fields.office_phone")}
                    copyValue={
                        resolveLeadPhoneDisplay(
                            lead.office,
                            lead.office_phone_formatted,
                        ) || undefined
                    }
                >
                    <DealEditableField
                        value={resolveLeadPhoneDisplay(
                            lead.office,
                            lead.office_phone_formatted,
                        )}
                        fieldName="office"
                        fieldType="phone"
                        onSave={(value) => onFieldUpdate("office", value)}
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={t(
                            "pages.leads.info.placeholders.office_phone",
                        )}
                        loading={isFieldLoading("office")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("WhatsApp", { source: "en" })}>
                    <DealEditableField
                        value={resolveLeadPhoneDisplay(lead.client_whatsapp)}
                        fieldName="client_whatsapp"
                        fieldType="phone"
                        onSave={(value) =>
                            onFieldUpdate("client_whatsapp", value)
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={td("WhatsApp number", { source: "en" })}
                        loading={isFieldLoading("client_whatsapp")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("Telegram", { source: "en" })}>
                    <DealEditableField
                        value={lead.client_telegram || ""}
                        fieldName="client_telegram"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("client_telegram", value)
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={td("Telegram username", { source: "en" })}
                        loading={isFieldLoading("client_telegram")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={td("Instagram", { source: "en" })}>
                    <DealEditableField
                        value={lead.client_instagram || ""}
                        fieldName="client_instagram"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("client_instagram", value)
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        placeholder={td("Instagram username", { source: "en" })}
                        loading={isFieldLoading("client_instagram")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            <DealInfoGroupTitle>{td("Attribution", { source: "en" })}</DealInfoGroupTitle>
            <FieldGrid>
                <DetailField label={t("pages.leads.info.fields.lead_source")}>
                    <LeadSourceField {...attributionFieldProps} />
                </DetailField>
                <DetailField label={t("pages.leads.info.fields.category")}>
                    <LeadCategoryField {...attributionFieldProps} />
                </DetailField>
                <DetailField
                    label={t("pages.leads.info.fields.temperature", {
                        defaultValue: "Temperature",
                    })}
                >
                    <LeadTemperatureField {...attributionFieldProps} />
                </DetailField>
                <DetailField label={td("Referrer", { source: "en" })}>
                    <LeadReferrerField {...attributionFieldProps} />
                </DetailField>
                <DetailField
                    label={t("pages.leads.info.fields.joined_whatsapp_group")}
                >
                    <DealEditableField
                        value={
                            lead.marketing?.has_joined_the_whatsapp_group
                                ? 1
                                : 0
                        }
                        fieldName="has_joined_the_whatsapp_group"
                        fieldType="boolean"
                        onSave={(value) =>
                            onFieldUpdate(
                                "has_joined_the_whatsapp_group",
                                value,
                            )
                        }
                        alwaysEditing={editing}
                        onChange={handleFieldChange}
                        displayValue={
                            <span className="text-gray-700">
                                {lead.marketing?.has_joined_the_whatsapp_group
                                    ? t("pages.leads.marketing.yes")
                                    : t("pages.leads.marketing.no")}
                            </span>
                        }
                        loading={isFieldLoading(
                            "has_joined_the_whatsapp_group",
                        )}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.leads.info.fields.added_by")}>
                    <span className="text-[13px] text-[#0f172a]">
                        {getDossierFieldValue(lead, "addedBy") || (
                            <span className="italic text-gray-400">--</span>
                        )}
                    </span>
                </DetailField>
            </FieldGrid>
        </>
    );

    const renderAddress = () => (
        <FieldGrid>
            <DetailField
                label={td("Street address", { source: "en" })}
                span={2}
                useContainerQuery
            >
                <DealEditableField
                    value={lead.address || ""}
                    fieldName="address"
                    fieldType="textarea"
                    onSave={(value) => onFieldUpdate("address", value)}
                    alwaysEditing={editing}
                    onChange={handleFieldChange}
                    placeholder={td("Street, building, unit…", { source: "en" })}
                    loading={isFieldLoading("address")}
                    disabled={!canEdit}
                />
            </DetailField>
            <DetailField label={t("pages.leads.info.fields.postal_code")}>
                <DealEditableField
                    value={lead.postal_code || ""}
                    fieldName="postal_code"
                    fieldType="text"
                    onSave={(value) => onFieldUpdate("postal_code", value)}
                    alwaysEditing={editing}
                    onChange={handleFieldChange}
                    placeholder={t(
                        "pages.leads.info.placeholders.postal_code",
                    )}
                    loading={isFieldLoading("postal_code")}
                    disabled={!canEdit}
                />
            </DetailField>
            <DetailField label={t("pages.leads.info.fields.city")}>
                <DealEditableField
                    value={lead.city || ""}
                    fieldName="city"
                    fieldType="text"
                    onSave={(value) => onFieldUpdate("city", value)}
                    alwaysEditing={editing}
                    onChange={handleFieldChange}
                    placeholder={t("pages.leads.info.placeholders.city")}
                    loading={isFieldLoading("city")}
                    disabled={!canEdit}
                />
            </DetailField>
            <DetailField label={t("pages.leads.info.fields.state")}>
                <DealEditableField
                    value={lead.state || ""}
                    fieldName="state"
                    fieldType="text"
                    onSave={(value) => onFieldUpdate("state", value)}
                    alwaysEditing={editing}
                    onChange={handleFieldChange}
                    placeholder={t("pages.leads.info.placeholders.state")}
                    loading={isFieldLoading("state")}
                    disabled={!canEdit}
                />
            </DetailField>
            <DetailField label={t("pages.leads.info.fields.country")}>
                <DealEditableField
                    value={lead.country || ""}
                    fieldName="country"
                    fieldType="country"
                    onSave={(value) => onFieldUpdate("country", value)}
                    alwaysEditing={editing}
                    onChange={handleFieldChange}
                    placeholder={t(
                        "pages.leads.info.placeholders.country",
                    )}
                    loading={isFieldLoading("country")}
                    disabled={!canEdit}
                />
            </DetailField>
        </FieldGrid>
    );

    const renderCategorySection = () => {
        if (categoryId == null) return null;
        return (
            <CustomFieldDisplay
                fields={fields}
                customFieldsData={lead.custom_fields_data ?? {}}
                categoryId={categoryId}
                useContainerQuery
                bare
                column={2}
                onUpdate={(field, value) =>
                    onFieldUpdate(field, value, "custom_field")
                }
                editable={editing}
                onChange={(fieldName, value) =>
                    handleFieldChange(fieldName, value, "custom_field")
                }
                loadingField={updatingField}
                disabled={!canEdit}
                activateOnSingleClick
            />
        );
    };

    const renderSectionBody = () => {
        if (categoryId != null) return renderCategorySection();
        switch (sectionId) {
            case "personal":
                return renderPersonal();
            case "address":
                return renderAddress();
            default:
                return null;
        }
    };

    return (
        <section className="@container pl-[26px] pt-1">
            <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                    <h3 className="mb-0.5 text-base font-medium text-[#0f172a]">
                        {td(sectionTitle, { source: "en" })}
                    </h3>
                    <p className="text-xs text-[#5b6472]">
                        {td(sectionSubtitle, { source: "en" })}
                    </p>
                </div>
                {canEdit &&
                    (isEditing ? (
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
                                {t("pages.leads.info.actions.cancel_edit")}
                            </DealButton>
                            <DealButton
                                variant="primary"
                                size="sm"
                                onClick={handleSaveAll}
                                disabled={!hasUnsavedChanges || isSavingAll}
                                loading={isSavingAll}
                            >
                                {t("pages.leads.info.actions.save_all_tooltip")}
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
                    ))}
            </div>
            {renderSectionBody()}
        </section>
    );
}
