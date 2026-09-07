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

    // Each opening starts clean — a report left half-typed for one meeting
    // must never be filed against the next.
    useEffect(() => {
        if (open) return;
        setForm(EMPTY);
        setAttendance("unknown");
        clearErrors();
    }, [open, clearErrors]);

    // Seed the attendance answer from whatever was already recorded, so
    // filing a report doesn't quietly reset a confirmed one to "not sure".
    useEffect(() => {
        if (!open || !meeting) return;
        setAttendance(
            meeting.client_attended === true
                ? "yes"
                : meeting.client_attended === false
                  ? "no"
                  : "unknown",
        );
    }, [open, meeting]);

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
            subtitle={td(
                "Record what happened so the deal keeps its history after the call.",
            )}
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
                        {td("Save report")}
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

            <ModalField label={td("Did the client attend?")}>
                <Segmented<Attendance>
                    value={attendance}
                    onChange={setAttendance}
                    ariaLabel={td("Client attendance")}
                    fullWidth
                    options={[
                        { value: "yes", label: td("Yes") },
                        { value: "no", label: td("No show") },
                        { value: "unknown", label: td("Not sure") },
                    ]}
                />
            </ModalField>

            <ModalField label={td("What was discussed")}>
                <textarea
                    autoFocus
                    disabled={isSaving}
                    value={form.discussed}
                    onChange={(event) =>
                        patch({ discussed: event.target.value })
                    }
                    placeholder={td("The main points covered in the meeting")}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={td("Outcome")}>
                <textarea
                    disabled={isSaving}
                    value={form.outcome}
                    onChange={(event) => patch({ outcome: event.target.value })}
                    placeholder={td(
                        "What was decided, and where that leaves the deal",
                    )}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={td("Next steps")}>
                <textarea
                    disabled={isSaving}
                    value={form.next_steps}
                    onChange={(event) =>
                        patch({ next_steps: event.target.value })
                    }
                    placeholder={td("Who does what, and by when")}
                    style={TEXTAREA_STYLE}
                />
            </ModalField>

            <ModalField label={td("Mark the meeting as completed")}>
                <Switch
                    checked={form.mark_completed}
                    onChange={() =>
                        patch({ mark_completed: !form.mark_completed })
                    }
                    disabled={isSaving}
                    label={
                        form.mark_completed
                            ? td("Completed")
                            : td("Leave as is")
                    }
                />
            </ModalField>
        </Modal>
    );
}
