import type { Lead } from "@/Types/api/leads";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import type { FactRow } from "./SidePanels";

type T = (key: string, params?: Record<string, string | number>) => string;

/**
 * The person's own details for the "Lead facts" tab: what the CRM already has
 * about them, from the same lead fields the lead page shows, so the agent can
 * check them during the call. Rows with nothing recorded read "Not set".
 */
export function leadFactRows(lead: Lead, t: T): FactRow[] {
    const label = (key: string) => t(`pages.agent_workspace.contact.edit.fields.${key}`);
    const nationality = lead.nationality as unknown;
    return [
        { key: "name", label: label("name"), value: lead.client_name || null },
        { key: "mobile", label: label("mobile"), value: resolveLeadPhoneDisplay(lead.mobile, lead.mobile_with_phonecode) || null },
        { key: "email", label: label("email"), value: lead.client_email || null },
        {
            key: "nationality",
            label: label("nationality"),
            value:
                nationality && typeof nationality === "object"
                    ? ((nationality as { nicename?: string }).nicename ?? null)
                    : (lead.nationality ?? null),
        },
        { key: "languages", label: label("languages"), value: lead.languages?.length ? lead.languages.join(", ") : null },
        { key: "occupation", label: label("occupation"), value: lead.occupation || null },
        { key: "city", label: label("city"), value: lead.city || null },
        {
            key: "temperature",
            label: label("temperature"),
            value: lead.temperature ? t(`pages.agent_workspace.contact.edit.options.${lead.temperature}`) : null,
        },
    ];
}
