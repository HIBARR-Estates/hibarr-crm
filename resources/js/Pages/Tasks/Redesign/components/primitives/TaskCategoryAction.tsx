import { Button, Dropdown, type MenuProps } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import useClickToCall from "@/Hooks/useClickToCall";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Task } from "@/Types/Task";

interface TaskCategoryActionProps {
    task: Task;
    /**
     * "icon" — compact icon-only trigger for list rows; "button" — labelled
     * trigger for the detail header.
     */
    variant?: "icon" | "button";
}

/**
 * Quick-action button shown on a task whose category has a configured action.
 *
 * Only the "call" action is wired for now (Call / Begin qualification); the
 * "email" action is stored on the category but renders nothing yet. Targets
 * the task's first linked lead — call needs a phone, qualification is
 * lead-only — and renders nothing when there is no lead to act on.
 */
export default function TaskCategoryAction({
    task,
    variant = "icon",
}: TaskCategoryActionProps) {
    const { td } = useTd();
    const { isEnabled, initiateCall, isCalling } = useClickToCall();

    if (task.category?.action !== "call") return null;

    const lead = task.leads?.[0];
    if (!lead) return null;

    const phone = lead.mobile?.trim() ?? "";
    const entity = { type: "lead" as const, id: lead.id };
    const calling = Boolean(phone) && isCalling(phone, entity);

    const items: MenuProps["items"] = [];

    if (isEnabled && phone) {
        items.push({
            key: "call",
            icon: <PhoneOutlined />,
            label: td("Call", { source: "en" }),
            onClick: () => void initiateCall(phone, entity),
        });
    }

    items.push({
        key: "qualify",
        label: td("Begin qualification", { source: "en" }),
        onClick: () =>
            router.visit(`${route("lead-contact.show", lead.id)}?tab=qualification`),
    });

    if (items.length === 0) return null;

    const triggerLabel = td("Call", { source: "en" });

    return (
        <span onClick={(event) => event.stopPropagation()}>
            <Dropdown
                menu={{ items }}
                trigger={["click"]}
                placement="bottomRight"
            >
                {variant === "button" ? (
                    <Button
                        size="small"
                        icon={<PhoneOutlined />}
                        loading={calling}
                    >
                        {triggerLabel}
                    </Button>
                ) : (
                    <Button
                        type="text"
                        size="small"
                        icon={<PhoneOutlined />}
                        aria-label={triggerLabel}
                        loading={calling}
                    />
                )}
            </Dropdown>
        </span>
    );
}
