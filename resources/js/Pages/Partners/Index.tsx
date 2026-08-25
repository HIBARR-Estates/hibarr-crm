import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import axios from "axios";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Button,
    Badge,
    Avatar,
    Icon,
    Modal,
    ConfirmDialog,
    EmptyState,
    AgentPicker,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TYPE,
} from "@/Components/Redesign";
import "@/Components/Redesign/redesign.css";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDebounce } from "@/Hooks/useDebounce";

interface PartnerAgent {
    id: number;
    status: "enabled" | "disabled";
    is_partner: boolean;
    referred_leads_count: number;
    user: { id: number; name: string; email: string; image?: string | null } | null;
}

interface Stats {
    total_partners: number;
    total_referred_leads: number;
    converted_referred_leads: number;
}

interface Props {
    pageTitle: string;
    agents: {
        data: PartnerAgent[];
        current_page: number;
        last_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
    filters: { search?: string };
    stats: Stats;
}

function initials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

const StatTile = ({ label, value }: { label: string; value: number }) => (
    <div className="dr-card" style={{ marginBottom: 0, flex: 1 }}>
        <div
            style={{
                fontSize: TYPE.CAPTION,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: T.TEXT_MUTED,
                marginBottom: 6,
            }}
        >
            {label}
        </div>
        <div style={{ fontSize: TYPE.DISPLAY, fontWeight: 700, color: T.TEXT }}>
            {value.toLocaleString()}
        </div>
    </div>
);

const PartnersIndex = ({ pageTitle, agents, filters, stats: initialStats }: Props) => {
    const { td } = useTd();

    const [rows, setRows] = useState<PartnerAgent[]>(agents.data);
    const [stats, setStats] = useState<Stats>(initialStats);
    useEffect(() => setRows(agents.data), [agents.data]);
    useEffect(() => setStats(initialStats), [initialStats]);

    const [search, setSearch] = useState(filters.search ?? "");
    const debouncedSearch = useDebounce(search, 400);
    useEffect(() => {
        if (debouncedSearch === (filters.search ?? "")) return;
        router.get(
            route("partners.index"),
            debouncedSearch ? { search: debouncedSearch } : {},
            { preserveState: true, replace: true },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    const [addOpen, setAddOpen] = useState(false);
    const [addingId, setAddingId] = useState<number | null>(null);
    const existingIds = rows.map((row) => row.id);

    const handleAddPartner = async (agent: { id: number; name: string }) => {
        setAddingId(agent.id);
        try {
            const response = await axios.post(route("partners.store"), {
                agent_id: agent.id,
            });
            const newAgent = response.data.agent as PartnerAgent;
            setRows((prev) => [newAgent, ...prev]);
            setStats((prev) => ({ ...prev, total_partners: prev.total_partners + 1 }));
            setAddOpen(false);
        } catch {
            message.error(td("Something went wrong. Please try again.", { source: "en" }));
        } finally {
            setAddingId(null);
        }
    };

    const [removeTarget, setRemoveTarget] = useState<PartnerAgent | null>(null);
    const [removing, setRemoving] = useState(false);

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await axios.delete(route("partners.destroy", removeTarget.id));
            setRows((prev) => prev.filter((row) => row.id !== removeTarget.id));
            setStats((prev) => ({
                ...prev,
                total_partners: Math.max(0, prev.total_partners - 1),
            }));
            setRemoveTarget(null);
        } catch {
            message.error(td("Something went wrong. Please try again.", { source: "en" }));
        } finally {
            setRemoving(false);
        }
    };

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: td("Partners", { source: "en" }) }]}>
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                    <StatTile
                        label={td("Total Partners", { source: "en" })}
                        value={stats.total_partners}
                    />
                    <StatTile
                        label={td("Leads Referred", { source: "en" })}
                        value={stats.total_referred_leads}
                    />
                    <StatTile
                        label={td("Converted (Won) Referrals", { source: "en" })}
                        value={stats.converted_referred_leads}
                    />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input
                        className="dr-input sm:max-w-xs"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={td("Search partners…", { source: "en" })}
                        aria-label={td("Search partners", { source: "en" })}
                    />
                    <Button
                        variant="primary"
                        icon={<Icon name="plus" size={12} />}
                        onClick={() => setAddOpen(true)}
                    >
                        {td("Add Partner", { source: "en" })}
                    </Button>
                </div>

                {rows.length === 0 ? (
                    <EmptyState
                        title={td("No partners yet", { source: "en" })}
                        description={td(
                            "Add an existing agent as a partner to start routing referrals to them.",
                            { source: "en" },
                        )}
                    />
                ) : (
                    <div>
                        {rows.map((agent) => (
                            <div
                                key={agent.id}
                                className="dr-card flex items-center gap-3"
                            >
                                <Avatar
                                    type="agent"
                                    size={32}
                                    src={agent.user?.image}
                                    initials={initials(agent.user?.name ?? "?")}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                        className="truncate"
                                        style={{ fontSize: TYPE.BODY_LG, fontWeight: 600, color: T.TEXT }}
                                    >
                                        {agent.user?.name ?? "—"}
                                    </div>
                                    <div
                                        className="truncate"
                                        style={{ fontSize: TYPE.CAPTION, color: T.TEXT_MUTED }}
                                    >
                                        {agent.user?.email}
                                    </div>
                                </div>
                                <Badge variant={agent.status === "enabled" ? "green" : "gray"}>
                                    {agent.status === "enabled"
                                        ? td("Enabled", { source: "en" })
                                        : td("Disabled", { source: "en" })}
                                </Badge>
                                <Badge variant="blue">
                                    {td(":count leads referred", { source: "en" }).replace(
                                        ":count",
                                        String(agent.referred_leads_count),
                                    )}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon name="trash" size={12} />}
                                    onClick={() => setRemoveTarget(agent)}
                                >
                                    {td("Remove", { source: "en" })}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {agents.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: TYPE.CAPTION, color: T.TEXT_MUTED }}>
                            {agents.from}–{agents.to} {td("of", { source: "en" })} {agents.total}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={agents.current_page <= 1}
                                onClick={() =>
                                    router.get(
                                        route("partners.index"),
                                        { ...filters, page: agents.current_page - 1 },
                                        { preserveState: true },
                                    )
                                }
                            >
                                {td("Previous", { source: "en" })}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={agents.current_page >= agents.last_page}
                                onClick={() =>
                                    router.get(
                                        route("partners.index"),
                                        { ...filters, page: agents.current_page + 1 },
                                        { preserveState: true },
                                    )
                                }
                            >
                                {td("Next", { source: "en" })}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={addOpen}
                title={td("Add partner", { source: "en" })}
                subtitle={td("Search for an existing agent to flag as a partner.", {
                    source: "en",
                })}
                onClose={() => setAddOpen(false)}
            >
                <AgentPicker
                    exclude={existingIds}
                    excludePartners
                    onPick={handleAddPartner}
                    pendingId={addingId}
                    autoFocus
                    searchPlaceholder={td("Search agents…", { source: "en" })}
                    emptyLabel={td("No agents match", { source: "en" })}
                />
            </Modal>

            <ConfirmDialog
                open={removeTarget !== null}
                title={td("Remove partner?", { source: "en" })}
                message={td(
                    `${removeTarget?.user?.name ?? ""} will no longer be selectable as a lead referrer. Existing referred leads keep their attribution.`,
                    { source: "en" },
                )}
                confirmLabel={td("Remove", { source: "en" })}
                danger
                confirmLoading={removing}
                onConfirm={handleRemove}
                onCancel={() => setRemoveTarget(null)}
            />
        </PageLayout>
    );
};

PartnersIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default PartnersIndex;
