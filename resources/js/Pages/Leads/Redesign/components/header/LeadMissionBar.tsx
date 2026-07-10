import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../primitives/LeadIcon";
import type { LeadMission } from "../../types";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";
import { formatPhoneNumber } from "@/lib/utils";

const URGENCY_BG: Record<LeadMission["urgency"], string> = {
    amber: T.GOLD_LIGHT,
    blue: T.BLUE_LIGHT,
    green: T.GREEN_LIGHT,
};

const URGENCY_BORDER: Record<LeadMission["urgency"], string> = {
    amber: "#fbe389",
    blue: T.BLUE_MID,
    green: T.GREEN_MID,
};

const URGENCY_LABEL: Record<LeadMission["urgency"], string> = {
    amber: T.GOLD_TEXT,
    blue: T.BLUE,
    green: T.GREEN,
};

interface LeadMissionBarProps {
    mission: LeadMission;
    leadPhone?: string | null;
    onCta?: () => void;
    ctaLoading?: boolean;
}

export default function LeadMissionBar({
    mission,
    leadPhone,
    onCta,
    ctaLoading = false,
}: LeadMissionBarProps) {
    const showPhone = Boolean(leadPhone) && mission.phase === "contact";
    const phoneDisplay = leadPhone ? formatPhoneNumber(leadPhone) : null;

    return (
        <div
            className="sticky top-0 z-40"
            style={{
                background: URGENCY_BG[mission.urgency],
                borderBottom: `1px solid ${URGENCY_BORDER[mission.urgency]}`,
            }}
        >
            <div
                className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3"
                style={{ flexWrap: "wrap" }}
            >
                <div className="min-w-0">
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: URGENCY_LABEL[mission.urgency],
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: 3,
                        }}
                    >
                        Your next action
                    </div>
                    <div
                        style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: T.NAVY,
                        }}
                    >
                        {mission.headline}
                    </div>
                    <div
                        style={{
                            fontSize: 12.5,
                            color: T.TEXT_MUTED,
                            marginTop: 2,
                        }}
                    >
                        {mission.detail}
                    </div>
                </div>

                <div
                    className="flex shrink-0 items-center gap-2"
                    style={{ gap: 8 }}
                >
                    {showPhone && phoneDisplay && (
                        <a
                            href={`tel:${phoneDisplay.replace(/\D/g, "")}`}
                            className="inline-flex items-center gap-1 no-underline"
                            style={{
                                fontSize: 12,
                                padding: "6px 11px",
                                borderRadius: 6,
                                color: T.TEXT_MUTED,
                                border: `1px solid ${T.BORDER}`,
                                background: "transparent",
                            }}
                        >
                            <LeadIcon
                                name="phone"
                                size={12}
                                color={T.TEXT_MUTED}
                            />
                            {phoneDisplay}
                        </a>
                    )}
                    {mission.cta && onCta && (
                        <DealButton
                            variant="navy"
                            onClick={onCta}
                            loading={ctaLoading}
                            disabled={ctaLoading}
                            style={{
                                fontSize: 13,
                                padding: "8px 14px",
                                fontWeight: 600,
                            }}
                        >
                            {mission.cta}
                        </DealButton>
                    )}
                </div>
            </div>
        </div>
    );
}
