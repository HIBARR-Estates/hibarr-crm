import { Dropdown, type MenuProps } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";

/**
 * The ⋯ menu beside Edit details. The agent page covers the deal's records
 * and fields; the deal page's remaining tabs (offers, recommendations,
 * Sally insights) stay one click away in the classic deal page.
 */
export default function DealMoreMenu({ dealId }: { dealId: number }) {
    const { t } = useTranslation();
    const items: MenuProps["items"] = [
        { key: "classic", icon: <Icon name="external-link" size={14} />, label: t("pages.agent_workspace.deal.more.classic") },
    ];

    return (
        <Dropdown
            menu={{
                items,
                onClick: ({ key }) => {
                    if (key === "classic") window.open(route("deals.show", dealId), "_blank", "noopener");
                },
            }}
            trigger={["click"]}
            placement="bottomRight"
        >
            <span className="agent-contact__menu-anchor">
                <Button className="agent-contact__more" aria-haspopup="menu" aria-label={t("pages.agent_workspace.deal.more.aria")}>
                    <Icon name="more" size={16} />
                </Button>
            </span>
        </Dropdown>
    );
}
