import LeadMarketingTab from "@/Pages/Leads/Components/LeadMarketingTab";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";

export default function MarketingTab() {
    const { lead } = useLeadWorkspace();
    return <LeadMarketingTab lead={lead} />;
}
