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
    contactLogged: boolean;
    isLoggingContact?: boolean;
    onLogContact?: () => void;
    onEditProfile?: () => void;
    onNavigateMeetings: () => void;
    onNavigateTasks: () => void;
    onNavigateDeals: () => void;
}

export default function LeadContextRail({
    lead,
    checks,
    railData,
    contactLogged,
    isLoggingContact,
    onLogContact,
    onEditProfile,
    onNavigateMeetings,
    onNavigateTasks,
    onNavigateDeals,
}: LeadContextRailProps) {
    return (
        <aside className="sticky top-[88px] flex flex-col gap-3 self-start">
            <ContactRailPanel
                lead={lead}
                contactLogged={contactLogged}
                isLoggingContact={isLoggingContact}
                onLogContact={onLogContact}
                onEditProfile={onEditProfile}
            />
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
