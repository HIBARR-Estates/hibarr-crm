import React, { useEffect, useState } from "react";
import type { FilterSummaryPart } from "./filterSummary";
import type { LeadSavedView, SaveViewPayload } from "./useLeadSavedViews";
import { useTranslation } from "@/Hooks/useTranslation";

interface SaveViewPopoverProps {
    open: boolean;
    parts: FilterSummaryPart[];
    suggestedName: string;
    saving: boolean;
    /** Set when re-saving over an existing view. */
    existing?: LeadSavedView | null;
    onCancel: () => void;
    onSave: (payload: Omit<SaveViewPayload, "filters">) => void;
}

/** Mockup 2b — the save-as-view popover anchored to the modal footer. */
export default function SaveViewPopover({
    open,
    parts,
    suggestedName,
    saving,
    existing,
    onCancel,
    onSave,
}: SaveViewPopoverProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(suggestedName);
    const [visibility, setVisibility] = useState<"private" | "team">("team");
    const [pinned, setPinned] = useState(true);

    useEffect(() => {
        if (!open) return;
        setName(existing?.name ?? suggestedName);
        setVisibility(existing?.visibility ?? "team");
        setPinned(existing?.pinned ?? true);
    }, [open, suggestedName, existing]);

    if (!open) return null;

    return (
        <>
            <div className="lfm-scrim" onClick={onCancel} />
            <div
                className="lfm-savepop"
                role="dialog"
                aria-label={t("pages.filters.save_filters_aria")}
            >
                <div className="lfm-savepop__title">
                    {existing ? t("pages.filters.update_view") : t("pages.filters.save_as_view")}
                </div>

                <label className="lfm-savepop__group">
                    <span className="lfm-savepop__label">{t("pages.filters.name")}</span>
                    <input
                        className="lfm-savepop__input"
                        value={name}
                        autoFocus
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t("pages.filters.name_placeholder")}
                    />
                    {!existing && (
                        <span className="lfm-savepop__hint">
                            {t("pages.filters.suggested")}
                        </span>
                    )}
                </label>

                <div className="lfm-savepop__group">
                    <span className="lfm-savepop__label">{t("pages.filters.who_can_see")}</span>
                    <button
                        type="button"
                        className={`lfm-radio${visibility === "private" ? " is-on" : ""}`}
                        onClick={() => setVisibility("private")}
                    >
                        <span className="lfm-radio__dot" />
                        <span>
                            <span className="lfm-radio__name">{t("pages.filters.only_me")}</span>
                            <span className="lfm-radio__sub">
                                {t("pages.filters.private_sub")}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`lfm-radio${visibility === "team" ? " is-on" : ""}`}
                        onClick={() => setVisibility("team")}
                    >
                        <span className="lfm-radio__dot" />
                        <span>
                            <span className="lfm-radio__name">
                                {t("pages.filters.share_team")}
                            </span>
                            <span className="lfm-radio__sub">
                                {t("pages.filters.share_team_sub")}
                            </span>
                        </span>
                    </button>
                </div>

                <div className="lfm-savepop__summary">
                    <div className="lfm-savepop__summaryhead">
                        {t("pages.filters.saving_filters", { count: parts.length })}
                    </div>
                    <div className="lfm-savepop__chips">
                        {parts.map((part) => (
                            <span
                                key={part.keys.join("|")}
                                className="lfm-savepop__chip"
                            >
                                {part.chip}
                            </span>
                        ))}
                        {parts.length === 0 && (
                            <span className="lfm-empty">
                                {t("pages.filters.no_filters_selected")}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="lfm-toggle"
                        onClick={() => setPinned((prev) => !prev)}
                    >
                        <span
                            className={`lfm-toggle__track${pinned ? " is-on" : ""}`}
                        >
                            <span className="lfm-toggle__knob" />
                        </span>
                        {t("pages.filters.pin_view")}
                    </button>
                </div>

                <div className="lfm-savepop__actions">
                    <button
                        type="button"
                        className="lfm-btn"
                        onClick={onCancel}
                        disabled={saving}
                    >
                        {t("pages.filters.cancel")}
                    </button>
                    <button
                        type="button"
                        className="lfm-btn lfm-btn--primary"
                        disabled={saving || name.trim() === ""}
                        onClick={() =>
                            onSave({
                                name: name.trim(),
                                visibility,
                                pinned,
                            })
                        }
                    >
                        {saving
                            ? t("pages.filters.saving")
                            : existing
                              ? t("pages.filters.update_view")
                              : t("pages.filters.save_view")}
                    </button>
                </div>
            </div>
        </>
    );
}
