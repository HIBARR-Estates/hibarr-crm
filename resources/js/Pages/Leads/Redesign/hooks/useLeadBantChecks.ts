import { useMemo } from "react";
import type { Lead } from "@/Types/api/leads";
import type { LeadQualificationAnswer } from "@/Types/qualification";
import { buildBantCaptures, getBantChecks } from "../adapters/bantAdapter";
import type { BantCaptures, BantChecks } from "../types";

interface UseLeadBantChecksArgs {
    lead: Lead;
    answers?: LeadQualificationAnswer[];
    contactLogged: boolean;
}

export default function useLeadBantChecks({
    lead,
    answers,
    contactLogged,
}: UseLeadBantChecksArgs): { captures: BantCaptures; checks: BantChecks } {
    return useMemo(() => {
        const captures = buildBantCaptures(answers, lead);
        const checks = getBantChecks(captures, contactLogged);
        return { captures, checks };
    }, [answers, contactLogged, lead]);
}
