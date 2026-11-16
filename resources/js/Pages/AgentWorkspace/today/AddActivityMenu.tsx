import { Dropdown, type MenuProps } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";

export type ActivityKind = "task" | "meeting";

interface AddActivityMenuProps {
    onAdd: (kind: ActivityKind) => void;
    /** "band" sits on the navy band; "panel" sits in a white panel's header. */
    tone?: "band" | "panel";
}

/**
 * "Add" with the two things the agenda holds: a task or a meeting. Each opens
 * the form the rest of the CRM already uses (the personal dashboard's task
 * form and the Meetings page's schedule dialog); nothing new is built here.
 */
export default function AddActivityMenu({ onAdd, tone = "panel" }: AddActivityMenuProps) {
    const { t } = useTranslation();
    const key = "pages.agent_workspace.today.add";
    const items: MenuProps["items"] = [
        { key: "task", icon: <Icon name="check-square" size={14} />, label: t(`${key}.task`), onClick: () => onAdd("task") },
        { key: "meeting", icon: <Icon name="video" size={14} />, label: t(`${key}.meeting`), onClick: () => onAdd("meeting") },
    ];

    return (
        <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
            {tone === "band" ? (
                <button type="button" className="agent-band-btn" aria-haspopup="menu">
                    <Icon name="plus" size={14} />
                    {t(`${key}.label`)}
                </button>
            ) : (
                <Button size="sm" className="agent-btn-soft" icon={<Icon name="plus" size={13} />} aria-haspopup="menu">
                    {t(`${key}.label`)}
                </Button>
            )}
        </Dropdown>
    );
}
