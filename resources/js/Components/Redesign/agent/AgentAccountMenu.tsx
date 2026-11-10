import { useEffect, useId, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import Avatar from "../primitives/Avatar";
import { initialsFromName } from "../adapters/initials";
import { CLASSIC_HOME_URL } from "./destinations";

interface AgentAccountMenuProps {
    name: string;
    image?: string | null;
}

/** Avatar button with the account menu: Preferences, Classic view, Log out. */
export default function AgentAccountMenu({ name, image }: AgentAccountMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const item = (label: string, onSelect: () => void, danger = false) => (
        <li role="none">
            <button
                type="button"
                role="menuitem"
                className={`agent-menu__item${danger ? " agent-menu__item--danger" : ""}`}
                onClick={() => {
                    setOpen(false);
                    onSelect();
                }}
            >
                {label}
            </button>
        </li>
    );

    return (
        <div ref={rootRef} className="agent-menu">
            <button
                type="button"
                className="agent-menu__trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={t("pages.agent_workspace.account")}
                onClick={() => setOpen((value) => !value)}
            >
                <Avatar initials={initialsFromName(name)} src={image ?? undefined} size={38} />
            </button>
            {open ? (
                <ul id={menuId} role="menu" className="agent-menu__list">
                    <li role="none" className="agent-menu__name">
                        {name}
                    </li>
                    {item(t("pages.agent_workspace.preferences"), () => router.visit("/account/settings/preferences"))}
                    {item(t("pages.agent_workspace.open_classic"), () => router.visit(CLASSIC_HOME_URL))}
                    {item(t("pages.agent_workspace.logout"), () => router.post("/logout"), true)}
                </ul>
            ) : null}
        </div>
    );
}
