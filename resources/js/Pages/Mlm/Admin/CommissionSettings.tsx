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
import { motion } from "framer-motion";
import { Save, Calculator, Play } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    useMlmSettings,
    useUpdateMlmSettings,
    useCommissionSimulation,
} from "@/Features/Mlm/api";
import type {
    MlmSettings,
    CommissionSimulationResult,
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
    const settings: MlmSettings =
        (settingsData as any)?.data?.data ?? initialSettings;

    const [form] = Form.useForm<MlmSettings>();
    const [simDealValue, setSimDealValue] = useState<number>(0);
    const [simAgentId, setSimAgentId] = useState<number>(0);

    const updateSettings = useUpdateMlmSettings(() => {
        message.success("Settings updated successfully");
    });

    const { data: simData, isLoading: simLoading } = useCommissionSimulation({
        deal_value: simDealValue,
        agent_id: simAgentId,
    });
    const simResult: CommissionSimulationResult | null =
        (simData as any)?.data?.data ?? null;

    useEffect(() => {
        if (settings) {
            form.setFieldsValue(settings);
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
                title="Commission Settings"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/dashboard" },
                    { name: "Commission Settings" },
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
                                                prefix="$"
                                                placeholder="Enter deal value"
                                                value={
                                                    simDealValue || undefined
                                                }
                                                onChange={(v) =>
                                                    setSimDealValue(v ?? 0)
                                                }
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
                                                                    $
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
                                                    $
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
                                                    $
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
