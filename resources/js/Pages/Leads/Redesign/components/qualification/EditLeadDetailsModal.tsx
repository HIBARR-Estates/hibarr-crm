import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Lead, LeadCategory } from "@/Types/api/leads";
import { Modal, ModalField } from "@/Components/Redesign";
import { DOSSIER_SECTIONS } from "../../config/dossierSections";
import { getDossierFieldValue } from "../../adapters/dossierAdapter";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";

type EditTabId = "identity" | "contact" | "engagement" | "personal" | "financial" | "attribution";

interface EditLeadDetailsModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    salutations: Array<{ value: string; label: string }>;
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
        const values: Record<string, string> = {
            client_name: lead.client_name ?? "",
            first_name: first,
            last_name: last,
            salutation: String(lead.salutation ?? ""),
        };

        for (const section of DOSSIER_SECTIONS) {
            for (const field of section.fields) {
                if (!field.leadField || section.readOnly) continue;
                values[field.leadField] = getDossierFieldValue(lead, field.key);
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
        ...DOSSIER_SECTIONS.map((section) => ({
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

            for (const section of DOSSIER_SECTIONS) {
                if (section.readOnly) continue;
                for (const field of section.fields) {
                    if (!field.leadField) continue;
                    const raw = form[field.leadField];
                    if (field.leadField === "value") {
                        payload.value = raw ? Number(raw) : null;
                    } else if (field.leadField === "currency_id") {
                        payload.currency_id = raw ? Number(raw) : null;
                    } else if (
                        field.leadField === "source_id" ||
                        field.leadField === "category_id"
                    ) {
                        payload[field.leadField] = raw ? Number(raw) : null;
                    } else if (field.leadField === "languages") {
                        payload.languages = raw
                            ? raw.split(",").map((s) => s.trim()).filter(Boolean)
                            : [];
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

            {DOSSIER_SECTIONS.map((section) => {
                if (tab !== section.id) return null;
                if (section.readOnly) {
                    return (
                        <p
                            key={section.id}
                            style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}
                        >
                            {td("Engagement fields are read-only.")}
                        </p>
                    );
                }

                return (
                    <div key={section.id}>
                        {section.fields.map((field) => {
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
                            if (field.leadField === "category_id") {
                                return renderFieldInput(
                                    "category_id",
                                    field.label,
                                    "select",
                                    categories.map((c) => ({
                                        value: String(c.id),
                                        label: c.category_name,
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
