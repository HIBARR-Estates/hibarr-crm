import { useCallback, useState } from "react";
import { App, message } from "antd";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
import useSoftphone, { canMakeSoftphoneCalls } from "@/Hooks/useSoftphone";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";
import type { Task } from "@/Types/Task";

/** The lead shape the quick-action needs, from either link path. */
export type TaskActionLead = NonNullable<NonNullable<Task["leads"]>[number]> &
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
    /** Available softphone lines when multiple lines are configured. */
    devices: SoftphoneDeviceSummary[];
    /** False when the user has no assigned line. */
    hasLine: boolean;
    /** True when this user can dial from the CRM (assigned line, or the 3CX bridge). */
    canDial: boolean;
    /** Currently active softphone line id. */
    activeDeviceId: number | null;
    /** Place the call (optionally selecting a specific line). No-ops when the user cannot dial. */
    startCall: (deviceId?: number) => Promise<void>;
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
    const { t } = useTranslation();
    const { message: appMessage } = App.useApp();
    const toast = appMessage ?? message;
    const softphoneEnabled = props.featureFlags?.["crm.softphone"] === true;
    const clickToCall = useClickToCall();
    const {
        devices,
        hasLine,
        activeDeviceId,
        call: softphoneCall,
    } = useSoftphone();
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

    // Softphone needs make_softphone_calls. Without a line or the 3CX bridge
    // there is nothing to dial — callers hide the button.
    const canCall = canMakeSoftphoneCalls(
        props.auth?.user,
        props.auth?.permissions,
    );
    const canDial =
        (softphoneEnabled && canCall && devices.length > 0) ||
        clickToCall.isEnabled;

    const startCall = useCallback(
        async (deviceId?: number) => {
            if (!lead || !canDial) return;

            if (!softphoneEnabled || !canCall || devices.length === 0) {
                if (!phone || !clickToCall.isEnabled) return;
                await clickToCall.initiateCall(phone, {
                    type: "lead",
                    id: lead.id,
                });
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
                toast.error(t("pages.telephony.insecure_context"));
                return;
            }
            if (
                devices.length === 0 &&
                typeof deviceId !== "number" &&
                softphone.getState().registration !== "registered"
            ) {
                toast.warning(t("pages.telephony.softphone_not_registered"));
                return;
            }

            setCalling(true);
            try {
                // Strip formatting spaces for the dialing target — softphone.call
                // expects a raw E.164 number, not a human-formatted one.
                const dialingPhone = phone.replace(/\s/g, "");
                await softphoneCall(
                    dialingPhone,
                    {
                        leadId: lead.id,
                        leadName: lead.client_name ?? null,
                    },
                    deviceId,
                );
                toast.info(t("pages.telephony.calling_number", { phone }));
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
                toast.error(
                    error instanceof Error
                        ? error.message
                        : t("pages.telephony.generic_error"),
                );
            } finally {
                setCalling(false);
            }
        },
        [
            calling,
            canDial,
            clickToCall,
            devices.length,
            lead,
            phone,
            softphoneCall,
            softphoneEnabled,
            canCall,
            t,
            toast,
        ],
    );

    return {
        lead,
        source,
        dealName: source === "deal" ? (dealWithLead?.name ?? null) : null,
        phone,
        email,
        calling,
        softphoneEnabled,
        canCall,
        devices,
        hasLine,
        canDial,
        activeDeviceId,
        startCall,
    };
}
