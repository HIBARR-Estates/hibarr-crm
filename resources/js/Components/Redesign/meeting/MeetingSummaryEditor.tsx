import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { SummarySection } from "./useMeetingSummaryActions";

interface MeetingSummaryEditorProps {
    /** The sections already on the summary; empty offers the usual three. */
    initial: SummarySection[];
    saving: boolean;
    error: string | null;
    onSave: (sections: SummarySection[]) => void;
    onCancel: () => void;
}

/** One editable row. A custom one has no key until it is saved. */
interface Row {
    id: number;
    key: string | null;
    title: string;
    value: string;
}

const TEXTAREA_STYLE = {
    width: "100%",
    minHeight: 84,
    padding: "9px 11px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical" as const,
};

/** The titles of the three prompts a blank summary starts from. */
const DEFAULT_TITLES: Record<string, string> = {
    discussed: "What was discussed",
    outcome: "Outcome",
    next_steps: "Next steps",
};

/** `key_points` -> `Key points`, the way the read view shows it. */
function humanize(key: string): string {
    const spaced = key.replace(/[_-]/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A title the user typed, as a stable key the server will accept. */
function keyFromTitle(title: string): string {
    return title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Writes or corrects a meeting's summary by hand.
 *
 * For when the automatic one never came, keeps failing, or is simply wrong. It
 * edits the sections the summary already has — whatever the automation named
 * them — rather than forcing them into a fixed form, and can add more. A
 * summary that was empty starts from the three prompts the follow-up report
 * uses, so a hand-written one and a report read the same.
 */
export default function MeetingSummaryEditor({
    initial,
    saving,
    error,
    onSave,
    onCancel,
}: MeetingSummaryEditorProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    const [rows, setRows] = useState<Row[]>(() => {
        if (initial.length > 0) {
            return initial.map((section, index) => ({
                id: index,
                key: section.key,
                title: "",
                value: section.value,
            }));
        }
        return Object.keys(DEFAULT_TITLES).map((key, index) => ({
            id: index,
            key,
            title: "",
            value: "",
        }));
    });
    const [nextId, setNextId] = useState(rows.length);

    const patch = (id: number, fields: Partial<Row>) =>
        setRows((current) =>
            current.map((row) => (row.id === id ? { ...row, ...fields } : row)),
        );

    const addSection = () => {
        setRows((current) => [
            ...current,
            { id: nextId, key: null, title: "", value: "" },
        ]);
        setNextId((id) => id + 1);
    };

    const sections: SummarySection[] = rows
        .map((row) => ({
            key: row.key ?? keyFromTitle(row.title),
            value: row.value.trim(),
        }))
        .filter((section) => section.key !== "" && section.value !== "");

    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <div key={row.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                        {row.key === null ? (
                            <input
                                type="text"
                                value={row.title}
                                disabled={saving}
                                maxLength={60}
                                placeholder={t("pages.meetings.ui.section_title")}
                                onChange={(event) =>
                                    patch(row.id, { title: event.target.value })
                                }
                                className="font-semibold"
                                style={{
                                    fontSize: 12,
                                    padding: "3px 8px",
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 6,
                                    fontFamily: "inherit",
                                }}
                            />
                        ) : (
                            <span
                                className="font-semibold uppercase"
                                style={{
                                    fontSize: 11,
                                    letterSpacing: "0.06em",
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {row.key in DEFAULT_TITLES
                                    ? td(DEFAULT_TITLES[row.key])
                                    : humanize(row.key)}
                            </span>
                        )}
                        {rows.length > 1 && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                    setRows((current) =>
                                        current.filter(
                                            (candidate) => candidate.id !== row.id,
                                        ),
                                    )
                                }
                                style={{
                                    fontSize: 12,
                                    color: T.TEXT_MUTED,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                {t("pages.meetings.ui.remove")}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={row.value}
                        disabled={saving}
                        maxLength={20000}
                        onChange={(event) =>
                            patch(row.id, { value: event.target.value })
                        }
                        style={TEXTAREA_STYLE}
                    />
                </div>
            ))}

            {rows.length < 20 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={addSection}
                    disabled={saving}
                >
                    {t("pages.meetings.ui.add_a_section")}
                </Button>
            )}

            {error && (
                <p role="alert" className="m-0" style={{ fontSize: 13, color: T.RED }}>
                    {td(error)}
                </p>
            )}

            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel} disabled={saving}>
                    {t("pages.meetings.ui.cancel")}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => onSave(sections)}
                    loading={saving}
                    disabled={saving || sections.length === 0}
                >
                    {t("pages.meetings.ui.save_summary")}
                </Button>
            </div>
        </div>
    );
}
