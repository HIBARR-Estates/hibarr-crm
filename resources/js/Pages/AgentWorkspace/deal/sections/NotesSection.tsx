import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import useWorkspaceOverview from "@/Pages/Deals/Redesign/hooks/useWorkspaceOverview";
import type { Note } from "@/Types/api/note";
import SectionCard, { SectionEmpty, SectionSkeleton } from "./SectionCard";

interface NotesSectionProps {
    notes: Note[];
    loading: boolean;
    canCreate: boolean;
    onAdd: () => void;
    onOpen: (id: number) => void;
}

/** Every note on the deal: title, who wrote it and when, then the start of the text. */
export default function NotesSection({ notes, loading, canCreate, onAdd, onOpen }: NotesSectionProps) {
    const { t } = useTranslation();
    const overview = useWorkspaceOverview({ notes });

    return (
        <SectionCard
            id="deal-notes"
            title={
                <>
                    {t("pages.agent_workspace.deal.notes.title")}
                    {notes.length > 0 ? <span className="agent-card__count"> · {notes.length}</span> : null}
                </>
            }
            action={
                canCreate ? (
                    <Button size="sm" className="agent-btn-soft" onClick={onAdd}>
                        <Icon name="plus" size={12} />
                        {t("pages.agent_workspace.deal.notes.add")}
                    </Button>
                ) : null
            }
        >
            {loading && notes.length === 0 ? (
                <SectionSkeleton />
            ) : overview.notes.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.notes.empty")}</SectionEmpty>
            ) : (
                <ul className="agent-deal__rows">
                    {overview.notes.map((note) => (
                        <li key={note.id}>
                            <button type="button" className="agent-deal__row agent-deal__row--note" onClick={() => onOpen(note.id)}>
                                <span className="agent-deal__row-top">
                                    <span className="agent-deal__row-title">{note.title || note.preview}</span>
                                    <span className="agent-deal__row-meta">
                                        {[note.authorName, note.createdAtLabel]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                </span>
                                {note.title && note.preview ? <span className="agent-deal__row-sub">{note.preview}</span> : null}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
