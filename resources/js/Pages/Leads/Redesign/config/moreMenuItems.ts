export type MoreMenuActionId =
    | "answers"
    | "edit"
    | "reassign"
    | "task"
    | "deal"
    | "note"
    | "delete";

export type MoreMenuItem =
    | { id: MoreMenuActionId; label: string; danger?: boolean }
    | { id: "sep" };

/** Literal MoreMenu item list from the lead-v2 mockup. */
export const MORE_MENU_ITEMS: MoreMenuItem[] = [
    { id: "answers", label: "View qualification answers" },
    { id: "edit", label: "Edit lead details" },
    { id: "reassign", label: "Reassign owner" },
    { id: "task", label: "Add task" },
    { id: "deal", label: "Create deal" },
    { id: "note", label: "Add note" },
    { id: "sep" },
    { id: "delete", label: "Delete lead", danger: true },
];
