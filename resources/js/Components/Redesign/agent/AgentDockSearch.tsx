import { useEffect, useRef, useState, type FormEvent } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";

/**
 * The dock's search field. Until the agent search screen ships it searches
 * people: Enter opens the classic lead list filtered by the text (the list's
 * own ?search= filter). "/" focuses it from anywhere outside a text field.
 */
export default function AgentDockSearch() {
    const { t } = useTranslation();
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
            event.preventDefault();
            inputRef.current?.focus();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const query = value.trim();
        if (!query) return;
        window.location.assign(route("lead-contact.index", { search: query }));
    };

    return (
        <form role="search" className="agent-dock__search" onSubmit={submit}>
            <Icon name="search" size={14} />
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={t("pages.agent_workspace.search")}
                aria-label={t("pages.agent_workspace.search_people")}
                className="agent-dock__search-input"
            />
            <kbd className="agent-dock__kbd" aria-hidden="true">
                /
            </kbd>
        </form>
    );
}
