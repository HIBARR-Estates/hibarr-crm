import { useCallback, useState } from "react";
import { message } from "antd";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import type { Task } from "@/Types/Task";

/** The lead shape the quick-action needs, from either link path. */
export type TaskActionLead = NonNullable<
    NonNullable<Task["leads"]>[number]
> &
    Partial<NonNullable<NonNullable<Task["deals"]>[number]["lead"]>>;

export interface TaskLeadCall {
    /**
     * The lead the action targets: the task's first linked lead, or — when the
     * task hangs off a deal instead — that deal's lead contact.
     */
    lead: TaskActionLead | undefined;
    /** Which link path supplied the lead, for copy that explains it. */
    source: "lead" | "deal" | null;
    /** Name of the deal the lead was reached through, when it was. */
    dealName: string | null;
    phone: string;
    email: string;
    /** True while the softphone is dialling out. */
    calling: boolean;
    softphoneEnabled: boolean;
    /** The user holds make_softphone_calls, so the softphone path is usable. */
    canCall: boolean;
    /** Place the call. Falls back to the device dialler without the softphone. */
    startCall: () => Promise<void>;
}

/**
 * The one place a task's category quick-action dials the linked lead.
 *
 * Shared by the list-row action button and the detail modal's call banner so
 * both place the same call, log the same timeline event and show the same
 * "calling…" state.
 */
export default function useTaskLeadCall(task: Task): TaskLeadCall {
    const { props } = usePage();
    const softphoneEnabled = props.featureFlags?.["shared.softphone"] === true;
    const clickToCall = useClickToCall();
    const [calling, setCalling] = useState(false);

    // A task can be attached to the lead itself or to a deal. A directly linked
    // lead wins; otherwise fall back to the first deal that exposes a lead the
    // viewer is allowed to see.
    const directLead = task.leads?.[0];
    const dealWithLead = task.deals?.find((deal) => deal.lead);
    const dealLead = dealWithLead?.lead;
    const lead = directLead ?? (dealLead as TaskActionLead | undefined);
    const source = directLead ? "lead" : dealLead ? "deal" : null;

    // `mobile` may be stored in E.164 or human-formatted ("+46 70 123 45 67"),
    // so resolve it the same way the meeting/contact surfaces do before using it
    // as a dialler target.
    const phone = resolveLeadPhoneDisplay(lead?.mobile).trim();
    const email = lead?.client_email?.trim() ?? "";

    // Mirrors ClickToCallButton: the softphone needs make_softphone_calls;
    // without it the button falls back to the device dialler.
    const canCall =
        props.auth?.permissions?.make_softphone_calls === "all";

    const startCall = useCallback(async () => {
        if (!lead) return;

        if (!softphoneEnabled) {
            // No SIP registration in this browser — fall back to the dialler.
            if (phone) {
                await clickToCall.initiateCall(phone, {
                    type: "lead",
                    id: lead.id,
                });
            }
            return;
        }

        if (!phone || calling) return;

        // Same preconditions as ClickToCallButton: getUserMedia needs a secure
        // context, and calling before the line has registered fails silently.
        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices ||
            !window.isSecureContext
        ) {
            message.error("Calling needs a secure connection.");
            return;
        }
        if (softphone.getState().registration !== "registered") {
            message.warning("Softphone is not registered — pick a line in the dock.");
            return;
        }

        setCalling(true);
        try {
            await softphone.call(phone, {
                leadId: lead.id,
                leadName: lead.client_name ?? null,
            });
            message.info(`Calling ${phone}…`);
            void axios
                .post(route("telephony.softphone.events.store"), {
                    phone,
                    entity_type: "lead",
                    entity_id: lead.id,
                    event: "call.started",
                })
                .catch(() => {
                    // Timeline logging is best-effort only.
                });
        } catch (error: unknown) {
            message.error(
                error instanceof Error
                    ? error.message
                    : "Unable to initiate the call.",
            );
        } finally {
            setCalling(false);
        }
    }, [calling, clickToCall, lead, phone, softphoneEnabled]);

    return {
        lead,
        source,
        dealName: source === "deal" ? (dealWithLead?.name ?? null) : null,
        phone,
        email,
        calling,
        softphoneEnabled,
        canCall,
        startCall,
    };
}