import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Lead, LeadCategory } from "@/Types/api/leads";
import { Modal, ModalField } from "@/Components/Redesign";
import {
    computeAgeFieldsFromDateOfBirth,
    computeAgeRangeFromAge,
} from "@/lib/leadAge";
import { getLeadNativeEditValue } from "../../adapters/dossierAdapter";
import { LEAD_INFO_CORE_SECTIONS } from "../../config/leadInfoSections";
import type { LeadInfoCoreSectionId } from "../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";

type EditTabId = "identity" | LeadInfoCoreSectionId;

interface EditLeadDetailsModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    salutations: Array<{ value: string; label: string }>;
    ageRanges?: Array<{ value: string; label: string }>;
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    sources: Array<{ id: number; type: string }>;
    categories: LeadCategory[];
}

function splitName(fullName: string): { first: string; last: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return {
        first: parts[0] ?? "",
        last: parts.slice(1).join(" "),
    };
}

export default function EditLeadDetailsModal({
    open,
    onClose,
    lead,
    salutations,
    ageRanges = [],
    countries,
    sources,
    categories,
}: EditLeadDetailsModalProps) {
    const { td } = useTd();
    const { setLead } = useLeadWorkspace();
    const [tab, setTab] = useState<EditTabId>("identity");
    const [saving, setSaving] = useState(false);

    const initial = useMemo(() => {
        const { first, last } = splitName(lead.client_name ?? "");
        const dob =
            typeof lead.date_of_birth === "string"
                ? lead.date_of_birth.split("T")[0]
                : "";
        const values: Record<string, string> = {
            client_name: lead.client_name ?? "",
            first_name: first,
            last_name: last,
            salutation: String(lead.salutation ?? ""),
            date_of_birth: dob,
            age: lead.age != null ? String(lead.age) : "",
            age_range: String(lead.age_range ?? ""),
        };

        for (const section of LEAD_INFO_CORE_SECTIONS) {
            for (const field of section.fields) {
                if (!field.leadField || field.readOnly) continue;
                if (
                    field.leadField === "date_of_birth" ||
                    field.leadField === "age" ||
                    field.leadField === "age_range"
                ) {
                    continue;
                }
                values[field.leadField] = getLeadNativeEditValue(
                    lead,
                    field.key,
                    field.leadField,
                );
            }
        }

        return values;
    }, [lead]);

    const [form, setForm] = useState(initial);

    useEffect(() => {
        if (open) {
            setForm(initial);
            setTab("identity");
        }
    }, [open, initial]);

    const setField = useCallback((key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const tabs: { id: EditTabId; label: string }[] = [
        { id: "identity", label: "Identity" },
        ...LEAD_INFO_CORE_SECTIONS.map((section) => ({
            id: section.id as EditTabId,
            label: section.title,
        })),
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                client_name: form.client_name?.trim(),
                salutation: form.salutation || null,
            };

            for (const section of LEAD_INFO_CORE_SECTIONS) {
                for (const field of section.fields) {
                    if (!field.leadField || field.readOnly) continue;
                    const raw = form[field.leadField];
                    if (field.leadField === "value") {
                        payload.value = raw ? Number(raw) : null;
                    } else if (field.leadField === "currency_id") {
                        payload.currency_id = raw ? Number(raw) : null;
                    } else if (
                        field.leadField === "source_id"
                    ) {
                        payload[field.leadField] = raw ? Number(raw) : null;
                    } else if (field.leadField === "category_ids") {
                        payload.category_ids = raw
                            ? String(raw)
                                  .split(",")
                                  .map((s) => Number(s.trim()))
                                  .filter((n) => Number.isFinite(n) && n > 0)
                            : [];
                    } else if (field.leadField === "languages") {
                        payload.languages = raw
                            ? raw.split(",").map((s) => s.trim()).filter(Boolean)
                            : [];
                    } else if (field.leadField === "age") {
                        payload.age = raw ? Number(raw) : null;
                    } else if (field.leadField === "date_of_birth") {
                        if (raw) {
                            const computed =
                                computeAgeFieldsFromDateOfBirth(raw);
                            payload.date_of_birth = raw;
                            payload.age = computed.age;
                            payload.age_range = computed.age_range;
                        } else {
                            payload.date_of_birth = null;
                            payload.age = form.age ? Number(form.age) : null;
                            payload.age_range = form.age_range || null;
                        }
                    } else {
                        payload[field.leadField] = raw || null;
                    }
                }
            }

            const response = await axios.patch(
                route("lead-contact.patch", { lead_contact: lead.id }),
                payload,
                { headers: { Accept: "application/json" } },
            );

            const updated = response.data?.data?.lead as
                | Record<string, unknown>
                | undefined;

            if (response.data?.status !== "success" || !updated) {
                throw new Error(
                    response.data?.message || "Failed to save lead details",
                );
            }

            setLead((prev) => ({ ...prev, ...updated }) as Lead);
            message.success(td("Lead details saved"));
            onClose();
        } catch (error: unknown) {
            const detail =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                (error as Error)?.message ||
                td("Failed to save lead details");
            message.error(detail);
        } finally {
            setSaving(false);
        }
    };

    const renderFieldInput = (
        fieldKey: string,
        label: string,
        type: "text" | "select" = "text",
        options?: Array<{ value: string; label: string }>,
    ) => (
        <ModalField key={fieldKey} label={td(label)}>
            {type === "select" ? (
                <select
                    className="v2-input"
                    value={form[fieldKey] ?? ""}
                    onChange={(e) => setField(fieldKey, e.target.value)}
                >
                    <option value="">{td("Select…")}</option>
                    {(options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    className="v2-input"
                    type="text"
                    value={form[fieldKey] ?? ""}
                    onChange={(e) => setField(fieldKey, e.target.value)}
                />
            )}
        </ModalField>
    );

    return (
        <Modal
            open={open}
            title={td("Edit lead details")}
            onClose={onClose}
            dirty={JSON.stringify(form) !== JSON.stringify(initial)}
            footer={
                <>
                    <button
                        type="button"
                        className="v2-btn v2-btn-ghost"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {td("Cancel")}
                    </button>
                    <button
                        type="button"
                        className="v2-btn v2-btn-primary"
                        onClick={() => void handleSave()}
                        disabled={saving}
                    >
                        {saving ? td("Saving…") : td("Save changes")}
                    </button>
                </>
            }
        >
            <div
                className="v2-workspace-tabs"
                style={{ margin: "-4px -2px 16px", padding: 0 }}
            >
                {tabs.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`v2-tab${tab === item.id ? " active" : ""}`}
                        onClick={() => setTab(item.id)}
                    >
                        {td(item.label)}
                    </button>
                ))}
            </div>

            {tab === "identity" && (
                <>
                    {renderFieldInput("client_name", "Full name")}
                    {renderFieldInput("first_name", "First name")}
                    {renderFieldInput(
                        "salutation",
                        "Salutation",
                        "select",
                        salutations.map((s) => ({
                            value: s.value,
                            label: s.label,
                        })),
                    )}
                </>
            )}

            {LEAD_INFO_CORE_SECTIONS.map((section) => {
                if (tab !== section.id) return null;

                const editableFields = section.fields.filter(
                    (field) => field.leadField && !field.readOnly,
                );

                if (editableFields.length === 0) {
                    return (
                        <p
                            key={section.id}
                            style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}
                        >
                            {td("No editable fields in this section.")}
                        </p>
                    );
                }

                return (
                    <div key={section.id}>
                        {editableFields.map((field) => {
                            if (!field.leadField) return null;

                            if (field.leadField === "country") {
                                return renderFieldInput(
                                    "country",
                                    field.label,
                                    "select",
                                    countries.map((c) => ({
                                        value: c.iso,
                                        label: c.nicename,
                                    })),
                                );
                            }
                            if (field.leadField === "source_id") {
                                return renderFieldInput(
                                    "source_id",
                                    field.label,
                                    "select",
                                    sources.map((s) => ({
                                        value: String(s.id),
                                        label: s.type,
                                    })),
                                );
                            }
                            if (field.leadField === "category_ids") {
                                const selected = new Set(
                                    String(form.category_ids ?? "")
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                );
                                return (
                                    <ModalField
                                        key="category_ids"
                                        label={td(field.label)}
                                    >
                                        <select
                                            className="v2-input"
                                            multiple
                                            value={[...selected]}
                                            onChange={(e) => {
                                                const values = Array.from(
                                                    e.target.selectedOptions,
                                                ).map((o) => o.value);
                                                setField(
                                                    "category_ids",
                                                    values.join(","),
                                                );
                                            }}
                                            style={{ minHeight: 96 }}
                                        >
                                            {categories.map((c) => (
                                                <option
                                                    key={c.id}
                                                    value={String(c.id)}
                                                >
                                                    {c.category_name}
                                                </option>
                                            ))}
                                        </select>
                                    </ModalField>
                                );
                            }
                            if (field.leadField === "gender") {
                                return renderFieldInput(
                                    "gender",
                                    field.label,
                                    "select",
                                    [
                                        { value: "male", label: td("Male") },
                                        {
                                            value: "female",
                                            label: td("Female"),
                                        },
                                    ],
                                );
                            }
                            if (field.leadField === "date_of_birth") {
                                const hasDob = Boolean(form.date_of_birth);
                                return (
                                    <div
                                        key="date_of_birth_age"
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "minmax(0,1.2fr) 5rem minmax(0,1fr)",
                                            gap: 10,
                                        }}
                                    >
                                        <ModalField label={td("Date of birth")}>
                                            <input
                                                className="v2-input"
                                                type="date"
                                                value={form.date_of_birth ?? ""}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    if (value) {
                                                        const computed =
                                                            computeAgeFieldsFromDateOfBirth(
                                                                value,
                                                            );
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            date_of_birth:
                                                                value,
                                                            age:
                                                                computed.age !=
                                                                null
                                                                    ? String(
                                                                          computed.age,
                                                                      )
                                                                    : "",
                                                            age_range:
                                                                computed.age_range ??
                                                                "",
                                                        }));
                                                    } else {
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            date_of_birth: "",
                                                            age: "",
                                                            age_range: "",
                                                        }));
                                                    }
                                                }}
                                            />
                                        </ModalField>
                                        <ModalField label={td("Age")}>
                                            <input
                                                className="v2-input"
                                                type="number"
                                                min={0}
                                                max={150}
                                                value={form.age ?? ""}
                                                disabled={hasDob}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    const age = value
                                                        ? Number(value)
                                                        : null;
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        age: value,
                                                        age_range:
                                                            computeAgeRangeFromAge(
                                                                age,
                                                            ) ?? "",
                                                    }));
                                                }}
                                            />
                                        </ModalField>
                                        <ModalField label={td("Age range")}>
                                            <select
                                                className="v2-input"
                                                value={form.age_range ?? ""}
                                                disabled={hasDob}
                                                onChange={(e) =>
                                                    setField(
                                                        "age_range",
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    {td("Select…")}
                                                </option>
                                                {ageRanges.map((option) => (
                                                    <option
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </ModalField>
                                    </div>
                                );
                            }
                            if (field.leadField === "salutation") {
                                return renderFieldInput(
                                    "salutation",
                                    field.label,
                                    "select",
                                    salutations.map((s) => ({
                                        value: s.value,
                                        label: s.label,
                                    })),
                                );
                            }

                            return renderFieldInput(
                                field.leadField,
                                field.label,
                            );
                        })}
                    </div>
                );
            })}
        </Modal>
    );
}
