import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button, Badge, EmptyState, ConfirmDialog } from "@/Components/Redesign";
import "@/Components/Redesign/redesign.css";
import { useTd } from "@/Hooks/useDynamicTranslation";
import usePackages from "./usePackages";
import PackageFormModal from "./components/PackageFormModal";
import AgentOverrides from "./components/AgentOverrides";
import type {
    AgentOption,
    PackageFormValues,
    PackageRow,
    PipelineOption,
    RoutingFieldOption,
    StageOption,
} from "./types";

interface Props {
    pageTitle: string;
    packages: PackageRow[];
    agents: AgentOption[];
    pipelines: PipelineOption[];
    stages: StageOption[];
    routingFieldItems: RoutingFieldOption[];
}

const COLUMN_COUNT = 5;

export default function PackagesIndex({
    pageTitle,
    packages: initialPackages,
    agents,
    pipelines,
    stages,
    routingFieldItems,
}: Props) {
    const { td } = useTd();
    const {
        packages,
        overrides,
        saving,
        createPackage,
        updatePackage,
        deletePackage,
        loadOverrides,
        saveOverride,
        removeOverride,
        loadRoutingTriggers,
    } = usePackages(initialPackages);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<PackageRow | null>(null);
    const [confirming, setConfirming] = useState<PackageRow | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);

    // Commissions pay out in the application's currency, never the package's
    // own price currency.
    const {
        default_currency_symbol: currencySymbol = "",
        default_currency_code: currencyCode = "",
    } = usePage().props as {
        default_currency_symbol?: string;
        default_currency_code?: string;
    };

    const money = (amount: number) =>
        `${currencySymbol}${amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (pkg: PackageRow) => {
        setEditing(pkg);
        setFormOpen(true);
    };

    const submit = (values: PackageFormValues) =>
        editing ? updatePackage(editing.id, values) : createPackage(values);

    const confirmDelete = async () => {
        if (!confirming) return;
        const ok = await deletePackage(confirming.id);
        if (ok) setConfirming(null);
    };

    const pipelineName = (id: number | null) =>
        pipelines.find((p) => p.id === id)?.name ?? null;

    const earns = (pkg: PackageRow) => {
        // A guaranteed zero, not "we don't know" — kept distinct from the null
        // below (commission_type === null), which falls through to a level
        // commission this list can't preview.
        if (pkg.commission_type === "none") return 0;
        if (pkg.commission_type === null || pkg.commission_value === null) return null;
        return pkg.commission_type === "percentage"
            ? (pkg.value * pkg.commission_value) / 100
            : pkg.commission_value;
    };

    return (
        <PageLayout breadcrumbs={[{ name: pageTitle }]} config={{ showTitle: true }}>
            <div className="mx-auto w-full max-w-screen-2xl space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <p className="max-w-3xl text-xs leading-relaxed text-[#5b6472]">
                        {td(
                            "A package with a commission set pays the closing agent from these settings alone — no upline or system commission is generated for that deal. Leave a package on the level commission to keep the standard split.",
                            { source: "en" },
                        )}
                    </p>
                    <Button variant="primary" onClick={openCreate}>
                        {td("New package", { source: "en" })}
                    </Button>
                </div>

                {packages.length === 0 ? (
                    <EmptyState
                        icon="layers"
                        title={td("No packages yet", { source: "en" })}
                        description={td(
                            "Create a package to price it and set how it pays commission.",
                            { source: "en" },
                        )}
                    />
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-[#e2e5ea] bg-white">
                        {/*
                            A real <table> on purpose: the browser's table layout
                            algorithm keeps one column width across every row, which
                            the previous CSS-grid "row per div" version couldn't
                            guarantee once rows held different amounts of content
                            (e.g. an actions cell wider on one row than another) —
                            the columns drifted out of alignment with the header.
                        */}
                        <table className="w-full table-fixed border-collapse text-left">
                            <colgroup>
                                <col style={{ width: "36%" }} />
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "230px" }} />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-[#e2e5ea] bg-[#f8f9fb] text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                                    <th className="px-5 py-3 font-bold">
                                        {td("Package", { source: "en" })}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {td("Commission", { source: "en" })}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {td("Agent earns", { source: "en" })}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {td("Pipeline", { source: "en" })}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {td("Actions", { source: "en" })}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {packages.map((pkg) => {
                                    const amount = earns(pkg);
                                    const isOpen = expanded === pkg.id;

                                    return (
                                        <React.Fragment key={pkg.id}>
                                            <tr className="border-b border-[#eef0f3] align-middle last:border-b-0">
                                                <td className="px-5 py-3.5">
                                                    <div className="truncate text-sm font-semibold text-[#1a1f2e]">
                                                        {pkg.name}
                                                    </div>
                                                    <div className="mt-0.5 truncate text-xs text-[#9ca3af]">
                                                        {pkg.value.toLocaleString()}{" "}
                                                        {pkg.currency ?? ""}
                                                        {pkg.routing_triggers_count > 0 && (
                                                            <>
                                                                {" · "}
                                                                {pkg.routing_triggers_count}{" "}
                                                                {td("routing triggers", {
                                                                    source: "en",
                                                                })}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-3.5">
                                                    {pkg.commission_type === null ? (
                                                        <span className="text-xs text-[#9ca3af]">
                                                            {td("Level commission", {
                                                                source: "en",
                                                            })}
                                                        </span>
                                                    ) : pkg.commission_type === "none" ? (
                                                        <Badge variant="gray">
                                                            {td("No commission", {
                                                                source: "en",
                                                            })}
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant={
                                                                pkg.commission_type ===
                                                                "percentage"
                                                                    ? "blue"
                                                                    : "teal"
                                                            }
                                                        >
                                                            {pkg.commission_type === "percentage"
                                                                ? `${pkg.commission_value}%`
                                                                : money(
                                                                      pkg.commission_value ?? 0,
                                                                  )}
                                                        </Badge>
                                                    )}
                                                </td>

                                                <td className="px-5 py-3.5 text-sm font-semibold text-[#177a5b]">
                                                    {amount === null ? (
                                                        <span className="font-normal text-[#9ca3af]">
                                                            —
                                                        </span>
                                                    ) : (
                                                        money(amount)
                                                    )}
                                                </td>

                                                <td className="truncate px-5 py-3.5 text-xs text-[#5b6472]">
                                                    {pipelineName(pkg.pipeline_id) ?? (
                                                        <span className="text-[#9ca3af]">—</span>
                                                    )}
                                                </td>

                                                <td className="px-5 py-3.5">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                setExpanded(isOpen ? null : pkg.id)
                                                            }
                                                        >
                                                            {td("Overrides", { source: "en" })}
                                                            {pkg.overrides_count > 0
                                                                ? ` (${pkg.overrides_count})`
                                                                : ""}
                                                        </Button>
                                                        <Button size="sm" onClick={() => openEdit(pkg)}>
                                                            {td("Edit", { source: "en" })}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setConfirming(pkg)}
                                                        >
                                                            {td("Delete", { source: "en" })}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isOpen && (
                                                <tr className="border-b border-[#eef0f3] last:border-b-0">
                                                    <td colSpan={COLUMN_COUNT} className="p-0">
                                                        <AgentOverrides
                                                            pkg={pkg}
                                                            agents={agents}
                                                            overrides={overrides[pkg.id]}
                                                            currencySymbol={currencySymbol}
                                                            onLoad={loadOverrides}
                                                            onSave={saveOverride}
                                                            onRemove={removeOverride}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <PackageFormModal
                open={formOpen}
                pkg={editing}
                pipelines={pipelines}
                stages={stages}
                routingFieldItems={routingFieldItems}
                currencySymbol={currencySymbol}
                currencyCode={currencyCode}
                saving={saving}
                onClose={() => setFormOpen(false)}
                onSubmit={submit}
                onLoadRoutingTriggers={loadRoutingTriggers}
            />

            <ConfirmDialog
                open={confirming !== null}
                title={td("Delete package", { source: "en" })}
                message={td(
                    `"${confirming?.name ?? ""}" will no longer be available on new deals. Deals that already use it keep it, and commissions already earned are untouched.`,
                    { source: "en" },
                )}
                confirmLabel={td("Delete", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                danger
                confirmLoading={saving}
                onConfirm={confirmDelete}
                onCancel={() => setConfirming(null)}
            />
        </PageLayout>
    );
}

PackagesIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
