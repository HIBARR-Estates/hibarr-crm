import React, { useState } from "react";
import {
    Alert,
    Card,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Space,
    message,
    Tag,
    Empty,
    Switch,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import { motion } from "framer-motion";
import {
    Plus,
    Pencil,
    Trash2,
    GripVertical,
    Settings,
    LucideAlignVerticalSpaceAround,
} from "lucide-react";
import { router, usePage } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useMlmLevels,
    useCreateMlmLevel,
    useUpdateMlmLevel,
    useReorderMlmLevels,
} from "@/Features/Mlm/api";
import { LevelBadge, DeleteLevel } from "@/Features/Mlm/Components";
import type { MlmLevel, MlmLevelFormData } from "@/Features/Mlm/types";

interface Props extends PageProps {
    levels: MlmLevel[];
}

const MlmLevels: React.FC<Props> = ({ levels: initialLevels }) => {
    const { t } = useTranslation();
    const { props } = usePage<PageProps>();
    const commissionOverrideEnabled =
        props.featureFlags?.["sales.per-agent-commission-override"] === true;
    const { data, isLoading, refetch } = useMlmLevels();
    const levels: MlmLevel[] =
        (data as any)?.data?.data ?? (data as any)?.data ?? initialLevels ?? [];
    const hasActiveCycle: boolean =
        (data as any)?.data?.has_active_cycle ?? false;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MlmLevel | null>(null);
    const [deleting, setDeleting] = useState<MlmLevel | null>(null);
    const [form] = Form.useForm<MlmLevelFormData>();

    // Dynamic mutation hooks
    const createLevel = useCreateMlmLevel(() => {
        message.success("Level created");
        refetch();
        closeModal();
    });

    const updateLevel = useUpdateMlmLevel(editing?.id ?? 0, () => {
        message.success("Level updated");
        refetch();
        closeModal();
    });

    const reorderLevels = useReorderMlmLevels(() => {
        message.success("Levels reordered");
        refetch();
    });

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            rank: levels.length + 1,
            commission_percentage: 0,
        });
        setModalOpen(true);
    };

    const openEdit = (level: MlmLevel) => {
        setEditing(level);
        form.setFieldsValue({
            name: level.name,
            rank: level.rank,
            commission_percentage: level.commission_percentage,
            direct_rate: level.direct_rate ?? level.commission_percentage,
            override_rate: level.override_rate ?? level.commission_percentage,
            is_hidden: level.is_hidden ?? false,
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
            if (editing) {
                updateLevel.mutate(values);
            } else {
                createLevel.mutate(values);
            }
        } catch {
            // validation failed
        }
    };

    const columns = [
        {
            title: "",
            width: 40,
            render: () => (
                <LucideAlignVerticalSpaceAround
                    size={14}
                    className="text-gray-400"
                />
            ),
        },
        {
            title: "Rank",
            dataIndex: "rank",
            key: "rank",
            width: 80,
            render: (rank: number) => <Tag className="font-mono">#{rank}</Tag>,
        },
        {
            title: "Level",
            key: "name",
            render: (_: any, record: MlmLevel) => (
                <LevelBadge level={record} showPercentage />
            ),
        },
        {
            title: "Commission %",
            dataIndex: "commission_percentage",
            key: "commission_percentage",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold text-green-600">{val}%</span>
            ),
        },
        ...(commissionOverrideEnabled
            ? [
                  {
                      title: "Direct %",
                      dataIndex: "direct_rate",
                      key: "direct_rate",
                      align: "right" as const,
                      render: (val: number, record: MlmLevel) => (
                          <span className="text-blue-600">
                              {val ?? record.commission_percentage}%
                          </span>
                      ),
                  },
                  {
                      title: "Override %",
                      dataIndex: "override_rate",
                      key: "override_rate",
                      align: "right" as const,
                      render: (val: number, record: MlmLevel) => (
                          <span className="text-purple-600">
                              {val ?? record.commission_percentage}%
                          </span>
                      ),
                  },
                  {
                      title: "Hidden",
                      dataIndex: "is_hidden",
                      key: "is_hidden",
                      width: 80,
                      render: (val: boolean) =>
                          val ? (
                              <Tag color="default">Hidden</Tag>
                          ) : (
                              <Tag color="green">Visible</Tag>
                          ),
                  },
              ]
            : []),
        {
            title: "Criteria",
            key: "criteria",
            render: (_: any, record: MlmLevel) => (
                <Tag color="blue">
                    {record.criteria?.length ?? 0} rule
                    {(record.criteria?.length ?? 0) !== 1 ? "s" : ""}
                </Tag>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_: any, record: MlmLevel) => (
                <Space size="small">
                    <Button
                        type="text"
                        icon={<Settings size={14} />}
                        size="small"
                        onClick={() =>
                            router.visit(
                                `/account/mlm/levels/${record.id}/rules`,
                            )
                        }
                    >
                        Rules
                    </Button>
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
                        onClick={() => setDeleting(record)}
                    />
                </Space>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.admin.levels")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.levels_short") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {hasActiveCycle && (
                        <Alert
                            type="info"
                            showIcon
                            message="Active cycle in progress"
                            description="Changes to levels and criteria will take effect in the next cycle. The current active cycle uses a snapshot of the rules as they were when it started. An admin can re-snapshot from the Cycle Management page if needed."
                            className="mb-0"
                        />
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card
                            title={
                                <span className="font-semibold">
                                    Commission Levels
                                </span>
                            }
                            extra={
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={openCreate}
                                >
                                    Add Level
                                </Button>
                            }
                            className="shadow-sm"
                        >
                            <DataTable
                                columns={columns}
                                dataSource={levels}
                                rowKey="id"
                                loading={isLoading}
                                size="middle"
                                emptyState={{ description: "No levels defined yet. Create one to get started." }}
                                scroll={{ y: "calc(100vh - 360px)" }}
                            />
                        </Card>
                    </motion.div>

                    <DeleteLevel
                        level={deleting}
                        open={!!deleting}
                        onClose={() => setDeleting(null)}
                        handleSuccessCallback={() => {
                            message.success("Level deleted");
                            refetch();
                        }}
                    />

                    {/* Create / Edit Modal */}
                    <Modal
                        title={editing ? "Edit Level" : "Create Level"}
                        open={modalOpen}
                        onOk={handleSubmit}
                        onCancel={closeModal}
                        confirmLoading={
                            createLevel.isPending || updateLevel.isPending
                        }
                        okText={editing ? "Save Changes" : "Create"}
                        destroyOnClose
                    >
                        <Form form={form} layout="vertical" className="mt-4">
                            <Form.Item
                                label="Level Name"
                                name="name"
                                rules={[
                                    {
                                        required: true,
                                        message: "Enter a level name",
                                    },
                                ]}
                            >
                                <Input placeholder="e.g. Bronze, Silver, Gold" />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item
                                    label="Rank"
                                    name="rank"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Enter rank",
                                        },
                                    ]}
                                    tooltip="Lower rank = lower tier. Agents progress upward."
                                >
                                    <InputNumber
                                        min={1}
                                        className="w-full"
                                        placeholder="1"
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Commission %"
                                    name="commission_percentage"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Enter commission %",
                                        },
                                    ]}
                                >
                                    <InputNumber
                                        min={0}
                                        max={100}
                                        className="w-full"
                                        addonAfter="%"
                                        placeholder="5"
                                    />
                                </Form.Item>
                            </div>

                            {commissionOverrideEnabled && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Form.Item
                                            label="Direct Rate %"
                                            name="direct_rate"
                                            tooltip="Rate used when this agent closes a deal"
                                        >
                                            <InputNumber
                                                min={0}
                                                max={100}
                                                className="w-full"
                                                addonAfter="%"
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            label="Override Rate %"
                                            name="override_rate"
                                            tooltip="Ceiling rate used in upline differential calculations"
                                        >
                                            <InputNumber
                                                min={0}
                                                max={100}
                                                className="w-full"
                                                addonAfter="%"
                                            />
                                        </Form.Item>
                                    </div>
                                    <Form.Item
                                        label="Hidden Level"
                                        name="is_hidden"
                                        valuePropName="checked"
                                        tooltip="Hidden levels are excluded from visible level progression"
                                    >
                                        <Switch />
                                    </Form.Item>
                                </>
                            )}
                        </Form>
                    </Modal>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmLevels;
