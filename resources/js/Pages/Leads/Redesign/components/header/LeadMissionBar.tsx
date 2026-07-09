import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../primitives/LeadIcon";
import type { LeadMission } from "../../types";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";

const URGENCY_BG: Record<LeadMission["urgency"], string> = {
    amber: T.GOLD_LIGHT,
    blue: T.BLUE_LIGHT,
    green: T.GREEN_LIGHT,
};

interface LeadMissionBarProps {
    mission: LeadMission;
    leadPhone?: string | null;
    onCta?: () => void;
}

export default function LeadMissionBar({
    mission,
    leadPhone,
    onCta,
}: LeadMissionBarProps) {
    return (
        <div
            className="sticky top-0 z-40 border-b border-[#e2e5ea] px-[26px] py-3"
            style={{ backgroundColor: URGENCY_BG[mission.urgency] }}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <LeadIcon name="target" size={15} color={T.BLUE} />
                        <h2 className="text-sm font-semibold text-[#1a1f2e]">
                            {mission.headline}
                        </h2>
                    </div>
                    <p className="mt-1 text-xs text-[#6b7280]">{mission.detail}</p>
                    {leadPhone && mission.phase === "contact" && (
                        <a
                            href={`tel:${leadPhone}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1a6bb5]"
                        >
                            <LeadIcon name="phone" size={12} color={T.BLUE} />
                            {leadPhone}
                        </a>
                    )}
                </div>
                {mission.cta && onCta && (
                    <DealButton variant="primary" onClick={onCta}>
                        {mission.cta}
                    </DealButton>
                )}
            </div>
        </div>
    );
}
