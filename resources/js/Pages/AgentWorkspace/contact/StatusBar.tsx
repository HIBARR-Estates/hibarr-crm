import type { ReactNode } from "react";
import { Dropdown, type MenuProps } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";

interface StatusBarProps {
    /** Small caps label over the path ("Lead status", "Deal stage · pipeline · deal"). */
    label: string;
    /** Muted note at the right of the label ("since 4 Nov · set by the qualification"). */
    note?: string;
    /** The path itself: the lead's status steps or the deal's stage ramp. */
    children: ReactNode;
    /** The menu button's label ("Status", "Stage"); no menu when items is empty. */
    menuLabel: string;
    menuItems?: MenuProps["items"];
    onMenuSelect?: (key: string) => void;
    busy?: boolean;
}

/**
 * The status or stage bar right under the person (canvas L8-01, L8-03): the
 * path on the left and one small menu on the right that changes it. Nothing
 * under it: mark lost and the other off-path statuses live in the menu.
 */
export default function StatusBar({ label, note, children, menuLabel, menuItems, onMenuSelect, busy = false }: StatusBarProps) {
    return (
        <section className="agent-contact__section agent-statusbar" aria-label={label}>
            <div className="agent-statusbar__main">
                <div className="agent-statusbar__head">
                    <h2 className="agent-contact__label">{label}</h2>
                    {note ? <span className="agent-statusbar__note">{note}</span> : null}
                </div>
                {children}
            </div>
            {menuItems && menuItems.length > 0 ? (
                <Dropdown
                    menu={{ items: menuItems, onClick: ({ key }) => onMenuSelect?.(key), className: "agent-statusbar__menu" }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <span className="agent-contact__menu-anchor agent-statusbar__anchor">
                        <Button size="sm" aria-haspopup="menu" loading={busy}>
                            {menuLabel}
                            <Icon name="chevron-down" size={13} />
                        </Button>
                    </span>
                </Dropdown>
            ) : null}
        </section>
    );
}

/** One row of the status menu: a check for the current one, a name and an optional reason under it. */
export function StatusMenuLabel({ name, sub, current = false }: { name: string; sub?: string; current?: boolean }) {
    return (
        <span className="agent-statusbar__item">
            <span className="agent-statusbar__check" aria-hidden="true">
                {current ? <Icon name="check" size={14} /> : null}
            </span>
            <span className="agent-statusbar__item-text">
                <span className="agent-statusbar__item-name">{name}</span>
                {sub ? <span className="agent-statusbar__item-sub">{sub}</span> : null}
            </span>
        </span>
    );
}
