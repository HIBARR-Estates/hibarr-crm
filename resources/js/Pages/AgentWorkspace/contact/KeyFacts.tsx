import { useEffect, useId, useRef, useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useSoftphone from "@/Hooks/useSoftphone";
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
 * come up the page. During a call they fold to one line, so the call card
 * and the activity keep the room; "Show all" opens the cards again.
 */
export default function KeyFacts({ groups, title }: { groups: KeyFactGroup[]; /** Replaces "Key facts" (the deal-only view reads "Deal facts"). */ title?: string }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [open, setOpen] = useState(initialOpen);
    const [showAllOnCall, setShowAllOnCall] = useState(false);
    const bodyId = useId();
    const sectionRef = useRef<HTMLElement | null>(null);
    /** Set when the agent swaps strip and cards, so the control that replaces the pressed one takes focus. */
    const refocusRef = useRef(false);
    const { isEnabled, state } = useSoftphone();
    const onCall = Boolean(isEnabled && state.call && (state.call.phase === "active" || state.call.phase === "outbound"));

    // "Show all" holds for this call only; the next call starts folded again.
    const [wasOnCall, setWasOnCall] = useState(onCall);
    if (wasOnCall !== onCall) {
        setWasOnCall(onCall);
        if (!onCall) setShowAllOnCall(false);
    }

    useEffect(() => {
        if (!refocusRef.current) return;
        refocusRef.current = false;
        sectionRef.current?.querySelector<HTMLButtonElement>("button[data-facts-toggle]")?.focus();
    }, [showAllOnCall]);

    const setShowAll = (next: boolean) => {
        refocusRef.current = true;
        setShowAllOnCall(next);
    };

    if (onCall && !showAllOnCall) {
        return (
            <section ref={sectionRef} className="agent-contact__section agent-facts agent-facts--strip" aria-labelledby="agent-facts-title">
                <h2 id="agent-facts-title" className="agent-contact__label">
                    {title ?? t("pages.agent_workspace.contact.facts.title")}
                </h2>
                <ul className="agent-facts__strip">
                    {groups.map((group) => {
                        const empty = group.empty ?? !group.lead;
                        const label = group.label ? td(group.label, { source: "en" }) : t(`pages.agent_workspace.contact.facts.${group.id}`);
                        const value = empty ? group.lead || t("pages.agent_workspace.contact.facts.empty") : group.lead;
                        return (
                            <li key={group.id} className={`agent-facts__chip${empty ? " agent-facts__chip--empty" : ""}`} title={`${label}: ${value}`}>
                                <span>{label}</span> <b>{value}</b>
                            </li>
                        );
                    })}
                </ul>
                <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} aria-expanded={false} data-facts-toggle="">
                    <Icon name="chevron-down" size={12} />
                    {t("pages.agent_workspace.contact.facts.show_all")}
                </Button>
            </section>
        );
    }

    const toggle = () => {
        if (onCall) {
            // On a call, collapsing goes back to the one-line strip.
            setShowAll(false);
            return;
        }
        const next = !open;
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
            // Not remembered; the toggle still works.
        }
        setOpen(next);
    };

    return (
        <section ref={sectionRef} className="agent-contact__section agent-facts" aria-labelledby="agent-facts-title">
            <div className="agent-facts__head">
                <h2 id="agent-facts-title" className="agent-contact__label">
                    {title ?? t("pages.agent_workspace.contact.facts.title")}
                </h2>
                <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open || onCall} aria-controls={bodyId} data-facts-toggle="">
                    <Icon name={open || onCall ? "chevron-up" : "chevron-down"} size={12} />
                    {open || onCall ? t("pages.agent_workspace.contact.facts.collapse") : t("pages.agent_workspace.contact.facts.expand")}
                </Button>
            </div>
            {open || onCall ? (
                <ul id={bodyId} className="agent-facts__grid">
                    {groups.map((group) => {
                        const empty = group.empty ?? !group.lead;
                        return (
                            <li key={group.id} className={`agent-fact agent-fact--${group.id}${empty ? " agent-fact--empty" : ""}`}>
                                <span className="agent-fact__label">
                                    {group.label ? td(group.label, { source: "en" }) : t(`pages.agent_workspace.contact.facts.${group.id}`)}
                                </span>
                                <span className="agent-fact__lead" title={group.id === "reach" && !empty ? group.lead : undefined}>
                                    {empty ? group.lead || t("pages.agent_workspace.contact.facts.empty") : group.lead}
                                </span>
                                {group.lines.map((line) => (
                                    <span key={line} className="agent-fact__line" title={group.id === "reach" ? line : undefined}>
                                        {line}
                                    </span>
                                ))}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </section>
    );
}
