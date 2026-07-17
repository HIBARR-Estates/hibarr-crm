import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type {
    CrmEventStorePayload,
    CrmEventsIndexResponse,
} from "@/Types/api/crm-event";
import type { PageProps } from "@/Components/DashboardLayout";

dayjs.extend(utc);

/** CRM event type used to mark first outreach on a lead. */
export const LEAD_FIRST_CONTACT_EVENT_SLUG = "lead_first_contact";
export const LEAD_FIRST_CONTACT_MESSAGE = "First Outreach recorded";

// Controller normalizes model_type with stripslashes(); send escaped slashes.
const LEAD_MODEL_TYPE = "App\\\\Models\\\\Lead";

export default function useLeadFirstContact(leadId: number) {
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
    const [optimisticLogged, setOptimisticLogged] = useState(false);
    const [isLogging, setIsLogging] = useState(false);

    const { data, isLoading, refetch } = useApiQuery<CrmEventsIndexResponse>({
        path: "/api/v1/crm-events",
        params: {
            model_type: LEAD_MODEL_TYPE,
            model_id: leadId,
            event_type_slug: LEAD_FIRST_CONTACT_EVENT_SLUG,
            per_page: 1,
            sort_order: "desc",
        },
        options: {
            staleTime: 1000 * 30,
        },
    });

    const hasFirstContactEvent = useMemo(
        () => (data?.data?.length ?? 0) > 0,
        [data],
    );

    const contactLogged = optimisticLogged || hasFirstContactEvent;

    const logContact = useCallback(async (): Promise<boolean> => {
        if (contactLogged || isLogging) return contactLogged;

        setIsLogging(true);
        try {
            const payload: CrmEventStorePayload = {
                event_type_slug: LEAD_FIRST_CONTACT_EVENT_SLUG,
                model_type: LEAD_MODEL_TYPE,
                model_id: leadId,
                user_id: userId,
                generation_type: "user_generated",
                status: "completed",
                direction: "outbound",
                metadata: {
                    comment: LEAD_FIRST_CONTACT_MESSAGE,
                    message: LEAD_FIRST_CONTACT_MESSAGE,
                },
                occurred_at: dayjs().utc().toISOString(),
            };

            await axios.post("/api/v1/crm-events", payload, {
                headers: { Accept: "application/json" },
            });

            setOptimisticLogged(true);
            message.success(LEAD_FIRST_CONTACT_MESSAGE);
            void refetch();
            return true;
        } catch (error: unknown) {
            const errMessage =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                "Failed to log first contact";
            message.error(errMessage);
            return false;
        } finally {
            setIsLogging(false);
        }
    }, [contactLogged, isLogging, leadId, refetch, userId]);

    return {
        contactLogged,
        isLoading,
        isLogging,
        logContact,
        refetch,
    };
}
