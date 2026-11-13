import { Deferred } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import EarningsHeader from "../EarningsHeader";
import { monthName } from "../format";
import AiSummaryCard from "./AiSummaryCard";
import KpiCards from "./KpiCards";
import ReportLists from "./ReportLists";
import type { ReportKpi, ReportRange, ReportWindows } from "./types";
import { REPORT_RANGES } from "./types";
import useReportKpi from "./useReportKpi";
import useReportSummary from "./useReportSummary";

interface ReportViewProps {
    range: ReportRange;
    windows: ReportWindows;
    agentId: number | null;
    agentName: string;
    currencySymbol: string;
    kpi?: ReportKpi | null;
}

/** "November so far", "this week so far", "Q4 so far": what the summary is about. */
function useBlurb(range: ReportRange, startDate: string) {
    const { t, locale } = useTranslation();
    const day = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
    switch (range) {
        case "month":
            return t("pages.agent_workspace.earnings.report.ai.period.month", { month: monthName(startDate, locale) });
        case "last_month":
            return monthName(startDate, locale);
        case "quarter":
            return t("pages.agent_workspace.earnings.report.ai.period.quarter", { quarter: Math.floor(day.getUTCMonth() / 3) + 1 });
        case "year":
            return t("pages.agent_workspace.earnings.report.ai.period.year", { year: day.getUTCFullYear() });
        default:
            return t("pages.agent_workspace.earnings.report.ai.period.week");
    }
}

/**
 * Earnings › My report (approved layout L7-38): the agent's own counts for a
 * period against the one before, an AI summary of their notes, and the lists
 * behind the counts. It is the classic Agent Reports screen, for the agent's
 * own records only: same counts, same summary service, same lists.
 */
export default function ReportView({ range: initialRange, windows, agentId, agentName, currencySymbol, kpi: initialKpi }: ReportViewProps) {
    const { t } = useTranslation();
    const { range, setRange, kpi, failed, retry } = useReportKpi(initialRange, initialKpi);
    const summary = useReportSummary({ agentId, agentName });
    const window = windows[range];
    const blurb = useBlurb(range, window.start);

    return (
        <>
            <EarningsHeader title={t("pages.agent_workspace.earnings.report.title")} subtitle={t("pages.agent_workspace.earnings.report.subtitle")}>
                <div className="agent-ea__switch" role="group" aria-label={t("pages.agent_workspace.earnings.report.period")}>
                    {REPORT_RANGES.map((key) => (
                        <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>
                            {t(`pages.agent_workspace.earnings.report.ranges.${key}`)}
                        </button>
                    ))}
                </div>
            </EarningsHeader>

            <Deferred data="kpi" fallback={<KpiCards range={range} kpi={null} failed={false} onRetry={retry} />}>
                <KpiCards range={range} kpi={kpi} failed={failed} onRetry={retry} />
            </Deferred>

            <AiSummaryCard
                range={range}
                periodName={blurb}
                summary={summary.summaries[range]}
                loading={summary.loading === range}
                error={summary.error?.range === range ? summary.error.kind : null}
                save={summary.saves[range] ?? "idle"}
                onGenerate={(refresh) => summary.generate(window, refresh)}
                onSave={() => summary.saveAsNote(window)}
            />

            <ReportLists window={window} agentId={agentId} currencySymbol={currencySymbol} />
        </>
    );
}
