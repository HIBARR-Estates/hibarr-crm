import { useMemo, useState } from "react";
import { message } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import DealAvatar from "../../primitives/DealAvatar";
import DealIcon from "../../primitives/DealIcon";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import { formatPhoneNumber } from "@/lib/utils";

interface WorkspaceLeadCardProps {
    deal: Deal;
}

function initialsFromName(name?: string | null): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export default function WorkspaceLeadCard({ deal }: WorkspaceLeadCardProps) {
    const { td } = useTd();
    const [emailCopied, setEmailCopied] = useState(false);
    const contact = deal.contact;

    const leadName = useMemo(
        () =>
            contact?.client_name_salutation ||
            contact?.client_name ||
            td("Unknown lead"),
        [contact?.client_name, contact?.client_name_salutation, td],
    );

    const phone = formatPhoneNumber(contact?.mobile || contact?.cell || null);
    const email = contact?.client_email || null;
    const leadUrl = contact?.id ? route("lead-contact.show", contact.id) : null;

    const copyEmail = async () => {
        if (!email) return;
        try {
            await navigator.clipboard.writeText(email);
            setEmailCopied(true);
            message.success(td("Email copied"));
            window.setTimeout(() => setEmailCopied(false), 2000);
        } catch {
            message.error(td("Copy failed"));
        }
    };

    if (!contact?.id) {
        return null;
    }

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader
                title={td("Lead")}
                rightSlot={
                    leadUrl ? (
                        <a
                            href={leadUrl}
                            aria-label={td("Open lead profile")}
                            className="flex text-white/75 hover:text-white"
                        >
                            <DealIcon
                                name="external-link"
                                size={13}
                                color="currentColor"
                            />
                        </a>
                    ) : undefined
                }
            />
            <div className="p-[13px]">
                <a
                    href={leadUrl ?? "#"}
                    className="mb-2.5 flex items-center gap-2.5 text-inherit no-underline"
                >
                    <DealAvatar
                        size={34}
                        initials={initialsFromName(leadName)}
                    />
                    <div>
                        <div className="text-sm font-medium text-[#1a1f2e]">
                            {leadName}
                        </div>
                        <div className="text-[11px] text-[#9ca3af]">
                            {td("Lead contact")}
                        </div>
                    </div>
                </a>

                {email && (
                    <button
                        type="button"
                        onClick={copyEmail}
                        className="contact-field mb-0.5 flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-xs text-[#5b6472] hover:bg-[#f5f6f8]"
                    >
                        <DealIcon name="mail" size={12} />
                        <span className="min-w-0 flex-1 truncate">{email}</span>
                        <span
                            className="ml-auto flex items-center gap-1 text-[10px]"
                            style={{
                                color: emailCopied ? T.GREEN : T.TEXT_HINT,
                            }}
                        >
                            <DealIcon
                                name={emailCopied ? "check" : "copy"}
                                size={11}
                                color={emailCopied ? T.GREEN : T.TEXT_HINT}
                            />
                            {emailCopied ? td("Copied") : td("Copy")}
                        </span>
                    </button>
                )}

                {phone && (
                    <a
                        href={`tel:${phone}`}
                        className="contact-field flex items-center gap-1.5 rounded px-1.5 py-1.5 text-xs text-[#5b6472] no-underline hover:bg-[#f5f6f8]"
                    >
                        <DealIcon name="phone" size={12} />
                        <span className="min-w-0 flex-1 truncate">{phone}</span>
                        <span className="ml-auto text-[10px] text-[#9ca3af]">
                            {td("Call")}
                        </span>
                    </a>
                )}

                {leadUrl && (
                    <div className="mt-2 border-t border-[#e2e5ea] pt-2 text-right">
                        <a
                            href={leadUrl}
                            className="text-[11px] text-[#1a6bb5] no-underline hover:text-[#145890]"
                        >
                            {td("View lead profile ↗")}
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}
