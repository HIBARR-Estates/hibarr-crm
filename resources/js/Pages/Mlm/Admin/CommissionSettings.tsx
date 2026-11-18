import React, { useState, useEffect } from "react";
import {
    Card,
    Form,
    InputNumber,
    Switch,
    Button,
    message,
    Divider,
    Alert,
    Row,
    Col,
    Select,
    Spin,
    Empty,
    Popconfirm,
} from "antd";
import { usePage } from "@inertiajs/react";
import { motion } from "framer-motion";
import { Save, Calculator, Play, CameraIcon } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useMlmSettings,
    useUpdateMlmSettings,
    useCommissionSimulation,
    useActiveCycle,
    useResnapshot,
} from "@/Features/Mlm/api";
import type {
    MlmSettings,
    CommissionSimulationResult,
    CycleDurationType,
} from "@/Features/Mlm/types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends PageProps {
    settings: MlmSettings;
    agents: Array<{ id: number; name: string }>;
}

const MlmCommissionSettings: React.FC<Props> = ({
    settings: initialSettings,
    agents = [],
}) => {
    const { td } = useTd();
    const { data: settingsData, isLoading } = useMlmSettings();
    const { t } = useTranslation();
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    const settings: MlmSettings =
        (settingsData as any)?.data ?? initialSettings;

    const [form] = Form.useForm<MlmSettings>();
    const [simDealValue, setSimDealValue] = useState<number>(0);
    const [simAgentId, setSimAgentId] = useState<number>(0);
    const [durationType, setDurationType] = useState<string>("monthly");

    const updateSettings = useUpdateMlmSettings(() => {
        message.success(td("Settings updated successfully", { source: "en" }));
    });

    // An active cycle pays from a snapshot taken when it started, so edits on
    // this page do not reach live commissions until it is retaken.
    const { data: activeCycleData, refetch: refetchActiveCycle } =
        useActiveCycle();
    const activeCycle = (activeCycleData as any)?.data?.cycle ?? null;
    const cycleIsSnapshotted =
        !!activeCycle?.id &&
        activeCycle?.status === "active" &&
        activeCycle?.has_snapshots;

    const resnapshot = useResnapshot(activeCycle?.id ?? 0, () => {
        message.success(
            td("Cycle re-snapshotted. New commissions will use the current rules.", { source: "en" }),
        );
        refetchActiveCycle();
    });

    const snapshotMax = activeCycle?.max_commission_snapshot ?? null;
    const currentMax = settings?.max_commission_percentage ?? null;
    // Only claim drift on a figure we can actually compare. Level percentages
    // can be stale too, which is why the copy never says "you are in sync".
    const maxCommissionDrifted =
        cycleIsSnapshotted &&
        snapshotMax !== null &&
        currentMax !== null &&
        Number(snapshotMax) !== Number(currentMax);

    const { data: simData, isLoading: simLoading } = useCommissionSimulation({
        deal_value: simDealValue,
        agent_id: simAgentId,
    });
    const simResult: CommissionSimulationResult | null =
        (simData as any)?.data ?? null;

    useEffect(() => {
        if (settings) {
            form.setFieldsValue(settings);
            setDurationType(settings.default_cycle_duration_type ?? "monthly");
        }
    }, [settings, form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            updateSettings.mutate(values);
        } catch {
            // validation error
        }
    };

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.admin.commission_settings")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.commission_settings") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <Row gutter={[24, 24]}>
                        {/* Settings Form */}
                        <Col xs={24} lg={14}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <Card
                                    title={
                                        <span className="font-semibold">
                                            {td("Global MLM Settings", { source: "en" })}
                                        </span>
                                    }
                                    className="shadow-sm"
                                >
                                    <Spin spinning={isLoading}>
                                        <Form
                                            form={form}
                                            layout="vertical"
                                            initialValues={settings}
                                        >
                                            <Form.Item
                                                label={td("Max Commission Percentage", { source: "en" })}
                                                name="max_commission_percentage"
                                                tooltip={td("The maximum total commission that can be distributed across all levels for a single deal.", { source: "en" })}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            "Enter max commission %",
                                                    },
                                                ]}
                                            >
                                                <InputNumber
                                                    min={0}
                                                    max={100}
                                                    className="w-full"
                                                    addonAfter="%"
                                                />
                                            </Form.Item>

                                            {cycleIsSnapshotted && (
                                                <Alert
                                                    className="mb-4"
                                                    type={
                                                        maxCommissionDrifted
                                                            ? "warning"
                                                            : "info"
                                                    }
                                                    showIcon
                                                    message={
                                                        maxCommissionDrifted
                                                            ? `Active cycle is still paying ${snapshotMax}%`
                                                            : "Active cycle uses a snapshot of these rules"
                                                    }
                                                    description={
                                                        <div className="space-y-2">
                                                            <div>
                                                                {maxCommissionDrifted
                                                                    ? `Cycle #${activeCycle.cycle_number} froze the rules when it started, so commissions are still calculated at ${snapshotMax}% rather than the ${currentMax}% saved here. Re-snapshot to apply the current settings.`
                                                                    : `Cycle #${activeCycle.cycle_number} froze the commission percentages and level rules when it started. Changes made here — including level percentages — only reach live commissions once the snapshot is retaken.`}
                                                            </div>
                                                            <Popconfirm
                                                                title={td("Re-snapshot this cycle?", { source: "en" })}
                                                                description={
                                                                    <div className="max-w-xs">
                                                                        {td("Commissions calculated from now on will use the current rules. Commissions already recorded keep the amounts they were paid at.", { source: "en" })}
                                                                    </div>
                                                                }
                                                                okText={td("Re-snapshot", { source: "en" })}
                                                                cancelText={td("Cancel", { source: "en" })}
                                                                onConfirm={() =>
                                                                    resnapshot.mutate(
                                                                        {},
                                                                    )
                                                                }
                                                            >
                                                                <Button
                                                                    size="small"
                                                                    danger={
                                                                        maxCommissionDrifted
                                                                    }
                                                                    icon={
                                                                        <CameraIcon
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                    loading={
                                                                        resnapshot.isPending
                                                                    }
                                                                >
                                                                    {td("Re-snapshot cycle", { source: "en" })}
                                                                </Button>
                                                            </Popconfirm>
                                                        </div>
                                                    }
                                                />
                                            )}

                                            <Form.Item
                                                label={td("Auto-Evaluate Ancestors", { source: "en" })}
                                                name="auto_evaluate_ancestors"
                                                valuePropName="checked"
                                                tooltip={td("When enabled, the system will automatically evaluate if upline agents should be promoted when a deal is closed.", { source: "en" })}
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Form.Item
                                                label={td("Enable Commission Reversal", { source: "en" })}
                                                name="enable_commission_reversal"
                                                valuePropName="checked"
                                                tooltip={td("Allow admins to revert paid commissions (e.g., when a deal is cancelled).", { source: "en" })}
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Divider>
                                                {td("Cycle Auto-Generation Defaults", { source: "en" })}
                                            </Divider>

                                            <Form.Item
                                                label={td("Auto-Generate Cycles", { source: "en" })}
                                                name="auto_generate_cycles"
                                                valuePropName="checked"
                                                tooltip={td("When enabled, new cycles are created automatically by the scheduler.", { source: "en" })}
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Row gutter={16}>
                                                <Col xs={24} md={12}>
                                                    <Form.Item
                                                        label={td("Default Duration Type", { source: "en" })}
                                                        name="default_cycle_duration_type"
                                                        tooltip={td("Duration type applied when auto-generating cycles.", { source: "en" })}
                                                    >
                                                        <Select
                                                            onChange={(v) =>
                                                                setDurationType(
                                                                    v,
                                                                )
                                                            }
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
                                                    <Col xs={24} md={12}>
                                                        <Form.Item
                                                            label={td("Custom Duration (days)", { source: "en" })}
                                                            name="default_cycle_duration_days"
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
                                            </Row>

                                            {/* <Form.Item
                                                label="Default Overflow Multiplier"
                                                name="default_overflow_multiplier"
                                                tooltip="Applied to newly auto-generated cycles. Agents can overflow for (cycle_days × this) extra days."
                                            >
                                                <InputNumber
                                                    min={0}
                                                    max={5}
                                                    step={0.1}
                                                    className="w-full"
                                                />
                                            </Form.Item> */}

                                            <Divider />

                                            <Button
                                                type="primary"
                                                icon={<Save size={14} />}
                                                onClick={handleSave}
                                                loading={
                                                    updateSettings.isPending
                                                }
                                            >
                                                {td("Save Settings", { source: "en" })}
                                            </Button>
                                        </Form>
                                    </Spin>
                                </Card>
                            </motion.div>
                        </Col>

                        {/* Commission Simulator */}
                        <Col xs={24} lg={10}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.15 }}
                            >
                                <Card
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Calculator
                                                size={18}
                                                className="text-blue-500"
                                            />
                                            <span className="font-semibold">
                                                {td("Commission Simulator", { source: "en" })}
                                            </span>
                                        </div>
                                    }
                                    className="shadow-sm"
                                >
                                    <Alert
                                        type="info"
                                        showIcon
                                        message={td("Test how commissions will be distributed for a hypothetical deal.", { source: "en" })}
                                        className="mb-4"
                                    />

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {td("Deal Value", { source: "en" })}
                                            </label>
                                            <InputNumber
                                                className="w-full"
                                                min={0}
                                                prefix={currencySymbol}
                                                placeholder={td("Enter deal value", { source: "en" })}
                                                value={
                                                    simDealValue || undefined
                                                }
                                                onChange={(v) =>
                                                    setSimDealValue(v ?? 0)
                                                }
                                                style={{ width: "100%" }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {td("Closing Agent", { source: "en" })}
                                            </label>
                                            <Select
                                                className="w-full"
                                                placeholder={td("Select an agent", { source: "en" })}
                                                showSearch
                                                optionFilterProp="label"
                                                options={agents.map((a) => ({
                                                    value: a.id,
                                                    label: a.name,
                                                }))}
                                                value={simAgentId || undefined}
                                                onChange={(v) =>
                                                    setSimAgentId(v ?? 0)
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Results */}
                                    {simLoading && (
                                        <div className="mt-6 text-center">
                                            <Spin />
                                        </div>
                                    )}

                                    {simResult && !simLoading && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-6"
                                        >
                                            <Divider>{td("Simulation Result", { source: "en" })}</Divider>

                                            <div className="space-y-2">
                                                {simResult.entries.map(
                                                    (entry, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                                        >
                                                            <div>
                                                                <div className="font-medium text-sm">
                                                                    {
                                                                        entry.agent_name
                                                                    }
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {
                                                                        entry.level_name
                                                                    }{" "}
                                                                    ·{" "}
                                                                    {entry.type}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-semibold text-green-600">
                                                                    {
                                                                        currencySymbol
                                                                    }
                                                                    {entry.amount.toLocaleString(
                                                                        undefined,
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                        },
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {
                                                                        entry.percentage
                                                                    }
                                                                    %
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>

                                            <Divider />

                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">
                                                    {td("Total Distributed", { source: "en" })}
                                                </span>
                                                <span className="font-bold text-green-600">
                                                    {currencySymbol}
                                                    {simResult.total_distributed.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                        },
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm mt-1">
                                                <span className="text-gray-600">
                                                    {td("System Retains", { source: "en" })}
                                                </span>
                                                <span className="font-bold">
                                                    {currencySymbol}
                                                    {simResult.system_commission.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                        },
                                                    )}
                                                </span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {!simResult &&
                                        !simLoading &&
                                        simDealValue > 0 &&
                                        simAgentId > 0 && (
                                            <Empty
                                                className="mt-6"
                                                description={td("No simulation data", { source: "en" })}
                                            />
                                        )}
                                </Card>
                            </motion.div>
                        </Col>
                    </Row>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmCommissionSettings;
