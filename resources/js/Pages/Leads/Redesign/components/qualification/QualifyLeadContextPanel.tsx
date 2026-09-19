import { useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";
import useLeadNoteCreate from "../../hooks/useLeadNoteCreate";
import useLeadInfoFieldUpdate from "../../hooks/useLeadInfoFieldUpdate";
import { useFormData } from "@/Hooks/useFormData";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import AnalysisCustomFieldRow from "@/Pages/Deals/Redesign/components/analysis/AnalysisCustomFieldRow";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { initialsFromName } from "@/Pages/Deals/Redesign/adapters/initials";
import { resolveLeadPhoneDisplay } from "@/lib/utils";

interface QualifyLeadContextPanelProps {
    lead: Lead;
    /** Lead custom fields + their categories, as passed to the Lead info tab. */
    fields?: any[];
    customFieldCategories?: Array<{ id: number; name: string }>;
    editLeadPermission?: string;
}

type Tab = "lead" | "notes";

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function FieldGroup({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
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
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>
            {open ? (
                <div className="divide-y divide-slate-100">{children}</div>
            ) : null}
        </div>
    );
}

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

/** Lead-side quick note — same UI as AnalysisQuickNote, wired to lead notes. */
function LeadQuickNote({ leadId }: { leadId: number }) {
    const { td } = useTd();
    const [text, setText] = useState("");
    const { createNote, isSaving } = useLeadNoteCreate(leadId);

    const save = () => {
        if (!text.trim()) return;
        createNote({ text }, () => setText(""));
    };

    return (
        <div className="flex flex-col gap-2">
            <textarea
                aria-label={td("Add a note", { source: "en" })}
                className="w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none transition-shadow"
                style={{
                    borderColor: T.BORDER,
                    color: T.TEXT,
                    minHeight: 68,
                    fontFamily: "inherit",
                    background: T.SURFACE_2,
                }}
                placeholder={td("Add a note about this call...", {
                    source: "en",
                })}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = T.BLUE_MID;
                    e.target.style.boxShadow = `0 0 0 2px ${T.BLUE_LIGHT}`;
                    e.target.style.background = T.WHITE;
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = T.BORDER;
                    e.target.style.boxShadow = "none";
                    e.target.style.background = T.SURFACE_2;
                }}
            />
            {text.trim() ? (
                <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: T.TEXT_HINT }}>
                        {td("⌘↵ to save", { source: "en" })}
                    </span>
                    <button
                        type="button"
                        className="dr-btn dr-btn-primary dr-btn-sm"
                        disabled={isSaving}
                        onClick={save}
                        style={{
                            background: T.NAVY,
                            color: "#fff",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            border: "none",
                            cursor: isSaving ? "default" : "pointer",
                        }}
                    >
                        {isSaving
                            ? td("Saving...", { source: "en" })
                            : td("Save note", { source: "en" })}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export default function QualifyLeadContextPanel({
    lead,
    fields = [],
    customFieldCategories = [],
    editLeadPermission = "all",
}: QualifyLeadContextPanelProps) {
    const { td } = useTd();
    const { notes, notesLoading } = useLeadWorkspace();
    const [activeTab, setActiveTab] = useState<Tab>("lead");
    const [imgError, setImgError] = useState(false);
    const canEdit = ["all", "added", "owned", "both"].includes(
        editLeadPermission,
    );
    const { handleFieldUpdate } = useLeadInfoFieldUpdate(canEdit);
    const record = lead as unknown as Record<string, any>;

    const { data: sources } = useFormData<any>("sources", { paginate: false });
    const { data: categories } = useFormData<any>("categories", {
        paginate: false,
    });

    const sourceOptions = useMemo(
        () =>
            (sources ?? []).map((item: any) => ({
                value: String(item.id ?? item.value),
                label: String(item.type ?? item.name ?? item.label ?? item.id),
            })),
        [sources],
    );
    const categoryOptions = useMemo(
        () =>
            (categories ?? []).map((item: any) => ({
                value: String(item.id ?? item.value),
                label: String(
                    item.category_name ?? item.name ?? item.label ?? item.id,
                ),
            })),
        [categories],
    );

    const selectedCategoryIds = useMemo(() => {
        if (Array.isArray(lead.categories) && lead.categories.length) {
            return lead.categories.map((category) => String(category.id));
        }
        if (Array.isArray(lead.category_ids) && lead.category_ids.length) {
            return lead.category_ids.map(String);
        }
        return lead.category_id ? [String(lead.category_id)] : [];
    }, [lead.categories, lead.category_ids, lead.category_id]);

    // Custom fields — same grouping/visibility rules as the analysis panel.
    const customFieldsData = (record.custom_fields_data ?? {}) as Record<
        string,
        any
    >;
    const regularCustomFields = useMemo(
        () => fields.filter((field: any) => field.type !== "file"),
        [fields],
    );
    const visibilityMap = useMemo(
        () =>
            evaluateAllFieldsVisibility(
                regularCustomFields,
                buildFieldValueMap({
                    customFieldsData,
                    // A record-source rule ("show only for these leads") reads this.
                    context: { recordId: record?.id },
                }),
            ),
        [regularCustomFields, customFieldsData, record?.id],
    );
    const customFieldGroups = useMemo(() => {
        const visible = regularCustomFields.filter(
            (field: any) => visibilityMap[field.id] !== false,
        );
        const groups = customFieldCategories
            .map((category) => ({
                id: category.id,
                name: category.name,
                fields: visible.filter(
                    (field: any) =>
                        Number(field.custom_field_category_id) === category.id,
                ),
            }))
            .filter((group) => group.fields.length > 0);
        const uncategorized = visible.filter(
            (field: any) =>
                !customFieldCategories.some(
                    (category) =>
                        Number(field.custom_field_category_id) === category.id,
                ),
        );
        return { groups, uncategorized };
    }, [customFieldCategories, regularCustomFields, visibilityMap]);

    const marketingRows = useMemo(() => {
        const marketing = record.marketing;
        if (!marketing) return [];
        const bool = (value: boolean | null | undefined) =>
            value == null
                ? ""
                : value
                  ? td("Yes", { source: "en" })
                  : td("No", { source: "en" });
        return [
            { label: td("UTM Source", { source: "en" }), value: marketing.utm_source ?? "" },
            { label: td("UTM Medium", { source: "en" }), value: marketing.utm_medium ?? "" },
            { label: td("UTM Campaign", { source: "en" }), value: marketing.utm_campaign ?? "" },
            { label: td("UTM Content", { source: "en" }), value: marketing.utm_content ?? "" },
            { label: td("UTM Term", { source: "en" }), value: marketing.utm_term ?? "" },
            { label: td("UTM Audience", { source: "en" }), value: marketing.utm_audience ?? "" },
            { label: td("Ebook", { source: "en" }), value: bool(marketing.has_downloaded_the_ebook) },
            { label: td("Facebook Group", { source: "en" }), value: bool(marketing.has_joined_the_facebook_group) },
            { label: td("WhatsApp Group", { source: "en" }), value: bool(marketing.has_joined_the_whatsapp_group) },
            { label: td("Webinar Registration", { source: "en" }), value: bool(marketing.has_registered_for_the_webinar) },
            { label: td("Webinar Attendance", { source: "en" }), value: bool(marketing.has_attended_the_webinar) },
        ].filter((row) => row.value !== "");
    }, [record.marketing, td]);

    /** Editable core lead field — analysis row UI, lead patch endpoint. */
    const coreRow = (
        id: number,
        label: string,
        type: string,
        fieldName: string,
        value: any,
        values?: any,
    ) => (
        <AnalysisCustomFieldRow
            key={fieldName}
            field={{ id, label: td(label, { source: "en" }), type, values }}
            value={value ?? null}
            canEdit={canEdit}
            onSave={(next) => void handleFieldUpdate(fieldName, next)}
        />
    );

    const leadName = lead.client_name || "";
    const email = lead.client_email || "";
    // Phones are stored E.164 or as legacy antd-phone-input JSON — always
    // resolve through the shared util so no surface here renders raw JSON.
    const mobileDisplay = resolveLeadPhoneDisplay(
        lead.mobile,
        record.mobile_with_phonecode,
    );
    const officeDisplay = resolveLeadPhoneDisplay(
        lead.office,
        record.office_phone_formatted,
    );
    const phones = useMemo(() => {
        const values = [
            mobileDisplay,
            resolveLeadPhoneDisplay(lead.cell),
            officeDisplay,
        ].filter(Boolean);
        return Array.from(new Set(values));
    }, [lead.cell, mobileDisplay, officeDisplay]);
    const whatsapp = resolveLeadPhoneDisplay(lead.client_whatsapp);
    const initials = initialsFromName(leadName);

    return (
        <aside
            className="qualify-3col-left flex flex-col min-h-0 overflow-hidden"
            style={{ background: T.SURFACE }}
        >
            {/* Profile — same shape as AnalysisLeadContextPanel ProfileCard */}
            <div className="p-4 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                    {lead.image_url && !imgError ? (
                        <img
                            src={lead.image_url}
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
                            {leadName || td("No name", { source: "en" })}
                        </div>
                        {email ? (
                            <div className="text-xs text-slate-500 truncate">
                                {email}
                            </div>
                        ) : null}
                        {phones[0] ? (
                            <div className="text-xs text-slate-500 truncate">
                                {phones[0]}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex gap-2">
                    {phones[0] ? (
                        <a
                            href={`tel:${phones[0]}`}
                            className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: "#0A2E5D" }}
                        >
                            {td("Call", { source: "en" })}
                        </a>
                    ) : null}
                    {email ? (
                        <a
                            href={`mailto:${email}`}
                            className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-slate-700 border border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            {td("Email", { source: "en" })}
                        </a>
                    ) : null}
                    {whatsapp ? (
                        <a
                            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-slate-700 border border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            WhatsApp
                        </a>
                    ) : null}
                </div>
            </div>

            {/* Tabs — AnalysisLeadContextPanel tab strip */}
            <div
                className="flex shrink-0 border-b border-slate-200"
                role="tablist"
            >
                {(
                    [
                        ["lead", td("Lead Info", { source: "en" })],
                        ["notes", td("Notes", { source: "en" })],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === id}
                        onClick={() => setActiveTab(id)}
                        className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                        style={
                            activeTab === id
                                ? {
                                      color: T.NAVY,
                                      borderBottom: `2px solid ${T.NAVY}`,
                                  }
                                : { color: T.TEXT_HINT }
                        }
                    >
                        {label}
                        {id === "notes" && !notesLoading && notes.length > 0
                            ? ` (${notes.length})`
                            : ""}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div hidden={activeTab !== "lead"}>
                    <CoreFieldRow
                        label={td("Owner", { source: "en" })}
                        value={lead.lead_owner?.name ?? ""}
                    />
                    <CoreFieldRow
                        label={td("Status", { source: "en" })}
                        value={lead.lead_lifecycle_status?.label ?? ""}
                    />

                    <FieldGroup label={td("Attribution", { source: "en" })}>
                        {coreRow(
                            100,
                            "Source",
                            "select",
                            "source_id",
                            lead.source_id ? String(lead.source_id) : null,
                            sourceOptions,
                        )}
                        {coreRow(
                            101,
                            "Category",
                            "multiselect",
                            "category_ids",
                            selectedCategoryIds,
                            categoryOptions,
                        )}
                        {coreRow(
                            102,
                            "Temperature",
                            "select",
                            "temperature",
                            lead.temperature ?? null,
                            [
                                { value: "cold", label: td("Cold", { source: "en" }) },
                                { value: "warm", label: td("Warm", { source: "en" }) },
                                { value: "hot", label: td("Hot", { source: "en" }) },
                            ],
                        )}
                    </FieldGroup>

                    <FieldGroup label={td("Personal Info", { source: "en" })}>
                        {coreRow(103, "Salutation", "text", "salutation", record.salutation)}
                        {coreRow(104, "Gender", "select", "gender", record.gender_value ?? record.gender, [
                            { value: "male", label: td("Male", { source: "en" }) },
                            { value: "female", label: td("Female", { source: "en" }) },
                        ])}
                        {coreRow(105, "Date of Birth", "date", "date_of_birth", record.date_of_birth)}
                        {coreRow(106, "Age", "number", "age", record.age)}
                        {coreRow(107, "Nationality", "country", "nationality", record.nationality)}
                        {coreRow(108, "Occupation", "text", "occupation", record.occupation)}
                        {coreRow(109, "Company", "text", "company_name", lead.company_name)}
                        <CoreFieldRow
                            label={td("Languages", { source: "en" })}
                            value={(lead.languages ?? []).join(", ")}
                        />
                    </FieldGroup>

                    <FieldGroup label={td("Contact", { source: "en" })}>
                        {coreRow(110, "Mobile", "phone", "mobile", mobileDisplay)}
                        {coreRow(111, "Office phone", "phone", "office", officeDisplay)}
                        {coreRow(112, "Email", "text", "email", lead.client_email)}
                        {coreRow(113, "WhatsApp", "phone", "client_whatsapp", whatsapp)}
                        {coreRow(114, "Telegram", "text", "client_telegram", record.client_telegram)}
                        {coreRow(115, "Instagram", "text", "client_instagram", record.client_instagram)}
                    </FieldGroup>

                    {marketingRows.length > 0 ? (
                        <FieldGroup label={td("Marketing", { source: "en" })}>
                            {marketingRows.map((row) => (
                                <CoreFieldRow
                                    key={row.label}
                                    label={row.label}
                                    value={row.value}
                                />
                            ))}
                        </FieldGroup>
                    ) : null}

                    {customFieldGroups.groups.map((group) => (
                        <FieldGroup key={group.id} label={group.name}>
                            {group.fields.map((field: any) => (
                                <AnalysisCustomFieldRow
                                    key={field.id}
                                    field={field}
                                    value={
                                        customFieldsData[`field_${field.id}`] ??
                                        null
                                    }
                                    canEdit={canEdit}
                                    onSave={(value) =>
                                        void handleFieldUpdate(
                                            `field_${field.id}`,
                                            value,
                                            "custom_field",
                                        )
                                    }
                                />
                            ))}
                        </FieldGroup>
                    ))}

                    {customFieldGroups.uncategorized.length > 0 ? (
                        <FieldGroup label={td("More", { source: "en" })}>
                            {customFieldGroups.uncategorized.map(
                                (field: any) => (
                                    <AnalysisCustomFieldRow
                                        key={field.id}
                                        field={field}
                                        value={
                                            customFieldsData[
                                                `field_${field.id}`
                                            ] ?? null
                                        }
                                        canEdit={canEdit}
                                        onSave={(value) =>
                                            void handleFieldUpdate(
                                                `field_${field.id}`,
                                                value,
                                                "custom_field",
                                            )
                                        }
                                    />
                                ),
                            )}
                        </FieldGroup>
                    ) : null}
                </div>

                <div
                    hidden={activeTab !== "notes"}
                    className="flex flex-col gap-3 px-4 py-4"
                >
                    <LeadQuickNote leadId={lead.id} />
                    {notesLoading && notes.length === 0 ? (
                        <p className="text-xs italic text-slate-400">
                            {td("Loading notes…", { source: "en" })}
                        </p>
                    ) : null}
                    {!notesLoading && notes.length === 0 ? (
                        <p className="text-xs italic text-slate-400">
                            {td("Notes from this call appear here.", {
                                source: "en",
                            })}
                        </p>
                    ) : null}
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            className="rounded-md px-3 py-2.5 bg-slate-50 border border-slate-200"
                        >
                            {note.title ? (
                                <div className="mb-0.5 text-xs font-semibold text-slate-800 truncate">
                                    {note.title}
                                </div>
                            ) : null}
                            <div className="text-xs text-slate-500 line-clamp-3">
                                {stripHtml(note.details || "")}
                            </div>
                            {note.added_by?.name ? (
                                <div className="mt-1.5 text-[11px] font-medium text-slate-400">
                                    {note.added_by.name}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
