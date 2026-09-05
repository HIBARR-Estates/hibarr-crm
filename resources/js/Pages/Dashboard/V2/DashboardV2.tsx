import { Head, router, usePage } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import DashboardHeader, {
    HeaderSubtext,
} from "./components/DashboardHeader";
import SegmentedControl from "./personal/SegmentedControl";
import {
    buildSwitcher,
    PERIODS,
    VIEW_SUBTEXT,
    WINDOWED,
    type ViewKey,
} from "./viewConfig";
import { useTd } from "@/Hooks/useDynamicTranslation";
import ManagerView, { ManagerViewProps } from "./views/ManagerView";
import TeamView, { TeamViewProps } from "./views/TeamView";
import LeadershipView, { LeadershipViewProps } from "./views/LeadershipView";
import PartnerView, { PartnerViewProps } from "./views/PartnerView";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";

/**
 * The deferred panel props all arrive as top-level page props, so the shell
 * carries the union of every view's shape and hands the active one its slice.
 */
type DashboardV2Props = {
    availableViews: ViewKey[];
    activeView: ViewKey;
    period: number;
    now: string;
    /** Greeted in the shared header, same as on the personal dashboard. */
    userName: string;
    personalDashboardEnabled?: boolean;
} & ManagerViewProps &
    TeamViewProps &
    LeadershipViewProps &
    PartnerViewProps;

/**
 * Shell for the role-scoped dashboards.
 *
 * Which views appear comes from independent view_*_dashboard permissions, so a
 * user holding several (a manager commonly holds team + downline) gets a
 * switcher. Switching is a real visit with ?view= rather than client state —
 * only the active view's panels are deferred server-side, so we never pay to
 * compute panels nobody is looking at.
 */
export default function DashboardV2(props: DashboardV2Props) {
    const { availableViews, activeView, period, now, userName, personalDashboardEnabled } =
        props;
    const { td } = useTd();
    const { auth } = usePage<PageProps>().props;

    const go = (params: Record<string, string | number>) =>
        router.visit(
            route("dashboard.v2", { view: activeView, days: period, ...params }),
            { preserveScroll: true },
        );

    // Identical to the personal dashboard's, by construction — see
    // buildSwitcher. The switcher must not change shape when you use it.
    const switcher = buildSwitcher(availableViews, !!personalDashboardEnabled);

    return (
        <DashboardLayout>
            <Head title={td("Dashboard")} />

            <PageLayout
                breadcrumbs={[{ name: td("Dashboard") }]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    <DashboardHeader
                        userName={userName}
                        now={now}
                        subtext={
                            <HeaderSubtext>
                                {WINDOWED.includes(activeView)
                                    ? `${VIEW_SUBTEXT[activeView]} Last ${period} days.`
                                    : VIEW_SUBTEXT[activeView]}
                            </HeaderSubtext>
                        }
                        actions={
                            <>
                                {/* One segment is not a switcher. With the
                                    personal dashboard on there are always at
                                    least two, so this only bites for an
                                    account holding exactly one role view. */}
                                {switcher.length > 1 && (
                                    <SegmentedControl
                                        label="Dashboard"
                                        active={activeView}
                                        segments={switcher}
                                        onSelect={(view) =>
                                            view !== activeView && go({ view })
                                        }
                                    />
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
                            </>
                        }
                    />

                    {activeView === "manager" && (
                        <ManagerView {...props} currentUserId={auth?.user?.id} />
                    )}
                    {activeView === "team" && (
                        <TeamView {...props} currentUserId={auth?.user?.id} />
                    )}
                    {activeView === "leadership" && <LeadershipView {...props} />}
                    {activeView === "partner" && <PartnerView {...props} />}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
