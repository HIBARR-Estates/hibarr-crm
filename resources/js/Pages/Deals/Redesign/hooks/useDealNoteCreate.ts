import { useCallback, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { Note } from "@/Types/api/note";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealNoteCreateInput {
    text: string;
    title?: string;
}

interface SaveNotePayload {
    title?: string;
    details: string;
    lead_id: number;
}

export default function useDealNoteCreate(dealId: number) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const { setNotes } = useDealWorkspace();

    const { mutate, status } = useApiMutate<
        SaveNotePayload,
        Note,
        ApiResponse<Note>
    >(route("deal-notes.store"), "POST");

    const createNote = useCallback(
        (input: DealNoteCreateInput, onSuccess?: () => void) => {
            const hasText =
                input.text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()
                    .length > 0;
            if (!hasText) {
                setErrors(["Please enter note details"]);
                return;
            }

            setErrors([]);
            mutate(
                {
                    // Left blank when the user leaves the title field empty —
                    // `deal_notes.title` is nullable (StoreDealNote has no
                    // rule for it) and the note list already falls back to
                    // "Untitled note" for display, so there's no need to
                    // synthesize one from the body here.
                    title: input.title?.trim() || undefined,
                    details: input.text,
                    lead_id: dealId,
                },
                {
                    onSuccess: (response) => {
                        if (response?.status === "success") {
                            setErrors([]);
                            message.success(t("pages.deals.workspace.notes.messages.saved"));
                            if (response.data) {
                                setNotes((prev) => [response.data as Note, ...prev]);
                            }
                            onSuccess?.();
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
        [dealId, mutate, setNotes, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createNote,
        isSaving: isLoading({ status }),
        errors,
        clearErrors,
    };
}
