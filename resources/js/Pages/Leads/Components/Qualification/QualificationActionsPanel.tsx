import { useMemo, useState } from "react";
import { Button, message } from "antd";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    QualificationActionRun,
    QualificationActionType,
} from "@/Types/qualification";
import { toWebinarLanguage } from "@/Types/qualification";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import WebinarSessionPickerModal from "./WebinarSessionPickerModal";

const ACTION_LABELS: Record<string, string> = {
    book_consultation: "Book consultation",
    invite_webinar: "Invite to webinar",
    schedule_callback: "Schedule callback",
    mark_no_fit: "Mark not a fit",
    create_task: "Create task",
    schedule_meeting: "Schedule meeting",
    create_deal: "Create deal",
    add_note: "Add note",
    log_activity: "Log activity",
    send_email: "Send email",
    send_sms: "Send SMS",
    assign_owner: "Assign owner",
};

const EXECUTABLE = new Set(["book_consultation", "invite_webinar"]);
const NO_OP = new Set(["schedule_callback", "mark_no_fit"]);

const splitLeadName = (name?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

interface QualificationActionsPanelProps {
    lead: Lead;
    qualification: LeadQualification;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    agentLanguage?: string;
    variant?: "redesign" | "legacy";
    onUpdated: (qualification: LeadQualification) => void;
    onDone?: () => void;
}

export default function QualificationActionsPanel({
    lead,
    qualification,
    qualificationService,
    registrationService,
    agentLanguage = "en",
    variant = "redesign",
    onUpdated,
    onDone,
}: QualificationActionsPanelProps) {
    const { td } = useTd();
    const [busyId, setBusyId] = useState<number | null>(null);
    const [webinarPickerOpen, setWebinarPickerOpen] = useState(false);
    const [pendingWebinar, setPendingWebinar] = useState<{
        run: QualificationActionRun;
        webinarId: string;
    } | null>(null);

    const runs = useMemo(
        () => qualification.action_runs ?? [],
        [qualification.action_runs],
    );

    const registrationPayload = useMemo(() => {
        const { firstName, lastName } = splitLeadName(lead.client_name);
        const marketing = lead.marketing;
        return {
            email: lead.client_email ?? "",
            firstName,
            lastName,
            phone: lead.mobile ?? lead.cell ?? undefined,
            leadId: lead.id,
            language: agentLanguage,
            country: lead.country ?? undefined,
            city: lead.city ?? undefined,
            state: lead.state ?? undefined,
            zipCode: lead.postal_code ?? undefined,
            gender: lead.gender ?? undefined,
            utmInfo: marketing?.utm_source
                ? {
                      utmSource: marketing.utm_source,
                      utmMedium: marketing.utm_medium ?? undefined,
                      utmCampaign: marketing.utm_campaign ?? undefined,
                      utmTerm: marketing.utm_term ?? undefined,
                      utmContent: marketing.utm_content ?? undefined,
                  }
                : undefined,
        };
    }, [agentLanguage, lead]);

    const markExecuted = async (
        run: QualificationActionRun,
        payload: Record<string, unknown> = {},
        error?: string,
    ) => {
        const result = await qualificationService.executeAction(
            qualification.id,
            run.id,
            { payload, error: error ?? null },
        );
        onUpdated(result.qualification);
    };

    const runBookConsultation = async (run: QualificationActionRun) => {
        setBusyId(run.id);
        try {
            await registrationService.bookConsultationCalendly({
                ...registrationPayload,
                calendlyUrl: run.config?.calendlyUrl,
            });
            await markExecuted(run, {
                calendlyUrl: run.config?.calendlyUrl ?? null,
            });
            message.success(td("Consultation booking started"));
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to book consultation";
            message.error(msg);
            try {
                await markExecuted(run, {}, msg);
            } catch {
                // ignore secondary failure
            }
        } finally {
            setBusyId(null);
        }
    };

    const runInviteWebinar = async (
        run: QualificationActionRun,
        sessionId: string,
        sessionLabel: string,
    ) => {
        setBusyId(run.id);
        try {
            // Webinar registration takes a narrower payload than the
            // consultation one — and only OL's language enum, which has no `ru`.
            await registrationService.registerWebinarSession(sessionId, {
                firstName: registrationPayload.firstName,
                email: registrationPayload.email,
                language: toWebinarLanguage(registrationPayload.language),
                lastName: registrationPayload.lastName || undefined,
                phone: registrationPayload.phone,
                gender: registrationPayload.gender,
                utmInfo: registrationPayload.utmInfo,
            });
            await markExecuted(run, {
                webinarSessionId: sessionId,
                webinarSessionLabel: sessionLabel,
            });
            message.success(td("Webinar registration completed"));
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to register webinar";
            message.error(msg);
            try {
                await markExecuted(run, {}, msg);
            } catch {
                // ignore
            }
        } finally {
            setBusyId(null);
            setPendingWebinar(null);
            setWebinarPickerOpen(false);
        }
    };

    const runNoOp = async (run: QualificationActionRun) => {
        setBusyId(run.id);
        try {
            await markExecuted(run, {});
            message.success(td("Action recorded"));
        } catch (error) {
            message.error(
                error instanceof Error
                    ? error.message
                    : "Failed to record action",
            );
        } finally {
            setBusyId(null);
        }
    };

    const handleClick = (run: QualificationActionRun) => {
        const type = run.action_type as QualificationActionType;
        if (run.status === "completed" || run.status === "unavailable") return;
        if (busyId != null) return;

        if (type === "invite_webinar") {
            const webinarId = run.config?.webinarId;
            if (!webinarId) {
                message.error(td("Webinar is not configured for this action."));
                return;
            }
            setPendingWebinar({ run, webinarId });
            setWebinarPickerOpen(true);
            return;
        }

        if (type === "book_consultation") {
            void runBookConsultation(run);
            return;
        }

        if (NO_OP.has(type)) {
            void runNoOp(run);
            return;
        }

        message.warning(td("This action is not available yet."));
    };

    const isDisabled = (run: QualificationActionRun) => {
        if (run.status === "completed" || run.status === "unavailable") {
            return true;
        }
        if (busyId != null) return true;
        const type = run.action_type;
        if (EXECUTABLE.has(type) || NO_OP.has(type)) return false;
        return true;
    };

    const statusHint = (run: QualificationActionRun) => {
        if (run.status === "completed") return td("Done");
        if (run.status === "failed") return td("Failed — retry");
        if (run.status === "unavailable") {
            return td("Unavailable in this CRM version");
        }
        if (!EXECUTABLE.has(run.action_type) && !NO_OP.has(run.action_type)) {
            return td("Coming soon");
        }
        return null;
    };

    if (variant === "legacy") {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    {td("Next steps")}
                </h3>
                <p className="text-sm text-gray-500">
                    {td(
                        "Run the actions for this qualification. You can finish later if needed.",
                    )}
                </p>
                <div className="space-y-2">
                    {runs.map((run) => {
                        const label =
                            ACTION_LABELS[run.action_type] ?? run.action_type;
                        const hint = statusHint(run);
                        return (
                            <Button
                                key={run.id}
                                block
                                type={
                                    run.status === "completed"
                                        ? "default"
                                        : "primary"
                                }
                                loading={busyId === run.id}
                                disabled={isDisabled(run)}
                                onClick={() => handleClick(run)}
                            >
                                {td(label)}
                                {hint ? ` · ${hint}` : ""}
                            </Button>
                        );
                    })}
                </div>
                {onDone ? (
                    <Button onClick={onDone}>{td("Done")}</Button>
                ) : null}
                {pendingWebinar ? (
                    <WebinarSessionPickerModal
                        open={webinarPickerOpen}
                        webinarId={pendingWebinar.webinarId}
                        registrationService={registrationService}
                        onClose={() => {
                            setWebinarPickerOpen(false);
                            setPendingWebinar(null);
                        }}
                        onSelect={(sessionId, sessionLabel) =>
                            void runInviteWebinar(
                                pendingWebinar.run,
                                sessionId,
                                sessionLabel,
                            )
                        }
                    />
                ) : null}
            </div>
        );
    }

    return (
        <div>
            <p className="v2-qualify-prompt">{td("Next steps")}</p>
            <p className="v2-qualify-guidance">
                {td(
                    "Run the actions for this qualification. You can finish later if needed.",
                )}
            </p>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 14,
                }}
            >
                {runs.map((run) => {
                    const label =
                        ACTION_LABELS[run.action_type] ?? run.action_type;
                    const hint = statusHint(run);
                    const done = run.status === "completed";
                    return (
                        <button
                            key={run.id}
                            type="button"
                            className={`v2-option${done ? " selected" : ""}`}
                            disabled={isDisabled(run)}
                            onClick={() => handleClick(run)}
                        >
                            <span>
                                {td(label)}
                                {hint ? (
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 11,
                                            color: "var(--lr-text-dim)",
                                            marginTop: 2,
                                        }}
                                    >
                                        {hint}
                                    </span>
                                ) : null}
                            </span>
                            {done ? <Icon name="check" size={16} /> : null}
                            {busyId === run.id ? (
                                <span style={{ fontSize: 11 }}>…</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            {onDone ? (
                <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    style={{ width: "100%" }}
                    onClick={onDone}
                >
                    {td("Done")}
                </button>
            ) : null}
            {pendingWebinar ? (
                <WebinarSessionPickerModal
                    open={webinarPickerOpen}
                    webinarId={pendingWebinar.webinarId}
                    registrationService={registrationService}
                    onClose={() => {
                        setWebinarPickerOpen(false);
                        setPendingWebinar(null);
                    }}
                    onSelect={(sessionId, sessionLabel) =>
                        void runInviteWebinar(
                            pendingWebinar.run,
                            sessionId,
                            sessionLabel,
                        )
                    }
                />
            ) : null}
        </div>
    );
}
