import { usePage } from "@inertiajs/react";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import QualificationScriptHtml from "@/Pages/Leads/Components/Qualification/QualificationScriptHtml";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import {
    FALLBACK_OUTCOME_BODIES,
    FALLBACK_OUTCOME_CTA,
    findEntrySegment,
    findOutcomeSegment,
    formatAnswerDisplay,
    getAllOutcomeChoices,
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Pages/Leads/Components/Qualification/useTranslatedScriptLabel";
import {
    DEFAULT_OUTCOME_LABELS,
    OUTCOME_LIFECYCLE_STATUS_KEY,
    WEBINAR_LANGUAGE_LABELS,
    WEBINAR_LANGUAGES,
    toWebinarLanguage,
} from "@/Types/qualification";
import type {
    LeadQualification,
    QualificationActionRun,
    QualificationOutcome,
    RegisterWebinarSessionPayload,
    WebinarGender,
    WebinarLanguage,
    WebinarSession,
} from "@/Types/qualification";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import type { Lead } from "@/Types/api/leads";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import RadioInput from "@/Pages/Deals/Redesign/components/analysis/inputs/RadioInput";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
import {
    buildEmptyMeetingForm,
    defaultMeetingStart,
    getMeetingOwner,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import useLeadMeetingCreate, {
    validateMeetingForm,
    type LeadMeetingCreateInput,
} from "../../hooks/useLeadMeetingCreate";
import useLeadFieldUpdate from "../../hooks/useLeadFieldUpdate";
import { useScriptMapping } from "@/Features/Leads/QualificationMapping/mappingApi";
import { Empty, Spin, message } from "antd";
import { useEffect, useMemo, useState } from "react";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

const OUTCOME_CARD_META: Record<
    QualificationOutcome,
    {
        icon: string;
        iconBg: string;
        iconColor: string;
        description: string;
    }
> = {
    bookMeeting: {
        icon: "calendar",
        iconBg: "#e8f1fb",
        iconColor: T.NAVY,
        description: "Arrange a consultation with a specialist.",
    },
    inviteWebinar: {
        icon: "video",
        iconBg: "#ecfdf5",
        iconColor: "#047857",
        description: "Invite the lead to an upcoming webinar.",
    },
    callback: {
        icon: "phone",
        iconBg: "#fff7ed",
        iconColor: "#c2410c",
        description: "Schedule a callback for a better time.",
    },
    noFit: {
        icon: "ban",
        iconBg: "#fef2f2",
        iconColor: "#b91c1c",
        description: "Close out — not the right fit right now.",
    },
};

const splitLeadName = (name?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

/** How the `bookMeeting` outcome is fulfilled. */
type BookMeetingTrack = "specialist" | "ceo";

const CEO_CALENDLY_URL =
    "https://calendly.com/rabihrabea/appointmentbooking?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=D6A319";

/**
 * Calendly prefill for the CEO track. `a1`/`a3` are Calendly's custom
 * question slots: a1 is the phone number, a3 carries the main qualification
 * answer so the booking page has call context.
 */
const buildCeoCalendlyUrl = (
    lead: Lead,
    mainQuestionSummary?: string | null,
): string => {
    const { firstName, lastName } = splitLeadName(lead.client_name);
    const url = new URL(CEO_CALENDLY_URL);
    url.searchParams.set("first_name", firstName);
    url.searchParams.set("last_name", lastName);
    url.searchParams.set("email", lead.client_email ?? "");
    url.searchParams.set(
        "a1",
        resolveLeadPhoneDisplay(lead.mobile, lead.mobile_with_phonecode) ||
            resolveLeadPhoneDisplay(lead.cell) ||
            "",
    );
    url.searchParams.set("a3", mainQuestionSummary?.trim() || "");
    return url.toString();
};

const statusChipBackground = (color: string): string =>
    /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}1f` : `${T.NAVY}1f`;

interface WebinarRegistrationForm {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: WebinarGender | "";
    language: WebinarLanguage;
}

type WebinarLeadField =
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "gender";

/** Which webinar fields already exist on the lead and should stay hidden. */
const resolveWebinarLockedFields = (
    lead: Lead,
): Record<WebinarLeadField, boolean> => {
    const { firstName, lastName } = splitLeadName(lead.client_name);
    const phone =
        resolveLeadPhoneDisplay(lead.mobile, lead.mobile_with_phonecode) ||
        resolveLeadPhoneDisplay(lead.cell) ||
        "";
    return {
        firstName: Boolean(firstName),
        lastName: Boolean(lastName),
        email: Boolean((lead.client_email ?? "").trim()),
        phone: Boolean(phone.trim()),
        gender: Boolean(toWebinarGender(lead.gender)),
    };
};

/** OL only accepts male/female; anything else on the lead means "unspecified". */
const toWebinarGender = (gender?: string | null): WebinarGender | "" => {
    const normalized = (gender ?? "").toLowerCase();
    return normalized === "male" || normalized === "female" ? normalized : "";
};

/**
 * Default meeting type for the callback outcome. Matched loosely because
 * meeting types are per-company and renameable — "Follow Up" (seeded),
 * "Follow-up", "Followup meeting" all resolve. Null when none exists, which
 * just leaves the picker empty as before.
 */
const findFollowUpMeetingTypeId = (
    meetingTypes: Array<{ id: number; name: string }>,
): number | null =>
    meetingTypes.find((type) =>
        type.name.toLowerCase().replace(/[^a-z]/g, "").startsWith("followup"),
    )?.id ?? null;

/**
 * Default meeting type for book-consultation. Matches "Kick Off" (seeded),
 * "Kickoff", "Kick-off meeting", etc.
 */
const findKickOffMeetingTypeId = (
    meetingTypes: Array<{ id: number; name: string }>,
): number | null =>
    meetingTypes.find((type) =>
        type.name.toLowerCase().replace(/[^a-z]/g, "").startsWith("kickoff"),
    )?.id ?? null;

const buildMainQuestionAgenda = (
    tree: QualificationFlow["templateTree"],
    answers: QualificationFlow["answers"],
): string => {
    const entrySegment = findEntrySegment(tree);
    const entryAnswer = entrySegment ? answers[entrySegment.key] : undefined;
    if (!entrySegment || !hasAnswerContent(entryAnswer)) return "";
    const answerText = stripHtmlTags(
        formatAnswerDisplay(entrySegment, entryAnswer),
    ).trim();
    if (!answerText) return "";

    const parts = answerText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    const combined =
        parts.length <= 1
            ? parts[0] ?? answerText
            : parts.length === 2
              ? `${parts[0]} and ${parts[1]}`
              : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

    return `Discuss about ${combined}`;
};

function NumberBadge({
    number,
    answered,
}: {
    number?: number | string;
    answered: boolean;
}) {
    return (
        <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all"
            style={
                answered
                    ? {
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          boxShadow: "0 0 0 2px #a7f3d0",
                      }
                    : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
            }
        >
            {answered ? (
                <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                    />
                </svg>
            ) : (
                number ?? "·"
            )}
        </div>
    );
}

function AnalysisTextarea({
    value,
    onChange,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className="w-full resize-y rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none transition-colors disabled:opacity-50"
            style={{
                border: `1px solid ${T.BORDER}`,
                color: T.TEXT,
                fontFamily: "inherit",
                background: "#f8fafc",
                minHeight: 72,
            }}
            onFocus={(e) => {
                e.target.style.borderColor = "#38bdf8";
                e.target.style.boxShadow = "0 0 0 2px #e0f2fe";
                e.target.style.background = "#fff";
            }}
            onBlur={(e) => {
                e.target.style.borderColor = T.BORDER;
                e.target.style.boxShadow = "none";
                e.target.style.background = "#f8fafc";
            }}
        />
    );
}

function OutcomeFooter({
    onBack,
    onPrimary,
    backLabel,
    primaryLabel,
    primaryDisabled,
}: {
    onBack: () => void;
    onPrimary?: () => void;
    backLabel: string;
    primaryLabel?: string;
    primaryDisabled?: boolean;
}) {
    return (
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-white border-t border-slate-200">
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-600 cursor-pointer transition-colors hover:bg-slate-50"
            >
                <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                {backLabel}
            </button>

            {onPrimary && primaryLabel ? (
                <button
                    type="button"
                    onClick={onPrimary}
                    disabled={primaryDisabled}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#0A2E5D" }}
                >
                    {primaryLabel}
                </button>
            ) : (
                <span />
            )}
        </div>
    );
}

/**
 * Lifecycle status an outcome will move the lead to, resolved against the
 * company's configured statuses (page prop) — so the agent sees the real label.
 */
function useOutcomeLifecycleStatus() {
    const { props } = usePage();
    const statuses = props.leadLifecycleStatuses as
        | Array<{ key: string; label: string; label_color?: string | null }>
        | undefined;

    return useMemo(() => {
        const byKey = new Map((statuses ?? []).map((s) => [s.key, s]));
        return (outcome: QualificationOutcome) =>
            byKey.get(OUTCOME_LIFECYCLE_STATUS_KEY[outcome]) ?? null;
    }, [statuses]);
}

function OutcomeChoiceCards({
    choices,
    onSelect,
}: {
    choices: Array<{ key: QualificationOutcome; label: string }>;
    onSelect: (outcome: QualificationOutcome) => void;
}) {
    const { td } = useTd();
    const lifecycleStatusFor = useOutcomeLifecycleStatus();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {choices.map((choice) => {
                const meta = OUTCOME_CARD_META[choice.key];
                const status = lifecycleStatusFor(choice.key);
                const rawColor = status?.label_color || T.NAVY;
                const statusColor = /^#[0-9a-fA-F]{6}$/.test(rawColor)
                    ? rawColor
                    : T.NAVY;
                return (
                    <button
                        key={choice.key}
                        type="button"
                        onClick={() => onSelect(choice.key)}
                        className="group text-left rounded-xl p-4 transition-all cursor-pointer"
                        style={{
                            background: "#fff",
                            border: `1.5px solid ${T.BORDER}`,
                            boxShadow: "0 1px 2px rgba(22, 41, 77, 0.04)",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.borderColor = T.NAVY;
                            el.style.boxShadow =
                                "0 4px 14px rgba(22, 41, 77, 0.12)";
                            el.style.background = T.BLUE_LIGHT;
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.borderColor = T.BORDER;
                            el.style.boxShadow =
                                "0 1px 2px rgba(22, 41, 77, 0.04)";
                            el.style.background = "#fff";
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: meta.iconBg,
                                    color: meta.iconColor,
                                }}
                            >
                                <Icon name={meta.icon} size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p
                                        className="text-[15px] font-semibold leading-snug"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td(choice.label, { source: "en" })}
                                    </p>
                                    <Icon
                                        name="chevron-right"
                                        size={16}
                                        className="shrink-0 opacity-40 group-hover:opacity-80"
                                    />
                                </div>
                                <p
                                    className="mt-1 text-[13px] leading-snug"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {td(meta.description, { source: "en" })}
                                </p>
                                {status ? (
                                    <span
                                        className="mt-2.5 inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-semibold leading-none"
                                        style={{
                                            background:
                                                statusChipBackground(
                                                    statusColor,
                                                ),
                                            color: statusColor,
                                            border: `1px solid ${statusColor}33`,
                                        }}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ background: statusColor }}
                                        />
                                        {td("Sets status to", { source: "en" })}{" "}
                                        {td(status.label, { source: "en" })}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

interface QualifyOutcomePhaseProps {
    flow: QualificationFlow;
    lead: Lead;
    agentLanguage: string;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    selectedOutcome: QualificationOutcome | null;
    onSelectOutcome: (outcome: QualificationOutcome) => void;
    onBack: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onDone: (qualification: LeadQualification) => void;
}

export default function QualifyOutcomePhase({
    flow,
    lead,
    agentLanguage,
    qualificationService,
    registrationService,
    meetingTypes,
    selectedOutcome,
    onSelectOutcome,
    onBack,
    onCompleted,
    onDone,
}: QualifyOutcomePhaseProps) {
    const { td } = useTd();
    const choices = useMemo(
        () => getAllOutcomeChoices(flow.templateTree),
        [flow.templateTree],
    );

    if (!selectedOutcome) {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-4">
                    <div className="flex gap-4 mb-7">
                        <NumberBadge number="★" answered={false} />
                        <div className="flex-1 min-w-0">
                            <p
                                className="text-base font-semibold mb-2 leading-snug"
                                style={{ color: T.TEXT }}
                            >
                                {td("Choose an outcome", { source: "en" })}
                            </p>
                            <p
                                className="text-sm mb-4"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td(
                                    "Select how this qualification should finish based on the call.",
                                    { source: "en" },
                                )}
                            </p>
                            <OutcomeChoiceCards
                                choices={choices}
                                onSelect={onSelectOutcome}
                            />
                        </div>
                    </div>
                </div>
                <OutcomeFooter
                    onBack={onBack}
                    backLabel={td("Previous", { source: "en" })}
                />
            </div>
        );
    }

    return (
        <OutcomeDetail
            flow={flow}
            lead={lead}
            agentLanguage={agentLanguage}
            outcome={selectedOutcome}
            qualificationService={qualificationService}
            registrationService={registrationService}
            meetingTypes={meetingTypes}
            onBack={onBack}
            onCompleted={onCompleted}
            onDone={onDone}
        />
    );
}

function OutcomeDetail({
    flow,
    lead,
    agentLanguage,
    outcome,
    qualificationService,
    registrationService,
    meetingTypes,
    onBack,
    onCompleted,
    onDone,
}: {
    flow: QualificationFlow;
    lead: Lead;
    agentLanguage: string;
    outcome: QualificationOutcome;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onBack: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onDone: (qualification: LeadQualification) => void;
}) {
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const { props: pageProps } = usePage();
    const userId = pageProps.auth?.user?.id;
    const userEmail = pageProps.auth?.user?.email;
    const meetingCreate = useLeadMeetingCreate(lead);
    const { updateField } = useLeadFieldUpdate();
    const [busy, setBusy] = useState(false);
    const [comment, setComment] = useState("");
    const [meetingForm, setMeetingForm] = useState<MeetingFormState>(() => ({
        ...buildEmptyMeetingForm(lead, userId, userEmail),
        ...defaultMeetingStart(),
    }));
    const [meetingErrors, setMeetingErrors] = useState<string[]>([]);
    const [bookTrack, setBookTrack] = useState<BookMeetingTrack>("specialist");
    const [webinarSessions, setWebinarSessions] = useState<WebinarSession[]>(
        [],
    );
    const [webinarLoading, setWebinarLoading] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
        null,
    );
    const [webinarForm, setWebinarForm] = useState<WebinarRegistrationForm>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        gender: "",
        language: "en",
    });
    const [webinarErrors, setWebinarErrors] = useState<string[]>([]);

    const webinarLocked = useMemo(
        () => resolveWebinarLockedFields(lead),
        [lead],
    );

    const syncWebinarFieldToLead = async (
        field: WebinarLeadField,
        form: WebinarRegistrationForm = webinarForm,
    ) => {
        if (webinarLocked[field]) return;

        try {
            if (field === "firstName" || field === "lastName") {
                const first = form.firstName.trim();
                const last = form.lastName.trim();
                const clientName = [first, last].filter(Boolean).join(" ");
                if (!clientName || clientName === (lead.client_name ?? "").trim()) {
                    return;
                }
                await updateField("client_name", clientName);
                return;
            }

            if (field === "email") {
                const email = form.email.trim();
                if (!email || email === (lead.client_email ?? "").trim()) return;
                await updateField("client_email", email);
                return;
            }

            if (field === "phone") {
                const phone = form.phone.trim();
                const existing =
                    resolveLeadPhoneDisplay(
                        lead.mobile,
                        lead.mobile_with_phonecode,
                    ) ||
                    resolveLeadPhoneDisplay(lead.cell) ||
                    "";
                if (!phone || phone === existing.trim()) return;
                await updateField("mobile", phone);
                return;
            }

            if (field === "gender") {
                if (!form.gender || form.gender === toWebinarGender(lead.gender)) {
                    return;
                }
                await updateField("gender", form.gender);
            }
        } catch {
            // useLeadFieldUpdate already toasts; keep the local form value.
        }
    };

    const syncMissingWebinarFieldsToLead = async () => {
        const fields: WebinarLeadField[] = [
            "firstName",
            "lastName",
            "email",
            "phone",
            "gender",
        ];
        for (const field of fields) {
            if (webinarLocked[field]) continue;
            const value =
                field === "gender"
                    ? webinarForm.gender
                    : webinarForm[field].trim();
            if (!value) continue;
            await syncWebinarFieldToLead(field);
        }
    };

    const treeSegment = useMemo(
        () => findOutcomeSegment(flow.templateTree, outcome),
        [flow.templateTree, outcome],
    );

    const bodyText =
        treeSegment?.label?.trim() || FALLBACK_OUTCOME_BODIES[outcome];
    const ctaLabel =
        treeSegment?.outcomeMetadata?.label?.trim() ||
        FALLBACK_OUTCOME_CTA[outcome];
    const title = DEFAULT_OUTCOME_LABELS[outcome];

    const answer = treeSegment ? flow.answers[treeSegment.key] : undefined;
    const selectedValues = answer?.answer_values ?? [];
    const optionChoices = (treeSegment?.options ?? []).map((option) => ({
        value: option.id,
        label: stripHtmlTags(option.label) || option.label,
    }));

    /** Attribution passed straight through to OL; not agent-editable. */
    const utmInfo = useMemo(() => {
        const marketing = lead.marketing;
        if (!marketing?.utm_source) return undefined;
        return {
            utmSource: marketing.utm_source,
            utmMedium: marketing.utm_medium ?? undefined,
            utmCampaign: marketing.utm_campaign ?? undefined,
            utmTerm: marketing.utm_term ?? undefined,
            utmContent: marketing.utm_content ?? undefined,
        };
    }, [lead.marketing]);

    // Falls back to the webinar an admin set for this script on the
    // qualification field mapping settings page.
    const scriptMapping = useScriptMapping(
        outcome === "inviteWebinar" ? flow.templateTree?.templateId : null,
    );
    const webinarId =
        treeSegment?.outcomeMetadata?.webinarId ||
        scriptMapping?.webinar_id ||
        undefined;

    /** `/sessions/next` yields a single upcoming session. */
    const nextSession = webinarSessions[0] ?? null;

    /** CEO track books on Calendly instead of creating a CRM meeting. */
    const usesCeoCalendly = outcome === "bookMeeting" && bookTrack === "ceo";
    const usesMeetingForm =
        outcome === "callback" ||
        (outcome === "bookMeeting" && bookTrack === "specialist");

    // Re-seed the meeting form whenever the agent switches outcomes, with the
    // contact method pre-set for callback (phone) vs bookMeeting (video),
    // callback typed as "Follow Up", and book-consultation as "Kick Off"
    // with an agenda from the main qualification answer.
    useEffect(() => {
        if (outcome !== "bookMeeting" && outcome !== "callback") return;
        const base = {
            ...buildEmptyMeetingForm(lead, userId, userEmail),
            ...defaultMeetingStart(),
        };
        setMeetingForm(
            outcome === "callback"
                ? {
                      ...base,
                      platform: "phone",
                      meetingTypeId: findFollowUpMeetingTypeId(meetingTypes),
                  }
                : {
                      ...base,
                      meetingTypeId: findKickOffMeetingTypeId(meetingTypes),
                      remark: buildMainQuestionAgenda(
                          flow.templateTree,
                          flow.answers,
                      ),
                  },
        );
        setMeetingErrors([]);
        setBookTrack("specialist");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per outcome switch, not on every lead/user/meetingTypes identity change
    }, [outcome]);

    // Prefill the registration form from the lead — the agent can correct or
    // complete it before submitting (OL requires first name, email, language).
    useEffect(() => {
        if (outcome !== "inviteWebinar") return;
        const { firstName, lastName } = splitLeadName(lead.client_name);
        setWebinarForm({
            firstName,
            lastName,
            email: lead.client_email ?? "",
            phone:
                resolveLeadPhoneDisplay(
                    lead.mobile,
                    lead.mobile_with_phonecode,
                ) ||
                resolveLeadPhoneDisplay(lead.cell) ||
                "",
            gender: toWebinarGender(lead.gender),
            language: toWebinarLanguage(agentLanguage),
        });
        setWebinarErrors([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill once per outcome switch, not on every lead identity change
    }, [outcome]);

    useEffect(() => {
        if (outcome !== "inviteWebinar" || !webinarId) {
            setWebinarSessions([]);
            setSelectedSessionId(null);
            return;
        }

        let cancelled = false;
        setWebinarLoading(true);
        registrationService
            .getNextWebinarSessions(webinarId)
            .then((response) => {
                if (cancelled) return;
                const sessions = response.data ?? [];
                setWebinarSessions(sessions);
                // The endpoint returns upcoming sessions in order — preselect
                // the next one so the common case is a single click.
                setSelectedSessionId(sessions[0]?.id ?? null);
            })
            .catch(() => {
                if (!cancelled) {
                    message.error(td("Failed to load webinar sessions"));
                }
            })
            .finally(() => {
                if (!cancelled) setWebinarLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [outcome, webinarId, registrationService, td]);

    const markExecuted = async (
        qualification: LeadQualification,
        run: QualificationActionRun,
        payload: Record<string, unknown> = {},
        error?: string,
    ) => {
        const result = await qualificationService.executeAction(
            qualification.id,
            run.id,
            { payload, error: error ?? null },
        );
        onCompleted(result.qualification);
        return result.qualification;
    };

    /** Book/callback: create the CRM meeting, then mark any matching run executed. */
    const runMeetingAction = async (
        qualification: LeadQualification,
        run: QualificationActionRun | undefined,
        input: LeadMeetingCreateInput,
    ) => {
        try {
            await new Promise<void>((resolve, reject) => {
                meetingCreate.createMeeting(input, {
                    onSuccess: () => resolve(),
                    onFailure: (errors) =>
                        reject(new Error(errors.join(" "))),
                });
            });
            if (run) {
                await markExecuted(qualification, run, {
                    date: input.date,
                    startTime: input.startTime,
                    platform: input.platform,
                });
            }
            message.success(
                td(
                    outcome === "callback"
                        ? "Callback scheduled"
                        : "Consultation booked",
                    { source: "en" },
                ),
            );
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to schedule the meeting";
            message.error(msg);
            if (run) {
                try {
                    await markExecuted(qualification, run, {}, msg);
                } catch {
                    // ignore
                }
            }
        }
    };

    /**
     * CEO track: the Calendly tab is already open (see `handleCta`); all that
     * is left is recording the run. No CRM meeting exists yet — the booking
     * happens on Calendly's side.
     */
    const runCalendlyAction = async (
        qualification: LeadQualification,
        run: QualificationActionRun | undefined,
        calendlyUrl: string,
    ) => {
        message.success(
            td("Calendly opened — complete the booking there", {
                source: "en",
            }),
        );
        if (!run) return;
        try {
            await markExecuted(qualification, run, { calendlyUrl });
        } catch {
            // Outcome already completed; a stuck run must not block closing.
        }
    };

    /** Invite to webinar: register the picked session, then mark any matching run executed. */
    const runWebinarAction = async (
        qualification: LeadQualification,
        run: QualificationActionRun | undefined,
        sessionId: string,
    ) => {
        const selected = webinarSessions.find(
            (session) => session.id === sessionId,
        );
        const sessionLabel = selected
            ? `${selected.title} · ${formatDateTime(selected.startsAt)}`
            : sessionId;

        const payload: RegisterWebinarSessionPayload = {
            firstName: webinarForm.firstName.trim(),
            email: webinarForm.email.trim(),
            language: webinarForm.language,
            lastName: webinarForm.lastName.trim() || undefined,
            phone: webinarForm.phone.trim() || undefined,
            gender: webinarForm.gender || undefined,
            utmInfo,
        };

        try {
            await registrationService.registerWebinarSession(
                sessionId,
                payload,
            );
            if (run) {
                await markExecuted(qualification, run, {
                    webinarSessionId: sessionId,
                    webinarSessionLabel: sessionLabel,
                });
            }
            message.success(td("Webinar registration completed"));
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to register webinar";
            message.error(msg);
            if (run) {
                try {
                    await markExecuted(qualification, run, {}, msg);
                } catch {
                    // ignore
                }
            }
        }
    };

    const meetingInputFromForm = (): LeadMeetingCreateInput => ({
        meetingTypeId: meetingForm.meetingTypeId,
        date: meetingForm.date,
        startTime: meetingForm.startTime,
        endTime: meetingForm.endTime,
        duration: meetingForm.duration,
        platform: meetingForm.platform,
        locationDetail: meetingForm.locationDetail,
        meetingLink: meetingForm.meetingLink,
        participants: meetingForm.participants,
        hostId: meetingForm.hostId,
        remark: meetingForm.remark,
        reminders: meetingForm.reminders,
    });

    const handleCta = async () => {
        if (busy || flow.completing) return;

        // Completion is one-way server-side, so validate the active inline
        // form up front — a failure after completing would strand the agent.
        let meetingInput: LeadMeetingCreateInput | null = null;
        if (usesMeetingForm) {
            meetingInput = meetingInputFromForm();
            const validationErrors = validateMeetingForm(meetingInput, {
                hasOwnerOrDeal: Boolean(lead.lead_owner?.id),
                userEmail,
            });
            if (validationErrors.length > 0) {
                setMeetingErrors(validationErrors);
                return;
            }
            setMeetingErrors([]);
        }

        // Opened synchronously: a popup opened after the `await` below has
        // lost the click's user activation and gets blocked by the browser.
        let calendlyUrl: string | null = null;
        if (usesCeoCalendly) {
            const entrySegment = findEntrySegment(flow.templateTree);
            const entryAnswer = entrySegment
                ? flow.answers[entrySegment.key]
                : undefined;
            const answerText =
                entrySegment && hasAnswerContent(entryAnswer)
                    ? stripHtmlTags(
                          formatAnswerDisplay(entrySegment, entryAnswer),
                      )
                    : "";
            const questionTitle = entrySegment
                ? stripHtmlTags(entrySegment.label)
                : "";
            const leadName = (lead.client_name ?? "").trim() || "Lead";
            const mainQuestionSummary =
                questionTitle && answerText
                    ? `${leadName} answered ${questionTitle} - ${answerText}`
                    : "";

            calendlyUrl = buildCeoCalendlyUrl(lead, mainQuestionSummary);
            window.open(calendlyUrl, "_blank", "noopener,noreferrer");
        }

        if (outcome === "inviteWebinar") {
            const errors: string[] = [];
            if (!selectedSessionId) {
                errors.push("Please select a webinar session.");
            }
            if (!webinarForm.firstName.trim()) {
                errors.push("First name is required.");
            }
            if (!/^\S+@\S+\.\S+$/.test(webinarForm.email.trim())) {
                errors.push("A valid email address is required.");
            }
            if (errors.length > 0) {
                setWebinarErrors(errors);
                return;
            }
            setWebinarErrors([]);
        }

        setBusy(true);
        try {
            if (treeSegment && selectedValues.length) {
                await flow.applyAnswerChange(
                    treeSegment,
                    selectedValues,
                    comment || null,
                );
            }

            const updated = await flow.completeWithOutcome(outcome, {
                comment: comment || null,
            });
            if (!updated) return;

            onCompleted(updated);

            const pendingRuns = (updated.action_runs ?? []).filter(
                (run) =>
                    run.status !== "completed" && run.status !== "unavailable",
            );
            const primary = pendingRuns[0];

            if (meetingInput) {
                await runMeetingAction(updated, primary, meetingInput);
            } else if (calendlyUrl) {
                await runCalendlyAction(updated, primary, calendlyUrl);
            } else if (outcome === "inviteWebinar" && selectedSessionId) {
                await syncMissingWebinarFieldsToLead();
                await runWebinarAction(updated, primary, selectedSessionId);
            } else if (primary) {
                try {
                    await markExecuted(updated, primary, {});
                } catch {
                    // ignore — outcome already completed
                }
            }

            onDone(updated);
        } catch {
            // errors already toasted
        } finally {
            setBusy(false);
        }
    };

    const selectOption = (optionId: string) => {
        if (!treeSegment) return;
        void flow.applyAnswerChange(treeSegment, [optionId], comment || null);
    };

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-4">
                    <div className="flex gap-4 mb-7">
                        <NumberBadge
                            number="★"
                            answered={Boolean(selectedValues.length)}
                        />
                        <div className="flex-1 min-w-0">
                            <p
                                className="text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td("Outcome", { source: "en" })}
                            </p>
                            <p
                                className="text-base font-semibold mb-2 leading-snug"
                                style={{ color: T.TEXT }}
                            >
                                {td(title, { source: "en" })}
                            </p>
                            <OutcomeBody
                                text={bodyText}
                                translateScript={flow.translateScript}
                            />
                            <p
                                className="text-sm mt-3 mb-4"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td(
                                    "Confirm the outcome with the lead, then continue.",
                                    { source: "en" },
                                )}
                            </p>

                            {optionChoices.length > 0 ? (
                                <div className="mb-4">
                                    <p
                                        className="text-sm font-medium mb-2"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td("Select an option", {
                                            source: "en",
                                        })}
                                    </p>
                                    <RadioInput
                                        value={selectedValues[0] ?? ""}
                                        options={optionChoices}
                                        onChange={selectOption}
                                    />
                                </div>
                            ) : null}

                            <p
                                className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                                style={{ color: T.TEXT }}
                            >
                                {td("Comment", { source: "en" })}
                            </p>
                            <AnalysisTextarea
                                value={comment}
                                onChange={setComment}
                                placeholder={td("Optional outcome comment…", {
                                    source: "en",
                                })}
                                disabled={busy || flow.completing}
                            />

                            {(outcome === "bookMeeting" ||
                                outcome === "callback") && (
                                <div
                                    className="mt-4 rounded-xl"
                                    style={{
                                        border: `1px solid ${T.BORDER}`,
                                        background: "#fff",
                                        padding: "20px 22px",
                                    }}
                                >
                                    <p
                                        className="text-sm font-semibold mb-4"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td(
                                            outcome === "callback"
                                                ? "Schedule the callback"
                                                : "Book the consultation",
                                            { source: "en" },
                                        )}
                                    </p>

                                    {outcome === "bookMeeting" && (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-4">
                                            {(
                                                [
                                                    {
                                                        key: "specialist" as const,
                                                        title: "With an agent",
                                                        subtitle:
                                                            "Schedule it here in the CRM.",
                                                    },
                                                    {
                                                        key: "ceo" as const,
                                                        title: "With Mr. Rabih (CEO)",
                                                        subtitle:
                                                            "Opens Calendly in a new tab.",
                                                    },
                                                ]
                                            ).map((track) => {
                                                const selected =
                                                    bookTrack === track.key;
                                                return (
                                                    <button
                                                        key={track.key}
                                                        type="button"
                                                        aria-pressed={selected}
                                                        disabled={
                                                            busy ||
                                                            flow.completing
                                                        }
                                                        onClick={() =>
                                                            setBookTrack(
                                                                track.key,
                                                            )
                                                        }
                                                        className="text-left rounded-lg border px-3.5 py-2.5 transition-colors"
                                                        style={{
                                                            borderColor:
                                                                selected
                                                                    ? "#1a6bb5"
                                                                    : T.BORDER,
                                                            background: selected
                                                                ? T.BLUE_LIGHT
                                                                : "#fff",
                                                        }}
                                                    >
                                                        <span
                                                            className="block text-[13px] font-semibold"
                                                            style={{
                                                                color: selected
                                                                    ? "#14538c"
                                                                    : T.TEXT,
                                                            }}
                                                        >
                                                            {td(track.title, {
                                                                source: "en",
                                                            })}
                                                        </span>
                                                        <span
                                                            className="block text-[12px] mt-0.5"
                                                            style={{
                                                                color: T.TEXT_MUTED,
                                                            }}
                                                        >
                                                            {td(
                                                                track.subtitle,
                                                                {
                                                                    source: "en",
                                                                },
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {meetingErrors.length > 0 && (
                                        <div className="mb-3 space-y-1">
                                            {meetingErrors.map((err) => (
                                                <p
                                                    key={err}
                                                    className="text-xs text-red-600"
                                                >
                                                    {td(err)}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {usesCeoCalendly ? (
                                        <div
                                            className="rounded-lg p-3"
                                            style={{
                                                background: T.BLUE_LIGHT,
                                                border: "1px solid #b8d4f0",
                                            }}
                                        >
                                            <p
                                                className="text-[13px] leading-relaxed"
                                                style={{ color: T.TEXT }}
                                            >
                                                {td(
                                                    "Continuing completes the qualification and opens Calendly in a new tab, prefilled with:",
                                                    { source: "en" },
                                                )}
                                            </p>
                                            <ul
                                                className="mt-2 text-[13px] space-y-0.5"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                <li>
                                                    {lead.client_name ||
                                                        td("No name", {
                                                            source: "en",
                                                        })}
                                                </li>
                                                <li>
                                                    {lead.client_email ||
                                                        td("No email", {
                                                            source: "en",
                                                        })}
                                                </li>
                                                <li>
                                                    {resolveLeadPhoneDisplay(
                                                        lead.mobile,
                                                        lead.mobile_with_phonecode,
                                                    ) ||
                                                        resolveLeadPhoneDisplay(
                                                            lead.cell,
                                                        ) ||
                                                        td("No phone", {
                                                            source: "en",
                                                        })}
                                                </li>
                                            </ul>
                                            <p
                                                className="mt-2 text-[12px]"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                {td(
                                                    "The booking is completed on Calendly — no CRM meeting is created here.",
                                                    { source: "en" },
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        <MeetingFormFields
                                            form={meetingForm}
                                            onChange={(patch) =>
                                                setMeetingForm((prev) => ({
                                                    ...prev,
                                                    ...patch,
                                                }))
                                            }
                                            meetingTypes={meetingTypes}
                                            disabled={busy || flow.completing}
                                            mustIncludeOwner={getMeetingOwner(lead)}
                                        />
                                    )}
                                </div>
                            )}

                            {outcome === "inviteWebinar" && (
                                <div
                                    className="mt-4 rounded-xl"
                                    style={{
                                        border: `1px solid ${T.BORDER}`,
                                        background: "#fff",
                                        padding: "20px 22px",
                                    }}
                                >
                                    <p
                                        className="text-sm font-semibold mb-4"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td("Next webinar", { source: "en" })}
                                    </p>
                                    {webinarLoading ? (
                                        <div className="flex justify-center py-6">
                                            <Spin />
                                        </div>
                                    ) : !nextSession ? (
                                        <Empty
                                            description={td(
                                                "No upcoming sessions",
                                                { source: "en" },
                                            )}
                                        />
                                    ) : (
                                        <div
                                            className="flex items-start gap-3 rounded-xl p-3"
                                            style={{
                                                background: "#ecfdf5",
                                                border: "1px solid #a7f3d0",
                                            }}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{
                                                    background: "#fff",
                                                    color: "#047857",
                                                }}
                                            >
                                                <Icon name="video" size={18} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className="text-[15px] font-semibold leading-snug"
                                                    style={{ color: T.TEXT }}
                                                >
                                                    {nextSession.title}
                                                </p>
                                                <p
                                                    className="mt-0.5 text-sm"
                                                    style={{
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {formatDateTime(
                                                        nextSession.startsAt,
                                                    )}
                                                    {nextSession.timezone
                                                        ? ` (${nextSession.timezone})`
                                                        : ""}
                                                </p>
                                                {nextSession.duration ? (
                                                    <p
                                                        className="mt-0.5 text-xs"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {nextSession.duration}{" "}
                                                        {td("minutes", {
                                                            source: "en",
                                                        })}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {nextSession && (
                                        <div
                                            className="mt-4 pt-4"
                                            style={{
                                                borderTop: `1px solid ${T.BORDER}`,
                                            }}
                                        >
                                            <p
                                                className="text-sm font-semibold mb-1"
                                                style={{ color: T.TEXT }}
                                            >
                                                {td("Registration details", {
                                                    source: "en",
                                                })}
                                            </p>
                                            <p
                                                className="text-xs mb-4"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                {td(
                                                    "Details already on the lead are used as-is. Only missing fields are shown below — filling them also updates the lead.",
                                                    { source: "en" },
                                                )}
                                            </p>

                                            {webinarErrors.length > 0 && (
                                                <div className="mb-3 space-y-1">
                                                    {webinarErrors.map(
                                                        (err) => (
                                                            <p
                                                                key={err}
                                                                className="text-xs text-red-600"
                                                            >
                                                                {td(err)}
                                                            </p>
                                                        ),
                                                    )}
                                                </div>
                                            )}

                                            {(webinarLocked.firstName ||
                                                webinarLocked.lastName ||
                                                webinarLocked.email ||
                                                webinarLocked.phone ||
                                                webinarLocked.gender) && (
                                                <div
                                                    className="mb-4 rounded-lg px-3 py-2.5 space-y-1.5"
                                                    style={{
                                                        background: "#f8fafc",
                                                        border: `1px solid ${T.BORDER}`,
                                                    }}
                                                >
                                                    {[
                                                        webinarLocked.firstName ||
                                                        webinarLocked.lastName
                                                            ? {
                                                                  label: "Name",
                                                                  value: [
                                                                      webinarForm.firstName,
                                                                      webinarForm.lastName,
                                                                  ]
                                                                      .filter(
                                                                          Boolean,
                                                                      )
                                                                      .join(
                                                                          " ",
                                                                      ),
                                                              }
                                                            : null,
                                                        webinarLocked.email
                                                            ? {
                                                                  label: "Email",
                                                                  value: webinarForm.email,
                                                              }
                                                            : null,
                                                        webinarLocked.phone
                                                            ? {
                                                                  label: "Phone",
                                                                  value: webinarForm.phone,
                                                              }
                                                            : null,
                                                        webinarLocked.gender
                                                            ? {
                                                                  label: "Gender",
                                                                  value:
                                                                      webinarForm.gender ===
                                                                      "male"
                                                                          ? "Male"
                                                                          : "Female",
                                                              }
                                                            : null,
                                                    ]
                                                        .filter(
                                                            (
                                                                row,
                                                            ): row is {
                                                                label: string;
                                                                value: string;
                                                            } =>
                                                                Boolean(
                                                                    row?.value,
                                                                ),
                                                        )
                                                        .map((row) => (
                                                            <div
                                                                key={row.label}
                                                                className="flex items-baseline gap-2 text-[13px]"
                                                            >
                                                                <span
                                                                    className="shrink-0 font-semibold"
                                                                    style={{
                                                                        color: T.TEXT_MUTED,
                                                                        minWidth: 56,
                                                                    }}
                                                                >
                                                                    {td(
                                                                        row.label,
                                                                        {
                                                                            source: "en",
                                                                        },
                                                                    )}
                                                                </span>
                                                                <span
                                                                    className="min-w-0 break-words"
                                                                    style={{
                                                                        color: T.TEXT,
                                                                    }}
                                                                >
                                                                    {row.value}
                                                                </span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}

                                            {(!webinarLocked.firstName ||
                                                !webinarLocked.lastName) && (
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
                                                    {!webinarLocked.firstName ? (
                                                        <ModalField
                                                            label={td(
                                                                "First name",
                                                                {
                                                                    source: "en",
                                                                },
                                                            )}
                                                        >
                                                            <input
                                                                type="text"
                                                                value={
                                                                    webinarForm.firstName
                                                                }
                                                                disabled={
                                                                    busy ||
                                                                    flow.completing
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setWebinarForm(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            firstName:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                                onBlur={() =>
                                                                    void syncWebinarFieldToLead(
                                                                        "firstName",
                                                                    )
                                                                }
                                                            />
                                                        </ModalField>
                                                    ) : null}
                                                    {!webinarLocked.lastName ? (
                                                        <ModalField
                                                            label={td(
                                                                "Last name",
                                                                {
                                                                    source: "en",
                                                                },
                                                            )}
                                                        >
                                                            <input
                                                                type="text"
                                                                value={
                                                                    webinarForm.lastName
                                                                }
                                                                disabled={
                                                                    busy ||
                                                                    flow.completing
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setWebinarForm(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            lastName:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                                onBlur={() =>
                                                                    void syncWebinarFieldToLead(
                                                                        "lastName",
                                                                    )
                                                                }
                                                            />
                                                        </ModalField>
                                                    ) : null}
                                                </div>
                                            )}

                                            {!webinarLocked.email ? (
                                                <div className="mb-3">
                                                    <ModalField
                                                        label={td("Email", {
                                                            source: "en",
                                                        })}
                                                    >
                                                        <input
                                                            type="email"
                                                            value={
                                                                webinarForm.email
                                                            }
                                                            disabled={
                                                                busy ||
                                                                flow.completing
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setWebinarForm(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        email: event
                                                                            .target
                                                                            .value,
                                                                    }),
                                                                )
                                                            }
                                                            onBlur={() =>
                                                                void syncWebinarFieldToLead(
                                                                    "email",
                                                                )
                                                            }
                                                        />
                                                    </ModalField>
                                                </div>
                                            ) : null}

                                            <div
                                                className={`grid grid-cols-1 gap-3 ${
                                                    !webinarLocked.phone &&
                                                    !webinarLocked.gender
                                                        ? "sm:grid-cols-3"
                                                        : !webinarLocked.phone ||
                                                            !webinarLocked.gender
                                                          ? "sm:grid-cols-2"
                                                          : ""
                                                }`}
                                            >
                                                {!webinarLocked.phone ? (
                                                    <ModalField
                                                        label={td("Phone", {
                                                            source: "en",
                                                        })}
                                                    >
                                                        <input
                                                            type="tel"
                                                            value={
                                                                webinarForm.phone
                                                            }
                                                            disabled={
                                                                busy ||
                                                                flow.completing
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setWebinarForm(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        phone: event
                                                                            .target
                                                                            .value,
                                                                    }),
                                                                )
                                                            }
                                                            onBlur={() =>
                                                                void syncWebinarFieldToLead(
                                                                    "phone",
                                                                )
                                                            }
                                                        />
                                                    </ModalField>
                                                ) : null}
                                                {!webinarLocked.gender ? (
                                                    <ModalField
                                                        label={td("Gender", {
                                                            source: "en",
                                                        })}
                                                    >
                                                        <select
                                                            value={
                                                                webinarForm.gender
                                                            }
                                                            disabled={
                                                                busy ||
                                                                flow.completing
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                const gender =
                                                                    event.target
                                                                        .value as
                                                                        | WebinarGender
                                                                        | "";
                                                                setWebinarForm(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        gender,
                                                                    }),
                                                                );
                                                                void syncWebinarFieldToLead(
                                                                    "gender",
                                                                    {
                                                                        ...webinarForm,
                                                                        gender,
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            <option value="">
                                                                {td(
                                                                    "Not specified",
                                                                    {
                                                                        source: "en",
                                                                    },
                                                                )}
                                                            </option>
                                                            <option value="male">
                                                                {td("Male", {
                                                                    source: "en",
                                                                })}
                                                            </option>
                                                            <option value="female">
                                                                {td("Female", {
                                                                    source: "en",
                                                                })}
                                                            </option>
                                                        </select>
                                                    </ModalField>
                                                ) : null}
                                                <ModalField
                                                    label={td("Language", {
                                                        source: "en",
                                                    })}
                                                >
                                                    <select
                                                        value={
                                                            webinarForm.language
                                                        }
                                                        disabled={
                                                            busy ||
                                                            flow.completing
                                                        }
                                                        onChange={(event) =>
                                                            setWebinarForm(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    language:
                                                                        event
                                                                            .target
                                                                            .value as WebinarLanguage,
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        {WEBINAR_LANGUAGES.map(
                                                            (code) => (
                                                                <option
                                                                    key={code}
                                                                    value={code}
                                                                >
                                                                    {td(
                                                                        WEBINAR_LANGUAGE_LABELS[
                                                                            code
                                                                        ],
                                                                        {
                                                                            source: "en",
                                                                        },
                                                                    )}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </ModalField>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <OutcomeFooter
                    onBack={onBack}
                    backLabel={td("Previous", { source: "en" })}
                    onPrimary={() => void handleCta()}
                    primaryLabel={
                        busy || flow.completing
                            ? td("Working…", { source: "en" })
                            : td(ctaLabel, { source: "en" })
                    }
                    primaryDisabled={
                        busy ||
                        flow.completing ||
                        (outcome === "inviteWebinar" && !selectedSessionId)
                    }
                />
            </div>
        </DynamicTranslationProvider>
    );
}

function OutcomeBody({
    text,
    translateScript,
}: {
    text: string;
    translateScript: (text: string) => string;
}) {
    const localized = useTranslatedScriptLabel(text);
    const translated = translateScript(localized);
    return (
        <QualificationScriptHtml
            html={translated}
            className="qualify-segment-prompt text-base font-normal leading-snug"
            quoted
        />
    );
}
