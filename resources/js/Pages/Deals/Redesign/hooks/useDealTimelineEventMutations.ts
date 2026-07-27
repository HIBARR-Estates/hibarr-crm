import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type {
    CrmEventDirection,
    CrmEventStatus,
} from "@/Types/api/crm-event";

export interface TimelineEventUpdateInput {
    status?: CrmEventStatus;
    direction?: CrmEventDirection | null;
    comment?: string;
    /** ISO-8601 UTC timestamp. */
    occurred_at?: string;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;
        if (data?.message) return data.message;
    }
    return fallback;
}

/**
 * Edit/delete agent-logged CRM timeline events. Admin-gated on the backend
 * (`CrmEventController@update`/`@destroy`); callers should still hide the
 * controls for non-admins so the affordance never appears.
 *
 * Uses session-authenticated web routes (not /api/v1) so the request shares
 * the same auth + company session as the Inertia page — the API path was
 * rejecting real admins when CompanyScope hid the admin role.
 */
export default function useDealTimelineEventMutations(onChanged: () => void) {
    const { t } = useTranslation();
    const [savingUuid, setSavingUuid] = useState<string | null>(null);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

    const headers = {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
    };

    const updateEvent = useCallback(
        async (
            uuid: string,
            input: TimelineEventUpdateInput,
            onSuccess?: () => void,
        ) => {
            setSavingUuid(uuid);
            try {
                await axios.patch(route("crm-events.update", uuid), input, {
                    headers,
                });
                message.success(t("pages.deals.timeline.messages.event_updated"));
                onChanged();
                onSuccess?.();
            } catch (error) {
                message.error(
                    resolveErrorMessage(
                        error,
                        t("pages.deals.timeline.messages.event_update_failed"),
                    ),
                );
            } finally {
                setSavingUuid(null);
            }
        },
        [onChanged, t],
    );

    const deleteEvent = useCallback(
        async (uuid: string, onSuccess?: () => void) => {
            setDeletingUuid(uuid);
            try {
                await axios.delete(route("crm-events.destroy", uuid), {
                    headers,
                });
                message.success(t("pages.deals.timeline.messages.event_deleted"));
                onChanged();
                onSuccess?.();
            } catch (error) {
                message.error(
                    resolveErrorMessage(
                        error,
                        t("pages.deals.timeline.messages.event_delete_failed"),
                    ),
                );
            } finally {
                setDeletingUuid(null);
            }
        },
        [onChanged, t],
    );

    return {
        updateEvent,
        deleteEvent,
        savingUuid,
        deletingUuid,
        isSaving: savingUuid !== null,
        isDeleting: deletingUuid !== null,
    };
}
