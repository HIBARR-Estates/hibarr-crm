import { Dropdown, type MenuProps } from "antd";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { ActivityKind } from "../today/AddActivityMenu";
import type { Lead } from "./types";

type NextAction = NonNullable<Lead["next_action"]>;

interface NextActionCellProps {
    lead: Lead;
    action: NextAction | null;
    /** The action's own task or meeting, to preview and work on without leaving the list. */
    onOpen: (lead: Lead, action: NextAction) => void;
    /** Puts a first step on a person who has none. */
    onAdd: (lead: Lead, kind: ActivityKind) => void;
}

/**
 * The Next action cell. With a step it is a button that opens that task or
 * meeting; without one it is an "Add next step" menu (task or meeting). Both
 * sit above the row's own link so pressing them never opens the person.
 */
export default function NextActionCell({ lead, action, onOpen, onAdd }: NextActionCellProps) {
    const { t } = useTranslation();
    const key = "pages.agent_workspace.people.row";

    if (action) {
        return (
            <button
                type="button"
                className="agent-pp__action agent-pp__action--btn"
                title={t(`${key}.preview_action`)}
                onClick={() => onOpen(lead, action)}
            >
                <Icon name={action.type === "meeting" ? "video" : "check-square"} size={13} />
                <span>{action.title}</span>
            </button>
        );
    }

    const items: MenuProps["items"] = [
        { key: "task", icon: <Icon name="check-square" size={14} />, label: t("pages.agent_workspace.today.add.task"), onClick: () => onAdd(lead, "task") },
        { key: "meeting", icon: <Icon name="video" size={14} />, label: t("pages.agent_workspace.today.add.meeting"), onClick: () => onAdd(lead, "meeting") },
    ];

    return (
        <Dropdown menu={{ items }} trigger={["click"]} placement="bottomLeft">
            <button type="button" className="agent-pp__action agent-pp__action--add" aria-haspopup="menu">
                <Icon name="plus" size={13} />
                <span>{t(`${key}.add_next_step`)}</span>
            </button>
        </Dropdown>
    );
}
