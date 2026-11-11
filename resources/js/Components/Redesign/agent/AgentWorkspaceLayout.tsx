import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
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

interface PinnedChrome {
    /** Where a page's pinned bar goes, under the dock's second row. */
    slot: HTMLElement | null;
    /** A page that pins something keeps the whole chrome on screen while it scrolls. */
    setSticky: (sticky: boolean) => void;
}

const PinnedSlot = createContext<PinnedChrome>({ slot: null, setSticky: () => {} });

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
    const [top, setTop] = useState<HTMLElement | null>(null);
    const [pin, setPin] = useState<HTMLElement | null>(null);
    const [sticky, setSticky] = useState(false);
    const pinned = useMemo(() => ({ slot: pin, setSticky }), [pin]);
    useChromeBottom(top, slot);

    return (
        <SecondRowSlot.Provider value={slot}>
            <PinnedSlot.Provider value={pinned}>
            <div className={`agent-ws agent-ws--with-tabs${sticky ? " agent-ws--sticky-chrome" : ""}`}>
                <div className="agent-ws__band" aria-hidden="true" />
                <div className="agent-ws__chrome">
                <header ref={setTop} className="agent-ws__top">
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
                <div ref={setPin} className="agent-ws__pin" />
                </div>
                <main className="agent-ws__main">{children}</main>
                <div className="agent-ws__tabbar">
                    <nav aria-label={t("pages.agent_workspace.dock_label")} className="agent-tabs">
                        <AgentDock active={active} variant="tabs" />
                    </nav>
                </div>
                <SoftphoneDock />
            </div>
            </PinnedSlot.Provider>
        </SecondRowSlot.Provider>
    );
}

/**
 * Publishes where the dock and its second row end, as --agent-chrome-bottom
 * on the root, so a flow opened "under the dock" (qualification, analysis)
 * starts right below them. Measured from the top of the page: those flows
 * scroll the page back up when they open.
 */
function useChromeBottom(top: HTMLElement | null, secondRow: HTMLElement | null): void {
    useLayoutEffect(() => {
        if (!top) return;
        const root = document.documentElement;
        const measure = () => {
            const bottoms = [top, secondRow]
                .filter((el): el is HTMLElement => el !== null && el.offsetHeight > 0)
                .map((el) => el.getBoundingClientRect().bottom + window.scrollY);
            root.style.setProperty("--agent-chrome-bottom", `${Math.round(Math.max(0, ...bottoms))}px`);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(top);
        if (secondRow) {
            observer.observe(secondRow);
            // Pills come and go with the page; the row's size alone may not change.
            const mutations = new MutationObserver(measure);
            mutations.observe(secondRow, { childList: true, subtree: true });
            return () => {
                observer.disconnect();
                mutations.disconnect();
                root.style.removeProperty("--agent-chrome-bottom");
            };
        }
        return () => {
            observer.disconnect();
            root.style.removeProperty("--agent-chrome-bottom");
        };
    }, [top, secondRow]);
}

/** Renders a page's pills (or other second-row controls) under the dock. */
export function AgentSecondRow({ children }: { children: ReactNode }) {
    const slot = useContext(SecondRowSlot);
    return slot ? createPortal(children, slot) : null;
}

/**
 * Pins a page's bar under the dock's second row and keeps the dock, the
 * second row and that bar on screen while the page scrolls (canvas L7-11).
 * Render it with no children to keep the dock sticky while the bar is hidden:
 * the bar sits outside the layout flow, so showing or hiding it never moves
 * the page.
 */
export function AgentPinned({ children }: { children?: ReactNode }) {
    const { slot, setSticky } = useContext(PinnedSlot);
    useLayoutEffect(() => {
        setSticky(true);
        return () => setSticky(false);
    }, [setSticky]);
    return slot && children ? createPortal(children, slot) : null;
}
