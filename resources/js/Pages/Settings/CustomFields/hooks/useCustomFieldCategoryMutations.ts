import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
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
    const reorderRequestRef = useRef(0);
    const reorderChainRef = useRef<Promise<void>>(Promise.resolve());
    /**
     * The last category order actually confirmed persisted by the server —
     * the only safe thing to roll back to, since a per-call snapshot could
     * restore an order the server never had (see reorderCategories).
     */
    const confirmedCategoriesRef = useRef<SettingsCategory[] | null>(null);
    /** Bumped by every server-confirmed create/update/delete, so a reorder that
     *  was already in flight can tell its captured order is out of date. */
    const crudVersionRef = useRef(0);

    /**
     * Applies a server-confirmed create/update/delete to the rendered list *and*
     * to the rollback baseline. Without the second half, a later failed reorder
     * would roll back to an order captured before this change — resurrecting a
     * deleted category, dropping a created one, or reverting a rename.
     */
    const applyConfirmedChange = useCallback(
        (transform: (prev: SettingsCategory[]) => SettingsCategory[]) => {
            crudVersionRef.current += 1;
            setCategories(transform);
            if (confirmedCategoriesRef.current) {
                confirmedCategoriesRef.current = transform(confirmedCategoriesRef.current);
            }
        },
        [setCategories],
    );

    const withModuleName = useCallback(
        (category: SettingsCategory): SettingsCategory => ({
            ...category,
            module: moduleGroups.find((g) => g.id === category.custom_field_group_id)?.name ?? category.module,
        }),
        [moduleGroups],
    );

    const byOrder = (a: SettingsCategory, b: SettingsCategory) => a.order - b.order || a.id - b.id;

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
                    applyConfirmedChange((prev) => [...prev, created].sort(byOrder));
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
        [applyConfirmedChange, t, td, withModuleName],
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
                    applyConfirmedChange((prev) =>
                        prev.map((c) => (c.id === id ? updated : c)).sort(byOrder),
                    );
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
        [applyConfirmedChange, t, td, withModuleName],
    );

    const deleteCategory = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                const res = await axios.delete(route("custom-field-categories.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    applyConfirmedChange((prev) => prev.filter((c) => c.id !== id));
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
        [applyConfirmedChange, t, td],
    );

    /**
     * Persists a new global category order (sortCategories renumbers exactly
     * the ids sent, 1..N).
     *
     * Mirrors useCustomFieldMutations.reorderFields: requests are versioned
     * and serialized through a promise chain, and failures roll back to the
     * last order the server actually confirmed. Without that, two quick drags
     * could land out of order (the server applies whichever arrives last), and
     * a failed one could restore a pre-optimistic snapshot the server never
     * had — overwriting a newer, successful reorder.
     */
    const reorderCategories = useCallback(
        async (orderedIds: number[]) => {
            const requestId = ++reorderRequestRef.current;
            // The exact order this request persists, captured up front so a
            // drag that lands while it is in flight can't be mistaken for it.
            let requestOrder: SettingsCategory[] | null = null;
            // CRUD state this order was captured against — a create/update/delete
            // confirmed while this request is on the wire makes the capture stale.
            const crudVersionAtCapture = crudVersionRef.current;

            setCategories((prev) => {
                // Baseline the confirmed order from the state that preceded any
                // client-side reordering, the first time this ever runs.
                if (!confirmedCategoriesRef.current) {
                    confirmedCategoriesRef.current = prev;
                }
                const byId = new Map(prev.map((c) => [c.id, c]));
                const next = orderedIds
                    .map((id) => byId.get(id))
                    .filter(Boolean) as SettingsCategory[];
                requestOrder = next;
                return next;
            });

            reorderChainRef.current = reorderChainRef.current.then(async () => {
                // A newer drag already superseded this one — it carries the
                // full order anyway, so this request is pure noise.
                if (reorderRequestRef.current !== requestId) return;

                try {
                    const res = await axios.post(
                        route("custom-field-categories.sort"),
                        { sortedIds: orderedIds },
                        { headers: { Accept: "application/json" } },
                    );

                    if (res.data?.status === "success") {
                        // The server now holds exactly *this* request's order,
                        // so that is the baseline to advance to. Reading current
                        // state instead would promote a drag that landed while
                        // this request was in flight — an order the server has
                        // never confirmed — and a later failure would then roll
                        // back to it.
                        //
                        // Two things can make the capture unsafe to commit: a
                        // newer reorder has superseded this one, or a CRUD write
                        // landed since the capture (so it still lists a deleted
                        // category, or is missing a created one). In either case
                        // leave the baseline alone — applyConfirmedChange has
                        // already kept it CRUD-correct, and the next reorder
                        // brings the order along with it. A slightly stale order
                        // is a far better rollback target than one that
                        // resurrects or drops a category.
                        if (
                            requestOrder &&
                            reorderRequestRef.current === requestId &&
                            crudVersionRef.current === crudVersionAtCapture
                        ) {
                            confirmedCategoriesRef.current = requestOrder;
                        }
                        message.success(td("Category order updated", { source: "en" }));
                    } else {
                        message.error(res.data?.message || t("messages.somethingWentWrong"));
                        if (reorderRequestRef.current === requestId && confirmedCategoriesRef.current) {
                            setCategories(confirmedCategoriesRef.current);
                        }
                    }
                } catch (error: any) {
                    message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                    if (reorderRequestRef.current === requestId && confirmedCategoriesRef.current) {
                        setCategories(confirmedCategoriesRef.current);
                    }
                }
            });

            return reorderChainRef.current;
        },
        [setCategories, t, td],
    );

    return { saving, deletingId, createCategory, updateCategory, deleteCategory, reorderCategories };
}
