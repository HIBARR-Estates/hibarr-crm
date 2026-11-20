import React, { useState } from "react";
import { Drawer, Popconfirm, message } from "antd";
import type { FilterConfig } from "@/contexts/FilterContext";
import { describeFilters } from "./filterSummary";
import {
    canManageView,
    type LeadSavedView,
    type SaveViewPayload,
} from "./useLeadSavedViews";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import "./entity-filter-modal.css";

interface SavedViewsDrawerProps {
    open: boolean;
    views: LeadSavedView[];
    config: FilterConfig;
    activeViewId: number | null;
    saving: boolean;
    /** The filters currently set in the modal, for "Update with current filters". */
    currentFilters: Record<string, any>;
    onClose: () => void;
    onApply: (view: LeadSavedView) => void;
    onUpdate: (
        id: number,
        payload: Partial<SaveViewPayload>,
    ) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const MAX_CHIPS = 4;

/**
 * Everything a person can do to their saved views, in one place: apply,
 * rename, pin, share or make private, overwrite with the filters currently
 * set, and delete. Team views other people shared are listed too; the ones the
 * viewer may not change (`can_manage`) show who to ask instead.
 */
export default function SavedViewsDrawer({
    open,
    views,
    config,
    activeViewId,
    saving,
    currentFilters,
    onClose,
    onApply,
    onUpdate,
    onDelete,
}: SavedViewsDrawerProps) {
    const { t } = useTranslation();
    const mine = views.filter((view) => view.is_owner);
    const shared = views.filter((view) => !view.is_owner);

    const rowProps = {
        config,
        activeViewId,
        saving,
        hasCurrentFilters: Object.keys(currentFilters).length > 0,
        onApply,
        onRename: (view: LeadSavedView, name: string) =>
            onUpdate(view.id, { name }),
        onSetPinned: (view: LeadSavedView, pinned: boolean) =>
            onUpdate(view.id, { pinned }),
        onSetVisibility: (
            view: LeadSavedView,
            visibility: "private" | "team",
        ) => onUpdate(view.id, { visibility }),
        onOverwrite: async (view: LeadSavedView) => {
            const ok = await onUpdate(view.id, { filters: currentFilters });
            if (ok) message.success(t("pages.filters.view_updated"));
            return ok;
        },
        onDelete: async (view: LeadSavedView) => {
            const ok = await onDelete(view.id);
            if (ok) message.success(t("pages.filters.view_deleted"));
            return ok;
        },
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            placement="right"
            width={460}
            // Above the filter modal it is opened from: antd popups sit at
            // zIndexPopupBase (1300, providers/antd/utils.ts), so anything
            // lower renders behind that modal.
            zIndex={1400}
            destroyOnClose
            title={t("pages.filters.views_drawer_title")}
        >
            <div className="lfm-svd">
                <p className="lfm-svd__sub">
                    {t("pages.filters.views_drawer_sub")}
                </p>

                <section className="lfm-svd__group">
                    <h3 className="lfm-svd__title">
                        {t("pages.filters.views_mine")}
                        <span className="lfm-svd__count">{mine.length}</span>
                    </h3>
                    {mine.length === 0 ? (
                        <p className="lfm-svd__empty">
                            {t("pages.filters.views_none_mine")}
                        </p>
                    ) : (
                        <ul className="lfm-svd__list">
                            {mine.map((view) => (
                                <ViewRow key={view.id} view={view} {...rowProps} />
                            ))}
                        </ul>
                    )}
                </section>

                <section className="lfm-svd__group">
                    <h3 className="lfm-svd__title">
                        {t("pages.filters.views_team")}
                        <span className="lfm-svd__count">{shared.length}</span>
                    </h3>
                    {shared.length === 0 ? (
                        <p className="lfm-svd__empty">
                            {t("pages.filters.views_none_team")}
                        </p>
                    ) : (
                        <ul className="lfm-svd__list">
                            {shared.map((view) => (
                                <ViewRow key={view.id} view={view} {...rowProps} />
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </Drawer>
    );
}

interface ViewRowProps {
    view: LeadSavedView;
    config: FilterConfig;
    activeViewId: number | null;
    saving: boolean;
    hasCurrentFilters: boolean;
    onApply: (view: LeadSavedView) => void;
    onRename: (view: LeadSavedView, name: string) => Promise<boolean>;
    onSetPinned: (view: LeadSavedView, pinned: boolean) => Promise<boolean>;
    onSetVisibility: (
        view: LeadSavedView,
        visibility: "private" | "team",
    ) => Promise<boolean>;
    onOverwrite: (view: LeadSavedView) => Promise<boolean>;
    onDelete: (view: LeadSavedView) => Promise<boolean>;
}

function ViewRow({
    view,
    config,
    activeViewId,
    saving,
    hasCurrentFilters,
    onApply,
    onRename,
    onSetPinned,
    onSetVisibility,
    onOverwrite,
    onDelete,
}: ViewRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(view.name);

    const canManage = canManageView(view);
    const parts = describeFilters(config, view.filters ?? {}, { t, td });
    const shown = parts.slice(0, MAX_CHIPS);
    const isActive = view.id === activeViewId;
    // The owner decides who sees a view; an admin fixing up a team view cannot
    // take it back private.
    const canChangeVisibility = view.is_owner;

    const commitRename = async () => {
        const next = name.trim();
        if (next === "" || next === view.name) {
            setEditing(false);
            setName(view.name);
            return;
        }
        if (await onRename(view, next)) setEditing(false);
    };

    return (
        <li className={`lfm-svd__row${isActive ? " is-active" : ""}`}>
            <div className="lfm-svd__head">
                {editing ? (
                    <input
                        className="lfm-svd__input"
                        value={name}
                        autoFocus
                        maxLength={120}
                        aria-label={t("pages.filters.name")}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") void commitRename();
                            if (event.key === "Escape") {
                                event.stopPropagation();
                                setEditing(false);
                                setName(view.name);
                            }
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        className="lfm-svd__name"
                        onClick={() => onApply(view)}
                        title={t("pages.filters.view_apply")}
                    >
                        {view.name}
                    </button>
                )}
                {editing ? (
                    <span className="lfm-svd__editactions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={() => {
                                setEditing(false);
                                setName(view.name);
                            }}
                            disabled={saving}
                        >
                            {t("pages.filters.cancel")}
                        </button>
                        <button
                            type="button"
                            className="lfm-btn lfm-btn--primary"
                            onClick={() => void commitRename()}
                            disabled={saving || name.trim() === ""}
                        >
                            {t("pages.filters.save")}
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        className="lfm-btn"
                        onClick={() => onApply(view)}
                    >
                        {t("pages.filters.view_apply")}
                    </button>
                )}
            </div>

            <div className="lfm-svd__tags">
                <span
                    className={`lfm-svd__tag${view.visibility === "team" ? " is-team" : ""}`}
                >
                    {view.visibility === "team"
                        ? t("pages.filters.view_tag_team")
                        : t("pages.filters.only_me")}
                </span>
                {view.pinned && (
                    <span className="lfm-svd__tag">
                        {t("pages.filters.view_pinned")}
                    </span>
                )}
                {!view.is_owner && (
                    <span className="lfm-svd__by">
                        {t("pages.filters.shared_by", {
                            name:
                                view.owner_name ?? t("pages.filters.teammate"),
                        })}
                    </span>
                )}
            </div>

            <div className="lfm-svd__chips">
                {shown.map((part) => (
                    <span
                        key={part.keys.join("|")}
                        className="lfm-savepop__chip"
                    >
                        {part.chip}
                    </span>
                ))}
                {parts.length > MAX_CHIPS && (
                    <span className="lfm-svd__more">
                        +{parts.length - MAX_CHIPS}
                    </span>
                )}
                {parts.length === 0 && (
                    <span className="lfm-empty">
                        {t("pages.filters.view_no_filters")}
                    </span>
                )}
            </div>

            {canManage ? (
                <div className="lfm-svd__actions">
                    <button
                        type="button"
                        className="lfm-svd__link"
                        onClick={() => setEditing(true)}
                        disabled={editing || saving}
                    >
                        {t("pages.filters.rename")}
                    </button>
                    <button
                        type="button"
                        className="lfm-svd__link"
                        onClick={() => void onSetPinned(view, !view.pinned)}
                        disabled={saving}
                    >
                        {view.pinned
                            ? t("pages.filters.view_unpin")
                            : t("pages.filters.view_pin")}
                    </button>
                    {canChangeVisibility && (
                        <button
                            type="button"
                            className="lfm-svd__link"
                            onClick={() =>
                                void onSetVisibility(
                                    view,
                                    view.visibility === "team"
                                        ? "private"
                                        : "team",
                                )
                            }
                            disabled={saving}
                        >
                            {view.visibility === "team"
                                ? t("pages.filters.view_make_private")
                                : t("pages.filters.share_team")}
                        </button>
                    )}
                    <Popconfirm
                        title={t("pages.filters.view_overwrite_q")}
                        okText={t("pages.filters.view_update_filters")}
                        zIndex={1500}
                        disabled={!hasCurrentFilters}
                        onConfirm={() => void onOverwrite(view)}
                    >
                        <button
                            type="button"
                            className="lfm-svd__link"
                            disabled={!hasCurrentFilters || saving}
                            title={
                                hasCurrentFilters
                                    ? undefined
                                    : t("pages.filters.view_update_needs_filters")
                            }
                        >
                            {t("pages.filters.view_update_filters")}
                        </button>
                    </Popconfirm>
                    <Popconfirm
                        title={t("pages.filters.delete_view_q")}
                        okText={t("pages.filters.delete")}
                        okButtonProps={{ danger: true }}
                        zIndex={1500}
                        onConfirm={() => void onDelete(view)}
                    >
                        <button
                            type="button"
                            className="lfm-svd__link lfm-svd__link--danger"
                            disabled={saving}
                        >
                            {t("pages.filters.delete")}
                        </button>
                    </Popconfirm>
                    {!view.is_owner && (
                        <span className="lfm-svd__admin">
                            {t("pages.filters.view_admin_note")}
                        </span>
                    )}
                </div>
            ) : (
                <p className="lfm-svd__locked">
                    {t("pages.filters.view_locked", {
                        name: view.owner_name ?? t("pages.filters.teammate"),
                    })}
                </p>
            )}
        </li>
    );
}
