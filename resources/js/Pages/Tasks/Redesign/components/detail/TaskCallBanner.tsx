import { useState } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import QualifyLaunchModal from "@/Pages/Leads/Redesign/components/qualification/QualifyLaunchModal";
import { TASK_ICON } from "../../config/taskDesignTokens";
import type { Lead } from "@/Types/api/leads";
import type { Task } from "@/Types/Task";
import useTaskLeadCall from "../../hooks/useTaskLeadCall";
import { TaskGlyph } from "../primitives/TaskGlyphs";

interface TaskCallBannerProps {
    task: Task;
}

/**
 * Call banner at the top of the task detail modal — the prominent form of the
 * category quick-action, for tasks in a call category.
 *
 * Replaces the small action button that used to sit in the meta row, keeping
 * both of that button's options: "Call now" dials the lead, "Qualification"
 * opens the script over this modal and dials with it (the same behaviour as the
 * list row's menu item). The interaction states (hover / focus / disabled /
 * loading) live in tasks-redesign.css (`.task-call-banner`), which resolves them
 * from the CRM design tokens rather than hardcoded colours.
 */
export default function TaskCallBanner({ task }: TaskCallBannerProps) {
    const { td } = useTd();
    const { lead, source, dealName, phone, calling, startCall } =
        useTaskLeadCall(task);
    const [qualifyLead, setQualifyLead] = useState<Lead | null>(null);

    // Only a call category gets the banner; every other action (or no action)
    // renders nothing here.
    if (task.category?.action !== "call") return null;

    const leadName = lead?.client_name ?? td("Lead", { source: "en" });
    const canCall = Boolean(phone);

    // The script only needs the lead, so this stays available even when there
    // is no phone number to dial.
    const startQualification = () => {
        if (!lead || calling) return;
        setQualifyLead({
            id: lead.id,
            client_name: lead.client_name ?? "",
            mobile: lead.mobile ?? undefined,
            client_email: lead.client_email ?? undefined,
        });
        void startCall();
    };

    return (
        <div
            className="task-call-banner"
            role="group"
            aria-label={td(`Call ${leadName}`, { source: "en" })}
        >
            <span className="task-call-banner__icon" aria-hidden="true">
                <TaskGlyph d={TASK_ICON.phone} size={19} strokeWidth={1.7} />
            </span>

            <div className="task-call-banner__text">
                <div
                    className="task-call-banner__title"
                    title={leadName}
                    style={{ color: T.NAVY }}
                >
                    {td(`Call ${leadName}`, { source: "en" })}
                </div>
                <div
                    className="task-call-banner__sub"
                    style={{ color: canCall ? T.TEXT_MUTED : T.TEXT_HINT }}
                >
                    {!lead
                        ? td("This task is not linked to a lead")
                        : !canCall
                          ? td("No phone number on this lead")
                          : calling
                            ? td("Connecting…")
                            // Name the deal when the lead came through one —
                            // otherwise "Call Junior Prtu" on a deal task looks
                            // unexplained.
                            : source === "deal" && dealName}
                </div>
            </div>

            <div className="task-call-banner__actions">
                <button
                    type="button"
                    className="task-call-banner__btn task-call-banner__btn--secondary"
                    onClick={startQualification}
                    disabled={!lead || calling}
                >
                    <TaskGlyph d={TASK_ICON.play} size={15} strokeWidth={1.9} />
                    {td("Qualification", { source: "en" })}
                </button>
                <button
                    type="button"
                    className="task-call-banner__btn"
                    onClick={() => void startCall()}
                    disabled={!canCall || calling}
                    aria-busy={calling || undefined}
                >
                    {calling ? (
                        <span className="task-call-banner__spinner" aria-hidden="true" />
                    ) : (
                        <TaskGlyph d={TASK_ICON.phone} size={15} strokeWidth={1.9} />
                    )}
                    {td("Call now", { source: "en" })}
                </button>
            </div>

            {qualifyLead && (
                <QualifyLaunchModal
                    open
                    lead={qualifyLead}
                    onClose={() => setQualifyLead(null)}
                />
            )}
        </div>
    );
}