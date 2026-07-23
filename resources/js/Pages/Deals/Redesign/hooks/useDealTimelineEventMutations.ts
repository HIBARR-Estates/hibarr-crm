import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
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
 */
export default function useDealTimelineEventMutations(onChanged: () => void) {
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const companyId = props.auth?.user?.company_id;
    const [savingUuid, setSavingUuid] = useState<string | null>(null);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

    const headers = {
        Accept: "application/json",
        "X-COMPANY-ID": companyId ?? "",
    };

    const updateEvent = useCallback(
        async (
            uuid: string,
            input: TimelineEventUpdateInput,
            onSuccess?: () => void,
        ) => {
            setSavingUuid(uuid);
            try {
                await axios.patch(`/api/v1/crm-events/${uuid}`, input, {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [companyId, onChanged, t],
    );

    const deleteEvent = useCallback(
        async (uuid: string, onSuccess?: () => void) => {
            setDeletingUuid(uuid);
            try {
                await axios.delete(`/api/v1/crm-events/${uuid}`, { headers });
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [companyId, onChanged, t],
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
