import React, { useState, useMemo } from "react";
import {
    Timeline,
    Button,
    Skeleton,
    Drawer,
    Empty,
    Segmented,
    Typography,
    Tooltip,
} from "antd";
import {
    PlusOutlined,
    ReloadOutlined,
    ExpandAltOutlined,
    ThunderboltOutlined,
    UserOutlined,
    ApiOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { isLoading as _isLoading } from "@/lib/utils";
import CrmEventItem from "./CrmEventItem";
import LogActionModal from "./LogActionModal";
import type { CrmEventsIndexResponse, CrmEvent } from "@/Types/api/crm-event";

const { Title } = Typography;

type FilterMode = "all" | "agent" | "system" | "external";

interface Props {
    /** Fully-qualified model class, e.g. "App\\Models\\Deal" */
    modelType: string;
    modelId: number;
    userId?: number;
    /** Show only a few items with limited detail. */
    compact?: boolean;
    /** Label for the modal context (e.g. deal name). */
    entityName?: string;
}

export default function CrmEventTimeline({
    modelType,
    modelId,
    userId,
    compact = true,
    entityName,
}: Props) {
    const [filter, setFilter] = useState<FilterMode>("all");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const perPage = compact ? 8 : 50;

    /* ---- Fetch events ------------------------------------------------------ */
    const {
        data: eventsResponse,
        status,
        isRefetching,
        refetch,
    } = useApiQuery<CrmEventsIndexResponse>({
        path: "/api/v1/crm-events",
        params: {
            model_type: modelType,
            model_id: modelId,
            per_page: perPage,
            sort_order: "desc",
            ...(filter === "agent"
                ? { generation_type: "user_generated" }
                : {}),
            ...(filter === "system"
                ? { generation_type: "system_generated" }
                : {}),
            ...(filter === "external" ? { generation_type: "external" } : {}),
        },
        options: { refetchInterval: 15000 },
    });

    const events: CrmEvent[] = eventsResponse?.data ?? [];
    const isLoadingData = _isLoading({ status });

    /* ---- Timeline items ---------------------------------------------------- */
    const timelineItems = useMemo(
        () =>
            events.map((evt) => ({
                key: evt.uuid,
                color:
                    evt.generation_type === "system_generated"
                        ? "blue"
                        : evt.generation_type === "external"
                          ? "orange"
                          : "green",
                children: <CrmEventItem event={evt} compact={compact} />,
            })),
        [events, compact],
    );

    /* ---- Header actions --------------------------------------------------- */
    const headerActions = (
        <div className="flex items-center gap-1.5">
            <Tooltip title="Log action">
                <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                />
            </Tooltip>
            <Tooltip title="Refresh">
                <Button
                    size="small"
                    icon={<ReloadOutlined spin={isRefetching} />}
                    onClick={() => refetch()}
                />
            </Tooltip>
            {compact && (
                <Tooltip title="Expand">
                    <Button
                        size="small"
                        icon={<ExpandAltOutlined />}
                        onClick={() => setDrawerOpen(true)}
                    />
                </Tooltip>
            )}
        </div>
    );

    /* ---- Filter chips ------------------------------------------------------ */
    const filterBar = (
        <div className="mb-4">
            <Segmented
                size="small"
                value={filter}
                onChange={(v) => setFilter(v as FilterMode)}
                options={[
                    { label: "All", value: "all" },
                    {
                        label: (
                            <span>
                                <UserOutlined className="mr-1" />
                                Agent
                            </span>
                        ),
                        value: "agent",
                    },
                    {
                        label: (
                            <span>
                                <ThunderboltOutlined className="mr-1" />
                                System
                            </span>
                        ),
                        value: "system",
                    },
                    {
                        label: (
                            <span>
                                <ApiOutlined className="mr-1" />
                                External
                            </span>
                        ),
                        value: "external",
                    },
                ]}
            />
        </div>
    );

    /* ---- Body (shared between sidebar & drawer) --------------------------- */
    const renderBody = (isCompact: boolean) => (
        <>
            {filterBar}
            {isLoadingData ? (
                <Skeleton active paragraph={{ rows: isCompact ? 4 : 10 }} />
            ) : events.length === 0 ? (
                <Empty
                    description="No events yet"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            ) : (
                <Timeline items={timelineItems} />
            )}
        </>
    );

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <Title level={5} className="!mb-0 !text-sm">
                    Activity Timeline
                </Title>
                {headerActions}
            </div>

            {/* Card body */}
            <div className="p-4 max-h-[560px] overflow-y-auto">
                {renderBody(compact)}
            </div>

            {/* Expanded Drawer */}
            <Drawer
                title={`Activity Timeline ${entityName ? ` — ${entityName}` : ""}`}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={520}
                destroyOnClose
            >
                {renderBody(false)}
            </Drawer>

            {/* Log Action Modal */}
            <LogActionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => refetch()}
                modelType={modelType}
                modelId={modelId}
                userId={userId}
            />
        </div>
    );
}
