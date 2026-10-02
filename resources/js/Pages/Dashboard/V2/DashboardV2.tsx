import { useMemo, useRef } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import ProductTour, {
    type ProductTourHandle,
} from "@/Components/ProductTour/ProductTour";
import useTranslation from "@/Hooks/useTranslation";
import DashboardHeader, {
    HeaderSubtext,
} from "./components/DashboardHeader";
import SegmentedControl from "./personal/SegmentedControl";
import DateRangePicker from "./components/DateRangePicker";
import {
    buildSwitcher,
    localizeSwitcherSegments,
    WINDOWED,
    windowLabel,
    windowParams,
    type DashboardRange,
    type ViewKey,
} from "./viewConfig";
import { useTd } from "@/Hooks/useDynamicTranslation";
import ManagerView, { ManagerViewProps } from "./views/ManagerView";
import TeamView, { TeamViewProps } from "./views/TeamView";
import LeadershipView, { LeadershipViewProps } from "./views/LeadershipView";
import PartnerView, { PartnerViewProps } from "./views/PartnerView";
import {
    buildTeamDashboardTourSteps,
    TEAM_DASHBOARD_TOUR_ID,
    TEAM_DASHBOARD_TOUR_LABELS,
} from "./config/teamDashboardTourSteps";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";

/**
 * The deferred panel props all arrive as top-level page props, so the shell
 * carries the union of every view's shape and hands the active one its slice.
 */
type DashboardV2Props = {
    availableViews: ViewKey[];
    activeView: ViewKey;
    /** The window, as the server resolved it — preset or custom. */
    range: DashboardRange;
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
    const { availableViews, activeView, range, now, userName, personalDashboardEnabled } =
        props;
    const { td } = useTd();
    const { t } = useTranslation();
    const { auth, featureFlags } = usePage<PageProps>().props;
    const showTeamTour =
        activeView === "team" &&
        featureFlags?.["crm.team-dashboard"] === true;
    const teamTourRef = useRef<ProductTourHandle>(null);
    const teamTourSteps = useMemo(() => buildTeamDashboardTourSteps(), []);

    // The current window travels with every visit so switching views keeps it.
    // A named/rolling preset and a custom range use different query keys —
    // sending both would let the server pick the wrong one.
    const currentWindow = windowParams(range);

    const go = (params: Record<string, string | number>) =>
        router.visit(
            route("dashboard.v2", {
                view: activeView,
                ...currentWindow,
                ...params,
            }),
            { preserveScroll: true },
        );

    // Identical to the personal dashboard's, by construction — see
    // buildSwitcher. The switcher must not change shape when you use it.
    const switcher = useMemo(
        () =>
            localizeSwitcherSegments(
                buildSwitcher(availableViews, !!personalDashboardEnabled),
                t,
            ),
        [availableViews, personalDashboardEnabled, t],
    );

    return (
        <DashboardLayout>
            <Head title={t("pages.dashboard.personal.title")} />

            <PageLayout
                breadcrumbs={[
                    { name: t("pages.dashboard.personal.title") },
                ]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    {showTeamTour && (
                        <ProductTour
                            ref={teamTourRef}
                            tourId={TEAM_DASHBOARD_TOUR_ID}
                            steps={teamTourSteps}
                            labels={TEAM_DASHBOARD_TOUR_LABELS}
                        />
                    )}

                    <DashboardHeader
                        userName={userName}
                        now={now}
                        subtext={
                            <HeaderSubtext localize={false}>
                                {WINDOWED.includes(activeView)
                                    ? `${t(`pages.dashboard.views.subtext.${activeView}`)} ${windowLabel(range, t)}`
                                    : t(
                                          `pages.dashboard.views.subtext.${activeView}`,
                                      )}
                            </HeaderSubtext>
                        }
                        actions={
                            <>
                                {showTeamTour && (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost"
                                        onClick={() =>
                                            teamTourRef.current?.restart()
                                        }
                                    >
                                        {t(
                                            "pages.dashboard.tour.replay_menu_item",
                                        )}
                                    </button>
                                )}
                                {/* One segment is not a switcher. With the
                                    personal dashboard on there are always at
                                    least two, so this only bites for an
                                    account holding exactly one role view. */}
                                {switcher.length > 1 && (
                                    <SegmentedControl
                                        label={t(
                                            "pages.dashboard.views.switcher_aria",
                                        )}
                                        localize={false}
                                        active={activeView}
                                        segments={switcher}
                                        onSelect={(view) =>
                                            view !== activeView && go({ view })
                                        }
                                    />
                                )}

                                {WINDOWED.includes(activeView) && (
                                    <DateRangePicker
                                        value={range}
                                        // A new window replaces the old one
                                        // rather than merging with it, so a
                                        // preset never leaves stale from/to
                                        // behind (and vice versa).
                                        onChange={(params) =>
                                            router.visit(
                                                route("dashboard.v2", {
                                                    view: activeView,
                                                    ...params,
                                                }),
                                                { preserveScroll: true },
                                            )
                                        }
                                    />
                                )}
                            </>
                        }
                    />

                    {activeView === "manager" && (
                        <ManagerView
                            {...props}
                            period={range.days}
                            from={range.from}
                            to={range.to}
                            currentUserId={auth?.user?.id}
                        />
                    )}
                    {activeView === "team" && (
                        <TeamView {...props} period={range.days} />
                    )}
                    {activeView === "leadership" && <LeadershipView {...props} />}
                    {activeView === "partner" && <PartnerView {...props} />}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
