import { useCallback, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { LeadNote } from "@/Types/api/lead-note";

export interface LeadNoteCreateInput {
    text: string;
}

interface SaveNotePayload {
    title: string;
    details: string;
    lead_id: number;
}

export default function useLeadNoteCreate(leadId: number) {
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate, status } = useApiMutate<
        SaveNotePayload,
        LeadNote,
        ApiResponse<LeadNote>
    >(route("lead-notes.store"), "POST");

    const createNote = useCallback(
        (
            input: LeadNoteCreateInput,
            onSuccess?: (note: LeadNote) => void,
        ) => {
            const trimmed = input.text.trim();
            if (!trimmed) {
                setErrors(["Please enter note details"]);
                return;
            }

            setErrors([]);
            mutate(
                {
                    title: trimmed.slice(0, 80),
                    details: `<p>${trimmed}</p>`,
                    lead_id: leadId,
                },
                {
                    onSuccess: (response) => {
                        if (response?.status === "success" && response.data) {
                            setErrors([]);
                            message.success("Note saved");
                            onSuccess?.(response.data);
                            return;
                        }

                        setErrors(["Failed to save note"]);
                    },
                    onError: (errorResponse) => {
                        const formatted = errorFormatter(errorResponse);
                        const responseErrors = Object.values(
                            formatted.errors || {},
                        ).flat();
                        setErrors(
                            responseErrors.length > 0
                                ? responseErrors
                                : [formatted.message || "Failed to save note"],
                        );
                    },
                },
            );
        },
        [leadId, mutate],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createNote,
        isSaving: isLoading({ status }),
        errors,
        clearErrors,
    };
}
