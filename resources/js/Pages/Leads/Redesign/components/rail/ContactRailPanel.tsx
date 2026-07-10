import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import DealBadge from "@/Pages/Deals/Redesign/components/primitives/DealBadge";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../primitives/LeadIcon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatPhoneNumber } from "@/lib/utils";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";

interface ContactRailPanelProps {
    lead: Lead;
    contactLogged: boolean;
    isLoggingContact?: boolean;
    onLogContact?: () => void;
    onEditProfile?: () => void;
}

export default function ContactRailPanel({
    lead,
    contactLogged,
    isLoggingContact = false,
    onLogContact,
    onEditProfile,
}: ContactRailPanelProps) {
    const { td } = useTd();

    const phone = formatPhoneNumber(lead.mobile || lead.cell);
    const email = lead.client_email;

    const copyEmail = async () => {
        if (!email) return;
        try {
            await navigator.clipboard.writeText(email);
            message.success(td("Copied"));
        } catch {
            message.error(td("Copy failed"));
        }
    };

    const locationBits = [lead.nationality, lead.city].filter(Boolean).join(" · ");

    return (
        <section className="section-card overflow-hidden">
            <header
                className="flex items-center justify-between px-3 py-2.5"
                style={{ background: T.NAVY }}
            >
                <h3 className="m-0 text-xs font-semibold text-white">
                    {td("Contact")}
                </h3>
                {onEditProfile && (
                    <button
                        type="button"
                        onClick={onEditProfile}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255,255,255,0.85)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {td("Edit")}
                    </button>
                )}
            </header>

            <div className="grid gap-0.5 p-3">
                {phone ? (
                    <a
                        href={`tel:${lead.mobile || lead.cell}`}
                        className="flex items-center gap-1.5 no-underline"
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.BLUE,
                            padding: "4px 6px",
                            margin: "0 -6px",
                        }}
                    >
                        <LeadIcon name="phone" size={12} color={T.BLUE} />
                        {phone}
                    </a>
                ) : (
                    <p className="text-xs text-[#9ca3af]">{td("No phone")}</p>
                )}

                {email && (
                    <button
                        type="button"
                        onClick={copyEmail}
                        className="flex w-full items-center gap-1.5 text-left"
                        style={{
                            background: "transparent",
                            border: "none",
                            padding: "4px 6px",
                            margin: "0 -6px",
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            cursor: "pointer",
                        }}
                    >
                        <LeadIcon name="mail" size={12} color={T.TEXT_MUTED} />
                        <span className="min-w-0 flex-1 truncate">{email}</span>
                        <span
                            className="ml-auto flex items-center gap-0.5"
                            style={{ fontSize: 10, color: T.TEXT_HINT }}
                        >
                            <LeadIcon name="copy" size={11} color={T.TEXT_HINT} />
                            {td("Copy")}
                        </span>
                    </button>
                )}

                {locationBits && (
                    <div
                        style={{
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            marginTop: 6,
                        }}
                    >
                        {locationBits}
                    </div>
                )}

                {lead.value != null && lead.value > 0 && (
                    <div style={{ fontSize: 12 }}>
                        <span style={{ color: T.TEXT_HINT }}>{td("Budget")} </span>
                        {lead.value}
                    </div>
                )}

                <div className="mt-2">
                    {!contactLogged ? (
                        <DealButton
                            variant="primary"
                            onClick={onLogContact}
                            loading={isLoggingContact}
                            disabled={!onLogContact || isLoggingContact}
                            style={{ width: "100%", fontSize: 12 }}
                        >
                            {td("Log contact")}
                        </DealButton>
                    ) : (
                        <DealBadge variant="green">{td("Contact logged")}</DealBadge>
                    )}
                </div>
            </div>
        </section>
    );
}
