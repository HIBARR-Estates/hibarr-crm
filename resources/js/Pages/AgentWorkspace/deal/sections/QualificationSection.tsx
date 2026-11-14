import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import useLeadQualificationLoader from "@/Pages/Leads/Components/Qualification/useLeadQualificationLoader";
import { formatAnswerDisplay, sortSegments, stripHtmlTags } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { COMPLETED_OUTCOME_LABELS, type QualificationOutcome } from "@/Types/qualification";
import SectionCard, { SectionEmpty, SectionSkeleton } from "./SectionCard";

/**
 * The person's qualification, read only: each question the agent asked and
 * the answer given, then how the call ended. It is the same record the lead
 * page's qualification fills in; nothing on a deal changes it.
 */
export default function QualificationSection({ leadId, enabled }: { leadId: number; enabled: boolean }) {
    const { t } = useTranslation();
    const { formatDate } = useUserDateTime();
    const loader = useLeadQualificationLoader(leadId, { enabled });
    const current = loader.current;
    const segments = loader.templateTree?.segments;

    const rows = useMemo(() => {
        if (!current || !segments) return [];
        const bySegment = new Map(segments.map((segment) => [segment.key, segment]));
        return sortSegments(segments)
            .map((segment) => {
                const answer = (current.answers ?? []).find((item) => item.segment_key === segment.key);
                return { segment, display: answer ? formatAnswerDisplay(bySegment.get(segment.key), answer) : "" };
            })
            .filter((row) => row.segment.type === "question" && row.display !== "")
            .map((row) => ({ key: row.segment.key, label: stripHtmlTags(row.segment.label), value: row.display }));
    }, [current, segments]);

    const outcomes = (current?.outcomes?.length ? current.outcomes : current?.outcome ? [current.outcome] : []) as QualificationOutcome[];
    const loading = loader.phase === "loading" || (loader.treeLoading && rows.length === 0);

    return (
        <SectionCard id="deal-qualification" title={t("pages.agent_workspace.deal.qualification.title")}>
            {loading ? (
                <SectionSkeleton />
            ) : !current || (rows.length === 0 && outcomes.length === 0) ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.qualification.empty")}</SectionEmpty>
            ) : (
                <dl className="agent-deal__facts">
                    {rows.map((row) => (
                        <div key={row.key} className="agent-deal__fact">
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                        </div>
                    ))}
                    {outcomes.length > 0 ? (
                        <div className="agent-deal__fact">
                            <dt>{t("pages.agent_workspace.deal.qualification.outcome")}</dt>
                            <dd>
                                {[
                                    outcomes.map((key) => COMPLETED_OUTCOME_LABELS[key] ?? key).join(", "),
                                    current.completed_at ? formatDate(current.completed_at) : "",
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </dd>
                        </div>
                    ) : null}
                </dl>
            )}
        </SectionCard>
    );
}
