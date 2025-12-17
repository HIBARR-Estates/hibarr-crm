import { pluralOrSingular } from "@/lib/utils";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { router } from "@inertiajs/react";
import { Button, Form, Modal, Select } from "antd";
import { TagsOutlined } from "@ant-design/icons";

interface Props extends IModalProps {
    ids: number[];
    propertyId: number;
    availableTags: Record<string, string>;
}

const BulkApplyTagsToAssets: React.FC<Props> = ({
    ids,
    propertyId,
    availableTags,
    open,
    onClose,
}) => {
    const [tagsForm] = Form.useForm();

    interface BulkTagsPayload {
        asset_ids: number[];
        tags: string[];
        action: "add" | "replace" | "remove";
        action_type: string;
    }

    const { mutate: updateBulkTags, isPending: isUpdatingTags } = useApiMutate<
        BulkTagsPayload,
        Record<string, any>,
        ApiResponse<Record<string, any>>
    >(
        route("properties.assets.bulk_action", propertyId),
        "POST",
        () => {
            onClose(true);
            router.reload({ only: ["assets"] });
            tagsForm.resetFields();
        }
    );

    const handleApplyTags = () => {
        tagsForm.validateFields().then((values) => {
            updateBulkTags({
                asset_ids: ids,
                tags: values.tags,
                action: values.action,
                action_type: "apply_tags",
            });
        });
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <TagsOutlined className="text-blue-500" />
                    <span>Apply Tags to Assets</span>
                </div>
            }
            open={open}
            onCancel={() => !isUpdatingTags && onClose()}
            footer={[
                <Button
                    key="cancel"
                    onClick={() => onClose()}
                    disabled={isUpdatingTags}
                >
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={isUpdatingTags}
                    onClick={handleApplyTags}
                    icon={<TagsOutlined />}
                >
                    Apply Tags
                </Button>,
            ]}
        >
            <div className="mb-4">
                <p>
                    You are about to apply tags to{" "}
                    {pluralOrSingular(ids.length, "this asset", "assets")}.
                </p>
            </div>
            <Form form={tagsForm} layout="vertical" initialValues={{ action: "add" }}>
                <Form.Item
                    name="action"
                    label="Action"
                    rules={[
                        {
                            required: true,
                            message: "Please select an action",
                        },
                    ]}
                >
                    <Select
                        placeholder="Choose action"
                        options={[
                            { value: "add", label: "Add Tags" },
                            { value: "replace", label: "Replace Tags" },
                            { value: "remove", label: "Remove Tags" },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    name="tags"
                    label="Tags"
                    rules={[
                        {
                            required: true,
                            message: "Please select at least one tag",
                        },
                    ]}
                >
                    <Select
                        mode="multiple"
                        placeholder="Select tags"
                        options={Object.entries(availableTags).map(
                            ([value, label]) => ({
                                value,
                                label,
                            })
                        )}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default BulkApplyTagsToAssets;
