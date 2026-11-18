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
    initialsFromName,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TYPE,
} from "@/Components/Redesign";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useDebounce } from "@/Hooks/useDebounce";
import usePartnerKeycloakProvisionFlag from "@/Hooks/usePartnerKeycloakProvisionFlag";

type InviteStatus = "invited" | "accepted" | "failed";

interface PartnerAgent {
    id: number;
    status: "enabled" | "disabled";
    is_partner: boolean;
    referred_leads_count: number;
    /** True for an account made through Invite Partner, which can be re-invited. */
    can_resend?: boolean;
    partner_invite_status?: InviteStatus | null;
    user: { id: number; name: string; email: string; image?: string | null; partner_invite_version?: number | null } | null;
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

/**
 * One column template for the header and every row, so labels sit over the
 * cells they describe whatever a row contains. The fixed columns need ~612px
 * plus a usable name column, so the grid starts at xl (with the sidebar open);
 * below that the row wraps.
 */
const ROW_GRID = "xl:grid xl:grid-cols-[32px_minmax(0,1fr)_88px_92px_120px_220px] xl:gap-3";

/** True when `incoming` carries an older version of the user than `current`. */
const isOlder = (incoming: PartnerAgent, current: PartnerAgent): boolean => {
    const a = incoming.user?.partner_invite_version;
    const b = current.user?.partner_invite_version;
    if (a == null || b == null) return false;
    return a < b;
};

const inviteBadgeVariant = (status: InviteStatus): "amber" | "green" | "red" => {
    if (status === "accepted") return "green";
    if (status === "failed") return "red";
    return "amber";
};

const PartnersIndex = ({ pageTitle, agents, filters, stats: initialStats }: Props) => {
    const { t } = useTranslation();
    const provisioning = usePartnerKeycloakProvisionFlag();

    const [rows, setRows] = useState<PartnerAgent[]>(agents.data);
    const [stats, setStats] = useState<Stats>(initialStats);
    // A roster from the server replaces the rows, but a row already on screen
    // keeps its newer invite state if this (slower) roster read it earlier.
    useEffect(() => {
        setRows((prev) =>
            agents.data.map((incoming) => {
                const current = prev.find((row) => row.id === incoming.id);
                return current && isOlder(incoming, current) ? current : incoming;
            }),
        );
    }, [agents.data]);
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
            // A refused change (e.g. another change in progress) comes back as
            // HTTP 200 with status "fail": show it, don't touch the roster.
            if (response.data?.status !== "success") {
                message.error(response.data?.message || t("pages.partners.error_generic"));
                return;
            }
            const newAgent = response.data.agent as PartnerAgent;
            setRows((prev) => [newAgent, ...prev]);
            setStats((prev) => ({ ...prev, total_partners: prev.total_partners + 1 }));
            setAddOpen(false);
        } catch {
            message.error(t("pages.partners.error_generic"));
        } finally {
            setAddingId(null);
        }
    };

    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: "", email: "", mobile: "" });
    const [inviteError, setInviteError] = useState<string | null>(null);

    const closeInvite = () => {
        setInviteOpen(false);
        setInviteError(null);
        setInviteForm({ name: "", email: "", mobile: "" });
    };

    const handleInvite = async () => {
        setInviting(true);
        setInviteError(null);
        try {
            const response = await axios.post(route("partners.invite"), inviteForm);
            const newAgent = response.data.agent as PartnerAgent;
            setRows((prev) => [newAgent, ...prev]);
            setStats((prev) => ({ ...prev, total_partners: prev.total_partners + 1 }));
            closeInvite();
            if (response.data.invite_sent === false) {
                message.warning(response.data.message);
            } else {
                message.success(t("pages.partners.invite_sent"));
            }
        } catch (error: any) {
            const errors = error?.response?.data?.errors;
            setInviteError(
                (errors && (Object.values(errors).flat()[0] as string)) ||
                    t("pages.partners.error_generic"),
            );
        } finally {
            setInviting(false);
        }
    };

    const [resendingId, setResendingId] = useState<number | null>(null);

    const handleResend = async (agent: PartnerAgent) => {
        setResendingId(agent.id);
        try {
            const { data } = await axios.post(route("partners.resend_invite", agent.id));
            // The server reports a failed resend in the body (HTTP 200), and the
            // invite status may have changed either way: patch the row from it,
            // unless the row on screen is already newer (compared by the user's
            // partner_invite_version, which every status change increments).
            if (data?.agent) {
                const updated = data.agent as PartnerAgent;
                setRows((prev) =>
                    prev.map((row) => (row.id === updated.id && !isOlder(updated, row) ? updated : row)),
                );
            }
            if (data?.status !== "success") {
                message.error(data?.message || t("pages.partners.error_generic"));
                return;
            }
            message.success(t("pages.partners.invite_sent"));
        } catch (error: any) {
            message.error(error?.response?.data?.message || t("pages.partners.error_generic"));
        } finally {
            setResendingId(null);
        }
    };

    const [removeTarget, setRemoveTarget] = useState<PartnerAgent | null>(null);
    const [removing, setRemoving] = useState(false);

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            const { data } = await axios.delete(route("partners.destroy", removeTarget.id));
            // Same as above: a "fail" body means nothing was removed.
            if (data?.status !== "success") {
                message.error(data?.message || t("pages.partners.error_generic"));
                return;
            }
            setRows((prev) => prev.filter((row) => row.id !== removeTarget.id));
            setStats((prev) => ({
                ...prev,
                total_partners: Math.max(0, prev.total_partners - 1),
            }));
            setRemoveTarget(null);
        } catch {
            message.error(t("pages.partners.error_generic"));
        } finally {
            setRemoving(false);
        }
    };

    const inviteStatusLabel = (status: InviteStatus) => {
        if (status === "accepted") return t("pages.partners.invite_accepted");
        if (status === "failed") return t("pages.partners.invite_failed");
        return t("pages.partners.invite_pending");
    };

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: t("pages.partners.title") }]}>
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                    <StatTile
                        label={t("pages.partners.stat_total")}
                        value={stats.total_partners}
                    />
                    <StatTile
                        label={t("pages.partners.stat_referred")}
                        value={stats.total_referred_leads}
                    />
                    <StatTile
                        label={t("pages.partners.stat_converted")}
                        value={stats.converted_referred_leads}
                    />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input
                        className="dr-input sm:max-w-xs"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("pages.partners.search_placeholder")}
                        aria-label={t("pages.partners.search_label")}
                    />
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() => setInviteOpen(true)}
                        >
                            {t("pages.partners.invite")}
                        </Button>
                        <Button
                            variant="primary"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() => setAddOpen(true)}
                        >
                            {t("pages.partners.add")}
                        </Button>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <EmptyState
                        title={t("pages.partners.empty_title")}
                        description={t("pages.partners.empty_description")}
                    />
                ) : (
                    <div>
                        <div
                            className={`mb-2 hidden items-center px-4 ${ROW_GRID}`}
                            style={{ fontSize: TYPE.CAPTION, fontWeight: 600, color: T.TEXT_MUTED, letterSpacing: 0.3 }}
                        >
                            <div />
                            <div>{t("pages.partners.col_partner")}</div>
                            <div>{t("pages.partners.col_account")}</div>
                            <div>{t("pages.partners.col_invite")}</div>
                            <div>{t("pages.partners.col_referrals")}</div>
                            <div className="text-right">{t("pages.partners.col_actions")}</div>
                        </div>
                        {rows.map((agent) => (
                            <div
                                key={agent.id}
                                className={`dr-card flex flex-wrap items-center gap-3 ${ROW_GRID}`}
                            >
                                <Avatar
                                    type="agent"
                                    size={32}
                                    src={agent.user?.image}
                                    initials={initialsFromName(agent.user?.name)}
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
                                <div>
                                    <Badge variant={agent.status === "enabled" ? "green" : "gray"}>
                                        {agent.status === "enabled"
                                            ? t("pages.partners.enabled")
                                            : t("pages.partners.disabled")}
                                    </Badge>
                                </div>
                                <div>
                                    {agent.partner_invite_status && (
                                        <Badge variant={inviteBadgeVariant(agent.partner_invite_status)}>
                                            {inviteStatusLabel(agent.partner_invite_status)}
                                        </Badge>
                                    )}
                                </div>
                                <div>
                                    <Badge variant="blue">
                                        {t("pages.partners.leads_referred", {
                                            count: agent.referred_leads_count,
                                        })}
                                    </Badge>
                                </div>
                                <div className="ml-auto flex shrink-0 gap-2 xl:ml-0 xl:justify-end">
                                    {agent.can_resend && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<Icon name="mail" size={12} />}
                                            loading={resendingId === agent.id}
                                            onClick={() => handleResend(agent)}
                                        >
                                            {t("pages.partners.resend")}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="trash" size={12} />}
                                        onClick={() => setRemoveTarget(agent)}
                                    >
                                        {t("pages.partners.remove")}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {agents.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: TYPE.CAPTION, color: T.TEXT_MUTED }}>
                            {agents.from}–{agents.to} {t("pages.partners.of")} {agents.total}
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
                                {t("pages.partners.previous")}
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
                                {t("pages.partners.next")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={addOpen}
                title={t("pages.partners.add_title")}
                subtitle={t("pages.partners.add_subtitle")}
                onClose={() => setAddOpen(false)}
            >
                <AgentPicker
                    exclude={existingIds}
                    excludePartners
                    onPick={handleAddPartner}
                    pendingId={addingId}
                    autoFocus
                    searchPlaceholder={t("pages.partners.search_agents")}
                    emptyLabel={t("pages.partners.no_agents")}
                />
            </Modal>

            <Modal
                open={inviteOpen}
                title={t("pages.partners.invite_title")}
                subtitle={t(
                    provisioning
                        ? "pages.partners.invite_subtitle_provisioned"
                        : "pages.partners.invite_subtitle",
                )}
                onClose={closeInvite}
            >
                <div className="flex flex-col gap-3">
                    <input
                        className="dr-input"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                        placeholder={t("pages.partners.full_name")}
                        aria-label={t("pages.partners.full_name")}
                        autoFocus
                    />
                    <input
                        className="dr-input"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        placeholder={t("pages.partners.email")}
                        aria-label={t("pages.partners.email")}
                    />
                    <input
                        className="dr-input"
                        value={inviteForm.mobile}
                        onChange={(e) => setInviteForm({ ...inviteForm, mobile: e.target.value })}
                        placeholder={t("pages.partners.mobile")}
                        aria-label={t("pages.partners.mobile")}
                    />
                    {inviteError && (
                        <div role="alert" style={{ fontSize: TYPE.CAPTION, color: T.RED }}>
                            {inviteError}
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={closeInvite}>
                            {t("pages.partners.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            loading={inviting}
                            disabled={!inviteForm.name.trim() || !inviteForm.email.trim()}
                            onClick={handleInvite}
                        >
                            {t("pages.partners.send_invite")}
                        </Button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={removeTarget !== null}
                title={t("pages.partners.remove_title")}
                message={t("pages.partners.remove_message", {
                    name: removeTarget?.user?.name ?? "",
                })}
                confirmLabel={t("pages.partners.remove")}
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
