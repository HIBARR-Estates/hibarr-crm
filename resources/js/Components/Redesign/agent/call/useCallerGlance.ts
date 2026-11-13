import { useEffect, useState } from "react";
import axios from "axios";

/** What an agent wants to know the moment a known lead rings in (CallerGlance on the server). */
export interface CallerGlance {
    status: { label: string; color: string | null } | null;
    deal: { stage: string | null; stage_color: string | null; value: number | null; currency: string | null } | null;
    next_meeting: { title: string | null; at: string } | null;
    last_touch_at: string | null;
}

/**
 * Loads the glance for the lead on the line in the background: the card is
 * already up with the name and number, and the chips fill in when this lands.
 * A failed request leaves the card as it is, without facts.
 */
export default function useCallerGlance(leadId: number | null): { glance: CallerGlance | null; loading: boolean } {
    const [state, setState] = useState<{ leadId: number; glance: CallerGlance } | null>(null);
    const [settledFor, setSettledFor] = useState<number | null>(null);

    useEffect(() => {
        if (leadId === null) return;
        let cancelled = false;
        axios
            .get(route("agent.people.caller", { lead: leadId }))
            .then((response) => {
                if (!cancelled) setState({ leadId, glance: response.data.data as CallerGlance });
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setSettledFor(leadId);
            });
        return () => {
            cancelled = true;
        };
    }, [leadId]);

    return {
        glance: state?.leadId === leadId ? state.glance : null,
        loading: leadId !== null && settledFor !== leadId,
    };
}
