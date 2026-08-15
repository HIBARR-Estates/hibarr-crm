import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import type { Lead } from "@/Types/api/leads";
import AddTaskModal from "@/Components/Redesign/modals/AddTaskModal";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import { buildEmptyMeetingForm } from "@/Components/Redesign/meeting/meetingFormUtils";
import useLeadTaskCreate from "@/Pages/Leads/Redesign/hooks/useLeadTaskCreate";
import useLeadIndexMeetingCreate from "./useLeadIndexMeetingCreate";
import ScheduleNextStepModal from "./ScheduleNextStepModal";

type Step = "choose" | "task" | "meeting";

interface MeetingTypeOption {
    id: number;
    name: string;
    color?: string;
}

interface ScheduleNextStepFlowProps {
    /** The lead being scheduled for; null/undefined hides every modal. */
    lead: Lead | null;
    onClose: () => void;
    meetingTypes: MeetingTypeOption[];
}

/**
 * Owns the "choose task or meeting, then fill it in" flow for the Leads
 * index Next Action column. Mounted once by Leads/Index.tsx; `lead` drives
 * which (if any) of the three modals is open.
 */
export default function ScheduleNextStepFlow({
    lead,
    onClose,
    meetingTypes,
}: ScheduleNextStepFlowProps) {
    const { td } = useTd();
    const { props } = usePage();
    const [step, setStep] = useState<Step>("choose");

    useEffect(() => {
        if (lead) setStep("choose");
    }, [lead]);

    const leadId = lead?.id ?? 0;
    const leadOwnerId = lead?.lead_owner?.id;

    const {
        createTask,
        isCreating: taskCreating,
        errors: taskErrors,
        clearErrors: clearTaskErrors,
    } = useLeadTaskCreate(leadId);

    const {
        createMeeting,
        isCreating: meetingCreating,
        errors: meetingErrors,
        clearErrors: clearMeetingErrors,
    } = useLeadIndexMeetingCreate(leadId, leadOwnerId);

    // router.get on the current URL/filters rather than router.reload()'s
    // window.location.href shorthand — matches Index.tsx's own pagination
    // reload exactly, so there's no ambiguity about what gets re-requested.
    const reloadLeads = () =>
        router.get(
            route("lead-contact.index"),
            mergeQueryParams({}),
            { only: ["leads"], preserveState: true, preserveScroll: true },
        );

    const handleClose = () => {
        clearTaskErrors();
        clearMeetingErrors();
        onClose();
    };

    const initialMeetingForm = useMemo(
        () =>
            buildEmptyMeetingForm(
                null,
                props.auth?.user?.id,
                props.auth?.user?.email,
            ),
        // Rebuilt only when a new lead opens the flow — see ScheduleMeetingModal's
        // own seeding note for why this doesn't need to track every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [leadId, props.auth?.user?.id, props.auth?.user?.email],
    );

    return (
        <>
            <ScheduleNextStepModal
                open={Boolean(lead) && step === "choose"}
                onClose={handleClose}
                onChoose={setStep}
                leadName={lead?.client_name}
            />

            <AddTaskModal
                open={Boolean(lead) && step === "task"}
                onClose={handleClose}
                saving={taskCreating}
                errors={taskErrors}
                defaultAssigneeUserId={leadOwnerId}
                onSubmit={(form) =>
                    createTask(
                        {
                            title: form.title,
                            startDate: form.startDate,
                            dueDate: form.dueDate,
                            dueTime: form.dueTime,
                            priority: form.priority,
                            description: form.description,
                            assignees: form.assignees,
                        },
                        () => {
                            handleClose();
                            reloadLeads();
                        },
                    )
                }
                labels={{
                    title: td("Add task", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Add task", { source: "en" }),
                    titleField: td("Task title", { source: "en" }),
                    titlePlaceholder: td("What needs to happen?", { source: "en" }),
                    description: td("Description", { source: "en" }),
                    descriptionPlaceholder: td("Add details (optional)", {
                        source: "en",
                    }),
                    startDate: td("Start date", { source: "en" }),
                    dueDate: td("Due date", { source: "en" }),
                    dueTime: td("Due time", { source: "en" }),
                    priority: td("Priority", { source: "en" }),
                    priorityHigh: td("High", { source: "en" }),
                    priorityMedium: td("Medium", { source: "en" }),
                    priorityLow: td("Low", { source: "en" }),
                    priorityHighest: td("Highest", { source: "en" }),
                    priorityUrgent: td("Urgent", { source: "en" }),
                    assignees: td("Assignees", { source: "en" }),
                    dateRangeError: td("Due date can't be before the start date.", {
                        source: "en",
                    }),
                }}
            />

            <ScheduleMeetingModal
                open={Boolean(lead) && step === "meeting"}
                onClose={handleClose}
                saving={meetingCreating}
                errors={meetingErrors}
                meetingTypes={meetingTypes}
                initialForm={initialMeetingForm}
                onSubmit={(form) =>
                    createMeeting(form, () => {
                        handleClose();
                        reloadLeads();
                    })
                }
                labels={{
                    title: td("Schedule meeting", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Schedule meeting", { source: "en" }),
                }}
            />
        </>
    );
}
