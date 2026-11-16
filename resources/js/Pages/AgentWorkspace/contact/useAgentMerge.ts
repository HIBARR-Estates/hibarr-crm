import { useCallback } from "react";
import { router } from "@inertiajs/react";

/**
 * What happens after two leads are merged, inside the agent workspace. The
 * merge dialog is the CRM's own; this keeps the person in the workspace: on the
 * lead they started from, the whole page refreshes (the duplicate's notes,
 * tasks and history are now on it); if they swapped the pair, they land on the
 * lead that was kept (its page opens in the deal's state when it has deals).
 */
export default function useAgentMerge(leadId: number): (keptId: number) => void {
    return useCallback(
        (keptId: number) => {
            if (keptId === leadId) router.reload();
            else router.visit(route("agent.people.show", keptId));
        },
        [leadId],
    );
}
