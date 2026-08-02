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
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Title } = Typography;

type FilterMode = "all" | "agent" | "system" | "external";
type TimelineVariant = "default" | "deal-redesign";

interface Props {
    /**
     * Fully-qualified model class. Prefer escaped form matching the redesign
     * timeline (`App\\\\Models\\\\Deal`) so store/index normalize identically;
     * single-backslash also works after controller normalization.
     */
    modelType: string;
    modelId: number;
    userId?: number;
    /** Show only a few items with limited detail. */
    compact?: boolean;
    /** Label for the modal context (e.g. deal name). */
    entityName?: string;
    /** Visual style variant; default preserves legacy callers. */
    variant?: TimelineVariant;
}

export default function CrmEventTimeline({
    modelType,
    modelId,
    userId,
    compact = true,
    entityName,
    variant = "default",
}: Props) {
    const [filter, setFilter] = useState<FilterMode>("all");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const { td } = useTd();

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
            <Tooltip title={td("Log action")}>
                <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                />
            </Tooltip>
            <Tooltip title={td("Refresh")}>
                <Button
                    size="small"
                    icon={<ReloadOutlined spin={isRefetching} />}
                    onClick={() => refetch()}
                />
            </Tooltip>
            {compact && (
                <Tooltip title={td("Expand")}>
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

    const isDealRedesign = variant === "deal-redesign";

    const filterBar = (
        <div
            className={`mb-4 flex items-center gap-2 flex-wrap ${isDealRedesign ? "mb-0" : ""}`}
        >
            {pillOptions.map((opt) => {
                const isActive = filter === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFilter(opt.value)}
                        className={
                            isDealRedesign
                                ? `
                            inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium
                            transition-all duration-150 cursor-pointer
                            ${
                                isActive
                                    ? "bg-[#1a6bb5] text-white border-[#1a6bb5]"
                                    : "bg-white text-[#5b6474] border-[#d8dce3] hover:bg-[#f6f8fb] hover:text-[#2f3747]"
                            }
                        `
                                : `
                            inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium
                            transition-all duration-150 cursor-pointer border
                            ${
                                isActive
                                    ? "bg-gray-800 text-white border-gray-800"
                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700"
                            }
                        `
                        }
                    >
                        {opt.icon && (
                            <span className="text-[11px]">{opt.icon}</span>
                        )}
                        {td(opt.label)}
                    </button>
                );
            })}
        </div>
    );

    /* ---- Body (shared between sidebar & drawer) --------------------------- */
    const renderBody = (isCompact: boolean) => (
        <>
            {isDealRedesign ? (
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap border-b border-[#edf0f4] pb-3">
                    {filterBar}
                    <Button size="small" disabled>
                        {td("Date range")}
                    </Button>
                </div>
            ) : (
                filterBar
            )}
            {isLoadingData ? (
                <Skeleton active paragraph={{ rows: isCompact ? 4 : 10 }} />
            ) : events.length === 0 ? (
                <Empty
                    description={td("No events yet")}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            ) : (
                <Timeline items={timelineItems} />
            )}
        </>
    );

    return (
        <div
            className={
                isDealRedesign
                    ? "bg-white rounded-xl border border-[#e2e5ea] overflow-hidden shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
                    : "bg-white rounded-lg border border-gray-200 overflow-hidden"
            }
        >
            {/* Card header */}
            <div
                className={
                    isDealRedesign
                        ? "flex items-center justify-between px-4 py-3.5 border-b border-[#edf0f4] bg-white"
                        : "flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50"
                }
            >
                <Title level={5} className="!mb-0 !text-sm">
                    {td("Activity Timeline")}
                </Title>
                {headerActions}
            </div>

            {/* Card body */}
            <div
                className={
                    isDealRedesign
                        ? "p-4 max-h-[620px] overflow-y-auto"
                        : "p-4 max-h-[560px] overflow-y-auto"
                }
            >
                {renderBody(compact)}
            </div>

            {/* Expanded Drawer */}
            <Drawer
                title={td(
                    `Activity Timeline ${entityName ? ` — ${entityName}` : ""}`,
                )}
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
