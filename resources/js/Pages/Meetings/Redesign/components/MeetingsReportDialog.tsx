import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import Switch from "@/Components/Redesign/primitives/Switch";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingsReport, {
    type MeetingReportInput,
} from "../hooks/useMeetingsReport";

interface MeetingsReportDialogProps {
    open: boolean;
    meeting: DealFollowup | null;
    onClose: () => void;
    onSaved: () => void;
}

/** "Not sure" is a real answer here — the column is tri-state. */
type Attendance = "yes" | "no" | "unknown";

const EMPTY: MeetingReportInput = {
    discussed: "",
    outcome: "",
    next_steps: "",
    client_attended: null,
    mark_completed: true,
};

function attendanceToValue(attendance: Attendance): boolean | null {
    if (attendance === "yes") return true;
    if (attendance === "no") return false;
    return null;
}

const TEXTAREA_STYLE = {
    width: "100%",
    minHeight: 84,
    padding: "9px 11px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical" as const,
};

/**
 * The post-meeting follow-up report.
 *
 * Deliberately short — three prompts, an attendance answer and a "this
 * meeting is done" toggle. A report nobody fills in is worth less than a
 * brief one everybody does, and everything here is already asked of agents
 * in some other form (attendance confirmation, the deal's next step).
 */
export default function MeetingsReportDialog({
    open,
    meeting,
    onClose,
    onSaved,
}: MeetingsReportDialogProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [form, setForm] = useState<MeetingReportInput>(EMPTY);
    const [attendance, setAttendance] = useState<Attendance>("unknown");
    const { submitReport, isSaving, errors, clearErrors } = useMeetingsReport();

    // Keyed on the meeting's id, not `open` alone — a report left half-typed
    // for one meeting must never be filed against the next, including if the
    // dialog is retargeted at a different meeting without ever closing
    // (e.g. "Report" clicked for a second meeting while it's still open for
    // the first).
    useEffect(() => {
        // Start from what the meeting's summary already says for the three
        // prompts, so filing a report edits it instead of looking like a
        // blank form that will replace it.
        const existing = (meeting?.meeting_summary?.summary_object ??
            {}) as Record<string, unknown>;
        const text = (key: string) =>
            typeof existing[key] === "string" ? (existing[key] as string) : "";
        setForm({
            ...EMPTY,
            discussed: text("discussed"),
            outcome: text("outcome"),
            next_steps: text("next_steps"),
        });
        setAttendance("unknown");
        clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on id, not the meeting object
    }, [meeting?.id, clearErrors]);

    // Seed the attendance answer from whatever was already recorded, so
    // filing a report doesn't quietly reset a confirmed one to "not sure".
    // Depends on the id, not the `meeting` object itself — a parent re-render
    // that hands back a new object for the same meeting (a local state patch
    // elsewhere) must not re-seed and discard an answer already picked while
    // this dialog is still open; switching to a genuinely different meeting
    // still re-seeds, since its id differs.
    useEffect(() => {
        if (!open || !meeting) return;
        setAttendance(
            meeting.client_attended === true
                ? "yes"
                : meeting.client_attended === false
                  ? "no"
                  : "unknown",
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on id, not the meeting object
    }, [open, meeting?.id]);

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const patch = (fields: Partial<MeetingReportInput>) =>
        setForm((current) => ({ ...current, ...fields }));

    const handleSubmit = () => {
        if (!meeting) return;
        submitReport(
            meeting.id,
            { ...form, client_attended: attendanceToValue(attendance) },
            () => {
                onSaved();
                onClose();
            },
        );
    };

    return (
        <Modal
            open={open && meeting !== null}
            title={t("pages.meetings.card.actions.report")}
            subtitle={t("pages.meetings.ui.record_what_happened_so_the_deal_keeps_its")}
            onClose={handleClose}
            maxWidth={640}
            dirty={Boolean(
                form.discussed.trim() ||
                form.outcome.trim() ||
                form.next_steps.trim(),
            )}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isSaving}
                    >
                        {t("pages.deals.common.cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isSaving}
                        disabled={isSaving || !form.discussed.trim()}
                    >
                        {t("pages.meetings.ui.save_report")}
                    </Button>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error)}
                        </p>
                    ))}
                </div>
            )}

            <ModalField label={t("pages.meetings.ui.did_the_client_attend")}>
                <Segmented<Attendance>
                    value={attendance}
                    onChange={setAttendance}
                    ariaLabel={t("pages.meetings.ui.client_attendance")}
                    fullWidth
                    options={[
                        { value: "yes", label: t("pages.meetings.ui.yes") },
                        { value: "no", label: t("pages.meetings.ui.no_show") },
                        { value: "unknown", label: t("pages.meetings.ui.not_sure") },
                    ]}
                />
            </ModalField>

            <ModalField label={t("pages.meetings.ui.what_was_discussed")}>
                <textarea
                    autoFocus
                    disabled={isSaving}
                    value={form.discussed}
                    onChange={(event) =>
                        patch({ discussed: event.target.value })
                    }
                    placeholder={t("pages.meetings.ui.the_main_points_covered_in_the_meeting")}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={t("pages.meetings.ui.outcome")}>
                <textarea
                    disabled={isSaving}
                    value={form.outcome}
                    onChange={(event) => patch({ outcome: event.target.value })}
                    placeholder={t("pages.meetings.ui.what_was_decided_and_where_that_leaves_the_deal")}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={t("pages.meetings.ui.next_steps")}>
                <textarea
                    disabled={isSaving}
                    value={form.next_steps}
                    onChange={(event) =>
                        patch({ next_steps: event.target.value })
                    }
                    placeholder={t("pages.meetings.ui.who_does_what_and_by_when")}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={t("pages.meetings.ui.mark_the_meeting_as_completed")}>
                <Switch
                    checked={form.mark_completed}
                    onChange={() =>
                        patch({ mark_completed: !form.mark_completed })
                    }
                    disabled={isSaving}
                    label={
                        form.mark_completed
                            ? t("pages.meetings.ui.completed")
                            : t("pages.meetings.ui.leave_as_is")
                    }
                />
            </ModalField>
        </Modal>
    );
}
