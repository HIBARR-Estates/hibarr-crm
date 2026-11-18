import React from "react";
import { Dropdown, Popconfirm } from "antd";
import type { LeadSavedView } from "./useLeadSavedViews";
import { useTranslation } from "@/Hooks/useTranslation";

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
    const { t } = useTranslation();
    const pinned = views.filter((view) => view.pinned);
    const unpinned = views.filter((view) => !view.pinned);

    return (
        <div className="lfm-views">
            <span className="lfm-views__label">{t("pages.filters.views")}</span>
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
                                              label: t("pages.filters.rename"),
                                              onClick: () => onRename(view),
                                          },
                                          {
                                              key: "delete",
                                              label: (
                                                  <Popconfirm
                                                      title={t("pages.filters.delete_view_q")}
                                                      okText={t("pages.filters.delete")}
                                                      okButtonProps={{
                                                          danger: true,
                                                      }}
                                                      onConfirm={() =>
                                                          onDelete(view)
                                                      }
                                                  >
                                                      <span className="text-red-600">
                                                          {t("pages.filters.delete")}
                                                      </span>
                                                  </Popconfirm>
                                              ),
                                          },
                                      ]
                                    : [
                                          {
                                              key: "shared",
                                              label: t("pages.filters.shared_by", {
                                                  name:
                                                      view.owner_name ??
                                                      t("pages.filters.teammate"),
                                              }),
                                              disabled: true,
                                          },
                                      ],
                            }}
                        >
                            <button
                                type="button"
                                className={`lfm-viewpill${isActive ? " is-on" : ""}`}
                                onClick={() => onApplyView(view)}
                                title={t("pages.filters.right_click")}
                            >
                                {isActive && <span className="lfm-viewpill__dot" />}
                                {view.name}
                                {view.visibility === "team" && (
                                    <span className="lfm-viewpill__meta">
                                        {t("pages.filters.team_tag")}
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
                            {t("pages.filters.more_views", { n: unpinned.length })}
                        </button>
                    </Dropdown>
                )}

                {dirty && hasFilters ? (
                    <span className="lfm-viewpill lfm-viewpill--unsaved">
                        {t("pages.filters.unsaved_set")}
                        <button
                            type="button"
                            className="lfm-viewpill__save"
                            onClick={onSaveCurrent}
                        >
                            {t("pages.filters.save")}
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        className="lfm-viewpill lfm-viewpill--add"
                        onClick={onSaveCurrent}
                        disabled={!hasFilters}
                    >
                        {t("pages.filters.save_current")}
                    </button>
                )}
            </div>
        </div>
    );
}
