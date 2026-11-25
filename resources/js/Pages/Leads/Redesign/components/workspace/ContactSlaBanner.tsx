import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Deferred, usePage } from "@inertiajs/react";
import { Icon } from "@/Components/Redesign";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import {
    formatClock,
    formatDurationShort,
    isLive,
    serverOffsetMs,
    slaView,
    type ContactSla,
    type SlaPhase,
} from "../../adapters/contactSla";

/** How often a running clock asks the server again, so contact made elsewhere shows up. */
const POLL_MS = 30_000;

const PHASE_STYLE: Record<SlaPhase, { bg: string; border: string; color: string; icon: string }> = {
    awaiting_owner: { bg: T.SURFACE_2, border: T.BORDER, color: T.TEXT_MUTED, icon: "clock" },
    running: { bg: T.BLUE_LIGHT, border: T.BORDER, color: T.BLUE_DARK, icon: "clock" },
    due_soon: { bg: T.AMBER_SOFT, border: T.AMBER_MID, color: T.AMBER, icon: "clock" },
    overdue: { bg: T.RED_SOFT, border: T.RED, color: T.RED, icon: "clock" },
    paused: { bg: T.SURFACE_2, border: T.BORDER, color: T.TEXT_MUTED, icon: "clock" },
    met: { bg: T.GREEN_LIGHT, border: T.GREEN_MID, color: T.GREEN, icon: "check-square" },
    met_late: { bg: T.AMBER_SOFT, border: T.AMBER_MID, color: T.AMBER, icon: "check-square" },
};

function Clock({ initial, leadId }: { initial: ContactSla; leadId: number }) {
    const { t } = useTranslation();
    const [sla, setSla] = useState(initial);
    const offset = useRef(serverOffsetMs(initial, Date.now()));
    const [now, setNow] = useState(() => Date.now() + offset.current);

    // Tick against the server's clock, not the browser's.
    useEffect(() => {
        if (!isLive(sla)) return;
        const id = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
        return () => window.clearInterval(id);
    }, [sla]);

    const refresh = async () => {
        try {
            const res = await axios.get(route("lead-contact.contact-sla", leadId), {
                headers: { Accept: "application/json" },
            });
            const next = res.data?.data as ContactSla | null | undefined;
            if (next) {
                offset.current = serverOffsetMs(next, Date.now());
                setSla(next);
            }
        } catch {
            // The timer keeps counting from what it has; the next poll tries again.
        }
    };

    useEffect(() => {
        if (!isLive(sla)) return;
        const id = window.setInterval(() => void refresh(), POLL_MS);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed only when the clock ends
    }, [sla.status, sla.id]);

    const view = slaView(sla, now);
    const style = PHASE_STYLE[view.phase];
    const method = (m: string | null) => (m ? t(`pages.leads.sla.method_${m}`) : "");
    const when = (iso: string | null) => formatCompanyDateTime(iso, { omitCurrentYear: true });

    const heading = {
        awaiting_owner: t("pages.leads.sla.awaiting_owner"),
        running: t("pages.leads.sla.running", { time: formatClock(view.seconds) }),
        due_soon: t("pages.leads.sla.due_soon", { time: formatClock(view.seconds) }),
        overdue: t("pages.leads.sla.overdue", { time: formatClock(view.seconds) }),
        paused: t("pages.leads.sla.paused", { when: when(sla.resumes_at) }),
        met: t("pages.leads.sla.met", { time: formatDurationShort(view.seconds) }),
        met_late: t("pages.leads.sla.met_late", { time: formatDurationShort(view.seconds) }),
    }[view.phase];

    const details: string[] = [];
    if (sla.status !== "met") {
        if (sla.due_at && sla.status === "running") details.push(t("pages.leads.sla.due", { when: when(sla.due_at) }));
        details.push(t("pages.leads.sla.limit", { limit: formatDurationShort(sla.first_contact_seconds) }));
        if (sla.recommended_method) {
            details.push(t("pages.leads.sla.recommended", { method: method(sla.recommended_method) }));
        }
        if (sla.owner?.name) details.push(t("pages.leads.sla.owner", { name: sla.owner.name }));
    } else {
        details.push(
            t("pages.leads.sla.contacted_by", {
                name: sla.contacted_by?.name ?? t("pages.leads.sla.someone"),
                method: method(sla.contact_method),
            }),
        );
        details.push(t("pages.leads.sla.limit", { limit: formatDurationShort(sla.first_contact_seconds) }));
        if (sla.used_recommended_method === false && sla.recommended_method) {
            details.push(t("pages.leads.sla.not_recommended", { method: method(sla.recommended_method) }));
        }
    }

    return (
        <section
            role="status"
            aria-live="polite"
            data-testid="contact-sla"
            data-phase={view.phase}
            className="mb-4 flex items-center gap-3 rounded-[10px] border px-4 py-3"
            style={{ background: style.bg, borderColor: style.border, color: style.color }}
        >
            <span className="flex shrink-0">
                <Icon name={style.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{heading}</div>
                <div className="mt-0.5 text-xs" style={{ opacity: 0.85 }}>
                    {details.join(" · ")}
                </div>
            </div>
        </section>
    );
}

function ContactSlaContent({ leadId }: { leadId: number }) {
    const { contactSla } = usePage().props as unknown as { contactSla?: ContactSla | null };
    return contactSla ? <Clock key={contactSla.id} initial={contactSla} leadId={leadId} /> : null;
}

/**
 * How long the lead's owner has to make first contact, counting down, and how it ended. Shown only
 * when the channel the lead came in through sets a time limit. Deferred, so it never blocks the page.
 */
export default function ContactSlaBanner({ leadId }: { leadId: number }) {
    return (
        <Deferred data="contactSla" fallback={null}>
            <ContactSlaContent leadId={leadId} />
        </Deferred>
    );
}
