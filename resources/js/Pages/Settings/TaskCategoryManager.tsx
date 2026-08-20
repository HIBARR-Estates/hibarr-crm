import React, { useEffect, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Button, Form, Input, Modal, Popconfirm, Space } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { DataTable } from "@/Components/DataTable";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

interface TaskCategory {
    id: number;
    category_name: string;
}

interface TaskCategoriesResponse {
    categories: TaskCategory[];
}

/**
 * Task category CRUD, meant to be embedded inline (e.g. in a Drawer) rather
 * than mounted as its own full-page route.
 */
export default function TaskCategoryManager() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] =
        useState<TaskCategory | null>(null);

    const { data, isLoading, refetch } = useApiQuery<TaskCategoriesResponse>({
        path: route("taskCategory.index"),
    });

    const categories = data?.categories ?? [];

    const closeModal = () => {
        setModalOpen(false);
        setEditingCategory(null);
        form.resetFields();
    };

    const createMutation = useApiMutate<
        { category_name: string },
        string,
        ApiSuccessResponse<string>
    >(route("taskCategory.store"), "POST", () => {
        refetch();
        closeModal();
    });

    const updateMutation = useApiMutate<
        { category_name: string },
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

    const [categoryToDelete, setCategoryToDelete] =
        useState<TaskCategory | null>(null);

    const deleteMutation = useApiMutate<{}, string, ApiSuccessResponse<string>>(
        categoryToDelete
            ? route("taskCategory.destroy", categoryToDelete.id)
            : "",
        "DELETE",
        () => {
            refetch();
            setCategoryToDelete(null);
        },
    );

    useEffect(() => {
        if (categoryToDelete) {
            deleteMutation.mutate({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryToDelete]);

    const openCreateModal = () => {
        setEditingCategory(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEditModal = (category: TaskCategory) => {
        setEditingCategory(category);
        form.setFieldsValue({ category_name: category.category_name });
        setModalOpen(true);
    };

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            if (editingCategory) {
                updateMutation.mutate(values);
            } else {
                createMutation.mutate(values);
            }
        });
    };

    const columns: TableColumnsType<TaskCategory> = [
        {
            title: "#",
            key: "index",
            width: 48,
            render: (_: unknown, __: TaskCategory, index: number) =>
                index + 1,
        },
        {
            title: t("modules.projectCategory.categoryName"),
            dataIndex: "category_name",
            key: "category_name",
        },
        {
            title: t("app.action"),
            key: "actions",
            width: 100,
            render: (_: unknown, record: TaskCategory) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(record)}
                    />
                    <Popconfirm
                        title={t("messages.recoverRecord")}
                        okText={t("messages.confirmDelete")}
                        cancelText={t("app.cancel")}
                        onConfirm={() => setCategoryToDelete(record)}
                    >
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            loading={
                                deleteMutation.isPending &&
                                categoryToDelete?.id === record.id
                            }
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreateModal}
                >
                    {t("app.addNew")} {t("modules.tasks.taskCategory")}
                </Button>
            </div>

            <DataTable<TaskCategory>
                rowKey="id"
                columns={columns}
                dataSource={categories}
                loading={isLoading}
            />

            <Modal
                title={
                    editingCategory
                        ? t("modules.lead.editDealCategory")
                        : `${t("app.addNew")} ${t("modules.tasks.taskCategory")}`
                }
                open={modalOpen}
                onCancel={closeModal}
                onOk={handleSubmit}
                confirmLoading={
                    createMutation.isPending || updateMutation.isPending
                }
                okText={t("app.save")}
                cancelText={t("app.cancel")}
                destroyOnClose
                styles={{ content: { boxShadow: "none" } }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="category_name"
                        label={t("modules.projectCategory.categoryName")}
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
