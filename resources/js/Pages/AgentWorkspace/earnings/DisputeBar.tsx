import { useEffect, useRef, useState } from "react";
import { message } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import useTranslation from "@/Hooks/useTranslation";
import { dayMonth } from "./format";
import useCommissionDispute from "./useCommissionDispute";
import type { CommissionLine, DisputeView } from "./types";

interface DisputeBarProps {
    line: CommissionLine;
    /** "send" asks for the text; "view" shows the dispute already sent. */
    mode: "send" | "view";
    onClose: () => void;
    /** Records the sent dispute on its line; the page closes the bar itself only if that line is still the one open. */
    onSent: (commissionId: number, dispute: DisputeView) => void;
}

/**
 * The bar under the table (L7-22): the deal it is about, one line to say what
 * is wrong, Cancel and Send dispute. For a line already disputed the same bar
 * reads the dispute back, with its status and any answer.
 */
export default function DisputeBar({ line, mode, onClose, onSent }: DisputeBarProps) {
    const { t, locale } = useTranslation();
    const { sending, send } = useCommissionDispute();
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const bar = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);

    const deal = line.deal_name?.trim() || line.person?.trim() || t("pages.agent_workspace.earnings.table.unnamed");

    useEffect(() => {
        bar.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        if (mode === "send") input.current?.focus();
    }, [mode, line.id]);

    const submit = async () => {
        if (!text.trim() || sending) return;
        setError(null);
        const outcome = await send(line.id, text);
        if (outcome.ok) {
            message.success(t("pages.agent_workspace.earnings.dispute.sent"));
            onSent(line.id, outcome.dispute);
        } else {
            setError(outcome.message || t("pages.agent_workspace.earnings.dispute.failed"));
        }
    };

    if (mode === "view" && line.dispute) {
        const { dispute } = line;
        const year = new Date().getFullYear();
        const sent = dispute.created_at ? dayMonth(dispute.created_at, locale, year) : null;
        return (
            <div ref={bar} className="agent-ea__dispute" role="region" aria-label={t("pages.agent_workspace.earnings.dispute.title", { deal })}>
                <b className="agent-ea__dispute-title">{t("pages.agent_workspace.earnings.dispute.title", { deal })}</b>
                <span className="agent-ea__dispute-text">
                    {dispute.message || dispute.reason}
                    <span className="agent-ea__dispute-meta">
                        {dispute.status === "open" ? t("pages.agent_workspace.earnings.dispute.open") : t("pages.agent_workspace.earnings.dispute.resolved")}
                        {sent ? ` · ${t("pages.agent_workspace.earnings.dispute.sent_on", { date: sent })}` : ""}
                        {dispute.resolution_note ? ` · ${t("pages.agent_workspace.earnings.dispute.answer", { note: dispute.resolution_note })}` : ""}
                    </span>
                </span>
                <Button onClick={onClose}>{t("pages.agent_workspace.earnings.dispute.close")}</Button>
            </div>
        );
    }

    return (
        <div ref={bar} className="agent-ea__dispute" role="region" aria-label={t("pages.agent_workspace.earnings.dispute.title", { deal })}>
            <b className="agent-ea__dispute-title">{t("pages.agent_workspace.earnings.dispute.title", { deal })}</b>
            <input
                ref={input}
                className="agent-ea__dispute-input"
                value={text}
                maxLength={2000}
                aria-label={t("pages.agent_workspace.earnings.dispute.label")}
                placeholder={t("pages.agent_workspace.earnings.dispute.placeholder")}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") void submit();
                    if (event.key === "Escape") onClose();
                }}
            />
            <Button onClick={onClose} disabled={sending}>
                {t("pages.agent_workspace.earnings.dispute.cancel")}
            </Button>
            <Button variant="navy" onClick={() => void submit()} loading={sending} disabled={!text.trim()}>
                {t("pages.agent_workspace.earnings.dispute.send")}
            </Button>
            {error ? (
                <span className="agent-ea__dispute-error" role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
}
