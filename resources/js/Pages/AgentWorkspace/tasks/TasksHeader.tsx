import { AgentListSearch } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { TaskChip, TaskCounts } from "./types";

interface TasksHeaderProps {
    subtitle: string;
    /** Undefined until the deferred tasks arrive. */
    counts: TaskCounts | undefined;
    chip: TaskChip | null;
    onChip: (chip: TaskChip | null) => void;
    searchText: string;
    onSearchText: (text: string) => void;
}

const CHIPS: Array<{ key: TaskChip | "all"; mark?: string }> = [
    { key: "all" },
    { key: "overdue", mark: "var(--dr-time-late-solid)" },
    { key: "today", mark: "var(--dr-navy)" },
    { key: "week", mark: "var(--dr-time-later-solid)" },
    { key: "none", mark: "var(--dr-time-none-solid)" },
];

/** The title and what is open on the navy band, and the chips that narrow the list. */
export default function TasksHeader({ subtitle, counts, chip, onChip, searchText, onSearchText }: TasksHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="agent-list-head">
            <div className="agent-tk__top">
                <div className="agent-tk__heading">
                    <h1>{t("pages.agent_workspace.tasks.title")}</h1>
                    <p aria-live="polite">{subtitle}</p>
                    <AgentListSearch
                        value={searchText}
                        onChange={onSearchText}
                        placeholder={t("pages.agent_workspace.tasks.search_placeholder")}
                        label={t("pages.agent_workspace.tasks.search_label")}
                    />
                </div>

                <ul className="agent-tk__chip-row" aria-label={t("pages.agent_workspace.tasks.chips.label")}>
                    {CHIPS.map(({ key, mark }) => {
                        const pressed = key === "all" ? chip === null : chip === key;
                        const value = counts?.[key];
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    className={`agent-tk__chip${value === undefined ? " agent-tk__chip--loading" : ""}`}
                                    aria-pressed={pressed}
                                    onClick={() => onChip(key === "all" ? null : key)}
                                >
                                    <span className="agent-tk__chip-label">
                                        {mark ? <span className="agent-tk__chip-mark" style={{ ["--mark" as string]: mark }} aria-hidden="true" /> : null}
                                        {t(`pages.agent_workspace.tasks.chips.${key}`)}
                                    </span>
                                    <b className="agent-tk__chip-value">{value ?? "00"}</b>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
