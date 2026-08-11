import React from "react";
import { Dropdown, Popconfirm } from "antd";
import type { LeadSavedView } from "./useLeadSavedViews";

interface ViewsBarProps {
    views: LeadSavedView[];
    activeViewId: number | null;
    /** True when the draft filters differ from the active (or no) view. */
    dirty: boolean;
    hasFilters: boolean;
    onApplyView: (view: LeadSavedView) => void;
    onSaveCurrent: () => void;
    onRename: (view: LeadSavedView) => void;
    onDelete: (view: LeadSavedView) => void;
}

/** Views bar from mockups 1a / 2a / 2c. */
export default function ViewsBar({
    views,
    activeViewId,
    dirty,
    hasFilters,
    onApplyView,
    onSaveCurrent,
    onRename,
    onDelete,
}: ViewsBarProps) {
    const pinned = views.filter((view) => view.pinned);
    const unpinned = views.filter((view) => !view.pinned);

    return (
        <div className="lfm-views">
            <span className="lfm-views__label">Views</span>
            <div className="lfm-views__list">
                {pinned.map((view) => {
                    const isActive = view.id === activeViewId;
                    return (
                        <Dropdown
                            key={view.id}
                            trigger={["contextMenu"]}
                            menu={{
                                items: view.is_owner
                                    ? [
                                          {
                                              key: "rename",
                                              label: "Rename",
                                              onClick: () => onRename(view),
                                          },
                                          {
                                              key: "delete",
                                              label: (
                                                  <Popconfirm
                                                      title="Delete this view?"
                                                      okText="Delete"
                                                      okButtonProps={{
                                                          danger: true,
                                                      }}
                                                      onConfirm={() =>
                                                          onDelete(view)
                                                      }
                                                  >
                                                      <span className="text-red-600">
                                                          Delete
                                                      </span>
                                                  </Popconfirm>
                                              ),
                                          },
                                      ]
                                    : [
                                          {
                                              key: "shared",
                                              label: `Shared by ${view.owner_name ?? "a teammate"}`,
                                              disabled: true,
                                          },
                                      ],
                            }}
                        >
                            <button
                                type="button"
                                className={`lfm-viewpill${isActive ? " is-on" : ""}`}
                                onClick={() => onApplyView(view)}
                                title="Right-click for options"
                            >
                                {isActive && <span className="lfm-viewpill__dot" />}
                                {view.name}
                                {view.visibility === "team" && (
                                    <span className="lfm-viewpill__meta">
                                        · team
                                    </span>
                                )}
                            </button>
                        </Dropdown>
                    );
                })}

                {unpinned.length > 0 && (
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: unpinned.map((view) => ({
                                key: view.id,
                                label: view.name,
                                onClick: () => onApplyView(view),
                            })),
                        }}
                    >
                        <button type="button" className="lfm-viewpill">
                            More views ({unpinned.length})
                        </button>
                    </Dropdown>
                )}

                {dirty && hasFilters ? (
                    <span className="lfm-viewpill lfm-viewpill--unsaved">
                        Unsaved filter set
                        <button
                            type="button"
                            className="lfm-viewpill__save"
                            onClick={onSaveCurrent}
                        >
                            Save
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        className="lfm-viewpill lfm-viewpill--add"
                        onClick={onSaveCurrent}
                        disabled={!hasFilters}
                    >
                        + Save current
                    </button>
                )}
            </div>
        </div>
    );
}
