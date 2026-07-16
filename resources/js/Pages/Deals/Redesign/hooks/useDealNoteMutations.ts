import { useCallback } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Note } from "@/Types/api/note";

interface UpdateNotePayload {
    title: string;
    details: string;
}

export default function useDealNoteMutations(noteId: number) {
    const { mutate: updateMutate, status: updateStatus } = useApiMutate<
        UpdateNotePayload,
        Note,
        ApiResponse<Note>
    >(route("deal-notes.update", noteId), "PUT");

    const { mutate: deleteMutate, status: deleteStatus } = useApiMutate<
        null,
        null,
        ApiResponse<null>
    >(route("deal-notes.destroy", noteId), "DELETE");

    const updateNote = useCallback(
        (payload: UpdateNotePayload, onSuccess?: () => void) => {
            updateMutate(payload, {
                onSuccess: (response) => {
                    if (response?.status === "success") {
                        message.success("Note updated");
                        onSuccess?.();
                        router.reload({ only: ["notes"] });
                    }
                },
            });
        },
        [updateMutate],
    );

    const deleteNote = useCallback(
        (onSuccess?: () => void) => {
            deleteMutate(null, {
                onSuccess: () => {
                    message.success("Note deleted");
                    onSuccess?.();
                    router.reload({ only: ["notes"] });
                },
            });
        },
        [deleteMutate],
    );

    return {
        updateNote,
        isUpdating: isLoading({ status: updateStatus }),
        deleteNote,
        isDeleting: isLoading({ status: deleteStatus }),
    };
}
