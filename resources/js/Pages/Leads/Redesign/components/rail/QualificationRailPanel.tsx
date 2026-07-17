import useTranslation from "@/Hooks/useTranslation";
import LeadIcon from "../primitives/LeadIcon";
import type { BantChecks } from "../../types";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";

const BANT_ITEMS: Array<{ key: keyof BantChecks; label: string }> = [
    { key: "contactability", label: "Contact" },
    { key: "need", label: "Need" },
    { key: "budget", label: "Budget" },
    { key: "timeline", label: "Timeline" },
];

interface QualificationRailPanelProps {
    checks: BantChecks;
}

export default function QualificationRailPanel({ checks }: QualificationRailPanelProps) {
    const { t } = useTranslation();
    const completed = BANT_ITEMS.filter((item) => checks[item.key]).length;

    return (
        <section className="rail-panel">
            <header className="flex items-center justify-between border-b border-[#eef1f5] px-3 py-2.5">
                <h3 className="text-xs font-semibold text-[#1a1f2e]">
                    {t("pages.leads.tabs.qualification")}
                </h3>
                <span className="text-[10px] font-medium text-[#6b7280]">
                    {completed}/{BANT_ITEMS.length}
                </span>
            </header>
            <div className="space-y-2 p-3">
                {BANT_ITEMS.map((item) => {
                    const done = checks[item.key];
                    return (
                        <div
                            key={item.key}
                            className="flex items-center justify-between rounded-md border border-[#edf1f5] px-2.5 py-2"
                        >
                            <span className="text-xs text-[#374151]">{item.label}</span>
                            <span
                                className="flex h-5 w-5 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: done ? T.GREEN_LIGHT : "#f5f6f8",
                                    color: done ? T.GREEN : "#9ca3af",
                                }}
                            >
                                {done ? (
                                    <LeadIcon name="check" size={11} color={T.GREEN} />
                                ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#d1d5db]" />
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
