import React, { useState, useMemo } from "react";
import {
    Timeline,
    Button,
    Skeleton,
    Drawer,
    Empty,
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

    /* ---- Filter pills ----------------------------------------------------- */
    const pillOptions: {
        label: string;
        value: FilterMode;
        icon?: React.ReactNode;
    }[] = [
        { label: "All", value: "all" },
        { label: "Agent", value: "agent", icon: <UserOutlined /> },
        { label: "System", value: "system", icon: <ThunderboltOutlined /> },
        { label: "External", value: "external", icon: <ApiOutlined /> },
    ];

    const filterBar = (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
            {pillOptions.map((opt) => {
                const isActive = filter === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFilter(opt.value)}
                        className={`
                            inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                            transition-all duration-150 cursor-pointer border
                            ${
                                isActive
                                    ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700"
                            }
                        `}
                    >
                        {opt.icon && (
                            <span className="text-[11px]">{opt.icon}</span>
                        )}
                        {opt.label}
                    </button>
                );
            })}
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
