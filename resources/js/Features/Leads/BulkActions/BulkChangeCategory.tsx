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
    const [categoryIds, setCategoryIds] = useState<number[]>([]);
    const [form] = Form.useForm();

    const { mutate: bulkUpdate, status } = useApiMutate<
        {
            row_ids: string;
            action_type: string;
            category_ids: number[];
        },
        any,
        ApiResponse<any>
    >(route("lead-contact.apply_quick_action"), "POST");

    const handleBulkChangeCategory = () => {
        bulkUpdate(
            {
                row_ids: ids.join(","),
                action_type: "change_category",
                category_ids: categoryIds,
            },
            {
                onSuccess: () => {
                    message.success("Categories updated successfully");
                    setCategoryIds([]);
                    form.resetFields();
                    onClose(true);
                    // X2: Index-only component — refresh just the leads list
                    router.reload({ only: ["leads"] });
                },
                onError: () => {
                    message.error("Failed to update categories");
                },
            },
        );
    };

    const handleClose = () => {
        setCategoryIds([]);
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
                    <span>Change Categories</span>
                </div>
            }
            okText="Update Categories"
            cancelText="Cancel"
            confirmLoading={loading}
        >
            <div className="py-4">
                <p className="text-gray-600 mb-4">
                    Set categories for{" "}
                    {pluralOrSingular(ids.length, "this contact", "contacts")}.
                    This replaces existing categories on the selected contacts.
                </p>
                <Form form={form} layout="vertical">
                    <Form.Item label="Categories" name="category_ids">
                        <FormDataSelector
                            type="categories"
                            mode="multiple"
                            value={categoryIds}
                            onChange={(value) =>
                                setCategoryIds(
                                    Array.isArray(value)
                                        ? value.map(Number).filter(Boolean)
                                        : [],
                                )
                            }
                            placeholder="Select categories"
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};

export default BulkChangeCategory;
