import React, { useState } from "react";
import { Card, Tag, Button, Space, Select, message, Typography } from "antd";
import { TeamOutlined, EyeOutlined, UserDeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import { Property } from "@/Types";
import { PropertyPermissions } from "@/Hooks/usePropertyPermissions";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { router, usePage } from "@inertiajs/react";
import type { ApiSuccessResponse } from "@/lib/api/types";

const { Text } = Typography;

interface TeamUser {
    id: number;
    name: string;
    email?: string;
    image?: string | null;
}

interface PropertyTeamCardProps {
    property: Property;
    permissions: PropertyPermissions;
    employees?: TeamUser[];
}

export default function PropertyTeamCard({
    property,
    permissions,
    employees = [],
}: PropertyTeamCardProps) {
    const { props } = usePage<any>();
    const [selectedWatcherIds, setSelectedWatcherIds] = useState<number[]>([]);
    const [removingCollaboratorId, setRemovingCollaboratorId] = useState<
        number | null
    >(null);

    const collaborators: TeamUser[] = (property as any).collaborators || [];
    const watchers: TeamUser[] = (property as any).watchers || [];
    const responsibleAgent: TeamUser | null =
        (property as any).responsible_agent ||
        (property as any).responsibleAgent ||
        null;
    const currentUserId = props.auth?.user?.id;

    const { mutate: addSelfWatcher, isPending: isAddingWatcher } = useApiMutate<
        Record<string, never>,
        any,
        ApiSuccessResponse<any>
    >(
        route("properties.watchers.store-self", property.id),
        "POST",
        () => {
            router.reload({ only: ["property"] });
        },
    );

    const { mutate: syncWatchers, isPending: isSyncingWatchers } = useApiMutate<
        { user_ids: number[] },
        any,
        ApiSuccessResponse<any>
    >(route("properties.watchers.sync", property.id), "PUT", () => {
        setSelectedWatcherIds([]);
        router.reload({ only: ["property"] });
    });

    const handleRemoveCollaborator = async (userId: number) => {
        setRemovingCollaboratorId(userId);
        try {
            await axios.delete(
                route("properties.collaborators.destroy", {
                    propertyId: property.id,
                    userId,
                }),
                {
                    headers: {
                        Accept: "application/json",
                        "X-COMPANY-ID": props.auth?.user?.company_id || "",
                    },
                },
            );
            message.success("Collaborator removed.");
            router.reload({ only: ["property"] });
        } catch {
            message.error("Failed to remove collaborator.");
        } finally {
            setRemovingCollaboratorId(null);
        }
    };

    const handleAddWatchers = () => {
        if (selectedWatcherIds.length === 0) {
            return;
        }

        const mergedIds = Array.from(
            new Set([...watchers.map((w) => w.id), ...selectedWatcherIds]),
        );
        syncWatchers({ user_ids: mergedIds });
    };

    const handleRemoveWatcher = (userId: number) => {
        const remaining = watchers
            .map((watcher) => watcher.id)
            .filter((id) => id !== userId);
        syncWatchers({ user_ids: remaining });
    };

    return (
        <Card
            title={
                <Space>
                    <TeamOutlined />
                    <span>Property Team</span>
                </Space>
            }
            className="mb-4"
        >
            <div className="space-y-4">
                <div>
                    <Text type="secondary" className="text-xs uppercase">
                        Responsible Agent
                    </Text>
                    <div className="mt-1 font-medium">
                        {responsibleAgent?.name || "Not assigned"}
                    </div>
                </div>

                <div>
                    <Text type="secondary" className="text-xs uppercase">
                        Collaborators
                    </Text>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {collaborators.length > 0 ? (
                            collaborators.map((collaborator) => (
                                <Tag
                                    key={collaborator.id}
                                    closable={permissions.canManageTeam}
                                    onClose={(e) => {
                                        e.preventDefault();
                                        handleRemoveCollaborator(
                                            collaborator.id,
                                        );
                                    }}
                                >
                                    {collaborator.name}
                                    {removingCollaboratorId === collaborator.id
                                        ? "..."
                                        : ""}
                                </Tag>
                            ))
                        ) : (
                            <Text type="secondary" className="text-sm">
                                No collaborators yet
                            </Text>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <Text type="secondary" className="text-xs uppercase">
                            Watchers
                        </Text>
                        {permissions.canAddSelfAsWatcher && (
                            <Button
                                size="small"
                                icon={<EyeOutlined />}
                                loading={isAddingWatcher}
                                onClick={() => addSelfWatcher({})}
                            >
                                Watch this property
                            </Button>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {watchers.length > 0 ? (
                            watchers.map((watcher) => (
                                <Tag
                                    key={watcher.id}
                                    icon={<EyeOutlined />}
                                    closable={
                                        permissions.canManageTeam ||
                                        watcher.id === currentUserId
                                    }
                                    onClose={(e) => {
                                        e.preventDefault();
                                        handleRemoveWatcher(watcher.id);
                                    }}
                                >
                                    {watcher.name}
                                </Tag>
                            ))
                        ) : (
                            <Text type="secondary" className="text-sm">
                                No watchers yet
                            </Text>
                        )}
                    </div>
                    {permissions.canManageTeam && employees.length > 0 && (
                        <div className="mt-3 flex gap-2">
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder="Add watchers"
                                className="flex-1"
                                value={selectedWatcherIds}
                                onChange={setSelectedWatcherIds}
                                options={employees
                                    .filter(
                                        (employee) =>
                                            !watchers.some(
                                                (watcher) =>
                                                    watcher.id === employee.id,
                                            ),
                                    )
                                    .map((employee) => ({
                                        label: employee.name,
                                        value: employee.id,
                                    }))}
                            />
                            <Button
                                onClick={handleAddWatchers}
                                loading={isSyncingWatchers}
                                disabled={selectedWatcherIds.length === 0}
                            >
                                Add
                            </Button>
                        </div>
                    )}
                </div>

                {permissions.isCollaborator && (
                    <Text type="secondary" className="text-xs block">
                        <UserDeleteOutlined className="mr-1" />
                        Collaborators can edit public listing fields only.
                    </Text>
                )}
            </div>
        </Card>
    );
}
