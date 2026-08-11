import React, { useEffect, useState } from "react";
import type { FilterSummaryPart } from "./filterSummary";
import type { LeadSavedView, SaveViewPayload } from "./useLeadSavedViews";

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
                aria-label="Save filters as a view"
            >
                <div className="lfm-savepop__title">
                    {existing ? "Update view" : "Save as view"}
                </div>

                <label className="lfm-savepop__group">
                    <span className="lfm-savepop__label">Name</span>
                    <input
                        className="lfm-savepop__input"
                        value={name}
                        autoFocus
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Name this view"
                    />
                    {!existing && (
                        <span className="lfm-savepop__hint">
                            Suggested from your filters
                        </span>
                    )}
                </label>

                <div className="lfm-savepop__group">
                    <span className="lfm-savepop__label">Who can see it</span>
                    <button
                        type="button"
                        className={`lfm-radio${visibility === "private" ? " is-on" : ""}`}
                        onClick={() => setVisibility("private")}
                    >
                        <span className="lfm-radio__dot" />
                        <span>
                            <span className="lfm-radio__name">Only me</span>
                            <span className="lfm-radio__sub">
                                Private to your account
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
                                Share with team
                            </span>
                            <span className="lfm-radio__sub">
                                Everyone in your company can open it
                            </span>
                        </span>
                    </button>
                </div>

                <div className="lfm-savepop__summary">
                    <div className="lfm-savepop__summaryhead">
                        Saving {parts.length}{" "}
                        {parts.length === 1 ? "filter" : "filters"}
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
                                No filters selected yet
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
                        Pin to my Views bar
                    </button>
                </div>

                <div className="lfm-savepop__actions">
                    <button
                        type="button"
                        className="lfm-btn"
                        onClick={onCancel}
                        disabled={saving}
                    >
                        Cancel
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
                            ? "Saving…"
                            : existing
                              ? "Update view"
                              : "Save view"}
                    </button>
                </div>
            </div>
        </>
    );
}
