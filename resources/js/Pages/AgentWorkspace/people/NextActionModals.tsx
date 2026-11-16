import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import axios from "axios";
import useMeetingStatus from "@/Components/Redesign/hooks/useMeetingStatus";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTaskStatus from "@/Hooks/useTaskStatus";
import useTranslation from "@/Hooks/useTranslation";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import type { ActivityKind } from "../today/AddActivityMenu";
import type { Lead } from "./types";

const QueueTaskModal = lazy(() => import("@/Components/Redesign/modals/QueueTaskModal"));
const MeetingActionModals = lazy(() => import("@/Components/Redesign/meeting/MeetingActionModals"));
const PersonalTaskCreateModal = lazy(() => import("@/Pages/Dashboard/V2/personal/PersonalTaskCreateModal"));
const MeetingScheduleModal = lazy(() => import("@/Components/Redesign/modals/MeetingScheduleModal"));

type NextAction = NonNullable<Lead["next_action"]>;

export type NextActionRequest =
    | { mode: "preview"; lead: Lead; action: NextAction }
    | { mode: "create"; lead: Lead; kind: ActivityKind };

/** The lists a change to a person's next step moves: the rows, the chips' counts and the deals beside them. */
const RELOAD_KEYS = ["leads", "counts", "rowExtras"];

interface NextActionModalsProps {
    request: NextActionRequest | null;
    onClose: () => void;
    taskBoardColumns: TaskboardColumn[] | undefined;
}

/**
 * The modals behind the People list's Next action column: the person's task or
 * meeting opens in the same modal the Today and Tasks screens use, and a first
 * step is made with the CRM's own task form and schedule dialog, pinned to
 * that person. Whatever changes, the list re-reads (the rows only carry the id
 * of the step, so the server decides which one is next now).
 */
export default function NextActionModals({ request, onClose, taskBoardColumns }: NextActionModalsProps) {
    const { t } = useTranslation();
    const [task, setTask] = useState<QueueTask | null>(null);
    const [meeting, setMeeting] = useState<ScheduleEntry | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(() => router.reload({ only: RELOAD_KEYS }), []);
    const { setStatus, isPending: isStatusPending } = useTaskStatus(() => refresh(), () => refresh());
    const { markHeld, isPending: isHeldPending } = useMeetingStatus(() => refresh(), RELOAD_KEYS);

    // A preview fetches the step itself; the row only knows its id.
    useEffect(() => {
        setTask(null);
        setMeeting(null);
        if (!request || request.mode !== "preview") return;
        const controller = new AbortController();
        setLoading(true);
        const { action } = request;
        axios
            .get(route(action.type === "task" ? "agent.tasks.show" : "agent.meetings.show", action.id), { signal: controller.signal })
            .then(({ data }) => {
                if (action.type === "task") setTask(data.task);
                else setMeeting(data.meeting);
            })
            .catch((error) => {
                if (axios.isCancel(error)) return;
                message.error(t("pages.agent_workspace.people.row.preview_failed"));
                onClose();
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    if (!request) return null;

    // A reschedule changes the meeting the modal is showing, so read it again
    // rather than leaving the old time on screen until the modal is reopened.
    const refreshMeeting = (id: number) => {
        axios
            .get(route("agent.meetings.show", id))
            .then(({ data }) => setMeeting(data.meeting))
            .catch(() => undefined);
    };

    const close = () => {
        setTask(null);
        setMeeting(null);
        onClose();
    };
    const afterCreate = () => {
        close();
        refresh();
    };

    return (
        <Suspense fallback={null}>
            {request.mode === "preview" && task && !loading ? (
                <QueueTaskModal
                    task={task}
                    taskBoardColumns={taskBoardColumns ?? []}
                    onClose={close}
                    onPatched={(next) => setTask(next as QueueTask)}
                    setStatus={setStatus}
                    isStatusPending={isStatusPending}
                    onComplete={(done) => {
                        setStatus(done.id, "done");
                        close();
                    }}
                    onChanged={refresh}
                />
            ) : null}
            {request.mode === "preview" && meeting && !loading ? (
                <MeetingActionModals
                    meeting={meeting}
                    onClose={close}
                    onMarkHeld={(id) => {
                        void markHeld(id);
                        close();
                    }}
                    markingHeld={isHeldPending(meeting.id)}
                    reloadKeys={RELOAD_KEYS}
                    onRescheduled={() => {
                        refresh();
                        refreshMeeting(meeting.id);
                    }}
                />
            ) : null}
            {request.mode === "create" && request.kind === "task" ? (
                <PersonalTaskCreateModal
                    open
                    taskBoardColumns={taskBoardColumns ?? []}
                    lockedLinks={[{ type: "lead", id: request.lead.id, name: request.lead.client_name ?? "" }]}
                    onClose={close}
                    onCreated={afterCreate}
                />
            ) : null}
            {request.mode === "create" && request.kind === "meeting" ? (
                <MeetingScheduleModal
                    open
                    onClose={close}
                    userDeals={[]}
                    userLeads={[{ id: request.lead.id, name: request.lead.client_name ?? "" }]}
                    initialRecord={{ type: "lead", id: request.lead.id }}
                    onSuccess={afterCreate}
                />
            ) : null}
        </Suspense>
    );
}
