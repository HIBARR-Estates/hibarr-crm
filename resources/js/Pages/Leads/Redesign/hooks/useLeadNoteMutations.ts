import { useCallback } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadNote } from "@/Types/api/lead-note";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

interface UpdateNotePayload {
    title?: string | null;
    details: string;
}

function noteFromUpdateResponse(
    response: ApiResponse<LeadNote>,
    noteId: number,
    payload: UpdateNotePayload,
    previous?: LeadNote,
): LeadNote {
    const raw = response.data as LeadNote | { data?: LeadNote } | undefined;
    const fromApi =
        raw && typeof raw === "object" && "id" in raw
            ? (raw as LeadNote)
            : raw && typeof raw === "object" && "data" in raw && raw.data?.id
              ? raw.data
              : null;

    const nextTitle =
        fromApi && "title" in fromApi
            ? (fromApi.title ?? "")
            : (payload.title ?? previous?.title ?? "");

    if (fromApi) {
        return {
            ...previous,
            ...fromApi,
            title: nextTitle,
            details: fromApi.details ?? payload.details,
            added_by: fromApi.added_by ?? previous?.added_by,
            added_by_user:
                fromApi.added_by_user ??
                previous?.added_by_user ??
                fromApi.added_by ??
                previous?.added_by,
        };
    }

    return {
        ...(previous ?? ({ id: noteId } as LeadNote)),
        id: noteId,
        title: payload.title ?? "",
        details: payload.details,
        updated_at: new Date().toISOString(),
    };
}

export default function useLeadNoteMutations(noteId: number) {
    const { t } = useTranslation();
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
            if (!noteId) return;
            updateMutate(payload, {
                suppressSuccessToast: true,
                onSuccess: (response) => {
                    if (response?.status === "success") {
                        message.success(
                            t("pages.deals.workspace.notes.messages.updated"),
                        );
                        setNotes((prev) =>
                            prev.map((note) =>
                                note.id === noteId
                                    ? noteFromUpdateResponse(
                                          response,
                                          noteId,
                                          payload,
                                          note,
                                      )
                                    : note,
                            ),
                        );
                        onSuccess?.();
                    }
                },
            });
        },
        [updateMutate, noteId, setNotes, t],
    );

    const deleteNote = useCallback(
        (onSuccess?: () => void) => {
            if (!noteId) return;
            deleteMutate(null, {
                suppressSuccessToast: true,
                onSuccess: () => {
                    message.success(
                        t("pages.deals.workspace.notes.messages.deleted"),
                    );
                    setNotes((prev) =>
                        prev.filter((note) => note.id !== noteId),
                    );
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
