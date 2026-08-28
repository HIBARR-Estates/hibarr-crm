import { useState } from "react";
import type { TasksViewMode } from "../components/TasksHeader";

function getInitialView(): TasksViewMode {
    if (typeof window === "undefined") return "list";
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "board" ? "board" : "list";
}

/**
 * List/board toggle, seeded from the URL like Deal/Lead's tab navigation.
 * Writing `view` back to the URL as it changes is handled centrally by
 * useTasksUrlSync (alongside the create/edit/detail popup state) rather
 * than here, so there's exactly one place computing the address bar —
 * two independent writers racing to replaceState() the same URL is a
 * lost-update bug waiting to happen.
 */
export default function useTasksViewNavigation() {
    const [view, setView] = useState<TasksViewMode>(() => getInitialView());
    return { view, setView };
}
