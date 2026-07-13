import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import type { LeadQualification } from "@/Types/qualification";
import { LEAD_REDESIGN_TOKENS as T } from "../../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";

const OUTCOME_LABELS: Record<string, string> = {
    bookMeeting: "Book consultation",
    inviteWebinar: "Invite to webinar",
    callback: "Schedule callback",
    noFit: "Not a fit",
};

interface QualificationScriptCompletedProps {
    qualification: LeadQualification;
    onRunAgain: () => void;
    isStarting?: boolean;
}

export default function QualificationScriptCompleted({
    qualification,
    onRunAgain,
    isStarting = false,
}: QualificationScriptCompletedProps) {
    const { td } = useTd();
    const outcomeLabel = qualification.outcome
        ? OUTCOME_LABELS[qualification.outcome] ?? qualification.outcome
        : td("Completed");

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
            }}
        >
            <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                {td("Last run outcome")}:{" "}
                <strong style={{ color: T.TEXT }}>{outcomeLabel}</strong>
            </span>
            <DealButton
                variant="ghost"
                onClick={onRunAgain}
                loading={isStarting}
                disabled={isStarting}
            >
                {td("Run again")}
            </DealButton>
        </div>
    );
}
