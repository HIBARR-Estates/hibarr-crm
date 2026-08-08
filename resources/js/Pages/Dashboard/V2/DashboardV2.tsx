import { Segmented } from "antd";
import { Head, router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AgentView, { AgentViewProps } from "./views/AgentView";
import ManagerView, { ManagerViewProps } from "./views/ManagerView";
import LeadershipView, { LeadershipViewProps } from "./views/LeadershipView";
import PartnerView, { PartnerViewProps } from "./views/PartnerView";

type ViewKey = "agent" | "manager" | "leadership" | "partner";

const VIEW_LABELS: Record<ViewKey, string> = {
    agent: "My work",
    manager: "Team",
    leadership: "Company",
    partner: "Partner",
};

/**
 * The deferred panel props all arrive as top-level page props, so the shell
 * carries the union of every view's shape and hands the active one its slice.
 */
type DashboardV2Props = {
    availableViews: ViewKey[];
    activeView: ViewKey;
} & AgentViewProps &
    ManagerViewProps &
    LeadershipViewProps &
    PartnerViewProps;

/**
 * Shell for the four role-scoped dashboards.
 *
 * Which views appear comes from independent view_*_dashboard permissions, so a
 * user holding several (leadership commonly holds agent + leadership) gets a
 * switcher. Switching is a real visit with ?view= rather than client state —
 * only the active view's panels are deferred server-side, so we never pay to
 * compute panels nobody is looking at.
 */
export default function DashboardV2(props: DashboardV2Props) {
    const { availableViews, activeView } = props;
    const { td } = useTd();

    const switchView = (view: ViewKey) => {
        router.visit(route("dashboard.v2", { view }), {
            preserveScroll: true,
        });
    };

    return (
        <DashboardLayout>
            <Head title={td("Dashboard")} />

            <PageLayout
                title={td("Dashboard")}
                breadcrumbs={[{ name: td("Dashboard") }]}
                config={{ showTitle: true }}
            >
                {availableViews.length > 1 && (
                    <div className="mb-4">
                        <Segmented
                            value={activeView}
                            onChange={(value) => switchView(value as ViewKey)}
                            options={availableViews.map((view) => ({
                                label: td(VIEW_LABELS[view]),
                                value: view,
                            }))}
                        />
                    </div>
                )}

                {activeView === "agent" && <AgentView {...props} />}
                {activeView === "manager" && <ManagerView {...props} />}
                {activeView === "leadership" && <LeadershipView {...props} />}
                {activeView === "partner" && <PartnerView {...props} />}
            </PageLayout>
        </DashboardLayout>
    );
}
