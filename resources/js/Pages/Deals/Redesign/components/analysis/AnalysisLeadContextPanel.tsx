import { useCallback, useMemo, useRef, useState } from "react";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealFileUpload from "../../hooks/useDealFileUpload";
import { initialsFromName } from "../../adapters/initials";
import {
    sortItineraryItems,
    toWorkspaceItineraryItem,
} from "../../adapters/itineraryAdapter";
import AnalysisQuickNote from "./AnalysisQuickNote";
import AnalysisCustomFieldRow from "./AnalysisCustomFieldRow";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { GENDER_OPTIONS } from "../../config/analysisFieldMeta";

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
    leadCustomFields: any[];
    leadCustomFieldsData: Record<string, any>;
    onLeadCustomFieldSave: (fieldId: number, value: any) => void;
    onLeadCustomFieldChange: (fieldId: number, value: any) => void;
    onContactFieldSave: (fieldKey: string, value: any) => void;
    canEdit: boolean;
}

type Tab = "lead" | "files" | "notes" | "flights";

// ── Formatters ────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return iso;
    }
}

// ── FieldGroup (revamp §C.3 styling) ──────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border-b border-slate-200">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-2.5 transition-colors bg-slate-50 hover:bg-slate-100"
            >
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-900">
                    {label}
                </span>
                <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-transform text-slate-400 ${open ? "" : "-rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="divide-y divide-slate-100">
                    {children}
                </div>
            )}
        </div>
    );
}

function FieldSkeleton() {
    return (
        <div className="animate-pulse px-4 py-2.5 border-b border-slate-100">
            <div className="h-2.5 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
        </div>
    );
}

// ── ProfileCard (revamp §C.1) ──────────────────────────────────────────────

function ProfileCard({ leadName, email, phones, whatsapp, imageUrl }: {
    leadName: string;
    email: string;
    phones: string[];
    whatsapp: string;
    imageUrl?: string;
}) {
    const initials = initialsFromName(leadName);
    const [imgError, setImgError] = useState(false);

    return (
        <div className="p-4 border-b border-slate-200">
            {/* Avatar + info row */}
            <div className="flex items-center gap-3 mb-3">
                {imageUrl && !imgError ? (
                    <img
                        src={imageUrl}
                        alt={initials}
                        onError={() => setImgError(true)}
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                ) : (
                    <div
                        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold"
                        style={{ backgroundColor: "#0A2E5D" }}
                    >
                        {initials}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                        {leadName || "No name"}
                    </div>
                    {email && (
                        <div className="text-xs text-slate-500 truncate">{email}</div>
                    )}
                    {phones[0] && (
                        <div className="text-xs text-slate-500 truncate">{phones[0]}</div>
                    )}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
                {phones[0] && (
                    <a
                        href={`tel:${phones[0]}`}
                        className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: "#0A2E5D" }}
                    >
                        {/* Handset icon */}
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {"Call"}
                    </a>
                )}
                {email && (
                    <a
                        href={`mailto:${email}`}
                        className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-slate-700 border border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        {/* Envelope icon */}
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {"Email"}
                    </a>
                )}
                {whatsapp && (
                    <a
                        href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-slate-700 border border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        {/* WhatsApp icon */}
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                    </a>
                )}
            </div>
        </div>
    );
}

// ── CoreFieldRow (read-only display, same shape as AnalysisCustomFieldRow display mode) ──

function CoreFieldRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 py-2 px-4">
            <span className="w-[130px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">
                {label}
            </span>
            <span className="flex-1 text-sm text-slate-800 font-medium break-words">
                {value || <span className="text-slate-300">—</span>}
            </span>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AnalysisLeadContextPanel({
    leadCustomFields,
    leadCustomFieldsData,
    onLeadCustomFieldSave,
    onLeadCustomFieldChange,
    onContactFieldSave,
    canEdit,
}: Props) {
    const { deal, notes, files, filesLoading } = useDealWorkspace();
    const contact = deal.contact as any;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFiles, isUploading } = useDealFileUpload(deal.id);

    const hasFlights = (deal.lead_flight_itineraries?.length ?? 0) > 0;
    const [activeTab, setActiveTab] = useState<Tab>("lead");

    const leadName = contact?.client_name || (deal as any).client_name || "";
    const email = contact?.client_email || "";
    const phones = [contact?.mobile, contact?.cell, contact?.office].filter(Boolean);
    const whatsapp = contact?.client_whatsapp || "";

    // ── Data derivations ─────────────────────────────────────────────────

    const languages: string[] = Array.isArray(contact?.languages) ? contact.languages : [];

    const address =
        [contact?.address, contact?.city, contact?.state, contact?.country, contact?.postal_code]
            .filter(Boolean)
            .join(", ") || null;

    const whatsappGroupJoined: boolean | null = contact?.marketing?.has_joined_the_whatsapp_group ?? null;
    const whatsappDisplay = (() => {
        const num = contact?.client_whatsapp;
        const groupSuffix = whatsappGroupJoined !== null
            ? whatsappGroupJoined ? ` · ✓ ${"Group"}` : ` · ✗ ${"Group"}`
            : "";
        if (num) return `${num}${groupSuffix}`;
        if (whatsappGroupJoined !== null) return whatsappGroupJoined ? `✓ ${"In group"}` : `✗ ${"Not in group"}`;
        return null;
    })();

    // Read-only relation rows — always-visible + conditional
    const alwaysReadOnlyRows: Array<{ label: string; value: string | null }> = [
        { label: "Source", value: contact?.leadSource?.name ?? null },
        { label: "Lead Owner", value: contact?.leadOwner?.name ?? null },
        { label: "Status", value: contact?.lifecycleStatus?.name ?? null },
    ];
    const conditionalReadOnlyRows: Array<{ label: string; value: string | null }> = [
        {
            label: "Category",
            value: (() => {
                const multi = contact?.categories as
                    | Array<{ category_name?: string; name?: string }>
                    | undefined;
                if (Array.isArray(multi) && multi.length) {
                    return multi
                        .map((c) => c.category_name || c.name || "")
                        .filter(Boolean)
                        .join(", ");
                }
                return (
                    contact?.category?.category_name ??
                    contact?.category?.name ??
                    null
                );
            })(),
        },
    ].filter((r) => r.value !== null && r.value !== "");

    // Age range — show only when both age and date_of_birth are absent
    const ageRange: string | null = (() => {
        if (contact?.age || contact?.date_of_birth) return null;
        const ar = contact?.age_range;
        if (!ar) return null;
        return String(ar?.value ?? ar);
    })();

    // ── Custom field grouping ─────────────────────────────────────────────

    const regularCustomFields = useMemo(
        () => leadCustomFields.filter((f: any) => f.type !== "file"),
        [leadCustomFields],
    );
    const fileCustomFields = useMemo(
        () => leadCustomFields.filter((f: any) => f.type === "file"),
        [leadCustomFields],
    );

    // `leadCustomFieldsData` is the modal's own merged value store, and an edit
    // here is echoed straight back down through it in the same commit — mirroring
    // it locally just bought an extra state update and a second visibility pass
    // per keystroke.
    const handleFieldChange = useCallback((fieldId: number, value: any) => {
        onLeadCustomFieldChange(fieldId, value);
    }, [onLeadCustomFieldChange]);

    const visibilityMap = useMemo(
        () =>
            evaluateAllFieldsVisibility(
                regularCustomFields,
                buildFieldValueMap({ customFieldsData: leadCustomFieldsData }),
            ),
        [regularCustomFields, leadCustomFieldsData],
    );

    // Group visible custom fields by category
    const { categorized, uncategorized } = useMemo(() => {
        const visible = regularCustomFields.filter((f: any) => visibilityMap[f.id] !== false);
        const catMap = new Map<number, { category: any; fields: any[] }>();
        const uncategorized: any[] = [];

        for (const f of visible) {
            const cat = f.customFieldCategory ?? f.custom_field_category ?? null;
            if (!cat) {
                uncategorized.push(f);
            } else {
                if (!catMap.has(cat.id)) catMap.set(cat.id, { category: cat, fields: [] });
                catMap.get(cat.id)!.fields.push(f);
            }
        }

        // Sort categories by display_order then name
        const categorized = Array.from(catMap.values()).sort((a, b) => {
            const ao = a.category.display_order ?? 999;
            const bo = b.category.display_order ?? 999;
            if (ao !== bo) return ao - bo;
            return (a.category.name ?? "").localeCompare(b.category.name ?? "");
        });

        return { categorized, uncategorized };
    }, [regularCustomFields, visibilityMap]);

    // ── Itinerary ─────────────────────────────────────────────────────────

    const itineraryItems = useMemo(
        () => sortItineraryItems(
            (deal.lead_flight_itineraries ?? []).map(toWorkspaceItineraryItem),
            "upcoming",
        ),
        [deal.lead_flight_itineraries],
    );

    // ── Tab bar ───────────────────────────────────────────────────────────

    const tabs: Array<{ id: Tab; label: string; count?: number }> = [
        { id: "lead", label: "Lead Info" },
        { id: "files", label: "Files", count: (files?.length ?? 0) + fileCustomFields.length },
        { id: "notes", label: "Notes" },
        ...(hasFlights ? [{ id: "flights" as Tab, label: "Flights" }] : []),
    ];

    // ── File upload ───────────────────────────────────────────────────────

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(e.target.files ?? []);
        if (chosen.length) uploadFiles(chosen);
        e.target.value = "";
    }, [uploadFiles]);

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* ProfileCard — replaces gradient hero */}
            <ProfileCard
                leadName={leadName}
                email={email}
                phones={phones}
                whatsapp={whatsapp}
                imageUrl={
                    contact?.image && contact?.image_url
                        ? contact.image_url
                        : undefined
                }
            />

            {/* Tab bar — revamp §C.2 style */}
            <div
                role="tablist"
                aria-label={"Lead context"}
                className="flex shrink-0 border-b border-slate-200 px-4"
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`analysis-tab-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        aria-controls={`analysis-panel-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center gap-1.5 py-3 px-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none"
                        style={{
                            borderColor: activeTab === tab.id ? "#1e293b" : "transparent",
                            color: activeTab === tab.id ? "#1e293b" : "#64748b",
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = "#334155";
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = "#64748b";
                        }}
                    >
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                            <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-semibold">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab panels */}
            <div className="min-h-0 flex-1 overflow-y-auto">

                {/* ── Lead Info ── */}
                <div
                    role="tabpanel"
                    id="analysis-panel-lead"
                    aria-labelledby="analysis-tab-lead"
                    className="pt-2"
                    hidden={activeTab !== "lead"}
                >
                    {alwaysReadOnlyRows.map(({ label, value }) => (
                        <CoreFieldRow key={label} label={label} value={value ?? ""} />
                    ))}
                    {/* Personal Info — mix of read-only and editable core contact fields */}
                    <FieldGroup label={"Personal Info"}>
                        {/* Editable: gender, date_of_birth, age, nationality, occupation */}
                        <AnalysisCustomFieldRow
                            field={{ id: 0, label: "Gender", type: "select", values: GENDER_OPTIONS }}
                            value={contact?.gender?.value ?? contact?.gender ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("gender", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 1, label: "Date of Birth", type: "date", values: null }}
                            value={contact?.date_of_birth ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("date_of_birth", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 2, label: "Age", type: "number", values: null }}
                            value={contact?.age ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("age", v)}
                        />
                        {ageRange && (
                            <CoreFieldRow label={"Age Range"} value={ageRange} />
                        )}
                        <AnalysisCustomFieldRow
                            field={{ id: 3, label: "Nationality", type: "country", values: null }}
                            value={contact?.nationality ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("nationality", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 4, label: "Occupation", type: "text", values: null }}
                            value={contact?.occupation ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("occupation", v)}
                        />

                        {/* Languages — read-only here too (matches Leads qualification panel) */}
                        <CoreFieldRow label={"Languages"} value={languages.join(", ")} />

                        <AnalysisCustomFieldRow
                            field={{ id: 6, label: "Company", type: "text", values: null }}
                            value={contact?.company_name ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("company_name", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 7, label: "Address", type: "text", values: null }}
                            value={contact?.address ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("address", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 8, label: "City", type: "text", values: null }}
                            value={contact?.city ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("city", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 9, label: "State", type: "text", values: null }}
                            value={contact?.state ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("state", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 10, label: "Country", type: "country", values: null }}
                            value={contact?.country ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("country", v)}
                        />
                        <AnalysisCustomFieldRow
                            field={{ id: 11, label: "Postal Code", type: "text", values: null }}
                            value={contact?.postal_code ?? null}
                            canEdit={canEdit}
                            onSave={(v) => onContactFieldSave("postal_code", v)}
                        />

                        {conditionalReadOnlyRows.map(({ label, value }) => (
                            <CoreFieldRow key={label} label={label} value={value ?? ""} />
                        ))}
                    </FieldGroup>

                    {/* Marketing — non-editable, only when data exists */}
                    {contact?.marketing && (() => {
                        const m = contact.marketing;
                        const boolField = (val: boolean | null | undefined) =>
                            val == null ? "" : val ? "Yes" : "No";
                        const rows = [
                            { label: "UTM Source", value: m.utm_source ?? "" },
                            { label: "UTM Medium", value: m.utm_medium ?? "" },
                            { label: "UTM Campaign", value: m.utm_campaign ?? "" },
                            { label: "UTM Content", value: m.utm_content ?? "" },
                            { label: "UTM Term", value: m.utm_term ?? "" },
                            { label: "UTM Audience", value: m.utm_audience ?? "" },
                            { label: "Ebook", value: boolField(m.has_downloaded_the_ebook) },
                            { label: "Facebook Group", value: boolField(m.has_joined_the_facebook_group) },
                            { label: "WhatsApp Group", value: boolField(m.has_joined_the_whatsapp_group) },
                            { label: "Webinar Registration", value: boolField(m.has_registered_for_the_webinar) },
                            { label: "Webinar Attendance", value: boolField(m.has_attended_the_webinar) },
                        ].filter((r) => r.value !== "");
                        if (!rows.length) return null;
                        return (
                            <FieldGroup label={"Marketing"}>
                                {rows.map(({ label, value }) => (
                                    <CoreFieldRow key={label} label={label} value={value} />
                                ))}
                            </FieldGroup>
                        );
                    })()}

                    {categorized.map(({ category, fields: catFields }) => (
                        <FieldGroup key={category.id} label={category.name}>
                            {catFields.map((field: any) => (
                                <AnalysisCustomFieldRow
                                    key={field.id}
                                    field={field}
                                    value={leadCustomFieldsData[`field_${field.id}`] ?? null}
                                    canEdit={canEdit}
                                    onChange={(value) => handleFieldChange(field.id, value)}
                                    onSave={(value) => onLeadCustomFieldSave(field.id, value)}
                                />
                            ))}
                        </FieldGroup>
                    ))}

                    {/* "More" — uncategorized custom fields */}
                    {uncategorized.length > 0 && (
                        <FieldGroup label={"More"}>
                            {uncategorized.map((field: any) => (
                                <AnalysisCustomFieldRow
                                    key={field.id}
                                    field={field}
                                    value={leadCustomFieldsData[`field_${field.id}`] ?? null}
                                    canEdit={canEdit}
                                    onChange={(value) => handleFieldChange(field.id, value)}
                                    onSave={(value) => onLeadCustomFieldSave(field.id, value)}
                                />
                            ))}
                        </FieldGroup>
                    )}
                </div>

                {/* ── Files ── (revamp §C.6) */}
                <div
                    role="tabpanel"
                    id="analysis-panel-files"
                    aria-labelledby="analysis-tab-files"
                    hidden={activeTab !== "files"}
                    className="p-4 space-y-2"
                >
                    {/* Deal files */}
                    {filesLoading ? (
                        <div className="text-xs text-slate-400">{"Loading…"}</div>
                    ) : (
                        <>
                            {files?.map((file: any) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-3 p-3 rounded-md bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                                >
                                    {/* Red document tile — no border-radius per revamp */}
                                    <div
                                        className="w-8 h-8 flex items-center justify-center shrink-0"
                                        style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
                                    >
                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-700 truncate">
                                            {file.filename}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {file.size}{file.created_at ? ` · ${formatDate(file.created_at)}` : ""}
                                        </div>
                                    </div>
                                    <a
                                        href={
                                            file.external_url ||
                                            file.file_url ||
                                            route("deal-files.download", file.id)
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-slate-400 hover:text-slate-600 shrink-0"
                                        aria-label={"Download"}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </a>
                                </div>
                            ))}

                            {files?.length === 0 && fileCustomFields.length === 0 && (
                                <p className="text-sm italic text-slate-400">{"No files attached yet."}</p>
                            )}

                            {/* File custom fields */}
                            {fileCustomFields.length > 0 && (
                                <div className="pt-2">
                                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                                        {"Document fields"}
                                    </div>
                                    {fileCustomFields.map((field: any) => {
                                        const val = leadCustomFieldsData[`field_${field.id}`];
                                        return (
                                            <div
                                                key={field.id}
                                                className="flex items-center gap-3 p-3 rounded-md bg-slate-50 border border-slate-200 mb-1.5"
                                            >
                                                <div
                                                    className="w-8 h-8 flex items-center justify-center shrink-0"
                                                    style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
                                                >
                                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">
                                                        {field.label}
                                                    </div>
                                                    {val ? (
                                                        <a
                                                            href={typeof val === "string" && val.startsWith("http") ? val : undefined}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-sm text-sky-600 truncate block"
                                                        >
                                                            {typeof val === "string" ? val.split("/").pop() ?? val : String(val)}
                                                        </a>
                                                    ) : (
                                                        <span className="text-sm italic text-slate-300">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Upload button */}
                    <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-1.5 py-3 rounded-md border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 transition-colors hover:border-[#0A2E5D] hover:text-[#0A2E5D] disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {isUploading ? "Uploading…" : "Upload File"}
                    </button>
                    <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={handleFileChange} />
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
                        <p className="text-xs italic text-slate-400">
                            {"Notes from this call appear here."}
                        </p>
                    )}
                    {notes.map((note: any) => (
                        <div
                            key={note.id}
                            className="rounded-md px-3 py-2.5 bg-slate-50 border border-slate-200"
                        >
                            {note.title && (
                                <div className="mb-0.5 text-xs font-semibold text-slate-800 dr-clamp-1">
                                    {note.title}
                                </div>
                            )}
                            <div
                                className="dr-clamp-3 text-xs text-slate-500"
                                dangerouslySetInnerHTML={{
                                    __html: note.details || note.text || "",
                                }}
                            />
                            {note.added_by?.name && (
                                <div className="mt-1.5 text-[11px] font-medium text-slate-400">
                                    {note.added_by.name}
                                </div>
                            )}
                        </div>
                    ))}
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
                                className="rounded-md px-3 py-2.5 bg-slate-50 border border-slate-200"
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <span
                                        className={`dr-pill dr-pill-${leg.direction === "arrival" ? "green" : "blue"}`}
                                        style={{ fontSize: 10 }}
                                    >
                                        {leg.direction === "arrival" ? "Arrival" : "Departure"}
                                    </span>
                                    {leg.isTransferRequired && (
                                        <span className="dr-pill dr-pill-amber" style={{ fontSize: 10 }}>
                                            {"Transfer"}
                                        </span>
                                    )}
                                </div>
                                <div className="truncate text-xs font-semibold text-slate-800">
                                    {leg.airportLabel}
                                </div>
                                <div className="text-[11px] text-slate-500">
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
