import React, { useState, useEffect } from "react";
import {
    Card,
    Form,
    Select,
    InputNumber,
    DatePicker,
    Switch,
    Button,
    Table,
    Tag,
    Empty,
    message,
    Spin,
    Alert,
    Row,
    Col,
    Statistic,
    Popconfirm,
    Divider,
} from "antd";
import { motion } from "framer-motion";
import {
    Save,
    CalendarDays,
    RefreshCw,
    Users,
    Clock,
    Eye,
    XCircle,
} from "lucide-react";
import dayjs from "dayjs";
import axios from "axios";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    useCycleConfig,
    useUpdateCycleConfig,
    useMlmCycles,
    useMlmCycleDetail,
    useActiveCycle,
} from "@/Features/Mlm/api";
import {
    CycleStatusBadge,
    EnrollmentStatusBadge,
} from "@/Features/Mlm/Components";
import type {
    MlmCycleConfig,
    MlmCycleConfigFormData,
    MlmCycle,
    ActiveCycleSummary,
    CycleDurationType,
    CYCLE_DURATION_LABELS,
} from "@/Features/Mlm/types";

interface Props extends PageProps {}

/* ------------------------------------------------------------------ */
/*  Config Section                                                     */
/* ------------------------------------------------------------------ */
const CycleConfigSection: React.FC = () => {
    const { data: configData, isLoading } = useCycleConfig();
    const config: MlmCycleConfig | null = (configData as any)?.data ?? null;

    const [form] = Form.useForm<MlmCycleConfigFormData>();
    const [durationType, setDurationType] = useState<string>("monthly");

    const updateConfig = useUpdateCycleConfig(() => {
        message.success("Cycle configuration saved");
    });

    useEffect(() => {
        if (config) {
            form.setFieldsValue({
                duration_type: config.duration_type,
                duration_days: config.duration_days,
                anchor_date: config.anchor_date,
                max_overflow_multiplier: config.max_overflow_multiplier,
                auto_generate: config.auto_generate,
            });
            setDurationType(config.duration_type);
        }
    }, [config, form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            updateConfig.mutate(values);
        } catch {
            // validation errors handled by form
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card
                title={
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-indigo-500" />
                        <span className="font-semibold">
                            Cycle Configuration
                        </span>
                    </div>
                }
                className="shadow-sm"
            >
                <Spin spinning={isLoading}>
                    <Alert
                        type="info"
                        showIcon
                        className="mb-4"
                        message="Cycle settings determine how agent performance windows are structured. Changing these settings will apply to future cycles only."
                    />

                    <Form
                        form={form}
                        layout="vertical"
                        initialValues={{
                            duration_type: "monthly",
                            max_overflow_multiplier: 1.5,
                            auto_generate: true,
                        }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    label="Duration Type"
                                    name="duration_type"
                                    rules={[
                                        { required: true, message: "Required" },
                                    ]}
                                    tooltip="How long each performance cycle lasts."
                                >
                                    <Select
                                        onChange={(v) => setDurationType(v)}
                                        options={[
                                            {
                                                value: "monthly",
                                                label: "Monthly (~30 days)",
                                            },
                                            {
                                                value: "quarterly",
                                                label: "Quarterly (~90 days)",
                                            },
                                            {
                                                value: "custom",
                                                label: "Custom Duration",
                                            },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>

                            {durationType === "custom" && (
                                <Col xs={24} md={8}>
                                    <Form.Item
                                        label="Custom Duration (days)"
                                        name="duration_days"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Required for custom type",
                                            },
                                        ]}
                                    >
                                        <InputNumber
                                            min={1}
                                            max={365}
                                            className="w-full"
                                            placeholder="e.g. 45"
                                        />
                                    </Form.Item>
                                </Col>
                            )}

                            <Col xs={24} md={8}>
                                <Form.Item
                                    label="Anchor Date"
                                    name="anchor_date"
                                    rules={[
                                        { required: true, message: "Required" },
                                    ]}
                                    tooltip="The starting reference date cycles are calculated from."
                                    getValueProps={(v) => ({
                                        value: v ? dayjs(v) : undefined,
                                    })}
                                    getValueFromEvent={(d: any) =>
                                        d ? d.format("YYYY-MM-DD") : null
                                    }
                                >
                                    <DatePicker className="w-full" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    label="Overflow Multiplier"
                                    name="max_overflow_multiplier"
                                    rules={[
                                        { required: true, message: "Required" },
                                    ]}
                                    tooltip="When an agent doesn't meet criteria within a cycle, they can continue for (cycle_days × multiplier) extra days. Set to 0 to disable overflow."
                                >
                                    <InputNumber
                                        min={0}
                                        max={5}
                                        step={0.1}
                                        className="w-full"
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    label="Auto-Generate Cycles"
                                    name="auto_generate"
                                    valuePropName="checked"
                                    tooltip="When enabled, new cycles are created automatically by the scheduler."
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>

                        {config && (
                            <div className="text-sm text-gray-500 mb-4">
                                Resolved duration:{" "}
                                <strong>
                                    {config.duration_days_resolved} days
                                </strong>
                                {config.max_overflow_days != null && (
                                    <>
                                        {" "}
                                        &middot; Max overflow:{" "}
                                        <strong>
                                            {config.max_overflow_days} days
                                        </strong>
                                    </>
                                )}
                            </div>
                        )}

                        <Button
                            type="primary"
                            icon={<Save size={14} />}
                            onClick={handleSave}
                            loading={updateConfig.isPending}
                        >
                            Save Configuration
                        </Button>
                    </Form>
                </Spin>
            </Card>
        </motion.div>
    );
};

/* ------------------------------------------------------------------ */
/*  Active Cycle Summary                                               */
/* ------------------------------------------------------------------ */
const ActiveCycleSummarySection: React.FC<{
    onViewCycle: (id: number) => void;
}> = ({ onViewCycle }) => {
    const { data, isLoading } = useActiveCycle();
    const summary: ActiveCycleSummary | null = (data as any)?.data ?? null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
        >
            <Card
                title={
                    <div className="flex items-center gap-2">
                        <RefreshCw size={18} className="text-green-500" />
                        <span className="font-semibold">Active Cycle</span>
                    </div>
                }
                className="shadow-sm"
                extra={
                    summary?.cycle ? (
                        <Button
                            type="link"
                            icon={<Eye size={14} />}
                            onClick={() => onViewCycle(summary.cycle!.id)}
                        >
                            View Details
                        </Button>
                    ) : null
                }
            >
                <Spin spinning={isLoading}>
                    {summary?.cycle ? (
                        <Row gutter={16}>
                            <Col xs={12} md={6}>
                                <Statistic
                                    title="Cycle #"
                                    value={summary.cycle.cycle_number}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <Statistic
                                    title="Days Remaining"
                                    value={summary.days_remaining}
                                    suffix="days"
                                    valueStyle={{
                                        color:
                                            summary.days_remaining <= 7
                                                ? "#cf1322"
                                                : undefined,
                                    }}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <Statistic
                                    title="Enrolled Agents"
                                    value={summary.enrollment_count}
                                    prefix={<Users size={14} />}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        Status
                                    </div>
                                    <CycleStatusBadge
                                        status={summary.cycle.status as any}
                                    />
                                </div>
                            </Col>
                            <Col xs={24} className="mt-2">
                                <div className="text-sm text-gray-500">
                                    {summary.cycle.start_date} →{" "}
                                    {summary.cycle.end_date} (
                                    {summary.cycle.duration_days} days)
                                </div>
                            </Col>
                        </Row>
                    ) : (
                        <Empty description="No active cycle. Configure settings and enable auto-generate, or cycles will be created on next scheduler run." />
                    )}
                </Spin>
            </Card>
        </motion.div>
    );
};

/* ------------------------------------------------------------------ */
/*  Cycle History Table                                                */
/* ------------------------------------------------------------------ */
const CycleHistorySection: React.FC<{
    onViewCycle: (id: number) => void;
}> = ({ onViewCycle }) => {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useMlmCycles({ page, per_page: 10 });
    const cycles = (data as any) ?? {
        data: [],
        total: 0,
        current_page: 1,
        per_page: 10,
    };

    const columns = [
        {
            title: "#",
            dataIndex: "cycle_number",
            key: "cycle_number",
            width: 60,
        },
        {
            title: "Start",
            dataIndex: "start_date",
            key: "start_date",
            render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
        },
        {
            title: "End",
            dataIndex: "end_date",
            key: "end_date",
            render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
        },
        {
            title: "Duration",
            dataIndex: "duration_days",
            key: "duration_days",
            render: (v: number) => `${v} days`,
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (v: string) => <CycleStatusBadge status={v as any} />,
        },
        {
            title: "Enrollments",
            dataIndex: "enrollments_count",
            key: "enrollments_count",
            align: "right" as const,
        },
        {
            title: "",
            key: "actions",
            width: 80,
            render: (_: any, record: any) => (
                <Button
                    size="small"
                    type="link"
                    icon={<Eye size={14} />}
                    onClick={() => onViewCycle(record.id)}
                >
                    View
                </Button>
            ),
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
        >
            <Card
                title={
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        <span className="font-semibold">Cycle History</span>
                    </div>
                }
                className="shadow-sm"
            >
                <Table
                    columns={columns}
                    dataSource={cycles.data ?? []}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    pagination={{
                        current: cycles.current_page ?? 1,
                        total: cycles.total ?? 0,
                        pageSize: cycles.per_page ?? 10,
                        showSizeChanger: false,
                        onChange: (p) => setPage(p),
                    }}
                    locale={{
                        emptyText: <Empty description="No cycles yet" />,
                    }}
                />
            </Card>
        </motion.div>
    );
};

/* ------------------------------------------------------------------ */
/*  Cycle Detail Drawer (inline)                                       */
/* ------------------------------------------------------------------ */
const CycleDetailSection: React.FC<{
    cycleId: number;
    onClose: () => void;
}> = ({ cycleId, onClose }) => {
    const { data, isLoading, refetch } = useMlmCycleDetail(cycleId);
    const detail = (data as any)?.data ?? null;

    const [forceLoading, setForceLoading] = useState(false);

    const handleForceComplete = async (enrollmentId: number) => {
        setForceLoading(true);
        try {
            await axios.post(
                `/account/mlm/api/cycles/${cycleId}/enrollments/${enrollmentId}/force-complete`,
            );
            message.success("Enrollment force-completed");
            refetch();
        } catch {
            message.error("Failed to force-complete enrollment");
        } finally {
            setForceLoading(false);
        }
    };

    const cycle = detail?.cycle;
    const enrollments = detail?.enrollments ?? [];

    const columns = [
        {
            title: "Agent",
            key: "agent",
            render: (_: any, r: any) => (
                <div>
                    <div className="font-medium text-sm">{r.agent_name}</div>
                    <div className="text-xs text-gray-500">{r.agent_email}</div>
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (v: string) => <EnrollmentStatusBadge status={v as any} />,
        },
        {
            title: "Start",
            dataIndex: "effective_start_date",
            key: "start",
            render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
        },
        {
            title: "End",
            dataIndex: "effective_end_date",
            key: "end",
            render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
        },
        {
            title: "NSA",
            key: "nsa",
            align: "right" as const,
            render: (_: any, r: any) => r.metrics?.nsa ?? 0,
        },
        {
            title: "NSD",
            key: "nsd",
            align: "right" as const,
            render: (_: any, r: any) => r.metrics?.nsd ?? 0,
        },
        {
            title: "VSA",
            key: "vsa",
            align: "right" as const,
            render: (_: any, r: any) =>
                `$${(r.metrics?.vsa ?? 0).toLocaleString()}`,
        },
        {
            title: "VSD",
            key: "vsd",
            align: "right" as const,
            render: (_: any, r: any) =>
                `$${(r.metrics?.vsd ?? 0).toLocaleString()}`,
        },
        {
            title: "Level",
            key: "level",
            render: (_: any, r: any) =>
                r.level_achieved ? (
                    <Tag color="gold">{r.level_achieved}</Tag>
                ) : (
                    <Tag>—</Tag>
                ),
        },
        {
            title: "Overflow",
            key: "overflow",
            render: (_: any, r: any) =>
                r.is_overflowing ? (
                    <Tag color="orange">Yes — {r.days_remaining}d left</Tag>
                ) : (
                    <span className="text-gray-400 text-xs">No</span>
                ),
        },
        {
            title: "",
            key: "actions",
            width: 100,
            render: (_: any, r: any) =>
                r.status === "active" || r.status === "extended" ? (
                    <Popconfirm
                        title="Force-complete this enrollment?"
                        description="The agent's cycle will end and they will be re-enrolled in the current cycle."
                        onConfirm={() => handleForceComplete(r.id)}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<XCircle size={12} />}
                            loading={forceLoading}
                        >
                            End
                        </Button>
                    </Popconfirm>
                ) : null,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card
                title={
                    <div className="flex items-center gap-2">
                        <Eye size={18} className="text-purple-500" />
                        <span className="font-semibold">
                            Cycle #{cycle?.cycle_number ?? "..."} Detail
                        </span>
                        {cycle && <CycleStatusBadge status={cycle.status} />}
                    </div>
                }
                className="shadow-sm"
                extra={
                    <Button size="small" onClick={onClose}>
                        Close
                    </Button>
                }
            >
                <Spin spinning={isLoading}>
                    {cycle && (
                        <Row gutter={16} className="mb-4">
                            <Col xs={8} md={4}>
                                <Statistic
                                    title="Duration"
                                    value={cycle.duration_days}
                                    suffix="days"
                                />
                            </Col>
                            <Col xs={8} md={4}>
                                <Statistic
                                    title="Enrollments"
                                    value={cycle.enrollments_count}
                                />
                            </Col>
                            <Col xs={8} md={4}>
                                <div className="text-sm text-gray-500">
                                    {new Date(
                                        cycle.start_date,
                                    ).toLocaleDateString()}{" "}
                                    →{" "}
                                    {new Date(
                                        cycle.end_date,
                                    ).toLocaleDateString()}
                                </div>
                            </Col>
                        </Row>
                    )}

                    <Divider className="my-3" />

                    <Table
                        columns={columns}
                        dataSource={enrollments}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        scroll={{ x: 900 }}
                        locale={{
                            emptyText: (
                                <Empty description="No enrollments in this cycle" />
                            ),
                        }}
                    />
                </Spin>
            </Card>
        </motion.div>
    );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
const CycleManagement: React.FC<Props> = () => {
    const [viewingCycleId, setViewingCycleId] = useState<number | null>(null);

    return (
        <DashboardLayout>
            <PageLayout
                title="Cycle Management"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/dashboard" },
                    { name: "Cycle Management" },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <CycleConfigSection />
                    <ActiveCycleSummarySection
                        onViewCycle={(id) => setViewingCycleId(id)}
                    />
                    <CycleHistorySection
                        onViewCycle={(id) => setViewingCycleId(id)}
                    />
                    {viewingCycleId && (
                        <CycleDetailSection
                            cycleId={viewingCycleId}
                            onClose={() => setViewingCycleId(null)}
                        />
                    )}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default CycleManagement;
