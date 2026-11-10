import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import NotificationDropdown from "@/Components/NotificationDropdown";
import SoftphoneDock from "@/Components/Softphone/SoftphoneDock";
import "../redesign.css";
import "./agent-workspace.css";
import AgentAccountMenu from "./AgentAccountMenu";
import AgentDock from "./AgentDock";
import AgentDockSearch from "./AgentDockSearch";
import AgentSoftphonePill from "./AgentSoftphonePill";
import AgentViewSwitch from "./AgentViewSwitch";
import useTranslation from "@/Hooks/useTranslation";
import { activeDestinationKey } from "./destinations";

const SecondRowSlot = createContext<HTMLElement | null>(null);

/**
 * The agent workspace shell: navy band, floating dock (bottom tab bar on
 * phones), Agent | Classic switch, bell and account menu.
 *
 * Pages set it as a persistent Inertia layout
 * (`Page.layout = (page) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>`),
 * so the chrome, an open menu and a live call survive every navigation and
 * only the page body swaps. A page puts its own pills under the dock with
 * <AgentSecondRow>.
 */
export default function AgentWorkspaceLayout({ children }: { children: ReactNode }) {
    const { props, url } = usePage<PageProps>();
    const user = props.auth?.user as { name?: string; image_url?: string | null } | undefined;
    const appName = (props.appName as string | undefined) ?? "";
    const active = activeDestinationKey(url);
    const [slot, setSlot] = useState<HTMLElement | null>(null);
    const { t } = useTranslation();

    return (
        <SecondRowSlot.Provider value={slot}>
            <div className="agent-ws agent-ws--with-tabs">
                <div className="agent-ws__band" aria-hidden="true" />
                <header className="agent-ws__top">
                    <div className="agent-ws__corner">
                        <span className="agent-ws__brand" aria-hidden="true">
                            {appName.charAt(0) || "H"}
                        </span>
                        <AgentViewSwitch current="agent" tone="band" />
                    </div>
                    <div className="agent-ws__dock-wrap">
                        <nav aria-label={t("pages.agent_workspace.dock_label")} className="agent-dock">
                            <AgentDock active={active} variant="dock" />
                            <span className="agent-dock__divider" aria-hidden="true" />
                            <AgentDockSearch />
                            <AgentSoftphonePill />
                        </nav>
                    </div>
                    <div className="agent-ws__actions">
                        <div className="agent-ws__bell">
                            <NotificationDropdown pollingInterval={30000} />
                        </div>
                        <AgentAccountMenu name={user?.name ?? ""} image={user?.image_url} />
                    </div>
                </header>
                <div ref={setSlot} className="agent-ws__second-row" />
                <main className="agent-ws__main">{children}</main>
                <div className="agent-ws__tabbar">
                    <nav aria-label={t("pages.agent_workspace.dock_label")} className="agent-tabs">
                        <AgentDock active={active} variant="tabs" />
                    </nav>
                </div>
                <SoftphoneDock />
            </div>
        </SecondRowSlot.Provider>
    );
}

/** Renders a page's pills (or other second-row controls) under the dock. */
export function AgentSecondRow({ children }: { children: ReactNode }) {
    const slot = useContext(SecondRowSlot);
    return slot ? createPortal(children, slot) : null;
}
