import { useEffect, useRef } from "react";
import { router } from "@inertiajs/react";
import type { TasksViewMode } from "../components/TasksHeader";

interface TasksUrlState {
    view: TasksViewMode;
    addOpen: boolean;
    editingTaskId: number | null;
    selectedTaskId: number | null;
}

/** Edit sits visually on top of the detail popup when both happen to be open; create sits on top of everything. */
function actionPath(state: TasksUrlState): string {
    if (state.addOpen) return route("tasks.create");
    if (state.editingTaskId) return route("tasks.edit", state.editingTaskId);
    if (state.selectedTaskId) return route("tasks.show", state.selectedTaskId);
    return route("tasks.index");
}

function syncUrl(state: TasksUrlState) {
    if (typeof window === "undefined") return;
    const target = new URL(actionPath(state), window.location.origin);
    // Carry over whatever's already in the query string (filters, search,
    // sort, page, ...) onto the new path instead of dropping it.
    target.search = window.location.search;
    if (state.view === "board") {
        target.searchParams.set("view", "board");
    } else {
        target.searchParams.delete("view");
    }
    window.history.replaceState({}, "", target.toString());
}

/**
 * Keeps the address bar showing which popup is open (create/edit/detail)
 * plus the list/board toggle — /tasks, /tasks/create, /tasks/{id} or
 * /tasks/{id}/edit, always with the current filters still in the query
 * string. The single writer for all of this (see useTasksViewNavigation's
 * comment) so nothing races itself.
 *
 * Also re-stamps after every Inertia request finishes: this page ships
 * several Inertia::defer groups, and Inertia unconditionally rewrites the
 * address bar to whatever URL was current when a deferred request was
 * dispatched once it resolves — silently reverting a popup that opened (or
 * a filter that changed) while one was in flight, unless re-applied here.
 */
export default function useTasksUrlSync(state: TasksUrlState): void {
    const stateRef = useRef(state);
    // Assigned in an effect (commit phase), not during render — a render
    // that gets thrown away (e.g. React discarding an in-progress render)
    // must not leave the ref pointing at state that was never actually
    // committed, since router.on("finish") below reads it well after render.
    useEffect(() => {
        stateRef.current = state;
    });

    useEffect(() => {
        syncUrl(stateRef.current);
    }, [state.view, state.addOpen, state.editingTaskId, state.selectedTaskId]);

    useEffect(() => {
        return router.on("finish", () => syncUrl(stateRef.current));
    }, []);
}
