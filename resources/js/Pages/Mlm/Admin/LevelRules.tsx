import React, { useState } from "react";
import {
    Card,
    Button,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    Space,
    message,
    Tag,
    Empty,
    Descriptions,
    Divider,
    Alert,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import { router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
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
import { useTd } from "@/Hooks/useDynamicTranslation";

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

/** Render a single criterion as a readable sentence */
const CriterionSentence: React.FC<{ criterion: MlmLevelCriterion }> = ({
    criterion,
}) => (
    <span>
        <Tag color="blue">
            {MLM_METRIC_LABELS[criterion.metric] ?? criterion.metric}
        </Tag>
        <code className="bg-gray-100 px-2 py-0.5 rounded text-sm mx-1">
            {criterion.operator}
        </code>
        <span className="font-semibold">
            {criterion.threshold.toLocaleString()}
        </span>
        {criterion.description && (
            <span className="text-gray-500 text-xs ml-2 italic">
                — {criterion.description}
            </span>
        )}
    </span>
);

const MlmLevelRules: React.FC<Props> = ({
    level: initialLevel,
    criteria: initialCriteria,
}) => {
    const { td } = useTd();
    const { t } = useTranslation();
    const { data: levelData } = useMlmLevel(initialLevel?.id ?? 0);
    const { data: criteriaData, refetch } = useMlmLevelCriteria(
        initialLevel?.id ?? 0,
    );

    const level: MlmLevel = (levelData as any)?.data?.data ?? initialLevel;
    const criteria: MlmLevelCriterion[] =
        (criteriaData as any)?.data?.data ?? initialCriteria ?? [];

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MlmLevelCriterion | null>(null);
    const [deletingCriterion, setDeletingCriterion] =
        useState<MlmLevelCriterion | null>(null);
    const [form] = Form.useForm<MlmLevelCriterionFormData>();

    const createCriterion = useCreateLevelCriterion(() => {
        message.success(td("Criterion added", { source: "en" }));
        refetch();
        closeModal();
        router.reload();
    });

    const updateCriterion = useUpdateLevelCriterion(editing?.id ?? 0, () => {
        message.success(td("Criterion updated", { source: "en" }));
        refetch();
        closeModal();
        router.reload();
    });

    const deleteCriterion = useDeleteLevelCriterion(
        deletingCriterion?.id ?? 0,
        () => {
            message.success(td("Criterion removed", { source: "en" }));
            setDeletingCriterion(null);
            refetch();
            router.reload();
        },
    );

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        // Default logic_group to the next group number (or 1 if none exist)
        const existingGroups = criteria.map((c) => c.logic_group);
        const nextGroup =
            existingGroups.length > 0 ? Math.max(...existingGroups) : 1;
        form.setFieldsValue({
            mlm_level_id: level.id,
            logic_group: nextGroup,
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
            description: c.description,
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

    const handleDeleteConfirm = () => {
        if (!deletingCriterion) return;
        deleteCriterion.mutate({} as any);
    };

    // Group criteria by logic_group for visual separation
    const groupedEntries = Object.entries(
        criteria.reduce(
            (acc, c) => {
                if (!acc[c.logic_group]) acc[c.logic_group] = [];
                acc[c.logic_group].push(c);
                return acc;
            },
            {} as Record<number, MlmLevelCriterion[]>,
        ),
    ).sort(([a], [b]) => Number(a) - Number(b));

    const columns = [
        {
            title: td("Metric", { source: "en" }),
            dataIndex: "metric",
            key: "metric",
            render: (m: MlmMetric) => (
                <Tag color="blue">{MLM_METRIC_LABELS[m] ?? m}</Tag>
            ),
        },
        {
            title: td("Operator", { source: "en" }),
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
            title: td("Threshold", { source: "en" }),
            dataIndex: "threshold",
            key: "threshold",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold">{val.toLocaleString()}</span>
            ),
        },
        {
            title: td("Description", { source: "en" }),
            dataIndex: "description",
            key: "description",
            render: (val: string | null) =>
                val ? (
                    <span className="text-gray-500 text-sm">{val}</span>
                ) : (
                    <span className="text-gray-300">—</span>
                ),
        },
        {
            title: td("Actions", { source: "en" }),
            key: "actions",
            width: 100,
            render: (_: any, record: MlmLevelCriterion) => (
                <Space size="small">
                    <Button
                        type="text"
                        icon={<Pencil size={14} />}
                        size="small"
                        onClick={() => openEdit(record)}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<Trash2 size={14} />}
                        size="small"
                        onClick={() => setDeletingCriterion(record)}
                    />
                </Space>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={`${t("app.mlm.admin.level_rules")}: ${level?.name ?? ""}`}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    {
                        name: t("app.mlm.admin.levels_short"),
                        url: "/account/mlm/levels",
                    },
                    { name: level?.name ?? "Rules" },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
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
                                        {td("Back", { source: "en" })}
                                    </Button>
                                    {level && (
                                        <LevelBadge
                                            level={level}
                                            showPercentage
                                        />
                                    )}
                                </div>
                                <Descriptions size="small" column={3}>
                                    <Descriptions.Item label={td("Rank", { source: "en" })}>
                                        #{level?.rank}
                                    </Descriptions.Item>
                                    <Descriptions.Item label={td("Commission", { source: "en" })}>
                                        {level?.commission_percentage}%
                                    </Descriptions.Item>
                                    <Descriptions.Item label={td("Criteria", { source: "en" })}>
                                        {criteria.length} rule
                                        {criteria.length !== 1 ? "s" : ""}
                                    </Descriptions.Item>
                                </Descriptions>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Criteria – Grouped by Logic Group */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <Card
                            title={
                                <span className="font-semibold">
                                    {td("Promotion Criteria", { source: "en" })}
                                </span>
                            }
                            extra={
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={openCreate}
                                >
                                    {td("Add Criterion", { source: "en" })}
                                </Button>
                            }
                            className="shadow-sm"
                        >
                            {/* Explanation */}
                            <div className="mb-4">
                                <Alert
                                    type="info"
                                    showIcon
                                    message={td("How criteria work", { source: "en" })}
                                    description={
                                        <>
                                            Rules within the same{" "}
                                            <strong>group</strong> must{" "}
                                            <em>all</em> be met (
                                            <Tag
                                                color="green"
                                                className="mx-0.5"
                                            >
                                                {td("AND", { source: "en" })}
                                            </Tag>
                                            ). If multiple groups exist,
                                            satisfying <em>{td("any one", { source: "en" })}</em> group is
                                            enough (
                                            <Tag
                                                color="orange"
                                                className="mx-0.5"
                                            >
                                                {td("OR", { source: "en" })}
                                            </Tag>
                                            ).
                                        </>
                                    }
                                />
                            </div>

                            {criteria.length === 0 ? (
                                <Empty description={td("No criteria defined. Agents cannot be auto-promoted to this level until criteria are set.", { source: "en" })} />
                            ) : (
                                <div className="flex flex-col gap-y-4">
                                    {groupedEntries.map(
                                        ([groupNum, items], idx) => (
                                            <React.Fragment key={groupNum}>
                                                {/* OR divider between groups */}
                                                {idx > 0 && (
                                                    <Divider className="my-2">
                                                        <Tag
                                                            color="orange"
                                                            className="text-sm font-semibold"
                                                        >
                                                            {td("OR", { source: "en" })}
                                                        </Tag>
                                                    </Divider>
                                                )}

                                                {/* Group card */}
                                                <Card
                                                    size="small"
                                                    className="border-l-4 border-l-blue-400"
                                                    title={
                                                        <span className="text-sm text-gray-600">
                                                            Group {groupNum}
                                                            <span className="ml-2 text-xs text-gray-400">
                                                                {td("— all of these must be true", { source: "en" })}
                                                            </span>
                                                        </span>
                                                    }
                                                >
                                                    <DataTable
                                                        columns={columns}
                                                        dataSource={items}
                                                        rowKey="id"
                                                        size="small"
                                                        showHeader={idx === 0}
                                                        scroll={{ x: "max-content" }}
                                                    />
                                                </Card>
                                            </React.Fragment>
                                        ),
                                    )}
                                </div>
                            )}

                            {/* Human-readable summary */}
                            {groupedEntries.length > 0 && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                                    <strong>{td("Summary:", { source: "en" })}</strong> An agent qualifies
                                    for <em>{td(level?.name, { source: "en" })}</em> if{" "}
                                    {groupedEntries.map(
                                        ([groupNum, items], gIdx) => (
                                            <React.Fragment key={groupNum}>
                                                {gIdx > 0 && (
                                                    <Tag
                                                        color="orange"
                                                        className="mx-1"
                                                    >
                                                        {td("OR", { source: "en" })}
                                                    </Tag>
                                                )}
                                                <span>
                                                    (
                                                    {items.map((c, cIdx) => (
                                                        <React.Fragment
                                                            key={c.id}
                                                        >
                                                            {cIdx > 0 && (
                                                                <Tag
                                                                    color="green"
                                                                    className="mx-1"
                                                                >
                                                                    {td("AND", { source: "en" })}
                                                                </Tag>
                                                            )}
                                                            <CriterionSentence
                                                                criterion={c}
                                                            />
                                                        </React.Fragment>
                                                    ))}
                                                    )
                                                </span>
                                            </React.Fragment>
                                        ),
                                    )}
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Create / Edit Modal */}
                    <Modal
                        title={editing ? "Edit Criterion" : "Add Criterion"}
                        open={modalOpen}
                        onOk={handleSubmit}
                        onCancel={closeModal}
                        confirmLoading={
                            createCriterion.isPending ||
                            updateCriterion.isPending
                        }
                        okText={editing ? "Save" : "Add"}
                        destroyOnClose
                    >
                        <Form form={form} layout="vertical" className="mt-4">
                            <Form.Item
                                label={td("Metric", { source: "en" })}
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
                                    placeholder={td("Select metric...", { source: "en" })}
                                />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item
                                    label={td("Operator", { source: "en" })}
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
                                        placeholder={td("Operator", { source: "en" })}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label={td("Threshold", { source: "en" })}
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
                                        style={{ width: "100%" }}
                                    />
                                </Form.Item>
                            </div>

                            <Form.Item
                                label={td("Logic Group", { source: "en" })}
                                name="logic_group"
                                tooltip={td("Criteria in the same group are AND'd. Different groups are OR'd.", { source: "en" })}
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

                            <Form.Item
                                label={td("Description", { source: "en" })}
                                name="description"
                                tooltip={td("Optional note explaining what this criterion represents.", { source: "en" })}
                            >
                                <Input.TextArea
                                    rows={2}
                                    maxLength={500}
                                    showCount
                                    placeholder={td("e.g. Must have at least 10 direct sales to qualify", { source: "en" })}
                                />
                            </Form.Item>

                            <Form.Item name="mlm_level_id" hidden>
                                <InputNumber />
                            </Form.Item>
                        </Form>
                    </Modal>

                    {/* Delete Confirmation Modal */}
                    <Modal
                        title={
                            <div className="flex items-center gap-2 text-red-600">
                                <AlertTriangle size={18} />
                                {td("Remove Criterion", { source: "en" })}
                            </div>
                        }
                        open={!!deletingCriterion}
                        onOk={handleDeleteConfirm}
                        onCancel={() => setDeletingCriterion(null)}
                        confirmLoading={deleteCriterion.isPending}
                        okText={td("Remove", { source: "en" })}
                        okType="danger"
                        destroyOnClose
                    >
                        {deletingCriterion && (
                            <div className="py-2">
                                <p className="mb-2">
                                    {td("Are you sure you want to remove this criterion?", { source: "en" })}
                                </p>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <CriterionSentence
                                        criterion={deletingCriterion}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {td("This may affect how agents qualify for the", { source: "en" })}{" "}
                                    <strong>{td(level?.name, { source: "en" })}</strong> level.
                                </p>
                            </div>
                        )}
                    </Modal>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmLevelRules;
