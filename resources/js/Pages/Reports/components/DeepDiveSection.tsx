import React, { useState, useEffect, useCallback } from "react";
import {
    Tabs,
    Table,
    Skeleton,
    Drawer,
    Typography,
    Space,
    Avatar,
    Card,
    Button,
    Input,
    Empty,
    Pagination,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "@inertiajs/react";
import {
    UserOutlined,
    CalendarOutlined,
    EyeOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import MeetingTypeBadge from "./MeetingTypeBadge";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import ViewNote from "@/Pages/Deals/Components/Tabs/notes/ViewNote";
import { ContentRenderer } from "@/Components/ContentRenderer";

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
    {
        title: "Name",
        dataIndex: "client_name",
        key: "client_name",
        render: (v: string, r) => (
            <Link href={`/account/lead-contact/${r.id}`}>{v}</Link>
        ),
    },
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
    {
        title: "Deal Name",
        dataIndex: "name",
        key: "name",
        render: (v: string, r) => (
            <Link href={`/account/deals/${r.id}`}>{v}</Link>
        ),
    },
    {
        title: "Contact",
        key: "contact",
        render: (_, r) =>
            r.contact ? (
                <Link href={`/account/lead-contact/${r.contact.id}`}>
                    {r.contact.client_name}
                </Link>
            ) : (
                "—"
            ),
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
    {
        title: "Deal Name",
        dataIndex: "name",
        key: "name",
        render: (v: string, r) => (
            <Link href={`/account/deals/${r.id}`}>{v}</Link>
        ),
    },
    {
        title: "Contact",
        key: "contact",
        render: (_, r) =>
            r.contact ? (
                <Link href={`/account/lead-contact/${r.contact.id}`}>
                    {r.contact.client_name}
                </Link>
            ) : (
                "—"
            ),
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

const getMeetingsColumns = (
    onView: (record: any) => void,
): ColumnsType<any> => [
    {
        title: "Deal",
        key: "deal",
        render: (_, r) =>
            r.deal ? (
                <Link href={`/account/deals/${r.deal.id}`}>{r.deal.name}</Link>
            ) : (
                "—"
            ),
    },
    {
        title: "Type",
        key: "meeting_type",
        render: (_, r) => (
            <a className="cursor-pointer" onClick={() => onView(r)}>
                <MeetingTypeBadge type={r.meeting_type?.name ?? "Unknown"} />
            </a>
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
                        key: "meetings",
                        label: "Meetings",
                        children: <MeetingsTabContent filters={filters} />,
                    },
                    {
                        key: "deal-notes",
                        label: "Deal Notes",
                        children: <DealNotesTabContent filters={filters} />,
                    },
                    {
                        key: "lead-notes",
                        label: "Lead Notes",
                        children: <LeadNotesTabContent filters={filters} />,
                    },
                ]}
            />
        </div>
    );
};

// ── Meetings Tab (with ViewFollowup drawer) ─────────────────────

const MeetingsTabContent: React.FC<{ filters: Filters }> = ({ filters }) => {
    const [selected, setSelected] = useState<any>(null);

    const columns = getMeetingsColumns((record) => setSelected(record));

    return (
        <>
            <TabContent
                tabKey="meetings"
                filters={filters}
                config={{
                    endpoint: "/account/agent-reports/meetings",
                    columns,
                }}
            />
            {selected?.deal && (
                <ViewFollowup
                    open={!!selected}
                    onClose={() => setSelected(null)}
                    deal={selected.deal}
                    followup={selected}
                />
            )}
        </>
    );
};

// ── Shared typography ───────────────────────────────────────────

const { Title, Text } = Typography;

// ── Read-only note card for reports ────────────────────────────

const ReportNoteCard: React.FC<{
    note: any;
    onView: (note: any) => void;
    context?: React.ReactNode;
}> = ({ note, onView, context }) => (
    <Card
        className="group transition-all duration-200 border border-gray-200 hover:border-blue-300"
        styles={{ body: { padding: "20px" } }}
        variant="outlined"
    >
        <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex-1 min-w-0">
                <Title
                    level={5}
                    className="mb-1 text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => onView(note)}
                    ellipsis={{ tooltip: note.title, rows: 1 }}
                >
                    {note.title}
                </Title>
            </div>
            <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                onClick={() => onView(note)}
            />
        </div>

        <div className="mb-3 h-14 overflow-hidden">
            <ContentRenderer
                content={note.details}
                maxLength={120}
                showFullContent={false}
                className="text-sm text-gray-600 leading-relaxed"
            />
        </div>

        {context && <div className="mb-3 text-xs text-gray-500">{context}</div>}

        <div className="flex items-center justify-between mt-2">
            {note.added_by && (
                <div className="flex items-center gap-x-2 text-xs text-gray-500">
                    <Avatar
                        size="small"
                        icon={<UserOutlined />}
                        src={note.added_by?.image_url}
                    />
                    <span>{note.added_by.name}</span>
                </div>
            )}
            <Space size="small" className="text-xs text-gray-400">
                <ClockCircleOutlined />
                <span>{dayjs(note.created_at).format("MMM DD, YYYY")}</span>
            </Space>
        </div>
    </Card>
);

// ── Shared notes data-fetching hook ────────────────────────────

function useNotesFetch(endpoint: string, filters: Filters) {
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
                const res = await axios.get<PaginatedResponse<any>>(endpoint, {
                    params,
                });
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
        [filters, endpoint],
    );

    useEffect(() => {
        fetchData(1);
    }, [fetchData]);

    return { data, loading, pagination, fetchData };
}

// ── Deal Notes Tab (card-based, view-only) ──────────────────────

const DealNotesTabContent: React.FC<{ filters: Filters }> = ({ filters }) => {
    const [selected, setSelected] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const { data, loading, pagination, fetchData } = useNotesFetch(
        "/account/agent-reports/deal-notes",
        filters,
    );

    const filteredNotes = data.filter(
        (n) =>
            n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.details?.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (loading && data.length === 0) {
        return <Skeleton active paragraph={{ rows: 6 }} className="p-4" />;
    }

    return (
        <div className="flex flex-col gap-y-6">
            <div className="flex justify-end">
                <Input.Search
                    placeholder="Search notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="small"
                    className="w-72"
                />
            </div>

            {filteredNotes.length === 0 ? (
                <Empty
                    description={
                        searchTerm
                            ? `No notes found for "${searchTerm}"`
                            : "No deal notes in this period"
                    }
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredNotes.map((note) => (
                        <ReportNoteCard
                            key={note.id}
                            note={note}
                            onView={setSelected}
                            context={
                                note.deal ? (
                                    <div className="flex flex-col gap-y-1">
                                        <div>
                                            <span className="mr-1 text-gray-400">
                                                Deal:
                                            </span>
                                            <Link
                                                href={`/account/deals/${note.deal.id}`}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                {note.deal.name}
                                            </Link>
                                        </div>
                                        {note.deal.contact && (
                                            <div>
                                                <span className="mr-1 text-gray-400">
                                                    Contact:
                                                </span>
                                                <Link
                                                    href={`/account/lead-contact/${note.deal.contact.id}`}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    {
                                                        note.deal.contact
                                                            .client_name
                                                    }
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                ) : undefined
                            }
                        />
                    ))}
                </div>
            )}

            {!searchTerm && pagination.total > pagination.pageSize && (
                <Pagination
                    current={pagination.current}
                    pageSize={pagination.pageSize}
                    total={pagination.total}
                    showSizeChanger
                    showTotal={(total) => `${total} notes`}
                    onChange={(page, size) => fetchData(page, size)}
                    className="flex justify-end"
                />
            )}

            {selected && (
                <ViewNote
                    open={!!selected}
                    onClose={() => setSelected(null)}
                    deal={selected.deal ?? {}}
                    note={selected}
                />
            )}
        </div>
    );
};

// ── Lead Notes Tab (card-based, view-only) ──────────────────────

const LeadNotesTabContent: React.FC<{ filters: Filters }> = ({ filters }) => {
    const [selected, setSelected] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const { data, loading, pagination, fetchData } = useNotesFetch(
        "/account/agent-reports/lead-notes",
        filters,
    );

    const filteredNotes = data.filter(
        (n) =>
            n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.details?.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (loading && data.length === 0) {
        return <Skeleton active paragraph={{ rows: 6 }} className="p-4" />;
    }

    return (
        <div className="flex flex-col gap-y-6">
            <div className="flex justify-end">
                <Input.Search
                    placeholder="Search notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="small"
                    className="w-72"
                />
            </div>

            {filteredNotes.length === 0 ? (
                <Empty
                    description={
                        searchTerm
                            ? `No notes found for "${searchTerm}"`
                            : "No lead notes in this period"
                    }
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredNotes.map((note) => (
                        <ReportNoteCard
                            key={note.id}
                            note={note}
                            onView={setSelected}
                            context={
                                note.lead ? (
                                    <div>
                                        <span className="mr-1 text-gray-400">
                                            Lead:
                                        </span>
                                        <Link
                                            href={`/account/lead-contact/${note.lead.id}`}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            {note.lead.client_name}
                                        </Link>
                                    </div>
                                ) : undefined
                            }
                        />
                    ))}
                </div>
            )}

            {!searchTerm && pagination.total > pagination.pageSize && (
                <Pagination
                    current={pagination.current}
                    pageSize={pagination.pageSize}
                    total={pagination.total}
                    showSizeChanger
                    showTotal={(total) => `${total} notes`}
                    onChange={(page, size) => fetchData(page, size)}
                    className="flex justify-end"
                />
            )}

            <Drawer
                title={<span className="text-sm">View Note</span>}
                placement="right"
                size="large"
                open={!!selected}
                onClose={() => setSelected(null)}
                destroyOnHidden
            >
                {selected && (
                    <div className="space-y-6">
                        <div>
                            <Title level={3} className="mb-0">
                                {selected.title}
                            </Title>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <Space
                                direction="vertical"
                                size="small"
                                className="w-full"
                            >
                                <div className="flex items-center space-x-2">
                                    <CalendarOutlined className="text-gray-500" />
                                    <Text type="secondary">
                                        Created on{" "}
                                        {dayjs(selected.created_at).format(
                                            "MMMM DD, YYYY [at] h:mm A",
                                        )}
                                    </Text>
                                </div>
                                {selected.added_by && (
                                    <div className="flex items-center gap-x-2">
                                        <Avatar
                                            size="small"
                                            icon={<UserOutlined />}
                                            src={selected.added_by?.image_url}
                                        />
                                        <Text type="secondary">
                                            Created by {selected.added_by?.name}
                                        </Text>
                                    </div>
                                )}
                            </Space>
                        </div>

                        <div>
                            <Title level={4} className="mb-3">
                                Details
                            </Title>
                            <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px]">
                                {selected.details ? (
                                    <ContentRenderer
                                        content={selected.details}
                                        showFullContent={true}
                                        className="prose prose-sm max-w-none"
                                    />
                                ) : (
                                    <Text type="secondary" italic>
                                        No details provided
                                    </Text>
                                )}
                            </div>
                        </div>

                        {selected.lead && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <Title level={5} className="mb-2 text-blue-800">
                                    Related Lead
                                </Title>
                                <div>
                                    <Link
                                        href={`/account/lead-contact/${selected.lead.id}`}
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        {selected.lead.client_name}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
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
