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
} from "antd";
import { usePage } from "@inertiajs/react";
import { motion } from "framer-motion";
import { Save, Calculator, Play } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useMlmSettings,
    useUpdateMlmSettings,
    useCommissionSimulation,
} from "@/Features/Mlm/api";
import type {
    MlmSettings,
    CommissionSimulationResult,
    CycleDurationType,
} from "@/Features/Mlm/types";

interface Props extends PageProps {
    settings: MlmSettings;
    agents: Array<{ id: number; name: string }>;
}

const MlmCommissionSettings: React.FC<Props> = ({
    settings: initialSettings,
    agents = [],
}) => {
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
        message.success("Settings updated successfully");
    });

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
                                            Global MLM Settings
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
                                                label="Max Commission Percentage"
                                                name="max_commission_percentage"
                                                tooltip="The maximum total commission that can be distributed across all levels for a single deal."
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

                                            <Form.Item
                                                label="Auto-Evaluate Ancestors"
                                                name="auto_evaluate_ancestors"
                                                valuePropName="checked"
                                                tooltip="When enabled, the system will automatically evaluate if upline agents should be promoted when a deal is closed."
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Form.Item
                                                label="Enable Commission Reversal"
                                                name="enable_commission_reversal"
                                                valuePropName="checked"
                                                tooltip="Allow admins to revert paid commissions (e.g., when a deal is cancelled)."
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Divider>
                                                Cycle Auto-Generation Defaults
                                            </Divider>

                                            <Form.Item
                                                label="Auto-Generate Cycles"
                                                name="auto_generate_cycles"
                                                valuePropName="checked"
                                                tooltip="When enabled, new cycles are created automatically by the scheduler."
                                            >
                                                <Switch />
                                            </Form.Item>

                                            <Row gutter={16}>
                                                <Col xs={24} md={12}>
                                                    <Form.Item
                                                        label="Default Duration Type"
                                                        name="default_cycle_duration_type"
                                                        tooltip="Duration type applied when auto-generating cycles."
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
                                                            label="Custom Duration (days)"
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
                                                Save Settings
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
                                                Commission Simulator
                                            </span>
                                        </div>
                                    }
                                    className="shadow-sm"
                                >
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="Test how commissions will be distributed for a hypothetical deal."
                                        className="mb-4"
                                    />

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Deal Value
                                            </label>
                                            <InputNumber
                                                className="w-full"
                                                min={0}
                                                prefix={currencySymbol}
                                                placeholder="Enter deal value"
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
                                                Closing Agent
                                            </label>
                                            <Select
                                                className="w-full"
                                                placeholder="Select an agent"
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
                                            <Divider>Simulation Result</Divider>

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
                                                    Total Distributed
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
                                                    System Retains
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
                                                description="No simulation data"
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
