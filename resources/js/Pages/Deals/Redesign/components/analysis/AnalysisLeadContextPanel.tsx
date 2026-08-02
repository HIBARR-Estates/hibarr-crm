import { useMemo, useState } from "react";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import { initialsFromName } from "../../adapters/initials";
import {
    sortItineraryItems,
    toWorkspaceItineraryItem,
} from "../../adapters/itineraryAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealAvatar from "../primitives/DealAvatar";
import DealIcon from "../primitives/DealIcon";
import AnalysisQuickNote from "./AnalysisQuickNote";

function SectionToggle({
    label,
    open,
    onToggle,
}: {
    label: string;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
            style={{ borderBottom: `1px solid ${T.BORDER}` }}
        >
            <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: T.TEXT_HINT }}>
                {label}
            </span>
            <span className="text-[10px]" style={{ color: T.TEXT_HINT }}>
                {open ? "▲" : "▼"}
            </span>
        </button>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-2 py-1">
            <span className="w-[110px] shrink-0 text-[11px] font-medium" style={{ color: T.TEXT_HINT }}>
                {label}
            </span>
            <span className="min-w-0 text-[12px]" style={{ color: T.TEXT }}>
                {value}
            </span>
        </div>
    );
}

interface Props {
    leadCustomFields: any[];
    leadCustomFieldsData: Record<string, any>;
    onLeadCustomFieldUpdate: (field: any, value: any) => Promise<void>;
    updatingField?: string | null;
    canEdit: boolean;
}

export default function AnalysisLeadContextPanel({
    leadCustomFields,
    leadCustomFieldsData,
    onLeadCustomFieldUpdate,
    updatingField,
    canEdit,
}: Props) {
    const { td } = useTd();
    const { deal, notes } = useDealWorkspace();
    const contact = deal.contact as any;

    const [contactOpen, setContactOpen] = useState(true);
    const [fieldsOpen, setFieldsOpen] = useState(leadCustomFields.length > 0);
    const [notesOpen, setNotesOpen] = useState(true);
    const [itineraryOpen, setItineraryOpen] = useState(
        (deal.lead_flight_itineraries?.length ?? 0) > 0,
    );

    const leadName = contact?.client_name || (deal as any).client_name || "";
    const email = contact?.client_email || "";
    const phones = [
        contact?.mobile,
        contact?.cell,
        contact?.office,
    ].filter(Boolean);
    const source = contact?.leadSource?.name || "";

    // Date of birth / age display
    const dobLabel = (() => {
        if (!contact?.date_of_birth) return null;
        try {
            const d = new Date(contact.date_of_birth);
            const formatted = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
            const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
            return `${formatted} (${age} yrs)`;
        } catch {
            return contact.date_of_birth;
        }
    })();

    const ageDisplay = dobLabel ?? (contact?.age ? `${contact.age} yrs` : null);

    const gender = contact?.gender?.value ?? contact?.gender ?? null;
    const nationality = contact?.nationality ?? null;
    const occupation = contact?.occupation ?? null;
    const languages: string[] = Array.isArray(contact?.languages) ? contact.languages : [];
    const companyName = contact?.company_name ?? null;
    const address = [contact?.address, contact?.city, contact?.state, contact?.country, contact?.postal_code]
        .filter(Boolean).join(", ") || null;

    const leadOwnerName = contact?.leadOwner?.name ?? null;
    const categoryName = contact?.category?.name ?? null;
    const lifecycleStatus = contact?.lifecycleStatus?.name ?? null;
    const whatsappGroupJoined: boolean | null =
        contact?.marketing?.has_joined_the_whatsapp_group ?? null;
    const whatsappNumber = contact?.client_whatsapp ?? null;

    const itineraryItems = useMemo(
        () =>
            sortItineraryItems(
                (deal.lead_flight_itineraries ?? []).map(toWorkspaceItineraryItem),
                "upcoming",
            ),
        [deal.lead_flight_itineraries],
    );

    const recentNotes = notes.slice(0, 5);

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            {/* Lead profile */}
            <SectionToggle
                label={td("Lead Profile")}
                open={contactOpen}
                onToggle={() => setContactOpen((v) => !v)}
            />
            {contactOpen && (
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.BORDER}` }}>
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 mb-3">
                        <DealAvatar size={40} initials={initialsFromName(leadName)} />
                        <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold" style={{ color: T.TEXT }}>
                                {leadName || td("No name")}
                            </div>
                            {email && (
                                <a
                                    href={`mailto:${email}`}
                                    className="block truncate text-[12px] hover:underline"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {email}
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Phones */}
                    {phones.length > 0 && (
                        <div className="mb-2 flex flex-col gap-1">
                            {phones.map((p, i) => (
                                <a
                                    key={i}
                                    href={`tel:${p}`}
                                    className="flex items-center gap-2 text-[12px] hover:underline"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    <DealIcon name="phone" size={11} color={T.TEXT_HINT} />
                                    {p}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Structured lead profile rows */}
                    <div className="mt-1 flex flex-col" style={{ borderTop: `1px solid ${T.BORDER}`, paddingTop: 8 }}>
                        <InfoRow label={td("Gender")} value={gender} />
                        <InfoRow label={td("Age")} value={ageDisplay} />
                        <InfoRow label={td("Nationality")} value={nationality} />
                        <InfoRow label={td("Occupation")} value={occupation} />
                        <InfoRow label={td("Company")} value={companyName} />
                        <InfoRow
                            label={td("Languages")}
                            value={languages.length ? languages.join(", ") : null}
                        />
                        <InfoRow label={td("Address")} value={address} />
                        <InfoRow label={td("Source")} value={source} />
                        <InfoRow label={td("Category")} value={categoryName} />
                        <InfoRow label={td("Lead Owner")} value={leadOwnerName} />
                        <InfoRow label={td("Lifecycle")} value={lifecycleStatus} />
                        <InfoRow
                            label={td("WhatsApp")}
                            value={
                                whatsappNumber ? (
                                    <span>
                                        {whatsappNumber}
                                        {whatsappGroupJoined !== null && (
                                            <span
                                                className="ml-2 text-[10px] font-semibold"
                                                style={{ color: whatsappGroupJoined ? T.GREEN : T.TEXT_HINT }}
                                            >
                                                {whatsappGroupJoined ? `✓ ${td("Group")}` : `✗ ${td("Group")}`}
                                            </span>
                                        )}
                                    </span>
                                ) : whatsappGroupJoined !== null ? (
                                    <span
                                        style={{ color: whatsappGroupJoined ? T.GREEN : T.TEXT_HINT }}
                                        className="text-[12px]"
                                    >
                                        {whatsappGroupJoined ? `✓ ${td("In group")}` : `✗ ${td("Not in group")}`}
                                    </span>
                                ) : null
                            }
                        />
                    </div>
                </div>
            )}

            {/* Lead custom fields */}
            {leadCustomFields.length > 0 && (
                <>
                    <SectionToggle
                        label={td("Lead Fields")}
                        open={fieldsOpen}
                        onToggle={() => setFieldsOpen((v) => !v)}
                    />
                    {fieldsOpen && (
                        <div
                            className="px-4 py-3"
                            style={{ borderBottom: `1px solid ${T.BORDER}` }}
                        >
                            <CustomFieldDisplay
                                fields={leadCustomFields}
                                customFieldsData={leadCustomFieldsData}
                                bare
                                column={1}
                                editable={canEdit}
                                activateOnSingleClick
                                onUpdate={(field: any, value: any) =>
                                    onLeadCustomFieldUpdate(field, value)
                                }
                                loadingField={updatingField}
                                disabled={!canEdit}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Notes */}
            <SectionToggle
                label={td("Notes")}
                open={notesOpen}
                onToggle={() => setNotesOpen((v) => !v)}
            />
            {notesOpen && (
                <div
                    className="flex flex-col gap-3 px-4 py-3"
                    style={{ borderBottom: `1px solid ${T.BORDER}` }}
                >
                    <AnalysisQuickNote />
                    {recentNotes.length === 0 && (
                        <p className="text-[12px] italic" style={{ color: T.TEXT_HINT }}>
                            {td("No notes yet.")}
                        </p>
                    )}
                    {recentNotes.map((note: any) => (
                        <div
                            key={note.id}
                            className="rounded-lg px-3 py-2.5"
                            style={{
                                background: T.SURFACE_2,
                                border: `1px solid ${T.BORDER}`,
                            }}
                        >
                            {note.title && (
                                <div
                                    className="mb-0.5 text-[12px] font-semibold dr-clamp-1"
                                    style={{ color: T.TEXT }}
                                >
                                    {note.title}
                                </div>
                            )}
                            <div
                                className="dr-clamp-3 text-[12px]"
                                style={{ color: T.TEXT_MUTED }}
                                dangerouslySetInnerHTML={{
                                    __html: note.details || note.text || "",
                                }}
                            />
                            {note.added_by?.name && (
                                <div className="mt-1.5 text-[11px]" style={{ color: T.TEXT_HINT }}>
                                    {note.added_by.name}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Itinerary */}
            {itineraryItems.length > 0 && (
                <>
                    <SectionToggle
                        label={td("Itinerary")}
                        open={itineraryOpen}
                        onToggle={() => setItineraryOpen((v) => !v)}
                    />
                    {itineraryOpen && (
                        <div className="flex flex-col gap-2 px-4 py-3">
                            {itineraryItems.map((leg) => (
                                <div
                                    key={leg.id}
                                    className="rounded-lg px-3 py-2"
                                    style={{
                                        background: T.SURFACE_2,
                                        border: `1px solid ${T.BORDER}`,
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`dr-pill dr-pill-${leg.direction === "arrival" ? "green" : "blue"}`}
                                            style={{ fontSize: 10 }}
                                        >
                                            {leg.direction === "arrival" ? td("Arrival") : td("Departure")}
                                        </span>
                                        {leg.isTransferRequired && (
                                            <span className="dr-pill dr-pill-amber" style={{ fontSize: 10 }}>
                                                {td("Transfer")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 truncate text-[12px] font-semibold" style={{ color: T.TEXT }}>
                                        {leg.airportLabel}
                                    </div>
                                    <div className="text-[11px]" style={{ color: T.TEXT_MUTED }}>
                                        {leg.dateLabel} · {leg.timeLabel}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
