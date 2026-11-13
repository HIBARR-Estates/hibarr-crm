import { useState, type ReactNode } from "react";
import { Dropdown } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import { useNewActivityScope } from "./NewActivityContext";

/** A New activity entry that isn't one of the lead page's create forms. */
export interface ExtraActivity {
    key: string;
    icon: ReactNode;
    label: string;
    onSelect: () => void;
}

/** How many meeting types the row names before it says "and more". */
const TYPES_SHOWN = 4;

interface NewActivityButtonProps {
    onCreate: (kind: LeadCreateKind) => void;
    /** Kinds the viewer may not create are left out (permissions). */
    allowed?: Partial<Record<LeadCreateKind, boolean>>;
    size?: "base" | "sm";
    extra?: ExtraActivity[];
}

/**
 * One "New activity" button for every kind of record (L7-42). The panel says
 * who it is for and offers the two things an agent schedules, a task or a
 * meeting, each opening the lead page's own form; notes and logged activities
 * are added from their cards. Extra entries such as Email follow.
 */
export function NewActivityButton({ onCreate, allowed, size = "base", extra = [] }: NewActivityButtonProps) {
    const { t } = useTranslation();
    const scope = useNewActivityScope();
    const [open, setOpen] = useState(false);

    const rows: Array<{ key: string; icon: ReactNode; title: string; text: string; onSelect: () => void }> = [];
    if (allowed?.task !== false) {
        rows.push({
            key: "task",
            icon: <Icon name="check-square" size={16} />,
            title: t("pages.agent_workspace.new_activity.task"),
            text: t("pages.agent_workspace.new_activity.task_text"),
            onSelect: () => onCreate("task"),
        });
    }
    if (allowed?.meeting !== false) {
        const names = scope?.meetingTypes ?? [];
        const listed = names.slice(0, TYPES_SHOWN).join(" · ");
        rows.push({
            key: "meeting",
            icon: <Icon name="calendar" size={16} />,
            title: t("pages.agent_workspace.new_activity.meeting"),
            text: listed
                ? names.length > TYPES_SHOWN
                    ? t("pages.agent_workspace.new_activity.meeting_types_more", { types: listed })
                    : listed
                : t("pages.agent_workspace.new_activity.meeting_text"),
            onSelect: () => onCreate("meeting"),
        });
    }
    for (const item of extra) {
        rows.push({ key: item.key, icon: item.icon, title: item.label, text: "", onSelect: item.onSelect });
    }
    if (rows.length === 0) return null;

    const choose = (select: () => void) => {
        setOpen(false);
        select();
    };

    const panel = (
        <div className="agent-na" role="menu" aria-label={t("pages.agent_workspace.contact.new_activity")}>
            <p className="agent-na__eyebrow">
                {[t("pages.agent_workspace.new_activity.eyebrow"), scope?.person, scope?.deal].filter(Boolean).join(" · ")}
            </p>
            {rows.map((row) => (
                <button key={row.key} type="button" role="menuitem" className="agent-na__row" onClick={() => choose(row.onSelect)}>
                    <span className="agent-na__icon" aria-hidden="true">
                        {row.icon}
                    </span>
                    <span className="agent-na__text">
                        <b>{row.title}</b>
                        {row.text ? <small>{row.text}</small> : null}
                    </span>
                    <Icon name="chevron-right" size={14} className="agent-na__chevron" />
                </button>
            ))}
            <p className="agent-na__foot">
                {scope?.deal
                    ? t("pages.agent_workspace.new_activity.foot_deal")
                    : t("pages.agent_workspace.new_activity.foot_person")}
            </p>
        </div>
    );

    return (
        <Dropdown open={open} onOpenChange={setOpen} popupRender={() => panel} trigger={["click"]} placement="bottomRight">
            {/* antd positions the panel from a DOM node; the span gives it one. */}
            <span className="agent-contact__menu-anchor">
                <Button size={size} className="agent-btn-soft" aria-haspopup="menu" aria-expanded={open}>
                    <Icon name="plus" size={size === "sm" ? 12 : 14} />
                    {t("pages.agent_workspace.contact.new_activity")}
                    <Icon name="chevron-down" size={size === "sm" ? 12 : 14} />
                </Button>
            </span>
        </Dropdown>
    );
}
