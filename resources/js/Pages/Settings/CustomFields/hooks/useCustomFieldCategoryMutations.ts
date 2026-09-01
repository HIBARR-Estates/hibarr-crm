import { Dispatch, SetStateAction, useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { CategoryDraft, ModuleGroup, SettingsCategory } from "../types";

interface Options {
    setCategories: Dispatch<SetStateAction<SettingsCategory[]>>;
    /** To fill in `module` (a name string) on the raw Eloquent row store/update return — the settings index's own mapping adds it, these two don't. */
    moduleGroups: ModuleGroup[];
}

/**
 * Category create/update/delete/reorder, wired to the existing
 * CustomFieldCategoryController JSON endpoints (custom-field-categories.*).
 */
export default function useCustomFieldCategoryMutations({ setCategories, moduleGroups }: Options) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const withModuleName = useCallback(
        (category: SettingsCategory): SettingsCategory => ({
            ...category,
            module: moduleGroups.find((g) => g.id === category.custom_field_group_id)?.name ?? category.module,
        }),
        [moduleGroups],
    );

    const createCategory = useCallback(
        async (draft: CategoryDraft): Promise<SettingsCategory | null> => {
            setSaving(true);
            try {
                const res = await axios.post(
                    route("custom-field-categories.store"),
                    { name: draft.name.trim(), custom_field_group_id: draft.custom_field_group_id, order: draft.order },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.category) {
                    const created = withModuleName(res.data.category as SettingsCategory);
                    setCategories((prev) => [...prev, created]);
                    message.success(td("Category saved", { source: "en" }));
                    return created;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [setCategories, t, td, withModuleName],
    );

    const updateCategory = useCallback(
        async (id: number, draft: CategoryDraft): Promise<SettingsCategory | null> => {
            setSaving(true);
            try {
                const res = await axios.put(
                    route("custom-field-categories.update", id),
                    { name: draft.name.trim(), custom_field_group_id: draft.custom_field_group_id, order: draft.order },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.category) {
                    const updated = withModuleName(res.data.category as SettingsCategory);
                    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
                    message.success(td("Category saved", { source: "en" }));
                    return updated;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [setCategories, t, td, withModuleName],
    );

    const deleteCategory = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                const res = await axios.delete(route("custom-field-categories.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    setCategories((prev) => prev.filter((c) => c.id !== id));
                    message.success(td("Category deleted", { source: "en" }));
                    return true;
                }
                // The backend replies 200 with status:'fail' when the category
                // still has fields attached — surface that message as-is.
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return false;
            } finally {
                setDeletingId(null);
            }
        },
        [setCategories, t, td],
    );

    /** Persists a new global category order (sortCategories renumbers exactly the ids sent, 1..N). */
    const reorderCategories = useCallback(
        async (orderedIds: number[]) => {
            setCategories((prev) => {
                const byId = new Map(prev.map((c) => [c.id, c]));
                return orderedIds.map((id) => byId.get(id)).filter(Boolean) as SettingsCategory[];
            });
            try {
                const res = await axios.post(
                    route("custom-field-categories.sort"),
                    { sortedIds: orderedIds },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success") {
                    message.success(td("Category order updated", { source: "en" }));
                } else {
                    message.error(res.data?.message || t("messages.somethingWentWrong"));
                }
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
            }
        },
        [setCategories, t, td],
    );

    return { saving, deletingId, createCategory, updateCategory, deleteCategory, reorderCategories };
}
