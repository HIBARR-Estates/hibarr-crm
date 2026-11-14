import { Button, Dropdown, type MenuProps } from "antd";
import { useState } from "react";
import {
    MailOutlined,
    PhoneOutlined,
    PlayCircleOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import QualifyLaunchModal from "@/Pages/Leads/Redesign/components/qualification/QualifyLaunchModal";
import type { Lead } from "@/Types/api/leads";
import type { Task } from "@/Types/Task";
import useTaskLeadCall from "../../hooks/useTaskLeadCall";

interface TaskCategoryActionProps {
    task: Task;
    /**
     * "icon" — compact icon-only trigger for list rows; "button" — labelled
     * trigger for the detail header.
     */
    variant?: "icon" | "button";
}

/** Actions a task category can configure (mirrors TaskCategoryManager). */
const ACTION_LABEL: Record<string, string> = {
    call: "Call",
    email: "Email",
};

/**
 * Quick-action button shown on a task row whose category has a configured
 * action. The button follows the category: `call` opens the phone menu,
 * `email` offers a mailto for the lead. Renders nothing when there is no lead
 * to act on.
 *
 * "Begin qualification" deliberately does NOT navigate to the lead: it opens the
 * qualification modal over the current page and starts a call to that lead, so
 * the agent keeps the script, the task list and the live call in one place.
 *
 * The task detail modal shows the call action as a full-width banner instead
 * (detail/TaskCallBanner) — both place the call through the same hook.
 */
export default function TaskCategoryAction({
    task,
    variant = "icon",
}: TaskCategoryActionProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const {
        lead,
        phone,
        email,
        calling,
        softphoneEnabled,
        canCall,
        canDial,
        devices,
        activeDeviceId,
        startCall,
    } = useTaskLeadCall(task);
    const [qualifyLead, setQualifyLead] = useState<Lead | null>(null);

    const action = task.category?.action ?? "";
    if (!action || !lead) return null;

    const leadForQualification: Lead = {
        id: lead.id,
        client_name: lead.client_name ?? "",
        mobile: lead.mobile ?? undefined,
        client_email: lead.client_email ?? undefined,
    };

    if (action === "email") {
        const label = td(ACTION_LABEL.email, { source: "en" });
        if (!email) return null;
        // antd renders `href` buttons as a real <a>, so this is a mailto link
        // that still looks like the call button — no nested interactive nodes.
        return (
            <span onClick={(event) => event.stopPropagation()}>
                <Button
                    {...(variant === "icon" ? { type: "text" as const } : {})}
                    href={`mailto:${email}?subject=${encodeURIComponent(
                        task.heading ?? "",
                    )}`}
                    size="small"
                    icon={<MailOutlined />}
                    title={`${label} ${email}`}
                    aria-label={`${label} ${lead.client_name ?? ""}`.trim()}
                >
                    {variant === "button" ? label : null}
                </Button>
            </span>
        );
    }

    if (action !== "call") return null;

    const hasLineChoice =
        Boolean(phone) &&
        softphoneEnabled &&
        canCall &&
        devices.length > 1;

    const buildLineChildren = (
        keyPrefix: string,
        onSelectLine: (deviceId: number) => void,
    ): MenuProps["items"] =>
        devices.map((d) => ({
            key: `${keyPrefix}-line-${d.id}`,
            disabled: calling,
            label: (
                <span className="flex items-center justify-between gap-3">
                    <span>{d.label}</span>
                    {activeDeviceId === d.id && (
                        <span className="text-[11px] text-emerald-600">
                            {t("pages.telephony.active_line_badge")}
                        </span>
                    )}
                </span>
            ),
            onClick: () => onSelectLine(d.id),
        }));

    const items: MenuProps["items"] = [];

    if (phone && canDial) {
        if (hasLineChoice) {
            items.push({
                key: "call",
                icon: <PhoneOutlined />,
                label: td(ACTION_LABEL.call, { source: "en" }),
                children: buildLineChildren("call", (deviceId) => {
                    void startCall(deviceId);
                }),
            });
        } else {
            items.push({
                key: "call",
                icon: <PhoneOutlined />,
                label: td(ACTION_LABEL.call, { source: "en" }),
                onClick: () => void startCall(),
            });
        }
    }

    if (hasLineChoice) {
        items.push({
            key: "qualify",
            icon: <PlayCircleOutlined />,
            label: td("Begin qualification", { source: "en" }),
            children: buildLineChildren("qualify", (deviceId) => {
                setQualifyLead(leadForQualification);
                void startCall(deviceId);
            }),
        });
    } else {
        items.push({
            key: "qualify",
            icon: <PlayCircleOutlined />,
            label: td("Begin qualification", { source: "en" }),
            onClick: () => {
                // Open the script where the agent already is, and ring the lead —
                // navigating to the lead would drop both the task list and the call.
                setQualifyLead(leadForQualification);
                void startCall();
            },
        });
    }

    if (items.length === 0) return null;

    // With no phone on the lead there is nothing to call, so the trigger becomes
    // the qualification action rather than a "Call" button that can't call.
    const onlyQualification = !phone || !canDial;
    const triggerLabel = td(
        onlyQualification ? "Begin qualification" : ACTION_LABEL.call,
        { source: "en" },
    );
    const TriggerIcon = onlyQualification ? PlayCircleOutlined : PhoneOutlined;

    const trigger = variant === "button" ? (
        <Button
            size="small"
            icon={<TriggerIcon />}
            loading={softphoneEnabled && calling}
            onClick={
                onlyQualification ? () => setQualifyLead(leadForQualification) : undefined
            }
        >
            {triggerLabel}
        </Button>
    ) : (
        <Button
            type="text"
            size="small"
            icon={<TriggerIcon />}
            aria-label={triggerLabel}
            loading={softphoneEnabled && calling}
            onClick={
                onlyQualification ? () => setQualifyLead(leadForQualification) : undefined
            }
        />
    );

    return (
        <span onClick={(event) => event.stopPropagation()}>
            {/* Qualification renders the button bare: Dropdown swallows the
                click, so the qualification onClick never fired. */}
            {onlyQualification ? (
                trigger
            ) : (
                <Dropdown
                    menu={{ items }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    {trigger}
                </Dropdown>
            )}

            {qualifyLead && (
                <QualifyLaunchModal
                    open
                    lead={qualifyLead}
                    onClose={() => setQualifyLead(null)}
                />
            )}
        </span>
    );
}
