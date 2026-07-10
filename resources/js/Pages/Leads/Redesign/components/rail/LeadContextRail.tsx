import type { Lead } from "@/Types/api/leads";
import type { BantChecks } from "../../types";
import type { LeadContextRailData } from "../../types";
import ContactRailPanel from "./ContactRailPanel";
import QualificationRailPanel from "./QualificationRailPanel";
import OpenItemsRailPanel from "./OpenItemsRailPanel";

interface LeadContextRailProps {
    lead: Lead;
    checks: BantChecks;
    railData: LeadContextRailData;
    onNavigateMeetings: () => void;
    onNavigateTasks: () => void;
    onNavigateDeals: () => void;
}

export default function LeadContextRail({
    lead,
    checks,
    railData,
    onNavigateMeetings,
    onNavigateTasks,
    onNavigateDeals,
}: LeadContextRailProps) {
    return (
        <aside className="sticky top-[88px] flex flex-col gap-3 self-start">
            <ContactRailPanel lead={lead} />
            <QualificationRailPanel checks={checks} />
            <OpenItemsRailPanel
                data={railData}
                marketingSource={lead.marketing?.utm_source}
                onNavigateMeetings={onNavigateMeetings}
                onNavigateTasks={onNavigateTasks}
                onNavigateDeals={onNavigateDeals}
            />
        </aside>
    );
}
