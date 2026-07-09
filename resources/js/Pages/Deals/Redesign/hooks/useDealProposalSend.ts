import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";

export default function useDealProposalSend() {
    const [sendingId, setSendingId] = useState<number | null>(null);

    const sendProposal = useCallback((proposalId: number) => {
        setSendingId(proposalId);

        fetch(route("proposals.send_proposal", proposalId), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN":
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content") || "",
                Accept: "application/json",
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.status === "success") {
                    message.success(data.message || "Offer sent to client");
                    router.reload({ only: ["proposals"] });
                    return;
                }

                message.error(data.message || "Failed to send offer");
            })
            .catch(() => {
                message.error("Failed to send offer");
            })
            .finally(() => setSendingId(null));
    }, []);

    return {
        sendProposal,
        sendingId,
    };
}
