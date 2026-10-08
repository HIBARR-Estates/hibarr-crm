import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type {
    EmailTimelineGroup,
    EmailTimelineGroupsResponse,
} from "@/Email/types";

/**
 * Compact conversation groups for the Lead/Deal redesign Timeline.
 * Fail-closed: when disabled or the API denies access, returns [].
 */
export default function useEmailTimelineGroups(options: {
    recordType: "lead" | "deal";
    recordId: number;
    enabled: boolean;
}) {
    const { recordType, recordId, enabled } = options;
    const [groups, setGroups] = useState<EmailTimelineGroup[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!enabled || !recordId) {
            setGroups([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get<EmailTimelineGroupsResponse>(
                `/email/records/${recordType}/${recordId}/timeline`,
            );
            setGroups(response.data.groups ?? []);
        } catch {
            setGroups([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, recordId, recordType]);

    useEffect(() => {
        void load();
    }, [load]);

    return { groups, loading, reload: load };
}
