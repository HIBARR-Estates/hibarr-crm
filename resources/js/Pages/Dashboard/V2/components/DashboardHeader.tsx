import { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { greetingFor } from "../format";

interface DashboardHeaderProps {
    /** Greeted by name — the same person whichever view they're looking at. */
    userName: string;
    /** Server clock, so the greeting doesn't flip on a stale browser. */
    now: string;
    /**
     * The line under the greeting: what this particular view is showing.
     * A node rather than a string because the personal dashboard's is derived
     * from live counts, not written copy.
     */
    subtext?: ReactNode;
    /** The switcher, and whatever controls this view owns. Right-aligned. */
    actions?: ReactNode;
}

/**
 * The one header every v2 dashboard wears.
 *
 * Greeting, the view's own subtext under it, switcher and controls on the
 * right — then the view's content below. Shared rather than per-view because
 * switching between My work, Team and Downline should move the content under
 * the header, not rebuild the page around it: a switcher that jumps position
 * between the views it switches between is the thing worth avoiding here.
 *
 * The greeting is the page's h1 on every view. It carries no data of its own,
 * so it never waits on a deferred prop — the subtext degrades a clause at a
 * time underneath it instead.
 */
export default function DashboardHeader({
    userName,
    now,
    subtext,
    actions,
}: DashboardHeaderProps) {
    const { td } = useTd();

    return (
        <header
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 18,
                flexWrap: "wrap",
                marginBottom: 16,
            }}
        >
            <div style={{ minWidth: 0 }}>
                <h1
                    style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.3,
                        fontWeight: 700,
                        color: T.NAVY,
                    }}
                >
                    {td(greetingFor(now))}, {userName}.
                </h1>

                {subtext}
            </div>

            <div
                style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                {actions}
            </div>
        </header>
    );
}

/**
 * The plain one-sentence variant of the subtext, for views whose summary is
 * written copy rather than derived counts.
 *
 * English source string in, translated here — the role views keep their
 * descriptions in a config object that can't call hooks.
 */
export function HeaderSubtext({ children }: { children: string }) {
    const { td } = useTd();

    return (
        <p
            style={{
                margin: "4px 0 0",
                fontSize: 14,
                lineHeight: 1.5,
                color: T.TEXT,
            }}
        >
            {td(children)}
        </p>
    );
}
