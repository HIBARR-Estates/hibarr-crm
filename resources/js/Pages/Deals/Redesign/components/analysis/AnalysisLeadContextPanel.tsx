import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealFileUpload from "../../hooks/useDealFileUpload";
import { initialsFromName } from "../../adapters/initials";
import {
    sortItineraryItems,
    toWorkspaceItineraryItem,
} from "../../adapters/itineraryAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealAvatar from "../primitives/DealAvatar";
import AnalysisQuickNote from "./AnalysisQuickNote";
import AnalysisCustomFieldRow from "./AnalysisCustomFieldRow";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";

interface Props {
    leadCustomFields: any[];
    leadCustomFieldsData: Record<string, any>;
    isLoadingCustomFields: boolean;
    onLeadCustomFieldUpdate: (field: any, value: any) => Promise<void>;
    updatingField?: string | null;
    canEdit: boolean;
}

type Tab = "profile" | "notes" | "files" | "flights";

function PanelTab({
    id,
    label,
    active,
    controls,
    onClick,
}: {
    id: string;
    label: string;
    active: boolean;
    controls: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="tab"
            id={id}
            aria-selected={active}
            aria-controls={controls}
            onClick={onClick}
            className="flex-1 py-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            style={{
                borderBottom: `2px solid ${active ? T.BLUE : "transparent"}`,
                color: active ? T.BLUE : T.TEXT_MUTED,
                background: active ? `${T.BLUE}0d` : "transparent",
                marginBottom: -1,
            }}
        >
            {label}
        </button>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: T.TEXT_MUTED,
                marginBottom: 10,
            }}
        >
            {children}
        </div>
    );
}

function FieldSkeleton() {
    return (
        <div className="animate-pulse" style={{ padding: "10px 0", borderBottom: `1px solid ${T.BORDER}` }}>
            <div
                style={{
                    height: 10,
                    width: 60,
                    borderRadius: 4,
                    background: T.BORDER,
                    marginBottom: 8,
                }}
            />
            <div
                style={{
                    height: 16,
                    width: "80%",
                    borderRadius: 4,
                    background: T.BORDER,
                }}
            />
        </div>
    );
}

export default function AnalysisLeadContextPanel({
    leadCustomFields,
    leadCustomFieldsData,
    isLoadingCustomFields,
    onLeadCustomFieldUpdate,
    updatingField,
    canEdit,
}: Props) {
    const { td } = useTd();
    const { deal, notes, files, filesLoading } = useDealWorkspace();
    const contact = deal.contact as any;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFiles, isUploading } = useDealFileUpload(deal.id);

    const hasFlights = (deal.lead_flight_itineraries?.length ?? 0) > 0;
    const [activeTab, setActiveTab] = useState<Tab>("profile");

    const leadName = contact?.client_name || (deal as any).client_name || "";
    const email = contact?.client_email || "";
    const phones = [contact?.mobile, contact?.cell, contact?.office].filter(Boolean);
    const whatsapp = contact?.client_whatsapp || "";

    const ageDisplay = (() => {
        if (contact?.date_of_birth) {
            try {
                const d = new Date(contact.date_of_birth);
                const age = Math.floor(
                    (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000),
                );
                return `${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} (${age} yrs)`;
            } catch {}
        }
        return contact?.age ? `${contact.age} yrs` : null;
    })();

    const languages: string[] = Array.isArray(contact?.languages)
        ? contact.languages
        : [];

    const address =
        [
            contact?.address,
            contact?.city,
            contact?.state,
            contact?.country,
            contact?.postal_code,
        ]
            .filter(Boolean)
            .join(", ") || null;

    const whatsappGroupJoined: boolean | null =
        contact?.marketing?.has_joined_the_whatsapp_group ?? null;

    const whatsappDisplay = (() => {
        const num = contact?.client_whatsapp;
        const groupSuffix =
            whatsappGroupJoined !== null
                ? whatsappGroupJoined
                    ? ` · ✓ ${td("Group")}`
                    : ` · ✗ ${td("Group")}`
                : "";
        if (num) return `${num}${groupSuffix}`;
        if (whatsappGroupJoined !== null)
            return whatsappGroupJoined
                ? `✓ ${td("In group")}`
                : `✗ ${td("Not in group")}`;
        return null;
    })();

    const profileRows: Array<{ label: string; value: string }> = [
        { label: td("Gender"), value: contact?.gender?.value ?? contact?.gender },
        { label: td("Age"), value: ageDisplay },
        { label: td("Nationality"), value: contact?.nationality },
        { label: td("Occupation"), value: contact?.occupation },
        { label: td("Company"), value: contact?.company_name },
        { label: td("Languages"), value: languages.length ? languages.join(", ") : null },
        { label: td("Source"), value: contact?.leadSource?.name },
        { label: td("Category"), value: contact?.category?.name },
        { label: td("Owner"), value: contact?.leadOwner?.name },
        { label: td("Lifecycle"), value: contact?.lifecycleStatus?.name },
        { label: td("WhatsApp group"), value: whatsappDisplay },
        { label: td("Address"), value: address },
    ].filter((r): r is { label: string; value: string } =>
        r.value !== null && r.value !== undefined && r.value !== "",
    );

    // Separate regular custom fields from file-type custom fields
    const regularCustomFields = useMemo(
        () => leadCustomFields.filter((f: any) => f.type !== "file"),
        [leadCustomFields],
    );
    const fileCustomFields = useMemo(
        () => leadCustomFields.filter((f: any) => f.type === "file"),
        [leadCustomFields],
    );

    // Optimistic local values — visibility reacts immediately when a field changes,
    // without waiting for the server to confirm.
    const [localFieldValues, setLocalFieldValues] = useState<Record<string, any>>(
        () => ({ ...leadCustomFieldsData }),
    );
    useEffect(() => {
        setLocalFieldValues((prev) => ({ ...prev, ...leadCustomFieldsData }));
    }, [leadCustomFieldsData]);

    const handleFieldChange = useCallback((fieldId: number, value: any) => {
        setLocalFieldValues((prev) => ({ ...prev, [`field_${fieldId}`]: value }));
    }, []);

    // Visibility uses localFieldValues so hidden fields appear/disappear instantly
    const visibilityMap = useMemo(
        () => evaluateAllFieldsVisibility(regularCustomFields, localFieldValues),
        [regularCustomFields, localFieldValues],
    );
    const visibleRegularFields = useMemo(
        () => regularCustomFields.filter((f: any) => visibilityMap[f.id] !== false),
        [regularCustomFields, visibilityMap],
    );

    const itineraryItems = useMemo(
        () =>
            sortItineraryItems(
                (deal.lead_flight_itineraries ?? []).map(toWorkspaceItineraryItem),
                "upcoming",
            ),
        [deal.lead_flight_itineraries],
    );

    const tabs: Array<{ id: Tab; label: string }> = [
        { id: "profile", label: td("Profile") },
        { id: "notes", label: td("Notes") },
        { id: "files", label: td("Files") },
        ...(hasFlights ? [{ id: "flights" as Tab, label: td("Flights") }] : []),
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(e.target.files ?? []);
        if (chosen.length) uploadFiles(chosen);
        e.target.value = "";
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Tab bar */}
            <div
                role="tablist"
                aria-label={td("Lead context")}
                className="flex shrink-0"
                style={{ borderBottom: `1px solid ${T.BORDER}` }}
            >
                {tabs.map((tab) => (
                    <PanelTab
                        key={tab.id}
                        id={`analysis-tab-${tab.id}`}
                        controls={`analysis-panel-${tab.id}`}
                        label={tab.label}
                        active={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                    />
                ))}
            </div>

            {/* Scrollable panel content */}
            <div className="min-h-0 flex-1 overflow-y-auto">

                {/* ── Profile ── */}
                <div
                    role="tabpanel"
                    id="analysis-panel-profile"
                    aria-labelledby="analysis-tab-profile"
                    hidden={activeTab !== "profile"}
                >
                    {/* Hero */}
                    <div
                        style={{
                            background: `linear-gradient(160deg, ${T.BLUE_LIGHT} 0%, #f0f7ff 100%)`,
                            borderBottom: `1px solid ${T.BORDER}`,
                            padding: "20px 18px 16px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                            <DealAvatar size={56} initials={initialsFromName(leadName)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: T.NAVY,
                                        lineHeight: 1.2,
                                        marginBottom: 4,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {leadName || td("No name")}
                                </div>
                                {email && (
                                    <a
                                        href={`mailto:${email}`}
                                        style={{
                                            fontSize: 13,
                                            color: T.BLUE,
                                            textDecoration: "none",
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {email}
                                    </a>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {phones.map((p, i) => (
                                <a
                                    key={i}
                                    href={`tel:${p}`}
                                    className="dr-btn dr-btn-ghost dr-btn-sm"
                                    style={{ textDecoration: "none", fontSize: 12 }}
                                >
                                    📞 {p}
                                </a>
                            ))}
                            {email && (
                                <a
                                    href={`mailto:${email}`}
                                    className="dr-btn dr-btn-ghost dr-btn-sm"
                                    style={{ textDecoration: "none", fontSize: 12 }}
                                >
                                    ✉ {td("Email")}
                                </a>
                            )}
                            {whatsapp && (
                                <a
                                    href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="dr-btn dr-btn-ghost dr-btn-sm"
                                    style={{ textDecoration: "none", fontSize: 12 }}
                                >
                                    💬 WhatsApp
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Key details + inline-editable custom fields — all in one section */}
                    {(profileRows.length > 0 || isLoadingCustomFields || visibleRegularFields.length > 0) && (
                        <div
                            style={{
                                padding: "16px 18px",
                                borderBottom: `1px solid ${T.BORDER}`,
                            }}
                        >
                            <SectionLabel>{td("Details")}</SectionLabel>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {profileRows.map(({ label, value }) => (
                                    <div
                                        key={label}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            gap: 12,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: T.TEXT_MUTED,
                                                flexShrink: 0,
                                                minWidth: 80,
                                            }}
                                        >
                                            {label}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 14,
                                                color: T.TEXT,
                                                fontWeight: 500,
                                                textAlign: "right",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {value}
                                        </span>
                                    </div>
                                ))}

                                {/* Custom fields rendered inline — same visual weight as profileRows */}
                                {isLoadingCustomFields ? (
                                    <>
                                        <FieldSkeleton />
                                        <FieldSkeleton />
                                        <FieldSkeleton />
                                    </>
                                ) : (
                                    visibleRegularFields.map((field: any) => (
                                        <AnalysisCustomFieldRow
                                            key={field.id}
                                            field={field}
                                            value={leadCustomFieldsData[`field_${field.id}`] ?? null}
                                            saving={updatingField === `field_${field.id}`}
                                            canEdit={canEdit}
                                            onChange={(value) => handleFieldChange(field.id, value)}
                                            onSave={(value) => onLeadCustomFieldUpdate(field, value)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Notes ── */}
                <div
                    role="tabpanel"
                    id="analysis-panel-notes"
                    aria-labelledby="analysis-tab-notes"
                    hidden={activeTab !== "notes"}
                    className="flex flex-col gap-3 px-4 py-4"
                >
                    <AnalysisQuickNote />
                    {notes.length === 0 && (
                        <p
                            className="text-[12px] italic"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("Notes from this call appear here.")}
                        </p>
                    )}
                    {notes.map((note: any) => (
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
                                <div
                                    className="mt-1.5 text-[11px] font-medium"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {note.added_by.name}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Files ── (now a dedicated tab, not buried at the bottom of Profile) */}
                <div
                    role="tabpanel"
                    id="analysis-panel-files"
                    aria-labelledby="analysis-tab-files"
                    hidden={activeTab !== "files"}
                    style={{ padding: "16px 18px" }}
                >
                    {/* Upload button — prominent, at the top */}
                    <div style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            className="dr-btn dr-btn-primary dr-btn-sm"
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            style={{ width: "100%", justifyContent: "center" }}
                        >
                            {isUploading ? td("Uploading…") : `+ ${td("Upload file")}`}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: "none" }}
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Deal files */}
                    {filesLoading ? (
                        <div style={{ fontSize: 12, color: T.TEXT_HINT }}>{td("Loading…")}</div>
                    ) : files.length === 0 && fileCustomFields.length === 0 ? (
                        <p style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic" }}>
                            {td("No files attached yet.")}
                        </p>
                    ) : (
                        <>
                            {files.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <SectionLabel>{td("Uploaded files")}</SectionLabel>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {files.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    padding: "8px 10px",
                                                    borderRadius: 7,
                                                    background: T.SURFACE_2,
                                                    border: `1px solid ${T.BORDER}`,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                <span style={{ fontSize: 18 }}>{file.icon}</span>
                                                <span
                                                    style={{
                                                        fontSize: 13,
                                                        color: T.TEXT,
                                                        flex: 1,
                                                        minWidth: 0,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {file.filename}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: T.TEXT_HINT,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {file.size}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* File-type custom fields */}
                            {fileCustomFields.length > 0 && (
                                <div>
                                    <SectionLabel>{td("Document fields")}</SectionLabel>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {fileCustomFields.map((field: any) => {
                                            const val = leadCustomFieldsData[`field_${field.id}`];
                                            return (
                                                <div
                                                    key={field.id}
                                                    style={{
                                                        padding: "10px 12px",
                                                        borderRadius: 7,
                                                        background: T.SURFACE_2,
                                                        border: `1px solid ${T.BORDER}`,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.06em",
                                                            color: T.TEXT_MUTED,
                                                            marginBottom: 4,
                                                        }}
                                                    >
                                                        {field.label}
                                                    </div>
                                                    {val ? (
                                                        <a
                                                            href={typeof val === "string" && val.startsWith("http") ? val : undefined}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                fontSize: 13,
                                                                color: T.BLUE,
                                                                textDecoration: "none",
                                                                display: "block",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {typeof val === "string" ? val.split("/").pop() ?? val : String(val)}
                                                        </a>
                                                    ) : (
                                                        <span style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic" }}>
                                                            —
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Flights ── */}
                {hasFlights && (
                    <div
                        role="tabpanel"
                        id="analysis-panel-flights"
                        aria-labelledby="analysis-tab-flights"
                        hidden={activeTab !== "flights"}
                        className="flex flex-col gap-2 px-4 py-4"
                    >
                        {itineraryItems.map((leg) => (
                            <div
                                key={leg.id}
                                className="rounded-lg px-3 py-2.5"
                                style={{
                                    background: T.SURFACE_2,
                                    border: `1px solid ${T.BORDER}`,
                                }}
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <span
                                        className={`dr-pill dr-pill-${leg.direction === "arrival" ? "green" : "blue"}`}
                                        style={{ fontSize: 10 }}
                                    >
                                        {leg.direction === "arrival"
                                            ? td("Arrival")
                                            : td("Departure")}
                                    </span>
                                    {leg.isTransferRequired && (
                                        <span
                                            className="dr-pill dr-pill-amber"
                                            style={{ fontSize: 10 }}
                                        >
                                            {td("Transfer")}
                                        </span>
                                    )}
                                </div>
                                <div
                                    className="truncate text-[12px] font-semibold"
                                    style={{ color: T.TEXT }}
                                >
                                    {leg.airportLabel}
                                </div>
                                <div
                                    className="text-[11px]"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {leg.dateLabel} · {leg.timeLabel}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
