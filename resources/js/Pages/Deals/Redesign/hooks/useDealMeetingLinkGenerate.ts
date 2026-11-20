import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

/**
 * Asks the meeting platform for a link again, for a meeting whose automatic
 * link failed (the "Meeting link generation failed" alert lands here). The new
 * link is patched into the workspace's meetings, so the card shows it at once.
 */
export default function useDealMeetingLinkGenerate() {
    const { t } = useTranslation();
    const { setDealFollowUps } = useDealWorkspace();
    const [generating, setGenerating] = useState(false);

    const generateLink = useCallback(
        async (followUpId: number): Promise<string | null> => {
            setGenerating(true);
            try {
                const response = await axios.post(route("deals.generate-meeting-link"), { followup_id: followUpId });
                const link: string | null = response.data?.meeting_link ?? null;
                if (response.data?.status !== "success" || !link) {
                    message.error(t("pages.deals.workspace.meetings.generate_link_failed"));
                    return null;
                }
                setDealFollowUps((prev) => prev.map((followUp) => (followUp.id === followUpId ? { ...followUp, meeting_link: link } : followUp)));
                return link;
            } catch {
                message.error(t("pages.deals.workspace.meetings.generate_link_failed"));
                return null;
            } finally {
                setGenerating(false);
            }
        },
        [setDealFollowUps, t],
    );

    return { generateLink, generating };
}
