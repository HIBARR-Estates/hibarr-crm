import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    readTaskFormDraft,
    writeTaskFormDraft,
} from "../hooks/tasksWorkspaceUiStore";
import { TASK_ICON, type RecordTypeKey } from "../config/taskDesignTokens";
import {
    emptyTaskForm,
    type RecordPool,
    type TaskFormValues,
    type TaskLinkRef,
} from "../adapters/taskFormValues";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import TaskModalShell from "./primitives/TaskModalShell";
import TaskFormPills from "./form/TaskFormPills";
import TaskFormLinksPopover from "./form/TaskFormLinksPopover";
import TaskFormLinkChips from "./form/TaskFormLinkChips";
import TaskFormChecklist from "./form/TaskFormChecklist";
import TaskFormAttachments from "./form/TaskFormAttachments";

export type { RecordPool, TaskFormValues, TaskLinkRef };

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UserOption {
    id: number;
    name: string;
}

interface TaskFormModalProps {
    open: boolean;
    mode: "create" | "edit";
    onClose: () => void;
    onSubmit: (values: TaskFormValues) => void;
    saving: boolean;
    errors: string[];
    initial?: Partial<TaskFormValues>;
    categories: CategoryOption[];
    users?: UserOption[];
    columns: TaskboardColumn[];
    records: RecordPool;
    lockedLinks?: TaskLinkRef[];
    draftKey?: string;
}

/**
 * Create/edit task dialog: a borderless title + description, then one pill
 * per field that opens its editor in an anchored popover. Checklist and
 * attachments sit inline below.
 */
export default function TaskFormModal({
    open,
    mode,
    onClose,
    onSubmit,
    saving,
    errors,
    initial,
    categories,
    users = [],
    columns,
    records,
    lockedLinks = [],
    draftKey,
}: TaskFormModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;

    const [form, setForm] = useState<TaskFormValues>(emptyTaskForm);
    const [formHydrated, setFormHydrated] = useState(false);
    const [assigneeOpen, setAssigneeOpen] = useState(false);
    const [linksOpen, setLinksOpen] = useState(false);
    const [recordType, setRecordType] = useState<RecordTypeKey>("lead");
    const [recordQuery, setRecordQuery] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const assigneeTriggerRef = useRef<HTMLButtonElement>(null);
    const linksTriggerRef = useRef<HTMLButtonElement>(null);
    const assigneeFloat = useFloatingMenuPosition(
        assigneeOpen,
        assigneeTriggerRef,
        { zIndex: 60, maxHeight: 400 },
    );
    const linksFloat = useFloatingMenuPosition(linksOpen, linksTriggerRef, {
        zIndex: 60,
        maxHeight: 420,
    });
    const assigneePosition = clampMenuLeft(assigneeFloat, 300, panelRef);
    const linksPosition = clampMenuLeft(linksFloat, 380, panelRef);

    const patchForm = (patch: Partial<TaskFormValues>) =>
        setForm((current) => ({ ...current, ...patch }));

    useEffect(() => {
        if (!open) {
            setFormHydrated(false);
            if (draftKey) writeTaskFormDraft(draftKey, null);
            return;
        }
        if (formHydrated) return;

        const saved = draftKey ? readTaskFormDraft(draftKey) : undefined;
        if (saved) {
            setForm(saved);
            setAssigneeOpen(false);
            setLinksOpen(false);
            setRecordQuery("");
            setFormHydrated(true);
            return;
        }

        const seeded = { ...emptyTaskForm(), ...initial };
        const merged = [...seeded.links];
        lockedLinks.forEach((locked) => {
            if (
                !merged.some(
                    (link) =>
                        link.type === locked.type && link.id === locked.id,
                )
            ) {
                merged.push(locked);
            }
        });
        seeded.links = merged;
        seeded.checklist = initial?.checklist ?? [];
        seeded.files = [];
        if (
            mode === "create" &&
            seeded.assignees.length === 0 &&
            currentUserId
        ) {
            seeded.assignees = [currentUserId];
        }
        setForm(seeded);
        setAssigneeOpen(false);
        setLinksOpen(false);
        setRecordQuery("");
        setFormHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, formHydrated]);

    useEffect(() => {
        if (!open || !draftKey || !formHydrated) return;
        writeTaskFormDraft(draftKey, form);
    }, [open, draftKey, form, formHydrated]);

    const isLocked = (link: TaskLinkRef) =>
        lockedLinks.some(
            (locked) => locked.type === link.type && locked.id === link.id,
        );

    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? td("Due date can't be before the start date")
            : null;

    const recordOptions = useMemo(() => {
        const pool = records[recordType] ?? [];
        const query = recordQuery.trim().toLowerCase();
        if (!query) return pool;
        return pool.filter((item) =>
            `${item.name} ${item.meta ?? ""}`.toLowerCase().includes(query),
        );
    }, [records, recordType, recordQuery]);

    const toggleLink = (id: number, name: string) => {
        const candidate: TaskLinkRef = { type: recordType, id, name };
        setForm((current) => {
            const exists = current.links.some(
                (link) => link.type === recordType && link.id === id,
            );
            if (exists) {
                if (isLocked(candidate)) return current;
                return {
                    ...current,
                    links: current.links.filter(
                        (link) => !(link.type === recordType && link.id === id),
                    ),
                };
            }
            return { ...current, links: [...current.links, candidate] };
        });
    };

    const toggleAssignee = (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setLinksOpen(false);
        setAssigneeOpen((open) => !open);
    };

    const toggleLinks = (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAssigneeOpen(false);
        setLinksOpen((open) => !open);
    };

    const assigneeLabel = (() => {
        if (form.assignees.length === 0) return td("Unassigned");
        if (form.assignees.length === 1) {
            const only = users.find((user) => user.id === form.assignees[0]);
            if (only?.name) return only.name;
        }
        return `${form.assignees.length} ${td("assignees")}`;
    })();

    const submit = () => {
        if (dateRangeError || !form.title.trim()) return;
        onSubmit({
            ...form,
            checklist: form.checklist.filter((item) => item.trim() !== ""),
        });
    };

    return (
        <TaskModalShell
            open={open}
            onClose={() => !saving && onClose()}
            onEscape={() => {
                if (assigneeOpen || linksOpen) {
                    setAssigneeOpen(false);
                    setLinksOpen(false);
                    return true;
                }
                return saving;
            }}
            ariaLabel={mode === "create" ? td("Add task") : td("Edit task")}
            zIndex={50}
            panelClassName="tasks-modal-panel flex w-full flex-col overflow-hidden"
            panelStyle={{
                // Fixed size regardless of content — opening the links picker
                // or adding chips/checklist rows must not resize the panel.
                width: "min(640px, 94vw)",
                background: T.WHITE,
                borderRadius: 12,
                boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
            }}
            panelRef={panelRef}
        >
            <div
                className="flex items-center justify-between"
                style={{
                    padding: "14px 24px",
                    borderBottom: `1px solid ${T.BORDER}`,
                }}
            >
                <span style={{ fontSize: 20, fontWeight: 700, color: T.NAVY }}>
                    {mode === "create" ? td("Add task") : td("Edit task")}
                </span>
                <button
                    type="button"
                    aria-label={td("Close")}
                    onClick={() => !saving && onClose()}
                    style={{
                        display: "flex",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    <TaskGlyph
                        d={TASK_ICON.x}
                        size={17}
                        color={T.TEXT_MUTED}
                        strokeWidth={1.5}
                    />
                </button>
            </div>

            <div
                className="flex flex-col gap-3.5 overflow-y-auto"
                style={{
                    padding: "20px 24px 24px",
                    minHeight: 300,
                    maxHeight: "70vh",
                }}
            >
                {errors.length > 0 && (
                    <div className="flex flex-col gap-1">
                        {errors.map((error) => (
                            <p
                                key={error}
                                style={{ fontSize: 14, color: T.RED }}
                            >
                                {td(error)}
                            </p>
                        ))}
                    </div>
                )}

                <input
                    value={form.title}
                    autoFocus
                    onChange={(event) => patchForm({ title: event.target.value })}
                    className="tasks-bare-input"
                    placeholder={td("Task name")}
                    style={{
                        border: "none",
                        padding: 0,
                        fontSize: 23,
                        fontWeight: 700,
                        color: T.TEXT,
                        outline: "none",
                    }}
                />
                <textarea
                    rows={2}
                    value={form.description}
                    onChange={(event) =>
                        patchForm({ description: event.target.value })
                    }
                    className="tasks-bare-input"
                    placeholder={td("Add description")}
                    style={{
                        border: "none",
                        padding: 0,
                        fontSize: 16,
                        color: T.TEXT_MUTED,
                        resize: "vertical",
                        minHeight: 108,
                        outline: "none",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                    }}
                />

                <TaskFormPills
                    form={form}
                    onChange={patchForm}
                    columns={columns}
                    categories={categories}
                    saving={saving}
                    dateRangeError={dateRangeError}
                    assigneeLabel={assigneeLabel}
                    assigneeTriggerRef={assigneeTriggerRef}
                    linksTriggerRef={linksTriggerRef}
                    onToggleAssignee={toggleAssignee}
                    onToggleLinks={toggleLinks}
                />

                {assigneeOpen &&
                    assigneePosition &&
                    createPortal(
                        <>
                            <div
                                role="presentation"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setAssigneeOpen(false);
                                }}
                                style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: 59,
                                }}
                            />
                            <div
                                className="tasks-reveal"
                                onClick={(event) => event.stopPropagation()}
                                style={{
                                    ...assigneePosition,
                                    width: 280,
                                    padding: 12,
                                    background: T.WHITE,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 12,
                                    boxShadow:
                                        "0 16px 36px rgba(22,41,77,0.16)",
                                }}
                            >
                                <AssigneeField
                                    value={form.assignees}
                                    onChange={(assignees) =>
                                        patchForm({ assignees })
                                    }
                                    disabled={saving}
                                />
                            </div>
                        </>,
                        document.body,
                    )}

                <TaskFormLinksPopover
                    open={linksOpen}
                    positionStyle={linksPosition}
                    onClose={() => setLinksOpen(false)}
                    recordType={recordType}
                    onRecordType={(type) => {
                        setRecordType(type);
                        setRecordQuery("");
                    }}
                    recordQuery={recordQuery}
                    onRecordQuery={setRecordQuery}
                    recordOptions={recordOptions}
                    links={form.links}
                    onToggleLink={toggleLink}
                />

                <TaskFormLinkChips
                    links={form.links}
                    isLocked={isLocked}
                    onRemove={(link) =>
                        setForm((current) => ({
                            ...current,
                            links: current.links.filter(
                                (item) =>
                                    !(
                                        item.type === link.type &&
                                        item.id === link.id
                                    ),
                            ),
                        }))
                    }
                />

                <TaskFormChecklist
                    items={form.checklist}
                    onChange={(checklist) => patchForm({ checklist })}
                />

                <TaskFormAttachments
                    files={form.files}
                    saving={saving}
                    onPick={() => fileInputRef.current?.click()}
                    onRemove={(index) =>
                        setForm((current) => ({
                            ...current,
                            files: current.files.filter((_, i) => i !== index),
                        }))
                    }
                />
            </div>

            <div
                className="flex items-center gap-2.5"
                style={{
                    padding: "14px 24px",
                    borderTop: `1px solid ${T.BORDER}`,
                }}
            >
                <button
                    type="button"
                    onClick={() => !saving && onClose()}
                    className="tasks-press"
                    style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        background: T.WHITE,
                        color: T.TEXT_MUTED,
                        border: `1px solid ${T.BORDER}`,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    {td("Cancel")}
                </button>

                <span className="flex-1" />

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                        const picked = Array.from(event.target.files ?? []);
                        if (picked.length) {
                            setForm((current) => ({
                                ...current,
                                files: [...current.files, ...picked],
                            }));
                        }
                        event.target.value = "";
                    }}
                />

                <button
                    type="button"
                    onClick={submit}
                    disabled={saving || !form.title.trim() || !!dateRangeError}
                    className="tasks-press"
                    style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        background: T.BLUE,
                        color: T.WHITE,
                        border: `1px solid ${T.BLUE}`,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity:
                            saving || !form.title.trim() || !!dateRangeError
                                ? 0.6
                                : 1,
                    }}
                >
                    {saving
                        ? td("Saving…")
                        : mode === "create"
                          ? td("Add task")
                          : td("Save changes")}
                </button>
            </div>
        </TaskModalShell>
    );
}

function clampMenuLeft(
    style: ReturnType<typeof useFloatingMenuPosition>,
    menuWidth: number,
    panelRef: RefObject<HTMLDivElement | null>,
) {
    if (!style) return null;
    if (typeof style.left !== "number") return style;
    // Bound by the modal panel's own right edge, not just the viewport —
    // the panel is narrower than the viewport, so a popover can fit on
    // screen while still spilling past the panel it's anchored inside.
    const panelRight = panelRef.current?.getBoundingClientRect().right;
    const maxLeft = Math.min(
        window.innerWidth - menuWidth,
        (panelRight ?? window.innerWidth) - menuWidth,
    );
    return {
        ...style,
        left: Math.max(8, Math.min(style.left, maxLeft)),
    };
}
