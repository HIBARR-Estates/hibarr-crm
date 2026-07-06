import { useMemo, useState } from "react";
import { Deal } from "@/Types/api/deals";

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export default function useDealTeam(deal: Deal) {
    const [teamModalOpen, setTeamModalOpen] = useState(false);

    const agent = useMemo(() => {
        const candidate = deal.agent ?? deal.lead_agent ?? null;
        if (!candidate) return null;
        return {
            id: candidate.id,
            name: candidate.user?.name ?? candidate.name,
            initials: initialsFromName(candidate.user?.name ?? candidate.name),
        };
    }, [deal.agent, deal.lead_agent]);

    const participants = useMemo(
        () =>
            (deal.deal_participants ?? []).map((participant) => ({
                id: participant.id,
                name: participant.name,
                initials: initialsFromName(participant.name),
            })),
        [deal.deal_participants],
    );

    const watchers = useMemo(
        () =>
            (deal.deal_watchers ?? []).map((watcher) => ({
                id: watcher.id,
                name: watcher.name,
                initials: initialsFromName(watcher.name),
            })),
        [deal.deal_watchers],
    );

    return {
        teamModalOpen,
        setTeamModalOpen,
        agent,
        participants,
        watchers,
    };
}
