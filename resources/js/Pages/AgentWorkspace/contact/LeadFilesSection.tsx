import { useMemo, useRef, useState } from "react";
import { AgentCardControls, AgentCardFilters, AgentCardSearch, matchesCardSearch } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { downloadLeadContactFile, toLeadWorkspaceFilePreview } from "@/Pages/Leads/Redesign/adapters/fileAdapter";
import { useLeadWorkspace } from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import useLeadFileUpload from "@/Pages/Leads/Redesign/hooks/useLeadFileUpload";
import SectionCard, { SectionEmpty, SectionNoMatch, SectionSkeleton } from "../deal/sections/SectionCard";
import { badgeFor } from "../deal/sections/FilesSection";

type FileFilter = "all" | "pdf" | "image" | "doc";

/**
 * The person's files on the lead page (canvas L8-05): the same card as the
 * deal's, with search and kind filters, reading the lead's own files.
 */
export default function LeadFilesSection({ canUpload }: { canUpload: boolean }) {
    const { t } = useTranslation();
    const { lead, files, filesLoading } = useLeadWorkspace();
    const { uploadFiles, isUploading } = useLeadFileUpload(lead.id);
    const input = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FileFilter>("all");

    const rows = useMemo(
        () => files.map((file) => ({ preview: toLeadWorkspaceFilePreview(file), badge: badgeFor(file.filename) })),
        [files],
    );
    const tones = new Set(rows.map((row) => row.badge.tone));
    const shown = rows.filter((row) => (filter === "all" || row.badge.tone === filter) && matchesCardSearch(query, row.preview.name, row.preview.file.filename));

    return (
        <SectionCard
            id="lead-files"
            title={
                <>
                    {t("pages.agent_workspace.deal.files.title")}
                    {rows.length > 0 ? <span className="agent-card__count"> · {rows.length}</span> : null}
                </>
            }
            action={
                canUpload ? (
                    <>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            hidden
                            onChange={async (event) => {
                                const selected = Array.from(event.target.files ?? []);
                                event.target.value = "";
                                if (selected.length > 0) await uploadFiles(selected);
                            }}
                        />
                        <Button size="sm" className="agent-btn-soft" loading={isUploading} onClick={() => input.current?.click()}>
                            <Icon name="plus" size={12} />
                            {t("pages.agent_workspace.deal.files.upload")}
                        </Button>
                    </>
                ) : null
            }
            controls={
                rows.length > 0 ? (
                    <AgentCardControls>
                        <AgentCardSearch value={query} onChange={setQuery} placeholder={t("pages.agent_workspace.deal.files.search")} />
                        {tones.size > 1 ? (
                            <AgentCardFilters<FileFilter>
                                value={filter}
                                onChange={setFilter}
                                label={t("pages.agent_workspace.contact.cards.filter_aria")}
                                options={[
                                    { value: "all" as FileFilter, label: t("pages.agent_workspace.contact.cards.all") },
                                    ...(["pdf", "image", "doc"] as const)
                                        .filter((tone) => tones.has(tone))
                                        .map((tone) => ({ value: tone as FileFilter, label: t(`pages.agent_workspace.deal.files.kind_${tone}`) })),
                                ]}
                            />
                        ) : null}
                    </AgentCardControls>
                ) : null
            }
        >
            {filesLoading && files.length === 0 ? (
                <SectionSkeleton />
            ) : rows.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.files.empty")}</SectionEmpty>
            ) : shown.length === 0 ? (
                <SectionNoMatch />
            ) : (
                <ul className="agent-deal__rows">
                    {shown.map(({ preview, badge }) => (
                        <li key={preview.id}>
                            <button type="button" className="agent-deal__row agent-deal__row--file" onClick={() => downloadLeadContactFile(preview.file)}>
                                <span className={`agent-deal__badge agent-deal__badge--${badge.tone}`} aria-hidden="true">
                                    {badge.label}
                                </span>
                                <span className="agent-deal__row-body">
                                    <span className="agent-deal__row-title">{preview.name}</span>
                                    <span className="agent-deal__row-sub">{[preview.sizeLabel, preview.uploadedLabel].join(" · ")}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
