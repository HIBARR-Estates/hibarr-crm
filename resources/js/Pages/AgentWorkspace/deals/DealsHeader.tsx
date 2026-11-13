import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { DealsChip, DealsLayout } from "./types";

interface DealsHeaderProps {
    title: string;
    subtitle: string;
    layout: DealsLayout;
    onLayout: (layout: DealsLayout) => void;
    /** Open deals shown, and the chip counts (undefined until the deferred figures arrive). */
    counts: { all: number; idle: number | undefined; meeting: number | undefined; ready: number | undefined };
    chip: DealsChip | null;
    onChip: (chip: DealsChip | null) => void;
    searchText: string;
    onSearchText: (text: string) => void;
}

const CHIPS: Array<{ key: DealsChip | "all"; mark?: string }> = [
    { key: "all" },
    { key: "idle", mark: "var(--dr-time-late-solid)" },
    { key: "meeting", mark: "var(--dr-time-later-solid)" },
    { key: "ready", mark: "var(--dr-time-now-solid)" },
];

/**
 * Pipeline name and what is in it on the navy band. The board has the Board
 * | List switch and the search; the list has the three chips (All, Idle 7+
 * days, Meeting this week, Ready to move) and the switch.
 */
export default function DealsHeader({ title, subtitle, layout, onLayout, counts, chip, onChip, searchText, onSearchText }: DealsHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="agent-dp__top">
            <div className="agent-dp__heading">
                <h1>{title}</h1>
                <p aria-live="polite">{subtitle}</p>
            </div>

            <div className="agent-dp__tools">
                {layout === "list" ? (
                    <ul className="agent-dp__chip-row" aria-label={t("pages.agent_workspace.deals.chips.label")}>
                        {CHIPS.map(({ key, mark }) => {
                            const pressed = key === "all" ? chip === null : chip === key;
                            const value = counts[key];
                            return (
                                <li key={key}>
                                    <button
                                        type="button"
                                        className={`agent-dp__chip${value === undefined ? " agent-dp__chip--loading" : ""}`}
                                        aria-pressed={pressed}
                                        onClick={() => onChip(key === "all" ? null : key)}
                                    >
                                        <span className="agent-dp__chip-label">
                                            {mark ? <span className="agent-dp__chip-mark" style={{ ["--mark" as string]: mark }} aria-hidden="true" /> : null}
                                            {t(`pages.agent_workspace.deals.chips.${key}`)}
                                        </span>
                                        <b className="agent-dp__chip-value">{value ?? "00"}</b>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}

                <div className="agent-dp__switch" role="group" aria-label={t("pages.agent_workspace.deals.layout.label")}>
                    {(["board", "list"] as const).map((key) => (
                        <button key={key} type="button" aria-pressed={layout === key} onClick={() => onLayout(key)}>
                            {t(`pages.agent_workspace.deals.layout.${key}`)}
                        </button>
                    ))}
                </div>

                {layout === "board" ? (
                    <label className="agent-dp__search">
                        <Icon name="search" size={14} />
                        <input
                            type="search"
                            value={searchText}
                            onChange={(event) => onSearchText(event.target.value)}
                            placeholder={t("pages.agent_workspace.deals.search_placeholder")}
                            aria-label={t("pages.agent_workspace.deals.search_label")}
                        />
                    </label>
                ) : null}
            </div>
        </div>
    );
}
