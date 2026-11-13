import { Link } from "@inertiajs/react";
import { AgentCallButton } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import Highlight from "@/Components/Redesign/agent/search/Highlight";
import SearchHitIcon from "@/Components/Redesign/agent/search/SearchHitIcon";
import type { Hit } from "@/Components/Redesign/agent/search/hits";
import useTranslation from "@/Hooks/useTranslation";
import type { ExposeTarget } from "../portfolio/PortfolioExposeModal";
import type { DoneTasks } from "./useDoneTasks";

interface SearchResultRowProps {
    hit: Hit;
    query: string;
    done: DoneTasks;
    onExpose: (target: ExposeTarget) => void;
}

/** One result, to the boards' L7-24 row: icon, name with the match marked, the grey line, and the one or two actions that fit it. */
export default function SearchResultRow({ hit, query, done, onExpose }: SearchResultRowProps) {
    const { t } = useTranslation();
    const action = (key: string) => t(`pages.agent_workspace.search_results.actions.${key}`);
    const open = (label: string) => (
        <Link href={hit.href} className="dr-btn dr-btn-ghost" prefetch={["hover"]} cacheFor="30s">
            {label}
        </Link>
    );

    let actions;
    if (hit.kind === "person") {
        actions = (
            <>
                {hit.person.phone ? <AgentCallButton phone={hit.person.phone} entity={{ type: "lead", id: hit.person.id }} /> : null}
                {open(action("open"))}
            </>
        );
    } else if (hit.kind === "deal") {
        actions = open(hit.deal.read_only ? action("view") : action("open"));
    } else if (hit.kind === "property") {
        actions = (
            <Button variant="ghost" onClick={() => onExpose({ kind: "property", id: hit.property.id, title: hit.title })}>
                {action("expose")}
            </Button>
        );
    } else if (hit.kind === "task") {
        actions = done.doneIds.has(hit.task.id) ? (
            <span className="agent-task-done">
                <Icon name="check" size={14} />
                {action("done")}
            </span>
        ) : (
            <Button variant="ghost" icon={<Icon name="check" size={14} />} disabled={done.isPending(hit.task.id)} onClick={() => done.complete(hit.task.id)} aria-label={`${action("done")}: ${hit.title}`}>
                {action("done")}
            </Button>
        );
    } else {
        actions = open(action("open"));
    }

    return (
        <li className="agent-sp__row">
            <Link href={hit.href} className="agent-sp__main" prefetch={["hover"]} cacheFor="30s">
                <SearchHitIcon hit={hit} />
                <span className="agent-sr__text">
                    <span className="agent-sr__title">
                        <Highlight text={hit.title} query={query} />
                    </span>
                    <span className="agent-sr__meta">{hit.meta}</span>
                </span>
            </Link>
            <div className="agent-sp__actions">{actions}</div>
        </li>
    );
}
