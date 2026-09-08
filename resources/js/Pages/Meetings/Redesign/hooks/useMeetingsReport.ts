import { useCallback, useState } from "react";
import { message } from "antd";
import { errorFormatter } from "@/lib/api/utils/common";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface MeetingReportInput {
    discussed: string;
    outcome: string;
    next_steps: string;
    /** Tri-state, as the column is: null = still unknown. */
    client_attended: boolean | null;
    /** Moves the meeting's status to completed as the report is filed. */
    mark_completed: boolean;
}

/**
 * Files a post-meeting follow-up report.
 *
 * The report is stored as the meeting's summary, the same record the AI
 * summary writes to, so a meeting has one "what happened" whether a person
 * wrote it or a transcript did — and the detail dialog's Summary tab renders
 * either without knowing which.
 */
export default function useMeetingsReport() {
    const { td } = useTd();
    const [errors, setErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const submitReport = useCallback(
        async (
            meetingId: number,
            input: MeetingReportInput,
            onSuccess?: () => void,
        ) => {
            if (!input.discussed.trim()) {
                // Left untranslated here — the dialog already wraps every
                // entry in `errors` through `td()` at render, so translating
                // twice would feed already-translated text back through it.
                setErrors(["Please describe what was discussed."]);
                return;
            }

            setIsSaving(true);
            setErrors([]);

            try {
                const response = await fetch(
                    route("meetings.report", { followUp: meetingId }),
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            "X-CSRF-TOKEN":
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute("content") || "",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                        body: JSON.stringify(input),
                    },
                );

                const json = await response.json();

                if (json?.success) {
                    message.success(td("Follow-up report saved"));
                    onSuccess?.();
                    return;
                }

                setErrors([json?.message || "Failed to save the report"]);
            } catch (error) {
                setErrors([
                    errorFormatter(error).message ||
                        "Failed to save the report",
                ]);
            } finally {
                setIsSaving(false);
            }
        },
        [],
    );

    return {
        submitReport,
        isSaving,
        errors,
        clearErrors: useCallback(() => setErrors([]), []),
    };
}
