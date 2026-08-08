import { useCallback, useState } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadNote } from "@/Types/api/lead-note";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

export interface LeadNoteCreateInput {
    text: string;
    title?: string;
}

interface SaveNotePayload {
    title?: string;
    details: string;
    lead_id: number;
}

/**
 * Store responses sometimes omit timestamps or only populate
 * `added_by_user`. Normalize so list/detail UIs always have a date + author.
 */
function normalizeCreatedNote(note: LeadNote): LeadNote {
    const now = new Date().toISOString();
    const authorSource = note.added_by ?? note.added_by_user;
    const author = authorSource
        ? ({
              id: authorSource.id,
              name: authorSource.name,
              email: authorSource.email,
              image_url:
                  "image_url" in authorSource
                      ? authorSource.image_url
                      : undefined,
          } as LeadNote["added_by"])
        : undefined;

    return {
        ...note,
        created_at: note.created_at || now,
        updated_at: note.updated_at || note.created_at || now,
        added_by: note.added_by ?? author,
        added_by_user: note.added_by_user ?? authorSource,
    };
}

export default function useLeadNoteCreate(leadId: number) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const { setNotes } = useLeadWorkspace();

    const { mutate, status } = useApiMutate<
        SaveNotePayload,
        LeadNote,
        ApiResponse<LeadNote>
    >(route("lead-notes.store"), "POST");

    const createNote = useCallback(
        (input: LeadNoteCreateInput, onSuccess?: () => void) => {
            const trimmed = input.text.trim();
            if (!trimmed) {
                setErrors(["Please enter note details"]);
                return;
            }

            setErrors([]);
            mutate(
                {
                    // Left blank when the user leaves the title field empty —
                    // same as deal notes; list UI falls back to "Untitled note".
                    title: input.title?.trim() || undefined,
                    details: `<p>${trimmed}</p>`,
                    lead_id: leadId,
                },
                {
                    onSuccess: (response) => {
                        if (response?.status === "success") {
                            setErrors([]);
                            message.success(
                                t("pages.deals.workspace.notes.messages.saved"),
                            );
                            if (response.data) {
                                const note = normalizeCreatedNote(
                                    response.data as LeadNote,
                                );
                                setNotes((prev) => [note, ...prev]);
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
        [leadId, mutate, setNotes, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createNote,
        isSaving: isLoading({ status }),
        errors,
        clearErrors,
    };
}
