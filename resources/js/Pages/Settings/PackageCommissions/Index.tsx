import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import { Alert, Button, InputNumber, Select, Table, Tag } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import usePackageCommissions from "./usePackageCommissions";
import AgentOverrides from "./components/AgentOverrides";
import type {
    AgentOption,
    PackageCommissionRow,
    PackageCommissionType,
} from "./types";

interface Props {
    pageTitle: string;
    packages: PackageCommissionRow[];
    agents: AgentOption[];
}

/** Draft edits per row, so a rate is only written when Save is pressed. */
type Draft = { type: PackageCommissionType | null; value: number | null };

export default function PackageCommissionsIndex({
    pageTitle,
    packages: initialPackages,
    agents,
}: Props) {
    const { td } = useTd();
    const {
        packages,
        overrides,
        savingId,
        savePackage,
        loadOverrides,
        saveOverride,
        removeOverride,
    } = usePackageCommissions(initialPackages);

    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [expanded, setExpanded] = useState<number[]>([]);

    // Commissions pay out in the application's currency, never the package's own
    // price currency — so the fee input is labelled with this, not pkg.currency.
    const pageProps = usePage().props as {
        default_currency_symbol?: string;
    };
    const currencySymbol = pageProps.default_currency_symbol || "";

    const draftFor = (row: PackageCommissionRow): Draft =>
        drafts[row.id] ?? {
            type: row.commission_type,
            value: row.commission_value,
        };

    const setDraft = (id: number, next: Partial<Draft>) =>
        setDrafts((prev) => ({
            ...prev,
            [id]: { ...(prev[id] ?? { type: null, value: null }), ...next },
        }));

    const isDirty = (row: PackageCommissionRow) => {
        const d = draftFor(row);
        return d.type !== row.commission_type || d.value !== row.commission_value;
    };

    const save = async (row: PackageCommissionRow) => {
        const d = draftFor(row);
        const ok = await savePackage(row.id, d.type, d.type === null ? null : d.value);
        if (ok) {
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[row.id];
                return next;
            });
        }
    };

    const money = (amount: number) =>
        `${currencySymbol}${amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    return (
        <PageLayout breadcrumbs={[{ name: pageTitle }]} config={{ showTitle: true }}>
            <div className="max-w-screen-2xl mx-auto w-full space-y-4">
                <Alert
                    type="info"
                    showIcon
                    message={td(
                        "A package with a commission set pays the closing agent from these settings alone — no upline or system commission is generated for that deal. Leave a package unset to keep the standard level-based commission.",
                        { source: "en" },
                    )}
                />

                <Table<PackageCommissionRow>
                    rowKey="id"
                    dataSource={packages}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    expandable={{
                        expandedRowKeys: expanded,
                        onExpandedRowsChange: (keys) => setExpanded(keys as number[]),
                        expandedRowRender: (row) => (
                            <AgentOverrides
                                pkg={row}
                                agents={agents}
                                overrides={overrides[row.id]}
                                currencySymbol={currencySymbol}
                                onLoad={loadOverrides}
                                onSave={saveOverride}
                                onRemove={removeOverride}
                            />
                        ),
                    }}
                    columns={[
                        {
                            title: td("Package", { source: "en" }),
                            dataIndex: "name",
                            render: (name: string, row) => (
                                <div>
                                    <div className="font-medium text-gray-800">
                                        {name}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {td("Package value", { source: "en" })}:{" "}
                                        {row.value.toLocaleString()} {row.currency ?? ""}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            title: td("Commission", { source: "en" }),
                            key: "type",
                            width: 170,
                            render: (_, row) => (
                                <Select<PackageCommissionType | null>
                                    value={draftFor(row).type}
                                    onChange={(next) =>
                                        setDraft(row.id, { type: next, value: null })
                                    }
                                    allowClear
                                    placeholder={td("Not set", { source: "en" })}
                                    style={{ width: 150 }}
                                    options={[
                                        {
                                            value: "percentage",
                                            label: td("Percentage", { source: "en" }),
                                        },
                                        {
                                            value: "fixed",
                                            label: td("Fixed", { source: "en" }),
                                        },
                                    ]}
                                />
                            ),
                        },
                        {
                            title: td("Rate", { source: "en" }),
                            key: "value",
                            width: 190,
                            render: (_, row) => {
                                const d = draftFor(row);
                                if (d.type === null) {
                                    return (
                                        <span className="text-xs text-gray-400">
                                            {td("Uses level commission", {
                                                source: "en",
                                            })}
                                        </span>
                                    );
                                }
                                return (
                                    <InputNumber
                                        value={d.value}
                                        onChange={(next) => setDraft(row.id, { value: next })}
                                        min={0}
                                        max={d.type === "percentage" ? 100 : undefined}
                                        step={d.type === "percentage" ? 0.5 : 10}
                                        addonAfter={
                                            d.type === "percentage" ? "%" : currencySymbol
                                        }
                                        style={{ width: 160 }}
                                    />
                                );
                            },
                        },
                        {
                            title: td("Agent earns", { source: "en" }),
                            key: "preview",
                            width: 150,
                            render: (_, row) => {
                                const d = draftFor(row);
                                if (d.type === null || d.value === null) return "—";
                                const amount =
                                    d.type === "percentage"
                                        ? (row.value * d.value) / 100
                                        : d.value;
                                return (
                                    <span className="font-medium text-green-600">
                                        {money(amount)}
                                    </span>
                                );
                            },
                        },
                        {
                            title: td("Overrides", { source: "en" }),
                            dataIndex: "overrides_count",
                            width: 110,
                            render: (count: number) =>
                                count > 0 ? (
                                    <Tag color="blue">{count}</Tag>
                                ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                ),
                        },
                        {
                            title: "",
                            key: "actions",
                            align: "right",
                            width: 100,
                            render: (_, row) => (
                                <Button
                                    type="primary"
                                    size="small"
                                    disabled={!isDirty(row)}
                                    loading={savingId === row.id}
                                    onClick={() => save(row)}
                                >
                                    {td("Save", { source: "en" })}
                                </Button>
                            ),
                        },
                    ]}
                />
            </div>
        </PageLayout>
    );
}

PackageCommissionsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
