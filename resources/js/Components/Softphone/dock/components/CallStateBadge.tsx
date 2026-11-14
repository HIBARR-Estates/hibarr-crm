import React from "react";
import type { SoftphoneCallStage } from "@/lib/softphone/SoftphoneClient";
import { STAGE_LABEL } from "../types";

interface CallStateBadgeProps {
    stage: SoftphoneCallStage;
}

/**
 * Call lifecycle stage badge ("Calling…", "Connecting…", "Connected", "Ringing…").
 */
export default function CallStateBadge({ stage }: CallStateBadgeProps) {
    return (
        <p className="sp__state" data-stage={stage} role="status" aria-live="polite">
            {STAGE_LABEL[stage]}
        </p>
    );
}
