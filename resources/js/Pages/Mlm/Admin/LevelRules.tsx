import React, { useState } from "react";
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Select,
    InputNumber,
    Space,
    Popconfirm,
    message,
    Tag,
    Empty,
    Descriptions,
    Spin,
} from "antd";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    useMlmLevelCriteria,
    useMlmLevel,
    useCreateLevelCriterion,
    useUpdateLevelCriterion,
    useDeleteLevelCriterion,
} from "@/Features/Mlm/api";
import { LevelBadge } from "@/Features/Mlm/Components";
import type {
    MlmLevel,
    MlmLevelCriterion,
    MlmLevelCriterionFormData,
    MlmMetric,
    CriteriaOperator,
} from "@/Features/Mlm/types";
import { MLM_METRIC_LABELS } from "@/Features/Mlm/types";

interface Props extends PageProps {
    level: MlmLevel;
    criteria: MlmLevelCriterion[];
}

const OPERATOR_OPTIONS: { value: CriteriaOperator; label: string }[] = [
    { value: ">=", label: ">= (greater or equal)" },
    { value: "<=", label: "<= (less or equal)" },
    { value: "=", label: "= (equal)" },
    { value: ">", label: "> (greater than)" },
    { value: "<", label: "< (less than)" },
];

const METRIC_OPTIONS = Object.entries(MLM_METRIC_LABELS).map(
    ([value, label]) => ({
        value: value as MlmMetric,
        label,
    }),
);

const MlmLevelRules: React.FC<Props> = ({
    level: initialLevel,
    criteria: initialCriteria,
}) => {
    const { data: levelData } = useMlmLevel(initialLevel?.id ?? 0);
    const { data: criteriaData, refetch } = useMlmLevelCriteria(
        initialLevel?.id ?? 0,
    );

    const level: MlmLevel = (levelData as any)?.data?.data ?? initialLevel;
    const criteria: MlmLevelCriterion[] =
        (criteriaData as any)?.data?.data ?? initialCriteria ?? [];

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MlmLevelCriterion | null>(null);
    const [form] = Form.useForm<MlmLevelCriterionFormData>();

    const createCriterion = useCreateLevelCriterion(() => {
        message.success("Criterion added");
        refetch();
        closeModal();
    });

    const updateCriterion = useUpdateLevelCriterion(editing?.id ?? 0, () => {
        message.success("Criterion updated");
        refetch();
        closeModal();
    });

    const deleteCriterion = useDeleteLevelCriterion(0, () => {
        message.success("Criterion removed");
        refetch();
    });

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            mlm_level_id: level.id,
            logic_group: 1,
            operator: ">=",
        });
        setModalOpen(true);
    };

    const openEdit = (c: MlmLevelCriterion) => {
        setEditing(c);
        form.setFieldsValue({
            mlm_level_id: c.mlm_level_id,
            logic_group: c.logic_group,
            metric: c.metric,
            operator: c.operator,
            threshold: c.threshold,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        form.resetFields();
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            values.mlm_level_id = level.id;
            if (editing) {
                updateCriterion.mutate(values);
            } else {
                createCriterion.mutate(values);
            }
        } catch {
            // validation error
        }
    };

    // Group criteria by logic_group
    const grouped = criteria.reduce(
        (acc, c) => {
            if (!acc[c.logic_group]) acc[c.logic_group] = [];
            acc[c.logic_group].push(c);
            return acc;
        },
        {} as Record<number, MlmLevelCriterion[]>,
    );

    const columns = [
        {
            title: "Metric",
            dataIndex: "metric",
            key: "metric",
            render: (m: MlmMetric) => (
                <Tag color="blue">{MLM_METRIC_LABELS[m] ?? m}</Tag>
            ),
        },
        {
            title: "Operator",
            dataIndex: "operator",
            key: "operator",
            width: 100,
            render: (op: string) => (
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {op}
                </code>
            ),
        },
        {
            title: "Threshold",
            dataIndex: "threshold",
            key: "threshold",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold">{val.toLocaleString()}</span>
            ),
        },
        {
            title: "Group",
            dataIndex: "logic_group",
            key: "logic_group",
            width: 80,
            render: (g: number) => <Tag>Group {g}</Tag>,
        },
        {
            title: "Actions",
            key: "actions",
            width: 120,
            render: (_: any, record: MlmLevelCriterion) => (
                <Space size="small">
                    <Button
                        type="text"
                        icon={<Pencil size={14} />}
                        size="small"
                        onClick={() => openEdit(record)}
                    />
                    <Popconfirm
                        title="Remove this criterion?"
                        onConfirm={() => deleteCriterion.mutate({} as any)}
                        okText="Remove"
                        okType="danger"
                    >
                        <Button
                            type="text"
                            danger
                            icon={<Trash2 size={14} />}
                            size="small"
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={`Level Rules: ${level?.name ?? ""}`}
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm" },
                    { name: "Levels", url: "/account/mlm/levels" },
                    { name: level?.name ?? "Rules" },
                ]}
            >
                {/* Level Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                >
                    <Card className="shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    icon={<ArrowLeft size={14} />}
                                    onClick={() =>
                                        router.visit("/account/mlm/levels")
                                    }
                                >
                                    Back
                                </Button>
                                {level && (
                                    <LevelBadge level={level} showPercentage />
                                )}
                            </div>
                            <Descriptions size="small" column={3}>
                                <Descriptions.Item label="Rank">
                                    #{level?.rank}
                                </Descriptions.Item>
                                <Descriptions.Item label="Commission">
                                    {level?.commission_percentage}%
                                </Descriptions.Item>
                                <Descriptions.Item label="Criteria">
                                    {criteria.length} rule
                                    {criteria.length !== 1 ? "s" : ""}
                                </Descriptions.Item>
                            </Descriptions>
                        </div>
                    </Card>
                </motion.div>

                {/* Criteria Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                >
                    <Card
                        title={
                            <span className="font-semibold">
                                Promotion Criteria
                            </span>
                        }
                        extra={
                            <Button
                                type="primary"
                                icon={<Plus size={14} />}
                                onClick={openCreate}
                            >
                                Add Criterion
                            </Button>
                        }
                        className="shadow-sm"
                    >
                        <div className="mb-3 text-sm text-gray-500">
                            All criteria within the same{" "}
                            <strong>logic group</strong> must be met (AND).
                            Different groups are evaluated as alternatives (OR).
                        </div>
                        <Table
                            columns={columns}
                            dataSource={criteria}
                            rowKey="id"
                            pagination={false}
                            size="middle"
                            locale={{
                                emptyText: (
                                    <Empty description="No criteria defined. Agents cannot be auto-promoted to this level until criteria are set." />
                                ),
                            }}
                        />
                    </Card>
                </motion.div>

                {/* Create / Edit Modal */}
                <Modal
                    title={editing ? "Edit Criterion" : "Add Criterion"}
                    open={modalOpen}
                    onOk={handleSubmit}
                    onCancel={closeModal}
                    confirmLoading={
                        createCriterion.isPending || updateCriterion.isPending
                    }
                    okText={editing ? "Save" : "Add"}
                    destroyOnClose
                >
                    <Form form={form} layout="vertical" className="mt-4">
                        <Form.Item
                            label="Metric"
                            name="metric"
                            rules={[
                                {
                                    required: true,
                                    message: "Select a metric",
                                },
                            ]}
                        >
                            <Select
                                options={METRIC_OPTIONS}
                                placeholder="Select metric..."
                            />
                        </Form.Item>

                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                label="Operator"
                                name="operator"
                                rules={[
                                    {
                                        required: true,
                                        message: "Select operator",
                                    },
                                ]}
                            >
                                <Select
                                    options={OPERATOR_OPTIONS}
                                    placeholder="Operator"
                                />
                            </Form.Item>

                            <Form.Item
                                label="Threshold"
                                name="threshold"
                                rules={[
                                    {
                                        required: true,
                                        message: "Enter threshold",
                                    },
                                ]}
                            >
                                <InputNumber
                                    min={0}
                                    className="w-full"
                                    placeholder="e.g. 10"
                                />
                            </Form.Item>
                        </div>

                        <Form.Item
                            label="Logic Group"
                            name="logic_group"
                            tooltip="Criteria in the same group are AND'd. Different groups are OR'd."
                            rules={[
                                {
                                    required: true,
                                    message: "Enter group number",
                                },
                            ]}
                        >
                            <InputNumber
                                min={1}
                                className="w-full"
                                placeholder="1"
                            />
                        </Form.Item>

                        <Form.Item name="mlm_level_id" hidden>
                            <InputNumber />
                        </Form.Item>
                    </Form>
                </Modal>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmLevelRules;
