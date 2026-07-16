import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message, Modal, Form } from "antd";
import { useState } from "react";
import { EditOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import FormDataSelector from "@/Components/FormDataSelector";

interface Props extends IModalProps {
    ids: number[];
}

const BulkChangeCategory: React.FC<Props> = ({ open, onClose, ids }) => {
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [form] = Form.useForm();

    const { mutate: bulkUpdate, status } = useApiMutate<
        { row_ids: string; action_type: string; category_id: number | null },
        any,
        ApiResponse<any>
    >(route("lead-contact.apply_quick_action"), "POST");

    const handleBulkChangeCategory = () => {
        bulkUpdate(
            {
                row_ids: ids.join(","),
                action_type: "change_category",
                category_id: categoryId,
            },
            {
                onSuccess: () => {
                    message.success("Category updated successfully");
                    setCategoryId(null);
                    form.resetFields();
                    onClose(true);
                    // X2: Index-only component — refresh just the leads list
                    router.reload({ only: ["leads"] });
                },
                onError: () => {
                    message.error("Failed to update category");
                },
            },
        );
    };

    const handleClose = () => {
        setCategoryId(null);
        form.resetFields();
        onClose();
    };

    const loading = getLoadingStatus({ status });

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            onOk={handleBulkChangeCategory}
            title={
                <div className="flex items-center gap-3">
                    <EditOutlined className="text-blue-500 text-xl" />
                    <span>Change Category</span>
                </div>
            }
            okText="Update Category"
            cancelText="Cancel"
            confirmLoading={loading}
        >
            <div className="py-4">
                <p className="text-gray-600 mb-4">
                    Update category for{" "}
                    {pluralOrSingular(ids.length, "this contact", "contacts")}.
                </p>
                <Form form={form} layout="vertical">
                    <Form.Item label="Category" name="category_id">
                        <FormDataSelector
                            type="categories"
                            value={categoryId}
                            onChange={(value) => setCategoryId(value)}
                            placeholder="Select a category"
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};

export default BulkChangeCategory;
