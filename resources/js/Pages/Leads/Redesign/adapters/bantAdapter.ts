import type { Lead } from "@/Types/api/leads";
import type { LeadQualificationAnswer } from "@/Types/qualification";
import type { BantCaptures, BantChecks } from "../types";

const NEED_KEYS = ["need", "interest", "intent", "primary_interest"];
const BUDGET_KEYS = ["budget", "budget_range", "budgetrange"];
const TIMELINE_KEYS = ["timeline", "timeframe", "move_date"];
const CONTACT_KEYS = ["contactability", "contact", "channel", "preferred_channel"];

function findAnswerValue(
    answers: LeadQualificationAnswer[] | undefined,
    keys: string[],
): string | undefined {
    if (!answers?.length) return undefined;
    for (const answer of answers) {
        const key = answer.segment_key.toLowerCase();
        if (keys.some((k) => key.includes(k))) {
            const value = answer.answer_text || answer.answer_values?.[0];
            if (value) return value;
        }
    }
    return undefined;
}

export function buildBantCaptures(
    answers: LeadQualificationAnswer[] | undefined,
    lead: Lead,
): BantCaptures {
    return {
        contactability:
            findAnswerValue(answers, CONTACT_KEYS) ||
            (lead.mobile ? "Phone" : undefined),
        need: findAnswerValue(answers, NEED_KEYS) || lead.occupation || undefined,
        budget:
            findAnswerValue(answers, BUDGET_KEYS) ||
            (lead.value ? String(lead.value) : undefined),
        timeline: findAnswerValue(answers, TIMELINE_KEYS),
    };
}

export function getBantChecks(
    captures: BantCaptures,
    contactLogged: boolean,
): BantChecks {
    return {
        contactability: contactLogged || Boolean(captures.contactability),
        need: Boolean(captures.need),
        budget: Boolean(captures.budget) && captures.budget !== "Not fit",
        timeline:
            Boolean(captures.timeline) && captures.timeline !== "Undefined",
    };
}
