import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { FieldDraft, OPTION_VALUE_TYPES, SettingsField } from "../types";

interface Options {
    setFields: Dispatch<SetStateAction<SettingsField[]>>;
}

/**
 * `original` is only used to pass an existing repeatable field's schema
 * (`values`) and `linked_field_id` through unchanged — the store/update
 * validators require both whenever type is "repeatable", even when this
 * screen isn't the one editing that schema.
 */
function buildPayload(draft: FieldDraft, original?: SettingsField | null) {
    const isOptionType = (OPTION_VALUE_TYPES as readonly string[]).includes(draft.type);
    const isRepeatable = draft.type === "repeatable";
    return {
        module: draft.module,
        label: draft.label.trim(),
        type: draft.type,
        category: draft.category || "",
        required: draft.required,
        export: draft.export,
        // `visible` is a string enum('true','false') column, not a boolean.
        visible: draft.visible ? "true" : "false",
        display_order: draft.display_order,
        ...(isOptionType ? { value: draft.values.map((v) => v.trim()).filter(Boolean) } : {}),
        ...(isRepeatable && original
            ? { value: original.values, linked_field_id: original.linked_field_id }
            : {}),
    };
}

/**
 * Field create/update/delete/reorder, wired to the existing
 * CustomFieldController JSON endpoints (custom-fields.*) — the same ones the
 * classic Blade admin posts to. Patches local state directly from each
 * response instead of an Inertia reload.
 */
export default function useCustomFieldMutations({ setFields }: Options) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const reorderRequestRef = useRef(0);
    const reorderChainRef = useRef<Promise<void>>(Promise.resolve());

    const createField = useCallback(
        async (draft: FieldDraft): Promise<SettingsField | null> => {
            setSaving(true);
            try {
                const res = await axios.post(route("custom-fields.store"), buildPayload(draft), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.field) {
                    const created = res.data.field as SettingsField;
                    setFields((prev) => [...prev, created]);
                    message.success(td("Field saved", { source: "en" }));
                    return created;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                const errors = error?.response?.data?.errors;
                const firstError = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
                message.error(firstError || error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [setFields, t, td],
    );

    const updateField = useCallback(
        async (id: number, draft: FieldDraft, original?: SettingsField | null): Promise<SettingsField | null> => {
            setSaving(true);
            try {
                const res = await axios.put(route("custom-fields.update", id), buildPayload(draft, original), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.field) {
                    const updated = res.data.field as SettingsField;
                    setFields((prev) => prev.map((f) => (f.id === id ? updated : f)));
                    message.success(td("Field saved", { source: "en" }));
                    return updated;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                const errors = error?.response?.data?.errors;
                const firstError = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
                message.error(firstError || error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [setFields, t, td],
    );

    const deleteField = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                const res = await axios.delete(route("custom-fields.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    setFields((prev) => prev.filter((f) => f.id !== id));
                    message.success(td("Field deleted", { source: "en" }));
                    return true;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return false;
            } finally {
                setDeletingId(null);
            }
        },
        [setFields, t, td],
    );

    /** Persists a new field order within one module (matches sortFields' 1..N-by-id-list contract). */
    const reorderFields = useCallback(
        async (orderedIds: number[]) => {
            // Versioned so a slow/failed request can't roll back a newer drag
            // that already landed — only the still-latest request's failure
            // may restore its snapshot.
            const requestId = ++reorderRequestRef.current;

            // Optimistic: apply locally first so drag feels instant, then persist.
            // Snapshot `prev` at the moment of this call so a failure rolls back to
            // exactly what preceded this request, not whatever state exists later.
            let snapshot: SettingsField[] = [];
            setFields((prev) => {
                snapshot = prev;
                const byId = new Map(prev.map((f) => [f.id, f]));
                const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as SettingsField[];
                const rest = prev.filter((f) => !orderedIds.includes(f.id));
                // Preserve overall array order by splicing the reordered block back
                // in at the position of the first moved item.
                const firstIndex = prev.findIndex((f) => orderedIds.includes(f.id));
                const next = [...rest];
                next.splice(firstIndex, 0, ...reordered);
                return next;
            });
            // Chain persistence so requests hit the server in submission order
            // and never overlap in flight — the server applies orders as it
            // receives them with no revision check, so two concurrent
            // requests could otherwise land out of order and let a stale
            // drag overwrite a newer one. If a later reorder was already
            // queued by the time this one's turn comes up, skip sending it:
            // that queued request carries the full (newer) order anyway.
            reorderChainRef.current = reorderChainRef.current.then(async () => {
                if (reorderRequestRef.current !== requestId) return;
                try {
                    const res = await axios.post(
                        route("custom-fields.sort-fields"),
                        { sortedValues: orderedIds },
                        { headers: { Accept: "application/json" } },
                    );
                    if (res.data?.status === "success") {
                        message.success(td("Field order updated", { source: "en" }));
                    } else {
                        if (reorderRequestRef.current === requestId) setFields(snapshot);
                        message.error(res.data?.message || t("messages.somethingWentWrong"));
                    }
                } catch (error: any) {
                    if (reorderRequestRef.current === requestId) setFields(snapshot);
                    message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                }
            });
        },
        [setFields, t, td],
    );

    return { saving, deletingId, createField, updateField, deleteField, reorderFields };
}
