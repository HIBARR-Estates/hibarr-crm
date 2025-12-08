import { IModalProps } from "@/Types/common";
import { User } from "@/Types";
import { router } from "@inertiajs/react";
import { message, Select, Modal, Button, Avatar } from "antd";
import { useState } from "react";
import { UserOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";
import UserIndicator from "@/Components/UserIndicator";

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

interface Props extends IModalProps {
    ids: number[];
    leadAgents: LeadAgent[];
}

const BulkChangeDealAgents: React.FC<Props> = ({
    open,
    onClose,
    ids,
    leadAgents,
}) => {
    const [bulkChangeAgentLoading, setBulkChangeAgentLoading] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<number>();

    const handleBulkChangeAgent = () => {
        if (!selectedAgentId) {
            message.error("Please select an agent");
            return;
        }

        setBulkChangeAgentLoading(true);
        router.post(
            route("deals.apply_quick_action"),
            {
                row_ids: ids.join(","),
                action_type: "change-deal-agents",
                agent: selectedAgentId,
            },
            {
                onSuccess: () => {
                    message.success("Deal agents updated successfully");
                    onClose(true);
                    // Refresh the deals list
                    router.reload();
                },
                onError: () => {
                    message.error("Failed to update deal agents");
                },
                onFinish: () => {
                    setBulkChangeAgentLoading(false);
                },
            }
        );
    };

    const handleClose = () => {
        setSelectedAgentId(undefined);
        onClose();
    };

    const selectedAgent = leadAgents.find(
        (agent) => agent.id === selectedAgentId
    );

    return (
        <Modal
            title={
                <div className="flex items-center space-x-2">
                    <UserOutlined className="text-blue-500" />
                    <span>Assign Agent to Selected Deals</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={bulkChangeAgentLoading}
                    disabled={!selectedAgentId}
                    onClick={handleBulkChangeAgent}
                >
                    Assign Agent
                </Button>,
            ]}
        >
            <div className="space-y-4">
                <p>
                    Select an agent to assign to{" "}
                    {pluralOrSingular(ids.length, "this deal", "deals")}:
                </p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Agent
                    </label>
                    <Select
                        placeholder="Select an agent"
                        value={selectedAgentId}
                        onChange={setSelectedAgentId}
                        className="w-full"
                        optionLabelProp="label"
                    >
                        {leadAgents.map((agent) => (
                            <Select.Option
                                key={agent.id}
                                value={agent.id}
                                label={agent.user?.name || agent.name}
                            >
                                <div className="flex items-center gap-x-2">
                                    <UserIndicator
                                        data={{
                                            image_url:
                                                agent.user?.image_url ||
                                                agent.image,
                                            name:
                                                agent.user?.name || agent.name,
                                        }}
                                        size="xs"
                                        showTooltip={false}
                                    />
                                    {agent.user?.email && (
                                        <span className="text-gray-500 text-xs">
                                            ({agent.user.email})
                                        </span>
                                    )}
                                </div>
                            </Select.Option>
                        ))}
                    </Select>
                </div>
                {selectedAgent && (
                    <div className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                            <UserIndicator
                                data={{
                                    image_url:
                                        selectedAgent.user?.image_url ||
                                        selectedAgent.image,
                                    name:
                                        selectedAgent.user?.name ||
                                        selectedAgent.name,
                                }}
                                size="xs"
                                showName={false}
                            />
                            <span className="text-sm text-gray-600">
                                Assigning to:{" "}
                                <strong>
                                    {selectedAgent.user?.name ||
                                        selectedAgent.name}
                                </strong>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkChangeDealAgents;
