import { useCallback } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { Note } from "@/Types/api/note";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

interface UpdateNotePayload {
    title: string;
    details: string;
}

export default function useDealNoteMutations(noteId: number) {
    const { t } = useTranslation();
    const { setNotes } = useDealWorkspace();
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
                        message.success(t("pages.deals.workspace.notes.messages.updated"));
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
        [updateMutate, noteId, setNotes, t],
    );

    const deleteNote = useCallback(
        (onSuccess?: () => void) => {
            deleteMutate(null, {
                onSuccess: () => {
                    message.success(t("pages.deals.workspace.notes.messages.deleted"));
                    setNotes((prev) => prev.filter((note) => note.id !== noteId));
                    onSuccess?.();
                },
            });
        },
        [deleteMutate, noteId, setNotes, t],
    );

    return {
        updateNote,
        isUpdating: isLoading({ status: updateStatus }),
        deleteNote,
        isDeleting: isLoading({ status: deleteStatus }),
    };
}
