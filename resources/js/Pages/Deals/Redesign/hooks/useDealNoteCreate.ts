import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Note } from "@/Types/api/note";

export interface DealNoteCreateInput {
    text: string;
}

interface SaveNotePayload {
    title: string;
    details: string;
    lead_id: number;
}

export default function useDealNoteCreate(dealId: number) {
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate, status } = useApiMutate<
        SaveNotePayload,
        Note,
        ApiResponse<Note>
    >(route("deal-notes.store"), "POST");

    const createNote = useCallback(
        (input: DealNoteCreateInput, onSuccess?: () => void) => {
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
                    lead_id: dealId,
                },
                {
                    onSuccess: (response) => {
                        if (response?.status === "success") {
                            setErrors([]);
                            message.success("Note saved");
                            onSuccess?.();
                            router.reload({ only: ["notes"] });
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
        [dealId, mutate],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createNote,
        isSaving: isLoading({ status }),
        errors,
        clearErrors,
    };
}
