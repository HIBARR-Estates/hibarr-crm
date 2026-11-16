import type { Lead } from "@/Types/api/leads";
import { resolveLeadPhoneDisplay } from "@/lib/utils";

/** A number the call button can offer, with a lang key for its label. */
export type LeadCallPhone = {
    labelKey: string;
    phone: string;
};

const LABEL_BY_FIELD: Record<string, string> = {
    mobile: "pages.lead_merge.fields.mobile",
    cell: "pages.lead_merge.fields.cell",
    office: "pages.lead_merge.fields.office",
};

function digits(phone: string): string {
    return phone.replace(/\D/g, "");
}

function pushUnique(
    list: LeadCallPhone[],
    seen: Set<string>,
    labelKey: string,
    display: string,
): void {
    const phone = display.trim();
    const key = digits(phone);
    if (!phone || key.length < 5 || seen.has(key)) return;
    seen.add(key);
    list.push({ labelKey, phone });
}

/**
 * Every distinct number on a lead (mobile, alternate, office, WhatsApp, and
 * extra contact-method phones), in that order. Same digits are kept once.
 */
export function leadCallPhones(
    lead: Partial<Lead> | null | undefined,
): LeadCallPhone[] {
    if (!lead) return [];

    const list: LeadCallPhone[] = [];
    const seen = new Set<string>();

    pushUnique(
        list,
        seen,
        LABEL_BY_FIELD.mobile,
        resolveLeadPhoneDisplay(lead.mobile, lead.mobile_with_phonecode),
    );
    pushUnique(
        list,
        seen,
        LABEL_BY_FIELD.cell,
        resolveLeadPhoneDisplay(lead.cell),
    );
    pushUnique(
        list,
        seen,
        LABEL_BY_FIELD.office,
        resolveLeadPhoneDisplay(lead.office, lead.office_phone_formatted),
    );
    pushUnique(
        list,
        seen,
        "pages.lead_merge.fields.client_whatsapp",
        resolveLeadPhoneDisplay(lead.client_whatsapp),
    );

    for (const method of lead.contact_methods ?? []) {
        if (method.type !== "phone") continue;
        const labelKey =
            (method.source_field && LABEL_BY_FIELD[method.source_field]) ||
            LABEL_BY_FIELD.cell;
        pushUnique(
            list,
            seen,
            labelKey,
            resolveLeadPhoneDisplay(method.identifier),
        );
    }

    return list;
}
