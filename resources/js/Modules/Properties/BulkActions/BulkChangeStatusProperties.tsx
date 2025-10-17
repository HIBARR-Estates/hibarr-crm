import { pluralOrSingular } from "@/lib/utils";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { Button, Form, message, Modal, Select } from "antd";
import { useState } from "react";

interface Props extends IModalProps {
    ids: number[];
}

const BulkChangeStatusProperties: React.FC<Props> = ({
    ids,
    open,
    onClose,
}) => {
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [statusForm] = Form.useForm();

    const handleChangeStatus = () => {
        statusForm.validateFields().then((values) => {
            setChangeStatusLoading(true);
            router.post(
                route("properties.bulk_action"),
                {
                    property_ids: ids,
                    action_type: "change_status",
                    status: values.status,
                },
                {
                    onSuccess: () => {
                        message.success(
                            "Properties status changed successfully"
                        );

                        onClose();
                        // Refresh the properties list
                        router.reload();
                        statusForm.resetFields();
                    },
                    onError: () => {
                        message.error("Failed to change properties status");
                    },
                    onFinish: () => {
                        setChangeStatusLoading(false);
                    },
                }
            );
        });
    };

    return (
        <Modal
            title="Change Properties Status"
            open={open}
            onCancel={() => !changeStatusLoading && onClose()}
            footer={[
                <Button
                    key="cancel"
                    onClick={() => onClose()}
                    disabled={changeStatusLoading}
                >
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={changeStatusLoading}
                    onClick={handleChangeStatus}
                >
                    Change Status
                </Button>,
            ]}
        >
            <div className="mb-4">
                <p>
                    You are about to change the status of{" "}
                    {pluralOrSingular(
                        ids.length,
                        "this property",
                        "properties."
                    )}
                    .
                </p>
            </div>
            <Form form={statusForm} layout="vertical">
                <Form.Item
                    name="status"
                    label="Select New Status"
                    rules={[
                        {
                            required: true,
                            message: "Please select a status",
                        },
                    ]}
                >
                    <Select
                        placeholder="Choose new status"
                        // TODO: Refactor to get from backend as a single source of truth
                        options={[
                            {
                                label: "Available",
                                value: "Available",
                            },
                            {
                                label: "Under offer",
                                value: "Under offer",
                            },
                            {
                                label: "Sold",
                                value: "Sold",
                            },
                            {
                                label: "Withdrawn",
                                value: "Withdrawn",
                            },
                        ]}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default BulkChangeStatusProperties;
