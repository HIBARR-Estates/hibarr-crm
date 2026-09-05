import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type {
    AgentOption,
    AgentOverride,
    PackageRow,
    PackageCommissionType,
} from "../types";

interface Props {
    pkg: PackageRow;
    agents: AgentOption[];
    overrides: AgentOverride[] | undefined;
    currencySymbol: string;
    onLoad: (packageId: number) => void;
    onSave: (
        packageId: number,
        agentId: number,
        type: PackageCommissionType,
        /** Null for "none" — there is nothing to enter. */
        value: number | null,
    ) => Promise<boolean>;
    onRemove: (packageId: number, agentId: number) => void;
}

const inputClass =
    "h-9 rounded-lg border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1a6bb5]";

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

    const needsValue = type === "percentage" || type === "fixed";

    const add = async () => {
        if (agentId === null || (needsValue && value === null)) return;
        setSaving(true);
        const ok = await onSave(pkg.id, agentId, type, needsValue ? value : null);
        setSaving(false);
        if (ok) {
            setAgentId(null);
            setValue(null);
        }
    };

    const rate = (o: AgentOverride) => {
        if (o.commission_type === "none" || o.commission_value === null) {
            return td("No commission", { source: "en" });
        }
        return o.commission_type === "percentage"
            ? `${o.commission_value}%`
            : `${currencySymbol}${o.commission_value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
              })}`;
    };

    return (
        <div className="border-t border-[#eef0f3] bg-[#f8f9fb] px-5 py-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                {td("Agent overrides", { source: "en" })}
            </div>

            {overrides === undefined ? (
                <p className="text-xs text-[#9ca3af]">
                    {td("Loading…", { source: "en" })}
                </p>
            ) : overrides.length === 0 ? (
                <p className="text-xs text-[#9ca3af]">
                    {td("Every agent uses the package default.", { source: "en" })}
                </p>
            ) : (
                <div className="mb-3 divide-y divide-[#eef0f3] overflow-hidden rounded-lg border border-[#e2e5ea] bg-white">
                    {overrides.map((o) => (
                        <div
                            key={o.agent_id}
                            className="flex items-center justify-between px-4 py-2.5"
                        >
                            <span className="text-sm text-[#1a1f2e]">
                                {o.agent_name}
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold text-[#16294d]">
                                    {rate(o)}
                                </span>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#b91c1c] hover:underline"
                                    onClick={() => onRemove(pkg.id, o.agent_id)}
                                >
                                    {td("Remove", { source: "en" })}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <select
                    className={`${inputClass} min-w-[200px]`}
                    value={agentId ?? ""}
                    onChange={(e) =>
                        setAgentId(e.target.value === "" ? null : Number(e.target.value))
                    }
                >
                    <option value="">
                        {td("Select an agent", { source: "en" })}
                    </option>
                    {available.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>

                <select
                    className={inputClass}
                    value={type}
                    onChange={(e) => {
                        setType(e.target.value as PackageCommissionType);
                        setValue(null);
                    }}
                >
                    <option value="percentage">
                        {td("Percentage", { source: "en" })}
                    </option>
                    <option value="fixed">{td("Fixed", { source: "en" })}</option>
                    <option value="none">{td("No commission", { source: "en" })}</option>
                </select>

                <div className="relative">
                    <input
                        type="number"
                        min={0}
                        max={type === "percentage" ? 100 : undefined}
                        step="0.01"
                        disabled={!needsValue}
                        className={`${inputClass} w-32 pr-9`}
                        value={value ?? ""}
                        onChange={(e) =>
                            setValue(
                                e.target.value === "" ? null : Number(e.target.value),
                            )
                        }
                    />
                    {needsValue && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ca3af]">
                            {type === "percentage" ? "%" : currencySymbol}
                        </span>
                    )}
                </div>

                <Button
                    variant="primary"
                    size="sm"
                    onClick={add}
                    loading={saving}
                    disabled={agentId === null || (needsValue && value === null)}
                >
                    {td("Add override", { source: "en" })}
                </Button>
            </div>
        </div>
    );
}
