import React, { useState, useEffect, useCallback } from "react";
import { Tabs, Table, Skeleton, Segmented } from "antd";
import type { ColumnsType } from "antd/es/table";
import axios from "axios";
import MeetingTypeBadge from "./MeetingTypeBadge";

interface Filters {
    start_date: string;
    end_date: string;
    agent_id: number | null;
    view_type: "agent" | "department";
}

interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface DeepDiveSectionProps {
    filters: Filters;
    activeTab: string | null;
    onTabChange: (tab: string) => void;
}

// ── Column Definitions ──────────────────────────────────────────

const leadColumns: ColumnsType<any> = [
    { title: "Name", dataIndex: "client_name", key: "client_name" },
    { title: "Email", dataIndex: "client_email", key: "client_email" },
    {
        title: "Source",
        key: "source",
        render: (_, r) => r.lead_source?.type ?? "—",
    },
    {
        title: "Lead Owner",
        key: "lead_owner",
        render: (_, r) => r.lead_owner?.name ?? "—",
    },
    {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleDateString(),
    },
];

const dealsCreatedColumns: ColumnsType<any> = [
    { title: "Deal Name", dataIndex: "name", key: "name" },
    {
        title: "Contact",
        key: "contact",
        render: (_, r) => r.contact?.client_name ?? "—",
    },
    {
        title: "Stage",
        key: "stage",
        render: (_, r) => r.lead_stage?.name ?? "—",
    },
    { title: "Value", dataIndex: "value", key: "value" },
    {
        title: "Agent",
        key: "agent",
        render: (_, r) => r.lead_agent?.user?.name ?? "—",
    },
    {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleDateString(),
    },
];

const dealsClosedColumns: ColumnsType<any> = [
    { title: "Deal Name", dataIndex: "name", key: "name" },
    {
        title: "Contact",
        key: "contact",
        render: (_, r) => r.contact?.client_name ?? "—",
    },
    { title: "Value", dataIndex: "value", key: "value" },
    {
        title: "Agent",
        key: "agent",
        render: (_, r) => r.lead_agent?.user?.name ?? "—",
    },
    {
        title: "Won At",
        dataIndex: "won_at",
        key: "won_at",
        render: (v: string) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
];

const meetingsColumns: ColumnsType<any> = [
    {
        title: "Deal",
        key: "deal",
        render: (_, r) => r.deal?.name ?? "—",
    },
    {
        title: "Type",
        key: "meeting_type",
        render: (_, r) => (
            <MeetingTypeBadge type={r.meeting_type?.name ?? "Unknown"} />
        ),
    },
    {
        title: "Date",
        dataIndex: "next_follow_up_date",
        key: "next_follow_up_date",
        render: (v: string) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
    {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: string | null) => v ?? "—",
    },
    {
        title: "Duration",
        dataIndex: "duration",
        key: "duration",
        render: (v: number | null) => (v ? `${v} min` : "—"),
    },
    {
        title: "Remark",
        dataIndex: "remark",
        key: "remark",
        ellipsis: true,
    },
];

const dealNotesColumns: ColumnsType<any> = [
    { title: "Title", dataIndex: "title", key: "title" },
    {
        title: "Details",
        dataIndex: "details",
        key: "details",
        ellipsis: true,
    },
    {
        title: "Lead",
        key: "lead",
        render: (_, r) => r.deal?.contact?.client_name ?? "—",
    },
    {
        title: "Deal",
        key: "deal",
        render: (_, r) => r.deal?.name ?? "—",
    },
    {
        title: "Agent",
        key: "agent",
        render: (_, r) =>
            r.deal?.lead_agent?.user?.name ?? r.added_by?.name ?? "—",
    },
    {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleDateString(),
    },
];

const leadNotesColumns: ColumnsType<any> = [
    { title: "Title", dataIndex: "title", key: "title" },
    {
        title: "Details",
        dataIndex: "details",
        key: "details",
        ellipsis: true,
    },
    {
        title: "Lead",
        key: "lead",
        render: (_, r) => r.lead?.client_name ?? "—",
    },
    {
        title: "Agent",
        key: "agent",
        render: (_, r) => r.added_by?.name ?? "—",
    },
    {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleDateString(),
    },
];

// ── Tab Config ──────────────────────────────────────────────────

const TAB_CONFIG: Record<
    string,
    { endpoint: string; columns: ColumnsType<any>; label: string }
> = {
    leads: {
        endpoint: "/account/agent-reports/leads",
        columns: leadColumns,
        label: "Leads",
    },
    "deals-created": {
        endpoint: "/account/agent-reports/deals-created",
        columns: dealsCreatedColumns,
        label: "Deals Created",
    },
    "deals-closed": {
        endpoint: "/account/agent-reports/deals-closed",
        columns: dealsClosedColumns,
        label: "Deals Closed",
    },
    meetings: {
        endpoint: "/account/agent-reports/meetings",
        columns: meetingsColumns,
        label: "Meetings",
    },
};

const NOTES_SUB_TABS: Record<
    string,
    { endpoint: string; columns: ColumnsType<any>; label: string }
> = {
    "deal-notes": {
        endpoint: "/account/agent-reports/deal-notes",
        columns: dealNotesColumns,
        label: "Deal Notes",
    },
    "lead-notes": {
        endpoint: "/account/agent-reports/lead-notes",
        columns: leadNotesColumns,
        label: "Lead Notes",
    },
};

// ── Component ───────────────────────────────────────────────────

const DeepDiveSection: React.FC<DeepDiveSectionProps> = ({
    filters,
    activeTab,
    onTabChange,
}) => {
    const currentTab = activeTab ?? "leads";

    return (
        <div className="bg-white rounded-lg border border-gray-200 px-8 py-6 mt-6">
            <Tabs
                activeKey={currentTab}
                onChange={onTabChange}
                className="px-4 pt-2"
                items={[
                    ...Object.entries(TAB_CONFIG).map(([key, config]) => ({
                        key,
                        label: config.label,
                        children: (
                            <TabContent
                                tabKey={key}
                                filters={filters}
                                config={config}
                            />
                        ),
                    })),
                    {
                        key: "notes",
                        label: "Notes",
                        children: <NotesTabContent filters={filters} />,
                    },
                ]}
            />
        </div>
    );
};

// ── Notes Tab (sub-segmented: Deal Notes / Lead Notes) ──────────

const NotesTabContent: React.FC<{ filters: Filters }> = ({ filters }) => {
    const [activeSubTab, setActiveSubTab] = useState<string>("deal-notes");
    const config = NOTES_SUB_TABS[activeSubTab];

    return (
        <div>
            <div className="mb-4">
                <Segmented
                    options={Object.entries(NOTES_SUB_TABS).map(
                        ([key, cfg]) => ({ label: cfg.label, value: key }),
                    )}
                    value={activeSubTab}
                    onChange={(val) => setActiveSubTab(val as string)}
                />
            </div>
            <TabContent
                tabKey={activeSubTab}
                filters={filters}
                config={config}
            />
        </div>
    );
};

// ── Single Tab Content (lazy-loaded) ────────────────────────────

const TabContent: React.FC<{
    tabKey: string;
    filters: Filters;
    config: { endpoint: string; columns: ColumnsType<any> };
}> = ({ tabKey, filters, config }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 15,
        total: 0,
    });

    const fetchData = useCallback(
        async (page = 1, perPage = 15) => {
            setLoading(true);
            try {
                const params: Record<string, string | number> = {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    view_type: filters.view_type,
                    page,
                    per_page: perPage,
                };
                if (filters.agent_id) {
                    params.agent_id = filters.agent_id;
                }
                const res = await axios.get<PaginatedResponse<any>>(
                    config.endpoint,
                    { params },
                );
                setData(res.data.data);
                setPagination({
                    current: res.data.current_page,
                    pageSize: res.data.per_page,
                    total: res.data.total,
                });
            } catch {
                setData([]);
            } finally {
                setLoading(false);
            }
        },
        [filters, config.endpoint],
    );

    useEffect(() => {
        fetchData(1);
    }, [fetchData]);

    if (loading && data.length === 0) {
        return <Skeleton active paragraph={{ rows: 6 }} className="p-4" />;
    }

    return (
        <Table
            dataSource={data}
            columns={config.columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `${total} records`,
                onChange: (page, pageSize) => fetchData(page, pageSize),
            }}
        />
    );
};

export default DeepDiveSection;
