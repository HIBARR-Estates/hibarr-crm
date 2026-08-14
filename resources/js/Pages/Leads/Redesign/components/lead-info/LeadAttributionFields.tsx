import DealEditableField from "@/Pages/Deals/Redesign/components/primitives/DealEditableField";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { Lead } from "@/Types/api/leads";
import { getDossierFieldValue } from "../../adapters/dossierAdapter";
import {
    formatPreferredContactTime,
    PREFERRED_CONTACT_TIME_LABELS,
    PREFERRED_CONTACT_TIME_VALUES,
} from "../../config/leadPreferredContactTime";
import {
    formatLeadTemperature,
    LEAD_TEMPERATURE_TONE,
} from "../../config/leadTemperature";

/**
 * Shared lead field editors for the Lead info tab and the dossier rail so both
 * write the same payload shape and read the same value fallbacks
 * (`categories` -> `category_ids` -> `category_id`).
 */
interface LeadAttributionFieldProps {
    lead: Lead;
    onFieldUpdate: (fieldName: string, value: unknown) => Promise<void>;
    isFieldLoading: (fieldName: string) => boolean;
    disabled?: boolean;
    /** Bulk section edit — render the input permanently. */
    alwaysEditing?: boolean;
    onChange?: (fieldName: string, value: unknown) => void;
}

export function LeadSourceField({
    lead,
    onFieldUpdate,
    isFieldLoading,
    disabled,
    alwaysEditing,
    onChange,
}: LeadAttributionFieldProps) {
    const display = getDossierFieldValue(lead, "source");

    return (
        <DealEditableField
            value={lead.source_id || null}
            fieldName="source_id"
            selectorType="sources"
            displayValue={
                display ? (
                    <span className="text-gray-700">{display}</span>
                ) : (
                    <span className="italic text-gray-400">--</span>
                )
            }
            onSave={(value) => onFieldUpdate("source_id", value)}
            alwaysEditing={alwaysEditing}
            onChange={onChange}
            loading={isFieldLoading("source_id")}
            disabled={disabled}
        />
    );
}

export function LeadCategoryField({
    lead,
    onFieldUpdate,
    isFieldLoading,
    disabled,
    alwaysEditing,
    onChange,
}: LeadAttributionFieldProps) {
    const selected =
        Array.isArray(lead.categories) && lead.categories.length
            ? lead.categories.map((category) => category.id)
            : Array.isArray(lead.category_ids) && lead.category_ids.length
              ? lead.category_ids
              : lead.category_id
                ? [lead.category_id]
                : [];

    const names =
        Array.isArray(lead.categories) && lead.categories.length
            ? lead.categories
                  .map((category) => category.category_name)
                  .filter(Boolean)
            : lead.category?.category_name
              ? [lead.category.category_name]
              : [];

    return (
        <DealEditableField
            value={selected}
            fieldName="category_ids"
            selectorType="categories"
            mode="multiple"
            displayValue={
                names.length ? (
                    <span className="text-gray-700">{names.join(", ")}</span>
                ) : (
                    <span className="italic text-gray-400">--</span>
                )
            }
            onSave={(value) => onFieldUpdate("category_ids", value)}
            alwaysEditing={alwaysEditing}
            onChange={onChange}
            loading={isFieldLoading("category_ids")}
            disabled={disabled}
        />
    );
}

export function LeadTemperatureField({
    lead,
    onFieldUpdate,
    isFieldLoading,
    disabled,
    alwaysEditing,
    onChange,
}: LeadAttributionFieldProps) {
    const { t } = useTranslation();

    return (
        <DealEditableField
            value={lead.temperature || ""}
            fieldName="temperature"
            fieldType="select"
            options={[
                {
                    label: t("pages.leads.info.fields.temperature_cold", {
                        defaultValue: "Cold",
                    }),
                    value: "cold",
                },
                {
                    label: t("pages.leads.info.fields.temperature_warm", {
                        defaultValue: "Warm",
                    }),
                    value: "warm",
                },
                {
                    label: t("pages.leads.info.fields.temperature_hot", {
                        defaultValue: "Hot",
                    }),
                    value: "hot",
                },
            ]}
            displayValue={
                lead.temperature ? (
                    <span
                        className={`v2-pill v2-pill-${LEAD_TEMPERATURE_TONE[lead.temperature]}`}
                    >
                        {formatLeadTemperature(lead.temperature)}
                    </span>
                ) : undefined
            }
            onSave={(value) => onFieldUpdate("temperature", value)}
            alwaysEditing={alwaysEditing}
            onChange={onChange}
            loading={isFieldLoading("temperature")}
            disabled={disabled}
        />
    );
}

export function LeadPreferredContactTimeField({
    lead,
    onFieldUpdate,
    isFieldLoading,
    disabled,
    alwaysEditing,
    onChange,
}: LeadAttributionFieldProps) {
    const { td } = useTd();

    return (
        <DealEditableField
            value={lead.preferred_contact_time || ""}
            fieldName="preferred_contact_time"
            fieldType="select"
            options={PREFERRED_CONTACT_TIME_VALUES.map((value) => ({
                label: td(PREFERRED_CONTACT_TIME_LABELS[value], {
                    source: "en",
                }),
                value,
            }))}
            displayValue={
                lead.preferred_contact_time ? (
                    <span className="text-gray-700">
                        {formatPreferredContactTime(
                            lead.preferred_contact_time,
                        )}
                    </span>
                ) : undefined
            }
            onSave={(value) =>
                onFieldUpdate("preferred_contact_time", value)
            }
            alwaysEditing={alwaysEditing}
            onChange={onChange}
            loading={isFieldLoading("preferred_contact_time")}
            disabled={disabled}
        />
    );
}
