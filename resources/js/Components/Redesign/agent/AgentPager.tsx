import Button from "@/Components/Redesign/primitives/Button";
import useTranslation from "@/Hooks/useTranslation";

interface AgentPagerProps {
    page: number;
    lastPage: number;
    from: number;
    to: number;
    total: number;
    onPage: (page: number) => void;
    busy?: boolean;
    /** Names the list for assistive tech ("Properties pages"). */
    label: string;
}

/**
 * The pager under a paged list in the agent workspace: the range on the left,
 * Previous and Next on the right. Hidden when everything fits on one page.
 * Same strip and buttons as the People list.
 */
export default function AgentPager({ page, lastPage, from, to, total, onPage, busy = false, label }: AgentPagerProps) {
    const { t } = useTranslation();

    if (lastPage <= 1) return null;

    return (
        <nav className="agent-pager" aria-label={label}>
            <span aria-live="polite">{t("pages.agent_workspace.pager.range", { from, to, total })}</span>
            <span className="agent-pager__buttons">
                <Button size="sm" variant="ghost" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
                    {t("pages.agent_workspace.pager.previous")}
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= lastPage || busy} onClick={() => onPage(page + 1)}>
                    {t("pages.agent_workspace.pager.next")}
                </Button>
            </span>
        </nav>
    );
}
