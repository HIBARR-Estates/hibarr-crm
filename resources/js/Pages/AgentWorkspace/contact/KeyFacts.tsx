import { useId, useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { KeyFactGroup } from "./model";

const STORAGE_KEY = "agent-contact.key-facts-open";

/** Open on wider screens, closed on a phone; a choice the viewer makes sticks. */
function initialOpen(): boolean {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "1") return true;
        if (stored === "0") return false;
    } catch {
        // Storage blocked: fall back to the screen size.
    }
    return typeof window === "undefined" || !window.matchMedia?.("(max-width: 639px)").matches;
}

/**
 * Key facts in small filled cards: how to reach them, who they are, where,
 * the lead's value and where they came from. A card with nothing recorded is
 * shown in amber as needing input. Collapsible, so the activity below can
 * come up the page.
 */
export default function KeyFacts({ groups }: { groups: KeyFactGroup[] }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(initialOpen);
    const bodyId = useId();

    const toggle = () => {
        setOpen((value) => {
            try {
                window.localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
            } catch {
                // Not remembered; the toggle still works.
            }
            return !value;
        });
    };

    return (
        <section className="agent-contact__section agent-facts" aria-labelledby="agent-facts-title">
            <div className="agent-facts__head">
                <h2 id="agent-facts-title" className="agent-contact__label">
                    {t("pages.agent_workspace.contact.facts.title")}
                </h2>
                <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open} aria-controls={bodyId}>
                    <Icon name={open ? "chevron-up" : "chevron-down"} size={12} />
                    {open ? t("pages.agent_workspace.contact.facts.collapse") : t("pages.agent_workspace.contact.facts.expand")}
                </Button>
            </div>
            {open ? (
                <ul id={bodyId} className="agent-facts__grid">
                    {groups.map((group) => {
                        const empty = !group.lead;
                        return (
                            <li key={group.id} className={`agent-fact${empty ? " agent-fact--empty" : ""}`}>
                                <span className="agent-fact__label">{t(`pages.agent_workspace.contact.facts.${group.id}`)}</span>
                                {empty ? (
                                    <span className="agent-fact__lead">{t("pages.agent_workspace.contact.facts.empty")}</span>
                                ) : (
                                    <>
                                        <span className="agent-fact__lead">{group.lead}</span>
                                        {group.lines.map((line) => (
                                            <span key={line} className="agent-fact__line">
                                                {line}
                                            </span>
                                        ))}
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </section>
    );
}
