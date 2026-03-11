import React from "react";
import { Button, Form, InputNumber, Select, Space } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type {
    MlmLevelCriterionFormData,
    MlmMetric,
    CriteriaOperator,
} from "../types";
import { MLM_METRIC_LABELS } from "../types";

const METRIC_OPTIONS: Array<{ value: MlmMetric; label: string }> = [
    { value: "nsa", label: MLM_METRIC_LABELS.nsa },
    { value: "nsd", label: MLM_METRIC_LABELS.nsd },
    { value: "vsa", label: MLM_METRIC_LABELS.vsa },
    { value: "vsd", label: MLM_METRIC_LABELS.vsd },
    { value: "nsa_nsd", label: MLM_METRIC_LABELS.nsa_nsd },
    { value: "vsa_vsd", label: MLM_METRIC_LABELS.vsa_vsd },
];

const OPERATOR_OPTIONS: Array<{ value: CriteriaOperator; label: string }> = [
    { value: ">=", label: ">= (Greater or Equal)" },
    { value: ">", label: "> (Greater)" },
    { value: "<=", label: "<= (Less or Equal)" },
    { value: "<", label: "< (Less)" },
    { value: "=", label: "= (Equal)" },
];

interface MetricConditionBuilderProps {
    conditions: Array<Partial<MlmLevelCriterionFormData>>;
    onChange: (conditions: Array<Partial<MlmLevelCriterionFormData>>) => void;
    logicGroup?: number;
}

export default function MetricConditionBuilder({
    conditions,
    onChange,
    logicGroup = 1,
}: MetricConditionBuilderProps) {
    const addCondition = () => {
        onChange([
            ...conditions,
            {
                logic_group: logicGroup,
                metric: "nsa",
                operator: ">=",
                threshold: 0,
            },
        ]);
    };

    const removeCondition = (index: number) => {
        const updated = conditions.filter((_, i) => i !== index);
        onChange(updated);
    };

    const updateCondition = (
        index: number,
        field: keyof MlmLevelCriterionFormData,
        value: any,
    ) => {
        const updated = [...conditions];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    return (
        <div className="space-y-3">
            {conditions.map((condition, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                    {/* Index */}
                    <span className="text-xs text-gray-400 font-mono w-5">
                        {index + 1}.
                    </span>

                    {/* Metric */}
                    <Select
                        value={condition.metric}
                        onChange={(val) =>
                            updateCondition(index, "metric", val)
                        }
                        options={METRIC_OPTIONS}
                        style={{ width: 260 }}
                        placeholder="Select metric"
                    />

                    {/* Operator */}
                    <Select
                        value={condition.operator}
                        onChange={(val) =>
                            updateCondition(index, "operator", val)
                        }
                        options={OPERATOR_OPTIONS}
                        style={{ width: 180 }}
                        placeholder="Operator"
                    />

                    {/* Threshold */}
                    <InputNumber
                        value={condition.threshold}
                        onChange={(val) =>
                            updateCondition(index, "threshold", val ?? 0)
                        }
                        min={0}
                        style={{ width: 150 }}
                        placeholder="Value"
                        formatter={(value) =>
                            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) =>
                            Number(value!.replace(/\$\s?|(,*)/g, ""))
                        }
                    />

                    {/* Delete */}
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeCondition(index)}
                        disabled={conditions.length <= 1}
                    />

                    {/* AND indicator between conditions (not on last) */}
                    {index < conditions.length - 1 && (
                        <span className="text-xs text-blue-500 font-semibold uppercase">
                            AND
                        </span>
                    )}
                </div>
            ))}

            <Button
                type="dashed"
                onClick={addCondition}
                icon={<PlusOutlined />}
                className="w-full"
            >
                Add Condition
            </Button>
        </div>
    );
}
