import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import LeadIcon from "../primitives/LeadIcon";
import useTranslation from "@/Hooks/useTranslation";

interface ContactRailPanelProps {
    lead: Lead;
}

export default function ContactRailPanel({ lead }: ContactRailPanelProps) {
    const { t } = useTranslation();

    const copyToClipboard = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            message.success(`${label} copied`);
        } catch {
            message.error("Copy failed");
        }
    };

    const rows = [
        { label: "Phone", value: lead.mobile || lead.cell, icon: "phone" },
        { label: "Email", value: lead.client_email, icon: "mail" },
        { label: "City", value: lead.city, icon: "map-pin" },
        { label: "Nationality", value: lead.nationality, icon: "user" },
        {
            label: "Budget",
            value: lead.value ? String(lead.value) : null,
            icon: "wallet",
        },
    ].filter((r) => r.value);

    return (
        <section className="rail-panel">
            <header className="border-b border-[#eef1f5] px-3 py-2.5">
                <h3 className="text-xs font-semibold text-[#1a1f2e]">
                    {t("pages.leads.contact_details")}
                </h3>
            </header>
            <div className="space-y-2.5 p-3">
                {rows.length === 0 && (
                    <p className="text-xs text-[#9ca3af]">No contact details</p>
                )}
                {rows.map((row) => (
                    <div key={row.label} className="group">
                        <p className="field-label">{row.label}</p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="field-read truncate">{row.value}</p>
                            <button
                                type="button"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => copyToClipboard(row.value!, row.label)}
                                aria-label={`Copy ${row.label}`}
                            >
                                <LeadIcon name="copy" size={12} color="#9ca3af" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
