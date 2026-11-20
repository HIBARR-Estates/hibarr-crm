import { AgentListSearch } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { PeopleBucket, PeopleCounts } from "./types";

interface PeopleHeaderProps {
    total: number;
    /** Next-action bucket applied now, or null for All. */
    bucket: PeopleBucket | null;
    counts: PeopleCounts | undefined;
    onBucket: (bucket: PeopleBucket | null) => void;
    searchText: string;
    onSearchText: (text: string) => void;
}

const CHIPS: Array<{ key: PeopleBucket | "all"; mark?: string }> = [
    { key: "all" },
    { key: "overdue", mark: "var(--dr-time-late-solid)" },
    { key: "today", mark: "var(--dr-navy)" },
    { key: "week", mark: "var(--dr-time-later-solid)" },
    { key: "none", mark: "var(--dr-time-none-solid)" },
];

/**
 * Title and count on the navy band, the four next-action chips (All is the
 * white one when nothing is picked) and the in-list search. Each chip is a
 * toggle on the list's next-action filter; its number fills in with the
 * deferred counts, keeping its size so nothing shifts.
 */
export default function PeopleHeader({ total, bucket, counts, onBucket, searchText, onSearchText }: PeopleHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="agent-list-head">
            <div className="agent-pp__top">
                <div className="agent-pp__heading">
                    <h1>{t("pages.agent_workspace.people.title")}</h1>
                    <p aria-live="polite">
                        {total === 1
                            ? t("pages.agent_workspace.people.subtitle_one")
                            : t("pages.agent_workspace.people.subtitle", { count: total })}
                    </p>
                    <AgentListSearch
                        value={searchText}
                        onChange={onSearchText}
                        placeholder={t("pages.agent_workspace.people.search_placeholder")}
                        label={t("pages.agent_workspace.people.search_label")}
                    />
                </div>

                <div className="agent-pp__tools">
                    <ul className="agent-pp__chips" aria-label={t("pages.agent_workspace.people.chips.label")}>
                        {CHIPS.map(({ key, mark }) => {
                            const pressed = key === "all" ? bucket === null : bucket === key;
                            const value = counts?.[key];
                            return (
                                <li key={key}>
                                    <button
                                        type="button"
                                        className={`agent-band-chip agent-pp__chip${value === undefined ? " is-loading" : ""}`}
                                        aria-pressed={pressed}
                                        onClick={() => onBucket(key === "all" ? null : key)}
                                    >
                                        <span className="agent-band-chip__label agent-pp__chip-label">
                                            {mark ? <span className="agent-band-chip__mark agent-pp__chip-mark" style={{ ["--mark" as string]: mark }} aria-hidden="true" /> : null}
                                            {t(`pages.agent_workspace.people.chips.${key}`)}
                                        </span>
                                        <b className="agent-band-chip__value agent-pp__chip-value">{value ?? "00"}</b>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}
