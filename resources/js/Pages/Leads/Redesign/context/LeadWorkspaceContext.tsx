import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Lead } from "@/Types/api/leads";
import type { LeadNote } from "@/Types/api/lead-note";
import type { Task } from "@/Types/api/tasks";

interface LeadWorkspaceValue {
    lead: Lead;
    setLead: Dispatch<SetStateAction<Lead>>;
    notes: LeadNote[];
    setNotes: Dispatch<SetStateAction<LeadNote[]>>;
    notesLoading: boolean;
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
    tasksLoading: boolean;
    leadFollowUps: DealFollowup[];
    setLeadFollowUps: Dispatch<SetStateAction<DealFollowup[]>>;
    leadFollowUpsLoading: boolean;
    deals: Deal[];
    setDeals: Dispatch<SetStateAction<Deal[]>>;
    addNote: (note: LeadNote) => void;
    addTask: (task: Task) => void;
    addLeadFollowUp: (followUp: DealFollowup) => void;
}

const LeadWorkspaceContext = createContext<LeadWorkspaceValue | null>(null);

interface LeadWorkspaceProviderProps {
    lead: Lead;
    notes?: LeadNote[];
    tasks?: Task[];
    leadFollowUps?: DealFollowup[];
    deals?: Deal[];
    children: ReactNode;
}

/**
 * Holds the lead + notes/tasks/meetings/deals as local React state so
 * mutations patch from a REST response instead of an Inertia reload.
 *
 * Deferred props seed once on first resolve; later arrivals cannot clobber
 * in-flight edits. `deals` is synchronous and tracks the prop directly.
 */
export function LeadWorkspaceProvider({
    lead: initialLead,
    notes: notesProp,
    tasks: tasksProp,
    leadFollowUps: leadFollowUpsProp,
    deals: dealsProp,
    children,
}: LeadWorkspaceProviderProps) {
    const [lead, setLead] = useState<Lead>(initialLead);
    useEffect(() => {
        setLead(initialLead);
    }, [initialLead]);

    const [notes, setNotes] = useState<LeadNote[]>(() => notesProp ?? []);
    const [tasks, setTasks] = useState<Task[]>(() => tasksProp ?? []);
    const [leadFollowUps, setLeadFollowUps] = useState<DealFollowup[]>(
        () => leadFollowUpsProp ?? [],
    );
    const [deals, setDeals] = useState<Deal[]>(() => dealsProp ?? []);

    const seeded = useRef({
        notes: notesProp !== undefined,
        tasks: tasksProp !== undefined,
        leadFollowUps: leadFollowUpsProp !== undefined,
    });

    useEffect(() => {
        if (!seeded.current.notes && notesProp !== undefined) {
            setNotes(notesProp);
            seeded.current.notes = true;
        }
    }, [notesProp]);

    useEffect(() => {
        if (!seeded.current.tasks && tasksProp !== undefined) {
            setTasks(tasksProp);
            seeded.current.tasks = true;
        }
    }, [tasksProp]);

    useEffect(() => {
        if (leadFollowUpsProp === undefined) return;
        // Meetings create/update only return success (no row payload), so the
        // tabs call `router.reload({ only: ["leadFollowUps"] })`. Re-sync the
        // prop on every arrival — unlike notes/tasks, there is no local edit
        // path that would be clobbered.
        setLeadFollowUps(leadFollowUpsProp);
        seeded.current.leadFollowUps = true;
    }, [leadFollowUpsProp]);

    useEffect(() => {
        if (dealsProp !== undefined) setDeals(dealsProp);
    }, [dealsProp]);

    const addNote = useCallback((note: LeadNote) => {
        setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
    }, []);

    const addTask = useCallback((task: Task) => {
        setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
    }, []);

    const addLeadFollowUp = useCallback((followUp: DealFollowup) => {
        setLeadFollowUps((prev) => [
            followUp,
            ...prev.filter((f) => f.id !== followUp.id),
        ]);
    }, []);

    const value = useMemo<LeadWorkspaceValue>(
        () => ({
            lead,
            setLead,
            notes,
            setNotes,
            notesLoading: notesProp === undefined,
            tasks,
            setTasks,
            tasksLoading: tasksProp === undefined,
            leadFollowUps,
            setLeadFollowUps,
            leadFollowUpsLoading: leadFollowUpsProp === undefined,
            deals,
            setDeals,
            addNote,
            addTask,
            addLeadFollowUp,
        }),
        [
            addLeadFollowUp,
            addNote,
            addTask,
            deals,
            lead,
            leadFollowUps,
            leadFollowUpsProp,
            notes,
            notesProp,
            tasks,
            tasksProp,
        ],
    );

    return (
        <LeadWorkspaceContext.Provider value={value}>
            {children}
        </LeadWorkspaceContext.Provider>
    );
}

export function useLeadWorkspace() {
    const ctx = useContext(LeadWorkspaceContext);
    if (!ctx) {
        throw new Error(
            "useLeadWorkspace must be used within a LeadWorkspaceProvider",
        );
    }
    return ctx;
}
