import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import useTranslation from "@/Hooks/useTranslation";
import LeadIcon from "../primitives/LeadIcon";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface LeadBreadcrumbRowProps {
    leadName: string;
    isRefreshing: boolean;
    refreshDisabled: boolean;
    onRefresh: () => void;
}

export default function LeadBreadcrumbRow({
    leadName,
    isRefreshing,
    refreshDisabled,
    onRefresh,
}: LeadBreadcrumbRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <div className="flex items-center justify-between px-[26px] pt-5 pb-3">
            <nav className="flex items-center gap-1.5 text-xs text-[#6b7280]">
                <span>{t("app.menu.dashboard")}</span>
                <span>·</span>
                <a
                    href={route("lead-contact.index")}
                    className="hover:text-[#1a6bb5]"
                >
                    {t("pages.leads.contacts")}
                </a>
                <span>·</span>
                <span className="font-medium text-[#1a1f2e]">{leadName}</span>
            </nav>
            <DealButton
                variant="ghost"
                onClick={onRefresh}
                disabled={refreshDisabled || isRefreshing}
            >
                <LeadIcon name="refresh" size={13} />
                {td("Refresh")}
            </DealButton>
        </div>
    );
}
