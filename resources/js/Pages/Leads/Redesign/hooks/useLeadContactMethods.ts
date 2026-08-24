import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { LeadContactMethod } from "@/Types/api/leads";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

interface ContactMethodResponse {
    status: "success" | "fail";
    message: string;
    contact_methods?: LeadContactMethod[];
    conflicts?: unknown;
}

function errorMessage(error: unknown, fallback: string): string {
    const data = (error as { response?: { data?: ContactMethodResponse } })
        ?.response?.data;
    return data?.message || (error as Error)?.message || fallback;
}

/**
 * Add/remove alternate (non-main) emails/phones for a lead — the main
 * client_email/mobile/office fields still go through useLeadInfoFieldUpdate.
 */
export default function useLeadContactMethods() {
    const { lead, setLead } = useLeadWorkspace();
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);

    const applyContactMethods = useCallback(
        (methods: LeadContactMethod[]) => {
            setLead((prev) => ({ ...prev, contact_methods: methods }));
        },
        [setLead],
    );

    const addContactMethod = useCallback(
        async (type: "email" | "phone", identifier: string): Promise<void> => {
            setSaving(true);
            try {
                const response = await axios.post<ContactMethodResponse>(
                    route("lead-contact.contact-methods.store", lead.id),
                    { type, identifier },
                    { headers: { Accept: "application/json" } },
                );

                if (response.data.status !== "success" || !response.data.contact_methods) {
                    throw new Error(response.data.message || "Failed to add contact method");
                }

                applyContactMethods(response.data.contact_methods);
            } catch (error) {
                message.error(errorMessage(error, "Failed to add contact method"));
                throw error;
            } finally {
                setSaving(false);
            }
        },
        [applyContactMethods, lead.id],
    );

    const removeContactMethod = useCallback(
        async (contactMethodId: number): Promise<void> => {
            setRemovingId(contactMethodId);
            try {
                const response = await axios.delete<ContactMethodResponse>(
                    route("lead-contact.contact-methods.destroy", {
                        lead: lead.id,
                        contact_method: contactMethodId,
                    }),
                    { headers: { Accept: "application/json" } },
                );

                if (response.data.status !== "success" || !response.data.contact_methods) {
                    throw new Error(response.data.message || "Failed to remove contact method");
                }

                applyContactMethods(response.data.contact_methods);
            } catch (error) {
                message.error(errorMessage(error, "Failed to remove contact method"));
                throw error;
            } finally {
                setRemovingId(null);
            }
        },
        [applyContactMethods, lead.id],
    );

    return {
        contactMethods: lead.contact_methods ?? [],
        saving,
        removingId,
        addContactMethod,
        removeContactMethod,
    };
}
