import { useEffect, useState } from "react";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import AgentPanel from "./AgentPanel";
import type { NetworkRow } from "./types";

interface AgentSheetProps {
    agent: NetworkRow | null;
    currencySymbol: string;
}

/**
 * The tree's details on a phone (L9-C phone): a sheet above the tab bar with
 * the picked agent's name and three numbers. Details opens the full panel in
 * the sheet; the numbers come from the tree, so the sheet never waits.
 */
export default function AgentSheet({ agent, currencySymbol }: AgentSheetProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    // A new pick shows its summary first.
    useEffect(() => setOpen(false), [agent?.id]);

    if (!agent) return null;

    const name = agent.name?.trim() || t("pages.agent_workspace.earnings.table.unnamed");
    const level = agent.level ?? t("pages.agent_workspace.earnings.network.unranked");
    const sub = t(agent.generation === 1 ? "pages.agent_workspace.earnings.network.tree.sheet_sub_direct" : "pages.agent_workspace.earnings.network.tree.sheet_sub", { level });

    return (
        <div className={`agent-ea-sheet${open ? " is-open" : ""}`} role="region" aria-label={t("pages.agent_workspace.earnings.network.panel.label", { name })}>
            <span className="agent-ea-sheet__grip" aria-hidden="true" />
            <div className="agent-ea-sheet__head">
                <span className="agent-ea__avatar agent-ea__avatar--lg" style={{ ["--fill" as string]: avatarFill(agent.id) }} aria-hidden="true">
                    {initialsFromName(name)}
                </span>
                <span className="agent-ea__who">
                    <b className="agent-ea__panel-name">{name}</b>
                    <span className="agent-ea__sub">{sub}</span>
                </span>
                <button type="button" className="agent-ea-tree__btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
                    {open ? t("pages.agent_workspace.earnings.network.tree.sheet_close") : t("pages.agent_workspace.earnings.network.tree.sheet_details")}
                </button>
            </div>
            {open ? (
                <div className="agent-ea-sheet__body">
                    <AgentPanel agent={agent} currencySymbol={currencySymbol} variant="sheet" />
                </div>
            ) : (
                <div className="agent-ea-sheet__nums">
                    <span>
                        <b>{agent.direct}</b>
                        {t("pages.agent_workspace.earnings.network.table.direct")}
                    </span>
                    <span>
                        <b>{agent.nsa}</b>
                        {t("pages.agent_workspace.earnings.network.table.individual")}
                    </span>
                    <span>
                        <b>{agent.nsd}</b>
                        {t("pages.agent_workspace.earnings.network.table.team")}
                    </span>
                </div>
            )}
        </div>
    );
}
