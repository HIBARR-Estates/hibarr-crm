import { useEffect, useMemo, useState } from "react";
import { Deferred } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { AgentNewTag } from "@/Components/Redesign/agent";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import AgentPanel from "./AgentPanel";
import EarningsHeader from "./EarningsHeader";
import { joinedRecently, monthYear } from "./format";
import type { NetworkPayload, NetworkRow } from "./types";

interface NetworkViewProps {
    selfId: number | null;
    currencySymbol: string;
    network?: NetworkPayload;
}

const INDENT = 26;

/** The tabs and the view switch on the band. Only Network is built: the rest have no data behind them yet. */
function NetworkControls() {
    const { t } = useTranslation();

    return (
        <>
            <div className="agent-ea__tabs" role="group" aria-label={t("pages.agent_workspace.earnings.network.tabs.label")}>
                <button type="button" className="agent-ea__tab" aria-pressed="true">
                    {t("pages.agent_workspace.earnings.network.tabs.network")}
                </button>
                <span className="agent-ea__tab agent-ea__tab--held" aria-disabled="true">
                    {t("pages.agent_workspace.earnings.network.tabs.invitations")}
                    <AgentNewTag hint={t("pages.agent_workspace.earnings.held.invitations")} />
                </span>
                <span className="agent-ea__tab agent-ea__tab--held" aria-disabled="true">
                    {t("pages.agent_workspace.earnings.network.tabs.deals")}
                    <AgentNewTag hint={t("pages.agent_workspace.earnings.held.downline_deals")} />
                </span>
            </div>
            <div className="agent-ea__switch" role="group" aria-label={t("pages.agent_workspace.earnings.network.view.label")}>
                <button type="button" aria-pressed="true">
                    {t("pages.agent_workspace.earnings.network.view.list")}
                </button>
                <span aria-disabled="true" className="agent-ea__switch-held">
                    {t("pages.agent_workspace.earnings.network.view.tree")}
                    <AgentNewTag hint={t("pages.agent_workspace.earnings.held.tree")} />
                </span>
            </div>
            <button type="button" className="agent-ea__btn agent-ea__btn--call" disabled>
                + {t("pages.agent_workspace.earnings.network.invite")}
                <AgentNewTag hint={t("pages.agent_workspace.earnings.held.invite")} />
            </button>
        </>
    );
}

function TableSkeleton() {
    return (
        <div className="agent-ea__split agent-ea__split--network" aria-busy="true">
            <div className="agent-ea__table">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="agent-ea__row agent-ea__row--skeleton">
                        <div className="dr-skeleton" style={{ height: 32, borderRadius: 16 }} />
                        <div className="dr-skeleton" style={{ height: 14, borderRadius: 6 }} />
                    </div>
                ))}
            </div>
            <div className="agent-ea__panel dr-skeleton" style={{ minHeight: 320 }} />
        </div>
    );
}

interface BodyProps {
    selfId: number | null;
    currencySymbol: string;
    network: NetworkPayload | undefined;
}

function NetworkBody({ selfId, currencySymbol, network }: BodyProps) {
    const { t, locale } = useTranslation();
    const rows = network?.rows ?? [];
    const below = useMemo(() => rows.filter((row) => row.kind === "downline"), [rows]);
    const [pickedId, setPickedId] = useState<number | null>(null);
    const [nowMs] = useState(() => Date.now());

    // The first agent below you is open until one is picked; it follows the list if the pick is gone.
    useEffect(() => {
        if (pickedId !== null && !below.some((row) => row.id === pickedId)) setPickedId(null);
    }, [below, pickedId]);
    const picked = below.find((row) => row.id === pickedId) ?? below[0] ?? null;

    const subtitle =
        below.length === 0
            ? t("pages.agent_workspace.earnings.network.subtitle_none")
            : t(below.length === 1 ? "pages.agent_workspace.earnings.network.subtitle_one" : "pages.agent_workspace.earnings.network.subtitle", { count: below.length });

    return (
        <>
            <EarningsHeader title={t("pages.agent_workspace.earnings.network.title")} subtitle={subtitle}>
                <NetworkControls />
            </EarningsHeader>

            {below.length === 0 && !rows.some((row) => row.kind === "upline") ? (
                <EmptyState icon="users" title={t("pages.agent_workspace.earnings.network.empty_title")} description={t("pages.agent_workspace.earnings.network.empty_description")} />
            ) : (
                <div className="agent-ea__split agent-ea__split--network">
                    <div role="table" aria-label={t("pages.agent_workspace.earnings.network.table.label")} className="agent-ea__table agent-ea__table--network">
                        <div role="row" className="agent-ea__head">
                            <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.network.table.agent")}</span>
                            <span className="agent-ea__line">
                                <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.network.table.level")}</span>
                                <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.network.table.direct")}</span>
                                <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.network.table.individual")}</span>
                                <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.network.table.team")}</span>
                            </span>
                        </div>
                        {rows.map((row) => (
                            <NetworkLine key={row.id} row={row} selfId={selfId} active={picked?.id === row.id} onPick={setPickedId} nowMs={nowMs} locale={locale} />
                        ))}
                    </div>
                    <AgentPanel agent={picked} currencySymbol={currencySymbol} />
                </div>
            )}
            {network?.truncated ? <p className="agent-ea__note">{t("pages.agent_workspace.earnings.network.truncated")}</p> : null}
        </>
    );
}

interface LineProps {
    row: NetworkRow;
    selfId: number | null;
    active: boolean;
    onPick: (id: number) => void;
    nowMs: number;
    locale: string;
}

function NetworkLine({ row, selfId, active, onPick, nowMs, locale }: LineProps) {
    const { t } = useTranslation();
    const name = row.name?.trim() || t("pages.agent_workspace.earnings.table.unnamed");
    const downline = row.kind === "downline";
    const recent = downline ? joinedRecently(row.joined_at, nowMs, t) : null;
    const sub =
        row.kind === "upline"
            ? t("pages.agent_workspace.earnings.network.role.upline")
            : row.kind === "self" || row.id === selfId
              ? t("pages.agent_workspace.earnings.network.role.you")
              : recent
                ? t("pages.agent_workspace.earnings.network.role.joined", { when: recent })
                : row.joined_at
                  ? t("pages.agent_workspace.earnings.network.role.since", { month: monthYear(row.joined_at, locale) })
                  : t("pages.agent_workspace.earnings.network.role.downline");

    const who = (
        <span className="agent-ea__person" style={{ paddingLeft: row.depth * INDENT }}>
            {downline ? <span className="agent-ea__elbow" aria-hidden="true">└</span> : null}
            <span className={`agent-ea__avatar${downline ? "" : " agent-ea__avatar--ring"}`} style={{ ["--fill" as string]: avatarFill(row.id) }} aria-hidden="true">
                {initialsFromName(name)}
            </span>
            <span className="agent-ea__who">
                <span className="agent-ea__name">{name}</span>
                <span className="agent-ea__sub">{sub}</span>
            </span>
        </span>
    );

    const cells = (
        <span className="agent-ea__line">
            <span role="cell">
                <span className={`agent-ea__level-pill${row.level ? "" : " is-unranked"}`}>{row.level ?? t("pages.agent_workspace.earnings.network.unranked")}</span>
            </span>
            <span role="cell" className="agent-ea__num" data-label={t("pages.agent_workspace.earnings.network.table.direct")}>{row.direct}</span>
            <span role="cell" className="agent-ea__num" data-label={t("pages.agent_workspace.earnings.network.table.individual")}>{row.nsa}</span>
            <span role="cell" className="agent-ea__num" data-label={t("pages.agent_workspace.earnings.network.table.team")}>{row.nsd}</span>
        </span>
    );

    return (
        <div role="row" className={`agent-ea__row${downline ? " agent-ea__row--pick" : ""}${active ? " is-active" : ""}`}>
            <span role="cell">
                {downline ? (
                    <button type="button" className="agent-ea__pickbtn" aria-pressed={active} onClick={() => onPick(row.id)}>
                        {who}
                    </button>
                ) : (
                    who
                )}
            </span>
            {cells}
        </div>
    );
}

/**
 * Network (L7-37): the upline, you and everyone below, with each agent's level
 * and sales; picking an agent below you opens their details beside the list.
 */
export default function NetworkView({ selfId, currencySymbol, network }: NetworkViewProps) {
    const { t } = useTranslation();

    return (
        <Deferred
            data="network"
            fallback={
                <>
                    <EarningsHeader title={t("pages.agent_workspace.earnings.network.title")} subtitle={t("pages.agent_workspace.earnings.network.subtitle_loading")}>
                        <NetworkControls />
                    </EarningsHeader>
                    <TableSkeleton />
                </>
            }
        >
            <NetworkBody selfId={selfId} currencySymbol={currencySymbol} network={network} />
        </Deferred>
    );
}
