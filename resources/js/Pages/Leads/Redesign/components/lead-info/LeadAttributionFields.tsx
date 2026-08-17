import { useState } from "react";
import DealEditableField from "@/Pages/Deals/Redesign/components/primitives/DealEditableField";
import DealConfirmDialog from "@/Pages/Deals/Redesign/components/primitives/DealConfirmDialog";
import FormDataSelector from "@/Components/FormDataSelector";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { Lead } from "@/Types/api/leads";
import { getDossierFieldValue } from "../../adapters/dossierAdapter";
import {
    formatPreferredContactTimes,
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

/**
 * Referrer (the partner who introduced the lead) — write-once.
 * Already set: read-only name. Not set: pick an agent, confirm, save.
 * ponytail: deliberately outside the section's bulk-edit/Save All flow so the
 * confirmation can never be bypassed; it always saves on its own.
 */
export function LeadReferrerField({
    lead,
    onFieldUpdate,
    isFieldLoading,
    disabled,
}: LeadAttributionFieldProps) {
    const { td } = useTd();
    const [pending, setPending] = useState<{ id: number; name: string } | null>(
        null,
    );
    const [saving, setSaving] = useState(false);

    if (lead.referred_by_agent_id) {
        return (
            <span className="text-gray-700">
                {lead.referred_by_agent?.user?.name ||
                    `#${lead.referred_by_agent_id}`}
            </span>
        );
    }

    if (disabled) {
        return <span className="italic text-gray-400">--</span>;
    }

    return (
        <>
            <FormDataSelector
                type="lead-agents"
                value={pending?.id ?? null}
                onSelect={(value, entity) =>
                    setPending({
                        id: Number(value),
                        name: entity?.user?.name || `#${value}`,
                    })
                }
                placeholder={td("Select referrer", { source: "en" })}
                className="w-full min-w-[200px]"
                allowClear={false}
                disabled={isFieldLoading("referred_by_agent_id")}
            />
            <DealConfirmDialog
                open={pending !== null}
                title={td("Set referrer?", { source: "en" })}
                message={td(
                    `The referrer can only be set once. Saving ${pending?.name ?? ""} here is permanent — it cannot be changed or removed afterwards.`,
                    { source: "en" },
                )}
                confirmLabel={td("Set referrer", { source: "en" })}
                confirmLoading={saving}
                onConfirm={async () => {
                    if (!pending) return;
                    setSaving(true);
                    try {
                        await onFieldUpdate(
                            "referred_by_agent_id",
                            pending.id,
                        );
                        setPending(null);
                    } catch {
                        // useLeadInfoFieldUpdate already surfaced the error.
                    } finally {
                        setSaving(false);
                    }
                }}
                onCancel={() => setPending(null)}
            />
        </>
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

    const preferredTimes =
        lead.preferred_contact_times && lead.preferred_contact_times.length > 0
            ? lead.preferred_contact_times
            : lead.preferred_contact_time
              ? [lead.preferred_contact_time]
              : [];

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
                preferredTimes.length > 0 ? (
                    <span className="text-gray-700">
                        {td(
                            formatPreferredContactTimes(
                                lead.preferred_contact_times,
                                lead.preferred_contact_time,
                            ),
                            { source: "en" },
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
