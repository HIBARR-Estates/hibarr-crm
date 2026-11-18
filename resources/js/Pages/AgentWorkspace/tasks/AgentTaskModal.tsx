import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import { Dropdown, Popover, type MenuProps } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentDialog } from "@/Components/Redesign/agent";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { emptyTaskForm, type TaskFormValues, type TaskLinkRef } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { TASK_PRIORITY_ORDER, type TaskPriorityKey } from "@/Pages/Tasks/Redesign/config/taskDesignTokens";
import "./task-modal.css";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface AgentTaskModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: TaskFormValues) => void;
    saving: boolean;
    errors: string[];
    columns: TaskboardColumn[];
    categories: CategoryOption[];
    /** The records the task is opened from: shown under Linked items and always sent. */
    lockedLinks?: TaskLinkRef[];
    /** "Opened from Thomas Becker · linked to this deal"; left out on the Tasks page. */
    subtitle?: ReactNode;
}

/** Above the dialog layer (1300), so the chip menus show over it. */
const MENU_LAYER = { zIndex: 1400 };

const PRIORITY_KEY: Record<TaskPriorityKey, string> = {
    urgent: "pages.deals.common.priority_urgent",
    highest: "pages.deals.common.priority_highest",
    high: "pages.deals.common.priority_high",
    medium: "pages.deals.common.priority_medium",
    low: "pages.deals.common.priority_low",
    lowest: "pages.agent_workspace.task_form.priority_lowest",
};

/** The column a new task starts in: the board's "to do" column, else its first. */
function defaultColumn(columns: TaskboardColumn[]): TaskboardColumn | undefined {
    const sorted = columns.slice().sort((a, b) => a.priority - b.priority);
    return sorted.find((column) => column.slug === "incomplete" || column.slug === "to_do") ?? sorted[0];
}

/**
 * Add task in the agent workspace (canvas L7-33): a large title, a
 * description, one chip per field (status, assignee, due, priority,
 * category, links), the records it is linked to, a checklist and
 * attachments. It hands the same values as the Tasks workspace form to the
 * caller, which saves them through the existing task endpoints.
 */
export default function AgentTaskModal({ open, onClose, onSubmit, saving, errors, columns, categories, lockedLinks = [], subtitle }: AgentTaskModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage<PageProps>();
    const me = props.auth?.user;
    const locale = (props as { locale?: string }).locale ?? undefined;

    const [form, setForm] = useState<TaskFormValues>(emptyTaskForm);
    const [draftItem, setDraftItem] = useState<string | null>(null);
    const [assigneeOpen, setAssigneeOpen] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);
    const dateRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const draftRef = useRef<HTMLInputElement>(null);
    const lockedKey = lockedLinks.map((link) => `${link.type}:${link.id}`).join(",");

    // A fresh form each time the dialog opens, already linked and assigned to the agent.
    useEffect(() => {
        if (!open) return;
        setForm({
            ...emptyTaskForm(),
            links: lockedLinks,
            assignees: me?.id ? [me.id] : [],
            boardColumnId: defaultColumn(columns)?.id ?? null,
        });
        setDraftItem(null);
        setAssigneeOpen(false);
        const id = window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 0);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, lockedKey]);

    // Columns arrive after the page; pick the starting one once they do.
    useEffect(() => {
        if (open && form.boardColumnId === null && columns.length > 0) {
            setForm((current) => ({ ...current, boardColumnId: defaultColumn(columns)?.id ?? null }));
        }
    }, [open, columns, form.boardColumnId]);

    const patch = (next: Partial<TaskFormValues>) => setForm((current) => ({ ...current, ...next }));

    const sortedColumns = useMemo(() => columns.slice().sort((a, b) => a.priority - b.priority), [columns]);
    const column = sortedColumns.find((item) => item.id === form.boardColumnId);
    const category = categories.find((item) => item.id === form.categoryId);

    const dueLabel = useMemo(() => {
        if (!form.dueDate) return t("pages.agent_workspace.task_form.no_due");
        const date = new Date(`${form.dueDate}T${form.dueTime || "17:00"}`);
        if (Number.isNaN(date.getTime())) return form.dueDate;
        const day = date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
        return form.dueTime ? `${day} · ${form.dueTime}` : day;
    }, [form.dueDate, form.dueTime, locale, t]);

    const onlyMe = form.assignees.length === 1 && form.assignees[0] === me?.id;
    const assigneeLabel = onlyMe
        ? t("pages.agent_workspace.task_form.you")
        : form.assignees.length === 0
          ? t("pages.agent_workspace.task_form.unassigned")
          : t("pages.agent_workspace.task_form.people", { count: form.assignees.length });

    const statusMenu: MenuProps["items"] = sortedColumns.map((item) => ({ key: String(item.id), label: td(item.column_name, { source: "en" }) }));
    const priorityMenu: MenuProps["items"] = TASK_PRIORITY_ORDER.map((key) => ({ key, label: t(PRIORITY_KEY[key]) }));
    const categoryMenu: MenuProps["items"] = [
        { key: "none", label: t("pages.agent_workspace.task_form.no_category") },
        ...categories.filter((item) => item.category_name).map((item) => ({ key: String(item.id), label: td(item.category_name, { source: "en" }) })),
    ];

    const commitDraft = (): string[] => {
        const text = draftItem?.trim();
        if (!text) return form.checklist;
        const checklist = [...form.checklist, text];
        patch({ checklist });
        setDraftItem("");
        return checklist;
    };

    const canSave = form.title.trim() !== "" && !saving;
    const submit = () => {
        if (!canSave) return;
        const checklist = commitDraft().filter((item) => item.trim() !== "");
        onSubmit({ ...form, checklist });
    };

    const openDate = () => {
        const input = dateRef.current;
        if (!input) return;
        try {
            input.showPicker();
        } catch {
            input.focus();
        }
    };

    return (
        <AgentDialog
            open={open}
            onClose={() => !saving && onClose()}
            title={t("pages.agent_workspace.task_form.title")}
            subtitle={subtitle}
            icon={<Icon name="check" size={16} />}
            closeLabel={t("pages.agent_workspace.task_form.close")}
            width={760}
            form
            footer={
                <>
                    <span className="agent-dlg__spacer" />
                    <Button variant="ghost" onClick={onClose} disabled={saving}>
                        {t("pages.agent_workspace.task_form.cancel")}
                    </Button>
                    <Button variant="primary" onClick={submit} disabled={!canSave}>
                        {saving ? t("pages.agent_workspace.task_form.saving") : t("pages.agent_workspace.task_form.submit")}
                    </Button>
                </>
            }
        >
            <div className="agent-task">
                {errors.length > 0 ? (
                    <ul className="agent-task__errors" role="alert">
                        {errors.map((error) => (
                            <li key={error}>{td(error, { source: "en" })}</li>
                        ))}
                    </ul>
                ) : null}

                <input
                    ref={titleRef}
                    className="agent-task__title"
                    value={form.title}
                    onChange={(event) => patch({ title: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            submit();
                        }
                    }}
                    placeholder={t("pages.agent_workspace.task_form.title_placeholder")}
                    aria-label={t("pages.agent_workspace.task_form.title_placeholder")}
                />
                <textarea
                    className="agent-task__desc"
                    rows={3}
                    value={form.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder={t("pages.agent_workspace.task_form.description_placeholder")}
                    aria-label={t("pages.agent_workspace.task_form.description_placeholder")}
                />

                <div className="agent-task__chips">
                    <Dropdown menu={{ items: statusMenu, onClick: ({ key }) => patch({ boardColumnId: Number(key) }) }} trigger={["click"]} overlayStyle={MENU_LAYER} disabled={saving || statusMenu.length === 0}>
                        <button type="button" className="agent-task__chip" aria-haspopup="menu">
                            <span className="agent-task__chip-label">{t("pages.agent_workspace.task_form.status")}</span>
                            <span className="agent-task__chip-value">{column ? td(column.column_name, { source: "en" }) : "—"}</span>
                        </button>
                    </Dropdown>

                    <Popover
                        open={assigneeOpen}
                        onOpenChange={setAssigneeOpen}
                        trigger="click"
                        zIndex={1400}
                        placement="bottomLeft"
                        arrow={false}
                        content={
                            <div className="agent-task__people">
                                <AssigneeField value={form.assignees} onChange={(assignees) => patch({ assignees })} disabled={saving} />
                            </div>
                        }
                    >
                        <button type="button" className="agent-task__chip" aria-haspopup="dialog">
                            {onlyMe ? (
                                <span className="agent-task__avatar" aria-hidden="true">
                                    {initialsFromName(me?.name ?? "")}
                                </span>
                            ) : (
                                <span className="agent-task__chip-label">{t("pages.agent_workspace.task_form.assignee")}</span>
                            )}
                            <span className="agent-task__chip-value">{assigneeLabel}</span>
                        </button>
                    </Popover>

                    <span className="agent-task__date">
                        <button type="button" className={`agent-task__chip${form.dueDate ? " agent-task__chip--set" : ""}`} onClick={openDate}>
                            <Icon name="calendar" size={13} />
                            <span className="agent-task__chip-value">{dueLabel}</span>
                        </button>
                        <input
                            ref={dateRef}
                            type="datetime-local"
                            className="agent-task__date-input"
                            tabIndex={-1}
                            aria-label={t("pages.agent_workspace.task_form.due")}
                            value={form.dueDate ? `${form.dueDate}T${form.dueTime || "17:00"}` : ""}
                            onChange={(event) => {
                                const [date, time] = event.target.value.split("T");
                                patch({ dueDate: date ?? "", dueTime: time ?? form.dueTime });
                            }}
                        />
                    </span>

                    <Dropdown menu={{ items: priorityMenu, onClick: ({ key }) => patch({ priority: key as TaskPriorityKey }) }} trigger={["click"]} overlayStyle={MENU_LAYER} disabled={saving}>
                        <button type="button" className="agent-task__chip" aria-haspopup="menu">
                            <span className="agent-task__chip-label">{t("pages.agent_workspace.task_form.priority")}</span>
                            <span className="agent-task__chip-value">{t(PRIORITY_KEY[form.priority])}</span>
                        </button>
                    </Dropdown>

                    <Dropdown
                        menu={{ items: categoryMenu, onClick: ({ key }) => patch({ categoryId: key === "none" ? null : Number(key) }) }}
                        trigger={["click"]} overlayStyle={MENU_LAYER}
                        disabled={saving}
                    >
                        <button type="button" className="agent-task__chip" aria-haspopup="menu">
                            <span className="agent-task__chip-label">{t("pages.agent_workspace.task_form.category")}</span>
                            <span className="agent-task__chip-value">{category ? td(category.category_name, { source: "en" }) : t("pages.agent_workspace.task_form.none")}</span>
                        </button>
                    </Dropdown>

                    {form.links.length > 0 ? (
                        <span className="agent-task__chip agent-task__chip--static">
                            <Icon name="paperclip" size={13} />
                            <span className="agent-task__chip-value">{t("pages.agent_workspace.task_form.linked", { count: form.links.length })}</span>
                        </span>
                    ) : null}
                </div>

                {form.links.length > 0 ? (
                    <section className="agent-task__section">
                        <h3 className="agent-task__cap">{t("pages.agent_workspace.task_form.linked_items")}</h3>
                        <div className="agent-task__links">
                            {form.links.map((link) => (
                                <span key={`${link.type}-${link.id}`} className="agent-task__link">
                                    <span className={`agent-task__link-mark agent-task__link-mark--${link.type}`} aria-hidden="true" />
                                    {t(`pages.agent_workspace.task_form.link_${link.type === "deal" ? "deal" : link.type === "lead" ? "lead" : "other"}`, { name: link.name })}
                                </span>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="agent-task__section">
                    <h3 className="agent-task__cap">{t("pages.agent_workspace.task_form.checklist")}</h3>
                    {form.checklist.length > 0 ? (
                        <ul className="agent-task__checklist">
                            {form.checklist.map((item, index) => (
                                <li key={`${index}-${item}`}>
                                    <span className="agent-task__box" aria-hidden="true" />
                                    <span className="agent-task__item">{item}</span>
                                    <button
                                        type="button"
                                        className="agent-task__remove"
                                        aria-label={t("pages.agent_workspace.task_form.remove_item", { item })}
                                        onClick={() => patch({ checklist: form.checklist.filter((_, i) => i !== index) })}
                                    >
                                        <Icon name="x" size={12} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {draftItem !== null ? (
                        <input
                            ref={draftRef}
                            className="agent-task__draft"
                            autoFocus
                            value={draftItem}
                            placeholder={t("pages.agent_workspace.task_form.item_placeholder")}
                            aria-label={t("pages.agent_workspace.task_form.item_placeholder")}
                            onChange={(event) => setDraftItem(event.target.value)}
                            // Keep the row on blur: removing it would move the chips under a click in flight.
                            onBlur={commitDraft}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitDraft();
                                }
                                if (event.key === "Escape") {
                                    event.stopPropagation();
                                    setDraftItem(null);
                                }
                            }}
                        />
                    ) : null}
                    <Button
                        size="sm"
                        className="agent-btn-soft agent-task__add"
                        onClick={() => (draftItem === null ? setDraftItem("") : draftRef.current?.focus())}
                        disabled={saving}
                    >
                        <Icon name="plus" size={12} />
                        {t("pages.agent_workspace.task_form.add_item")}
                    </Button>
                </section>

                <section className="agent-task__section">
                    <h3 className="agent-task__cap">{t("pages.agent_workspace.task_form.attachments")}</h3>
                    {form.files.length > 0 ? (
                        <ul className="agent-task__files">
                            {form.files.map((file, index) => (
                                <li key={`${index}-${file.name}`}>
                                    <Icon name="file-text" size={14} />
                                    <span className="agent-task__item">{file.name}</span>
                                    <button
                                        type="button"
                                        className="agent-task__remove"
                                        aria-label={t("pages.agent_workspace.task_form.remove_item", { item: file.name })}
                                        onClick={() => patch({ files: form.files.filter((_, i) => i !== index) })}
                                    >
                                        <Icon name="x" size={12} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <button type="button" className="agent-task__drop" onClick={() => fileRef.current?.click()} disabled={saving}>
                        {form.files.length > 0 ? t("pages.agent_workspace.task_form.add_files") : t("pages.agent_workspace.task_form.no_files")}
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const picked = Array.from(event.target.files ?? []);
                            if (picked.length) patch({ files: [...form.files, ...picked] });
                            event.target.value = "";
                        }}
                    />
                </section>
            </div>
        </AgentDialog>
    );
}
