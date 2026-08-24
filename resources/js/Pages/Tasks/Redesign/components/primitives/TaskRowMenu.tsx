import type { ReactNode } from "react";
import { Button, Dropdown, type MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface TaskRowAction {
    key: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    onSelect: () => void;
}

/**
 * The row-end "…" menu. Uses antd's `Dropdown`, matching every other row
 * actions menu in the app (Deals/Leads/Properties/Agents and the legacy
 * Tasks table all render `<Dropdown menu={{ items }}><Button type="text"
 * icon={<MoreOutlined />} /></Dropdown>`) instead of a bespoke popover.
 */
export default function TaskRowMenu({
    actions,
    ariaLabel,
}: {
    actions: TaskRowAction[];
    ariaLabel: string;
}) {
    const { td } = useTd();

    if (actions.length === 0) return null;

    const items: MenuProps["items"] = [];
    actions.forEach((action, index) => {
        // A divider ahead of the first danger item, same as the delete
        // entries in the other tables' row menus.
        if (action.danger && !actions[index - 1]?.danger) {
            items.push({ type: "divider", key: `${action.key}-divider` });
        }
        items.push({
            key: action.key,
            label: td(action.label),
            icon: action.icon,
            danger: action.danger,
            onClick: action.onSelect,
        });
    });

    return (
        <span onClick={(event) => event.stopPropagation()}>
            <Dropdown
                menu={{ items }}
                trigger={["click"]}
                placement="bottomRight"
            >
                <Button
                    type="text"
                    icon={<MoreOutlined />}
                    aria-label={ariaLabel}
                />
            </Dropdown>
        </span>
    );
}
