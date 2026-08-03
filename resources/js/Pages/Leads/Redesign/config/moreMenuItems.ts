export type MoreMenuActionId =
    | "answers"
    | "task"
    | "deal"
    | "note"
    | "find_duplicates"
    | "delete";

export type MoreMenuItem =
    | { id: MoreMenuActionId; label: string; danger?: boolean }
    | { id: "sep" };

/** Lead ⋯ menu — reassignment lives on LeadOwnerCard, not here. */
export const MORE_MENU_ITEMS: MoreMenuItem[] = [
    { id: "answers", label: "View qualification answers" },
    { id: "task", label: "Add task" },
    { id: "deal", label: "Create deal" },
    { id: "note", label: "Add note" },
    { id: "find_duplicates", label: "Find duplicates" },
    { id: "sep" },
    { id: "delete", label: "Delete lead", danger: true },
];
