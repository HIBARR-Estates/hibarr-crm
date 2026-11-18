import { pluralOrSingular } from "@/lib/utils";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { Button, Form, message, Modal, Select } from "antd";
import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    ids: number[];
}

const BulkChangeStatusProperties: React.FC<Props> = ({
    ids,
    open,
    onClose,
}) => {
    const { td } = useTd();
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
                            td("Properties status changed successfully", { source: "en" })
                        );

                        onClose(true);
                        // Refresh the properties list
                        router.reload();
                        statusForm.resetFields();
                    },
                    onError: () => {
                        message.error(td("Failed to change properties status", { source: "en" }));
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
            title={td("Change Properties Status", { source: "en" })}
            open={open}
            onCancel={() => !changeStatusLoading && onClose()}
            footer={[
                <Button
                    key="cancel"
                    onClick={() => onClose()}
                    disabled={changeStatusLoading}
                >
                    {td("Cancel", { source: "en" })}
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={changeStatusLoading}
                    onClick={handleChangeStatus}
                >
                    {td("Change Status", { source: "en" })}
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
                    label={td("Select New Status", { source: "en" })}
                    rules={[
                        {
                            required: true,
                            message: "Please select a status",
                        },
                    ]}
                >
                    <Select
                        placeholder={td("Choose new status", { source: "en" })}
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
