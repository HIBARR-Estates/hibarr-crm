import { IModalProps } from "@/Types/common";
import { Role } from "@/Types";
import { router } from "@inertiajs/react";
import { message, Modal, Form, Select } from "antd";
import { useState } from "react";
import { TeamOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    ids: number[];
    roles?: Role[];
}

const BulkChangeAgentRole: React.FC<Props> = ({ open, onClose, ids, roles = [] }) => {
    const { td } = useTd();
    const [roleId, setRoleId] = useState<number | null>(null);
    const [form] = Form.useForm();

    const { mutate: bulkUpdate, status } = useApiMutate<
        { row_ids: string; action_type: string; role_id: number | null },
        any,
        ApiResponse<any>
    >(route("agents.apply_quick_action"), "POST");

    const handleBulkChangeRole = () => {
        if (!roleId) {
            message.warning(td("Please select a role", { source: "en" }));
            return;
        }

        bulkUpdate(
            {
                row_ids: ids.join(","),
                action_type: "change_role",
                role_id: roleId,
            },
            {
                onSuccess: () => {
                    message.success(td("Role updated successfully", { source: "en" }));
                    setRoleId(null);
                    form.resetFields();
                    onClose(true);
                    router.reload();
                },
                onError: () => {
                    message.error(td("Failed to update role", { source: "en" }));
                },
            },
        );
    };

    const handleClose = () => {
        setRoleId(null);
        form.resetFields();
        onClose();
    };

    const loading = getLoadingStatus({ status });

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            onOk={handleBulkChangeRole}
            title={
                <div className="flex items-center gap-3">
                    <TeamOutlined className="text-blue-500 text-xl" />
                    <span>{td("Change Role", { source: "en" })}</span>
                </div>
            }
            okText={td("Update Role", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmLoading={loading}
        >
            <div className="py-4">
                <p className="text-gray-600 mb-4">
                    Update role for{" "}
                    {pluralOrSingular(ids.length, "this agent", "agents")}.
                </p>
                <Form form={form} layout="vertical">
                    <Form.Item label={td("Role", { source: "en" })} name="role_id">
                        <Select
                            value={roleId}
                            onChange={(value) => setRoleId(value)}
                            placeholder={td("Select a role", { source: "en" })}
                            allowClear
                            options={roles.map((r) => ({
                                label: r.display_name || r.name,
                                value: r.id,
                            }))}
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};

export default BulkChangeAgentRole;
