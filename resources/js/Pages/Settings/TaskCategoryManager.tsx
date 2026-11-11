import React, { useState } from "react";
import axios from "axios";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import useTranslation from "@/Hooks/useTranslation";
import { App } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

import "@/Components/Redesign/redesign.css";

/** Ant theme uses zIndexPopupBase 1300 — nested redesign modals must sit above it. */
const NESTED_MODAL_Z_INDEX = 1400;

interface TaskCategory {
    id: number;
    category_name: string;
    action?: string | null;
}

interface TaskCategoriesResponse {
    categories: TaskCategory[];
}

/**
 * Category quick-actions a task can trigger from its row/detail.
 * `label` is a translation key, resolved at the render site with t().
 */
const CATEGORY_ACTIONS = [
    { value: "", label: "pages.task_category_actions.none" },
    { value: "email", label: "pages.task_category_actions.email" },
    { value: "call", label: "pages.task_category_actions.call" },
] as const;

const ROW_GRID =
    "grid grid-cols-[36px_minmax(0,1fr)_100px_80px] items-center gap-x-3 px-3.5 py-3 border-b border-[#e2e5ea] last:border-b-0";

/** Translation key for a stored action value, or the raw value if unknown. */
function actionLabelKey(value: string): string {
    return CATEGORY_ACTIONS.find((a) => a.value === value)?.label ?? value;
}

/**
 * Task category CRUD, meant to be embedded inline (e.g. in a Drawer/Modal) rather
 * than mounted as its own full-page route.
 */
export default function TaskCategoryManager() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] =
        useState<TaskCategory | null>(null);
    const [categoryName, setCategoryName] = useState("");
    const [categoryAction, setCategoryAction] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<TaskCategory | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data, isLoading, refetch } = useApiQuery<TaskCategoriesResponse>({
        path: route("taskCategory.index"),
    });

    const categories = data?.categories ?? [];

    const closeModal = () => {
        setModalOpen(false);
        setEditingCategory(null);
        setCategoryName("");
        setCategoryAction("");
    };

    const createMutation = useApiMutate<
        { category_name: string; action: string | null },
        string,
        ApiSuccessResponse<string>
    >(route("taskCategory.store"), "POST", () => {
        refetch();
        closeModal();
    });

    const updateMutation = useApiMutate<
        { category_name: string; action: string | null },
        string,
        ApiSuccessResponse<string>
    >(
        editingCategory
            ? route("taskCategory.update", editingCategory.id)
            : "",
        "PUT",
        () => {
            refetch();
            closeModal();
        },
    );

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        try {
            await axios.delete(route("taskCategory.destroy", deleteTarget.id), {
                headers: { Accept: "application/json" },
            });
            await refetch();
            setDeleteTarget(null);
        } catch {
            message.error(t("messages.deleteTaskCategory"));
        } finally {
            setDeletingId(null);
        }
    };

    const openCreateModal = () => {
        setEditingCategory(null);
        setCategoryName("");
        setCategoryAction("");
        setModalOpen(true);
    };

    const openEditModal = (category: TaskCategory) => {
        setEditingCategory(category);
        setCategoryName(category.category_name);
        setCategoryAction(category.action ?? "");
        setModalOpen(true);
    };

    const handleSubmit = () => {
        const trimmed = categoryName.trim();
        if (!trimmed) return;

        const payload = {
            category_name: trimmed,
            action: categoryAction || null,
        };

        if (editingCategory) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const saving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex shrink-0 justify-end">
                <Button
                    variant="primary"
                    size="sm"
                    icon={<PlusOutlined />}
                    onClick={openCreateModal}
                >
                    {t("app.addNew")} {t("modules.tasks.taskCategory")}
                </Button>
            </div>

            <div
                className="flex flex-col overflow-hidden rounded-[10px] border bg-white"
                style={{ borderColor: T.BORDER }}
            >
                <div
                    className={`${ROW_GRID} shrink-0`}
                    style={{
                        background: T.SURFACE_2,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: T.TEXT_MUTED,
                    }}
                >
                    <span>#</span>
                    <span>{t("modules.projectCategory.categoryName")}</span>
                    <span>{t("app.action")}</span>
                    <span className="text-right" aria-hidden="true" />
                </div>

                {isLoading ? (
                    <div
                        className="px-3.5 py-6 text-center text-sm"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {t("app.loading")}
                    </div>
                ) : categories.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            title={t("messages.noRecordFound")}
                            description={t("modules.tasks.taskCategory")}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {categories.map((category, index) => (
                            <div key={category.id} className={ROW_GRID}>
                                <span
                                    className="text-xs tabular-nums"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {index + 1}
                                </span>
                                <span
                                    className="min-w-0 truncate text-sm font-medium"
                                    style={{ color: T.TEXT }}
                                    title={category.category_name}
                                >
                                    {category.category_name}
                                </span>
                                <span
                                    className="min-w-0 truncate text-sm"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {category.action
                                        ? t(actionLabelKey(category.action))
                                        : "—"}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<EditOutlined />}
                                        aria-label={t("app.edit")}
                                        onClick={() => openEditModal(category)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<DeleteOutlined />}
                                        aria-label={t("app.delete")}
                                        loading={deletingId === category.id}
                                        onClick={() => setDeleteTarget(category)}
                                        style={{ color: T.RED }}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                open={modalOpen}
                zIndex={NESTED_MODAL_Z_INDEX}
                title={
                    editingCategory
                        ? t("modules.taskCategory.editTaskCategory")
                        : `${t("app.addNew")} ${t("modules.tasks.taskCategory")}`
                }
                onClose={closeModal}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={closeModal}
                            disabled={saving}
                        >
                            {t("app.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            loading={saving}
                            disabled={!categoryName.trim()}
                        >
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <label
                    htmlFor="task-category-name"
                    style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {t("modules.projectCategory.categoryName")}
                </label>
                <input
                    id="task-category-name"
                    className="dr-input"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit();
                    }}
                    autoFocus
                />

                <label
                    style={{
                        display: "block",
                        margin: "16px 0 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {t("app.action")}
                </label>
                <MenuSelect
                    value={categoryAction}
                    options={CATEGORY_ACTIONS.map((a) => ({
                        value: a.value,
                        label: t(a.label),
                    }))}
                    onChange={(value) => setCategoryAction(String(value))}
                    placeholder={t("pages.task_category_actions.select")}
                    fullWidth
                />
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                zIndex={NESTED_MODAL_Z_INDEX}
                title={t("app.delete")}
                message={t("messages.deleteTaskCategory")}
                confirmLabel={t("messages.confirmDelete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
