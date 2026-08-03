import { useCallback } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { LeadNote } from "@/Types/api/lead-note";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

interface UpdateNotePayload {
    title: string;
    details: string;
}

export default function useLeadNoteMutations(noteId: number) {
    const { setNotes } = useLeadWorkspace();
    const { mutate: updateMutate, status: updateStatus } = useApiMutate<
        UpdateNotePayload,
        LeadNote,
        ApiResponse<LeadNote>
    >(route("lead-notes.update", noteId), "PUT");

    const { mutate: deleteMutate, status: deleteStatus } = useApiMutate<
        null,
        null,
        ApiResponse<null>
    >(route("lead-notes.destroy", noteId), "DELETE");

    const updateNote = useCallback(
        (payload: UpdateNotePayload, onSuccess?: () => void) => {
            updateMutate(payload, {
                onSuccess: (response) => {
                    if (response?.status === "success") {
                        message.success("Note updated");
                        if (response.data) {
                            const updated = response.data;
                            setNotes((prev) =>
                                prev.map((note) =>
                                    note.id === noteId ? updated : note,
                                ),
                            );
                        }
                        onSuccess?.();
                    }
                },
            });
        },
        [noteId, setNotes, updateMutate],
    );

    const deleteNote = useCallback(
        (onSuccess?: () => void) => {
            deleteMutate(null, {
                onSuccess: () => {
                    message.success("Note deleted");
                    setNotes((prev) => prev.filter((note) => note.id !== noteId));
                    onSuccess?.();
                },
            });
        },
        [deleteMutate, noteId, setNotes],
    );

    return {
        updateNote,
        isUpdating: isLoading({ status: updateStatus }),
        deleteNote,
        isDeleting: isLoading({ status: deleteStatus }),
    };
}
