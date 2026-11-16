import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { computeAgeFieldsFromDateOfBirth } from "@/lib/leadAge";
import { getFirstValidationMessage } from "@/lib/api/utils/common";
import useTranslation from "@/Hooks/useTranslation";
import { useLeadWorkspace } from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import type { Lead } from "@/Types/api/leads";
import { buildEditPatch, changedKeys, initialEditForm, type EditForm } from "./leadEditForm";

/**
 * The edit page's form: what the person has typed, what changed, undo per field
 * and the save. Saving patches the lead in the workspace context from the
 * response, so the page the person returns to is already up to date.
 */
export default function useLeadEditForm(lead: Lead, onSaved: () => void) {
    const { t } = useTranslation();
    const { setLead } = useLeadWorkspace();
    // What the person was shown when they opened the page. It stays fixed, so a change to the
    // lead underneath (a merge, a refresh) never turns untouched fields into pending edits.
    const [initial] = useState(() => initialEditForm(lead));
    const [form, setForm] = useState<EditForm>(initial);
    const [saving, setSaving] = useState(false);
    const [nameMissing, setNameMissing] = useState(false);

    const changed = useMemo(() => changedKeys(form, initial), [form, initial]);

    const setField = useCallback((key: string, value: string) => {
        setForm((previous) => {
            const next = { ...previous, [key]: value };
            if (key === "date_of_birth") {
                // The date of birth decides the age range; clearing it clears the range.
                next.age_range = value ? (computeAgeFieldsFromDateOfBirth(value).age_range ?? "") : "";
            }
            return next;
        });
        if (key === "client_name") setNameMissing(false);
    }, []);

    const undo = useCallback(
        (key: string) => {
            setForm((previous) => {
                const next = { ...previous, [key]: initial[key] ?? "" };
                if (key === "date_of_birth") next.age_range = initial.age_range ?? "";
                return next;
            });
            if (key === "client_name") setNameMissing(false);
        },
        [initial],
    );

    const save = useCallback(async () => {
        if (changed.length === 0 || saving) return;
        if (!form.client_name?.trim()) {
            // The name is the one field a lead cannot be without.
            setNameMissing(true);
            return;
        }
        setSaving(true);
        try {
            const response = await axios.patch(route("lead-contact.patch", { lead_contact: lead.id }), buildEditPatch(form, initial), {
                headers: { Accept: "application/json" },
            });
            const updated = response.data?.data?.lead as Record<string, unknown> | undefined;
            if (response.data?.status !== "success" || !updated) {
                throw new Error(response.data?.message || "save failed");
            }
            setLead((previous) => ({ ...previous, ...updated }) as Lead);
            message.success(t("pages.agent_workspace.contact.edit.saved"));
            onSaved();
        } catch (error: unknown) {
            message.error(getFirstValidationMessage(error, t("pages.agent_workspace.contact.edit.failed")));
        } finally {
            setSaving(false);
        }
    }, [changed.length, form, initial, lead.id, onSaved, saving, setLead, t]);

    return { form, initial, changed, setField, undo, save, saving, nameMissing };
}
