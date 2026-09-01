import React, { useEffect, useMemo, useState } from "react";
import { Button, InputNumber, Select, Table, Popconfirm } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type {
    AgentOption,
    AgentOverride,
    PackageCommissionRow,
    PackageCommissionType,
} from "../types";

interface Props {
    pkg: PackageCommissionRow;
    agents: AgentOption[];
    overrides: AgentOverride[] | undefined;
    currencySymbol: string;
    onLoad: (packageId: number) => void;
    onSave: (
        packageId: number,
        agentId: number,
        type: PackageCommissionType,
        value: number,
    ) => Promise<boolean>;
    onRemove: (packageId: number, agentId: number) => void;
}

/**
 * Per-agent overrides of one package's default rate. An override always states
 * its own shape — it never inherits half of the package default.
 */
export default function AgentOverrides({
    pkg,
    agents,
    overrides,
    currencySymbol,
    onLoad,
    onSave,
    onRemove,
}: Props) {
    const { td } = useTd();
    const [agentId, setAgentId] = useState<number | null>(null);
    const [type, setType] = useState<PackageCommissionType>("percentage");
    const [value, setValue] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (overrides === undefined) onLoad(pkg.id);
    }, [overrides, onLoad, pkg.id]);

    const assigned = useMemo(
        () => new Set((overrides ?? []).map((o) => o.agent_id)),
        [overrides],
    );

    const available = useMemo(
        () => agents.filter((a) => !assigned.has(a.id)),
        [agents, assigned],
    );

    const add = async () => {
        if (agentId === null || value === null) return;
        setSaving(true);
        const ok = await onSave(pkg.id, agentId, type, value);
        setSaving(false);
        if (ok) {
            setAgentId(null);
            setValue(null);
        }
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-xs font-semibold text-gray-600 mb-3">
                {td("Agent overrides", { source: "en" })}
            </div>

            <Table<AgentOverride>
                size="small"
                rowKey="agent_id"
                pagination={false}
                dataSource={overrides ?? []}
                loading={overrides === undefined}
                locale={{
                    emptyText: td("Every agent uses the package default", {
                        source: "en",
                    }),
                }}
                columns={[
                    {
                        title: td("Agent", { source: "en" }),
                        dataIndex: "agent_name",
                    },
                    {
                        title: td("Rate", { source: "en" }),
                        key: "rate",
                        render: (_, r) =>
                            r.commission_type === "percentage"
                                ? `${r.commission_value}%`
                                : `${currencySymbol}${r.commission_value.toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 },
                                  )}`,
                    },
                    {
                        title: "",
                        key: "actions",
                        align: "right",
                        width: 90,
                        render: (_, r) => (
                            <Popconfirm
                                title={td("Remove this override?", { source: "en" })}
                                onConfirm={() => onRemove(pkg.id, r.agent_id)}
                            >
                                <Button type="link" danger size="small">
                                    {td("Remove", { source: "en" })}
                                </Button>
                            </Popconfirm>
                        ),
                    },
                ]}
            />

            <div className="flex flex-wrap items-center gap-2 mt-3">
                <Select
                    value={agentId}
                    onChange={setAgentId}
                    placeholder={td("Select an agent", { source: "en" })}
                    showSearch
                    optionFilterProp="label"
                    style={{ minWidth: 220 }}
                    options={available.map((a) => ({ value: a.id, label: a.name }))}
                />
                <Select<PackageCommissionType>
                    value={type}
                    onChange={(next) => {
                        setType(next);
                        setValue(null);
                    }}
                    style={{ width: 130 }}
                    options={[
                        { value: "percentage", label: td("Percentage", { source: "en" }) },
                        { value: "fixed", label: td("Fixed", { source: "en" }) },
                    ]}
                />
                <InputNumber
                    value={value}
                    onChange={setValue}
                    min={0}
                    max={type === "percentage" ? 100 : undefined}
                    step={type === "percentage" ? 0.5 : 10}
                    addonAfter={type === "percentage" ? "%" : currencySymbol}
                    style={{ width: 150 }}
                />
                <Button
                    type="primary"
                    onClick={add}
                    loading={saving}
                    disabled={agentId === null || value === null}
                >
                    {td("Add override", { source: "en" })}
                </Button>
            </div>
        </div>
    );
}
