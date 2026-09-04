import { useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AgentView, { AgentViewProps } from "./views/AgentView";
import ManagerView, { ManagerViewProps } from "./views/ManagerView";
import TeamView, { TeamViewProps } from "./views/TeamView";
import LeadershipView, { LeadershipViewProps } from "./views/LeadershipView";
import PartnerView, { PartnerViewProps } from "./views/PartnerView";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";

type ViewKey = "agent" | "manager" | "team" | "leadership" | "partner";

const VIEW_LABELS: Record<ViewKey, string> = {
    agent: "My work",
    manager: "Team",
    // Not "Team": that is the manager view, one flat level of direct reports.
    // This one walks the whole tree, which is what the business calls a
    // downline.
    team: "Downline",
    leadership: "Company",
    partner: "Partner",
};

/** Windows offered by the period picker. Must match the controller's whitelist. */
const PERIODS = [
    { days: 30, label: "Last 30 days" },
    { days: 90, label: "Last 90 days" },
    { days: 365, label: "Last 12 months" },
];

/** Views whose panels are windowed, and so get the period picker. */
const WINDOWED: ViewKey[] = ["manager", "team"];

/**
 * The deferred panel props all arrive as top-level page props, so the shell
 * carries the union of every view's shape and hands the active one its slice.
 */
type DashboardV2Props = {
    availableViews: ViewKey[];
    activeView: ViewKey;
    period: number;
    now: string;
    personalDashboardEnabled?: boolean;
} & AgentViewProps &
    ManagerViewProps &
    TeamViewProps &
    LeadershipViewProps &
    PartnerViewProps;

/**
 * Shell for the role-scoped dashboards.
 *
 * Which views appear comes from independent view_*_dashboard permissions, so a
 * user holding several (leadership commonly holds agent + leadership) gets a
 * switcher. Switching is a real visit with ?view= rather than client state —
 * only the active view's panels are deferred server-side, so we never pay to
 * compute panels nobody is looking at.
 */
export default function DashboardV2(props: DashboardV2Props) {
    const { availableViews, activeView, period, now, personalDashboardEnabled } = props;
    const { td } = useTd();
    const { auth } = usePage<PageProps>().props;
    const [addLeadOpen, setAddLeadOpen] = useState(false);

    const go = (params: Record<string, string | number>) =>
        router.visit(
            route("dashboard.v2", { view: activeView, days: period, ...params }),
            { preserveScroll: true },
        );

    return (
        <DashboardLayout>
            <Head title={td("Dashboard")} />

            <PageLayout
                breadcrumbs={[{ name: td("Dashboard") }]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    <header
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 18,
                        }}
                    >
                        {personalDashboardEnabled || availableViews.length > 1 ? (
                            <nav className="dv2-tabs" aria-label={td("Dashboard")}>
                                {personalDashboardEnabled && (
                                    <button
                                        type="button"
                                        className="dv2-tab"
                                        onClick={() => go({ view: "personal" })}
                                    >
                                        {td("My work")}
                                    </button>
                                )}
                                {availableViews.map((view) => (
                                    <button
                                        key={view}
                                        type="button"
                                        className="dv2-tab"
                                        aria-current={
                                            view === activeView
                                                ? "page"
                                                : undefined
                                        }
                                        onClick={() => go({ view })}
                                    >
                                        {td(VIEW_LABELS[view])}
                                    </button>
                                ))}
                            </nav>
                        ) : (
                            <h1
                                style={{
                                    margin: 0,
                                    fontSize: 19,
                                    fontWeight: 700,
                                    color: T.NAVY,
                                }}
                            >
                                {td(VIEW_LABELS[activeView])}
                            </h1>
                        )}

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            {activeView === "partner" && (
                                <span className="dr-pill dr-pill-blue">
                                    {td("Your referrals only · no deal values")}
                                </span>
                            )}

                            {WINDOWED.includes(activeView) && (
                                <select
                                    className="dr-input"
                                    aria-label={td("Period")}
                                    value={period}
                                    style={{ minHeight: 38, width: "auto" }}
                                    onChange={(event) =>
                                        go({ days: event.target.value })
                                    }
                                >
                                    {PERIODS.map((option) => (
                                        <option
                                            key={option.days}
                                            value={option.days}
                                        >
                                            {td(option.label)}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {activeView === "agent" && (
                                <>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_HINT,
                                            marginRight: 4,
                                        }}
                                    >
                                        {dayjs(now).format("ddd D MMM · HH:mm")}
                                    </span>
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-primary"
                                        onClick={() => setAddLeadOpen(true)}
                                    >
                                        {td("Add lead")}
                                    </button>
                                </>
                            )}
                        </div>
                    </header>

                    {activeView === "agent" && <AgentView {...props} />}
                    {activeView === "manager" && (
                        <ManagerView {...props} currentUserId={auth?.user?.id} />
                    )}
                    {activeView === "team" && (
                        <TeamView {...props} currentUserId={auth?.user?.id} />
                    )}
                    {activeView === "leadership" && <LeadershipView {...props} />}
                    {activeView === "partner" && <PartnerView {...props} />}

                    {/* SaveLeadModal reloads the keys it's given on success, so
                        the new lead lands in the queue without a page visit. */}
                    {addLeadOpen && (
                        <SaveLeadModal
                            open
                            onClose={() => setAddLeadOpen(false)}
                            reloadKeys={[
                                "actionQueue",
                                "agentWeek",
                                "agentPipeline",
                            ]}
                        />
                    )}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
