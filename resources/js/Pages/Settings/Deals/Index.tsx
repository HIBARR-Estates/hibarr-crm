import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AnalysisScriptTab from "./AnalysisScriptTab";
import PipelinesTab from "./PipelinesTab";
import useDealSettingsNavigation, {
    type DealSettingsTab,
} from "./hooks/useDealSettingsNavigation";
import type { DealPipelineRow } from "./types";

const NO_PIPELINES: DealPipelineRow[] = [];

export default function DealSettingsIndex({ pageTitle }: { pageTitle: string }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { tab, setTab } = useDealSettingsNavigation();

    const pipelinesQuery = useApiQuery<{ pipelines: DealPipelineRow[] }>({
        path: route("pipeline.analysis-script.pipelines"),
    });
    const pipelines = pipelinesQuery.data?.pipelines ?? NO_PIPELINES;

    const tabs: Array<{
        key: DealSettingsTab;
        label: string;
        count?: number;
    }> = [
        {
            key: "pipelines",
            label: t("modules.deal.pipelineManagementTab"),
            count: pipelines.length,
        },
        {
            key: "analysis",
            label: t("modules.deal.analysisScriptTab"),
        },
    ];

    return (
        <PageLayout
            breadcrumbs={[
                {
                    name: t("app.menu.settings"),
                    url: route("settings-overview.index"),
                },
                { name: pageTitle },
            ]}
        >
            <div
                className={`mx-auto flex w-full flex-col ${
                    tab === "analysis" ? "max-w-6xl" : "max-w-4xl"
                }`}
                style={{
                    padding: "8px 0 32px",
                    fontFamily: REDESIGN_FONT_STACK,
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                            marginBottom: 6,
                        }}
                    >
                        {td("Settings", { source: "en" })}
                    </div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: REDESIGN_TYPE.DISPLAY,
                            fontWeight: 700,
                            color: T.NAVY,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {t("modules.deal.dealSettings")}
                    </h1>
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                            maxWidth: 560,
                        }}
                    >
                        {t("modules.deal.dealSettingsIntro")}
                    </p>
                </div>

                <div
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 10,
                        overflow: "hidden",
                    }}
                >
                    <div
                        role="tablist"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "0 24px",
                            padding: "0 22px",
                            borderBottom: `1px solid ${T.BORDER}`,
                        }}
                    >
                        {tabs.map((item) => {
                            const active = tab === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setTab(item.key)}
                                    style={{
                                        position: "relative",
                                        background: "none",
                                        border: "none",
                                        padding: "14px 0 12px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        fontWeight: active ? 600 : 500,
                                        color: active ? T.NAVY : T.TEXT_MUTED,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    {item.label}
                                    {item.count != null && (
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                                background: active ? T.BLUE_LIGHT : T.GRAY_MID,
                                                borderRadius: 999,
                                                padding: "1px 8px",
                                            }}
                                        >
                                            {item.count}
                                        </span>
                                    )}
                                    {active && (
                                        <span
                                            style={{
                                                position: "absolute",
                                                left: 0,
                                                right: 0,
                                                bottom: -1,
                                                height: 2,
                                                background: T.BLUE,
                                                borderRadius: 2,
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ padding: "20px 22px 24px" }}>
                        {tab === "pipelines" && (
                            <PipelinesTab
                                pipelines={pipelines}
                                loading={pipelinesQuery.isLoading}
                                onRefresh={() => void pipelinesQuery.refetch()}
                            />
                        )}
                        {tab === "analysis" && <AnalysisScriptTab pipelines={pipelines} />}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

DealSettingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
