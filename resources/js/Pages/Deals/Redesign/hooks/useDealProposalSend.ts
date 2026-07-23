import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";

export default function useDealProposalSend() {
    const { t } = useTranslation();
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
                    message.success(
                        data.message || t("pages.deals.workspace.offers.messages.sent"),
                    );
                    router.reload({ only: ["proposals"] });
                    return;
                }

                message.error(
                    data.message || t("pages.deals.workspace.offers.messages.send_failed"),
                );
            })
            .catch(() => {
                message.error(t("pages.deals.workspace.offers.messages.send_failed"));
            })
            .finally(() => setSendingId(null));
    }, [t]);

    return {
        sendProposal,
        sendingId,
    };
}
