import useTranslation from "@/Hooks/useTranslation";

interface AgentNewTagProps {
    /** Why this is held: what the CRM lacks. Shown as the tooltip and read out by screen readers. */
    hint: string;
}

/**
 * The dashed purple "New" tag. A part of an approved screen that has no CRM
 * data behind it yet is kept in its place, held (not clickable), and marked
 * with this so it is clear it still needs building and review.
 */
export default function AgentNewTag({ hint }: AgentNewTagProps) {
    const { t } = useTranslation();

    return (
        <span className="agent-new-tag" title={hint}>
            {t("pages.agent_workspace.new_tag")}
            <span className="agent-new-tag__hint">{hint}</span>
        </span>
    );
}
