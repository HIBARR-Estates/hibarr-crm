import React, { useState, useMemo } from "react";
import {
    Card,
    Form,
    InputNumber,
    DatePicker,
    Button,
    Table,
    Tag,
    Empty,
    Spin,
    Popconfirm,
    Modal,
} from "antd";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, CalendarDays, XCircle } from "lucide-react";
import dayjs from "dayjs";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    useMlmCycles,
    useMlmCycleDetail,
    useCreateCycle,
    useUpdateCycle,
    useDeleteCycle,
    useForceCompleteEnrollment,
    useMlmSettings,
} from "@/Features/Mlm/api";
import {
    CycleStatusBadge,
    EnrollmentStatusBadge,
} from "@/Features/Mlm/Components";
import type {
    MlmCycle,
    MlmCycleFormData,
    CycleStatus,
} from "@/Features/Mlm/types";

interface Props extends PageProps {}

/* ------------------------------------------------------------------ */
/*  Create / Edit Modal                                                */
/* ------------------------------------------------------------------ */
const CycleFormModal: React.FC<{
    open: boolean;
    editingCycle: MlmCycle | null;
    defaultOverflow: number;
    onClose: () => void;
    onSaved: () => void;
}> = ({ open, editingCycle, defaultOverflow, onClose, onSaved }) => {
    const [form] = Form.useForm();

    const isEdit = !!editingCycle;
    const title = isEdit
        ? `Edit Cycle #${editingCycle!.cycle_number}`
        : "Create New Cycle";

    const handleSuccess = () => {
        onSaved();
        onClose();
    };

    const createCycle = useCreateCycle(handleSuccess);
    const updateCycle = useUpdateCycle(editingCycle?.id ?? 0, handleSuccess);
    const isSaving = createCycle.isPending || updateCycle.isPending;

    React.useEffect(() => {
        if (open) {
            if (editingCycle) {
                form.setFieldsValue({
                    start_date: dayjs(editingCycle.start_date),
                    end_date: dayjs(editingCycle.end_date),
                    max_overflow_multiplier:
                        editingCycle.max_overflow_multiplier,
                });
            } else {
                form.resetFields();
                form.setFieldsValue({
                    max_overflow_multiplier: defaultOverflow,
                });
            }
        }
    }, [open, editingCycle, form, defaultOverflow]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload: MlmCycleFormData = {
                start_date: values.start_date.format("YYYY-MM-DD"),
                end_date: values.end_date.format("YYYY-MM-DD"),
                max_overflow_multiplier: values.max_overflow_multiplier,
            };

            if (isEdit) {
                updateCycle.mutate(payload);
            } else {
                createCycle.mutate(payload);
            }
        } catch {
            // form validation failed
        }
    };

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={isSaving}
            okText={isEdit ? "Save Changes" : "Create Cycle"}
            destroyOnClose
        >
            <Form form={form} layout="vertical" className="mt-4">
                <Form.Item
                    label="Start Date"
                    name="start_date"
                    rules={[{ required: true, message: "Required" }]}
                >
                    <DatePicker className="w-full" />
                </Form.Item>

                <Form.Item
                    label="End Date"
                    name="end_date"
                    rules={[{ required: true, message: "Required" }]}
                >
                    <DatePicker className="w-full" />
                </Form.Item>
                {/* 
                <Form.Item
                    label="Overflow Multiplier"
                    name="max_overflow_multiplier"
                    tooltip="When an agent doesn't meet criteria within this cycle, they can continue for (duration × multiplier) extra days. 0 disables overflow."
                    rules={[{ required: true, message: "Required" }]}
                >
                    <InputNumber
                        min={0}
                        max={5}
                        step={0.1}
                        className="w-full"
                    />
                </Form.Item> */}
            </Form>
        </Modal>
    );
};

/* ------------------------------------------------------------------ */
/*  Force-Complete Button (own hook per row)                            */
/* ------------------------------------------------------------------ */
const ForceCompleteButton: React.FC<{
    cycleId: number;
    enrollmentId: number;
    onCompleted: () => void;
}> = ({ cycleId, enrollmentId, onCompleted }) => {
    const mutation = useForceCompleteEnrollment(
        cycleId,
        enrollmentId,
        onCompleted,
    );

    return (
        <Popconfirm
            title="Force-complete this enrollment?"
            description="The agent's cycle will end and they will be re-enrolled in the current cycle."
            onConfirm={() => mutation.mutate({})}
        >
            <Button
                size="small"
                danger
                icon={<XCircle size={12} />}
                loading={mutation.isPending}
            >
                End
            </Button>
        </Popconfirm>
    );
};

/* ------------------------------------------------------------------ */
/*  Delete Cycle Button (own hook per row)                             */
/* ------------------------------------------------------------------ */
const DeleteCycleButton: React.FC<{
    cycleId: number;
    onDeleted: () => void;
}> = ({ cycleId, onDeleted }) => {
    const mutation = useDeleteCycle(cycleId, onDeleted);

    return (
        <Popconfirm
            title="Delete this cycle?"
            onConfirm={() => mutation.mutate({})}
        >
            <Button
                size="small"
                type="text"
                danger
                icon={<Trash2 size={14} />}
                loading={mutation.isPending}
            />
        </Popconfirm>
    );
};

/* ------------------------------------------------------------------ */
/*  Expandable Enrollment Row                                          */
/* ------------------------------------------------------------------ */
const EnrollmentSubTable: React.FC<{ cycleId: number }> = ({ cycleId }) => {
    const { data, isLoading, refetch } = useMlmCycleDetail(cycleId);
    const enrollments = (data as any)?.data?.enrollments ?? [];

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
                    <ForceCompleteButton
                        cycleId={cycleId}
                        enrollmentId={r.id}
                        onCompleted={() => refetch()}
                    />
                ) : null,
        },
    ];

    return (
        <div className="p-2 bg-gray-50 rounded">
            <Table
                columns={columns}
                dataSource={enrollments}
                rowKey="id"
                size="small"
                loading={isLoading}
                pagination={false}
                scroll={{ x: 900 }}
                locale={{
                    emptyText: (
                        <Empty description="No enrollments in this cycle" />
                    ),
                }}
            />
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
const CycleManagement: React.FC<Props> = () => {
    const [page, setPage] = useState(1);
    const { data, isLoading, refetch } = useMlmCycles({
        page,
        per_page: 15,
    });
    const cycles = (data as any) ?? {
        data: [],
        total: 0,
        current_page: 1,
        per_page: 15,
    };

    const { data: settingsData } = useMlmSettings();
    const defaultOverflow: number =
        (settingsData as any)?.data?.default_overflow_multiplier ?? 1.0;

    const [modalOpen, setModalOpen] = useState(false);
    const [editingCycle, setEditingCycle] = useState<MlmCycle | null>(null);

    const openCreate = () => {
        setEditingCycle(null);
        setModalOpen(true);
    };

    const openEdit = (cycle: MlmCycle) => {
        setEditingCycle(cycle);
        setModalOpen(true);
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
            title: "Days Left",
            dataIndex: "days_remaining",
            key: "days_remaining",
            render: (v: number, record: MlmCycle) =>
                record.status === "active" ? (
                    <Tag color={v <= 7 ? "red" : v <= 14 ? "orange" : "blue"}>
                        {v}d
                    </Tag>
                ) : (
                    <span className="text-gray-400">—</span>
                ),
        },
        // {
        //     title: "Overflow ×",
        //     dataIndex: "max_overflow_multiplier",
        //     key: "overflow",
        //     render: (v: number) => `${Number(v).toFixed(1)}×`,
        // },
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
            width: 120,
            render: (_: any, record: MlmCycle) => {
                const isUpcoming = record.status === "upcoming";
                const hasEnrollments = (record.enrollments_count ?? 0) > 0;

                return (
                    <div className="flex gap-1">
                        {isUpcoming && (
                            <Button
                                size="small"
                                type="text"
                                icon={<Pencil size={14} />}
                                onClick={() => openEdit(record)}
                            />
                        )}
                        {isUpcoming && !hasEnrollments && (
                            <DeleteCycleButton
                                cycleId={record.id}
                                onDeleted={() => refetch()}
                            />
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title="Cycle Management"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/dashboard" },
                    { name: "Cycle Management" },
                ]}
            >
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card
                            title={
                                <div className="flex items-center gap-2">
                                    <CalendarDays
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="font-semibold">
                                        Cycles
                                    </span>
                                </div>
                            }
                            className="shadow-sm"
                            extra={
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={openCreate}
                                >
                                    New Cycle
                                </Button>
                            }
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
                                    pageSize: cycles.per_page ?? 15,
                                    showSizeChanger: false,
                                    onChange: (p) => setPage(p),
                                }}
                                expandable={{
                                    expandedRowRender: (record: MlmCycle) => (
                                        <EnrollmentSubTable
                                            cycleId={record.id}
                                        />
                                    ),
                                    rowExpandable: (record: MlmCycle) =>
                                        (record.enrollments_count ?? 0) > 0,
                                }}
                                locale={{
                                    emptyText: (
                                        <Empty description="No cycles yet. Click 'New Cycle' to create one." />
                                    ),
                                }}
                            />
                        </Card>
                    </motion.div>

                    <CycleFormModal
                        open={modalOpen}
                        editingCycle={editingCycle}
                        defaultOverflow={defaultOverflow}
                        onClose={() => setModalOpen(false)}
                        onSaved={() => refetch()}
                    />
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default CycleManagement;
