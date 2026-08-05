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
import { useApiQuery } from "@/lib/api/client";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadContactFile } from "@/Types/api/file";
import type { Lead } from "@/Types/api/leads";
import type { LeadNote } from "@/Types/api/lead-note";
import type { Task } from "@/Types/api/tasks";

interface EntityResponse<T> {
    status: string;
    data: T;
}

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
    files: LeadContactFile[];
    setFiles: Dispatch<SetStateAction<LeadContactFile[]>>;
    filesLoading: boolean;
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
 * Holds the lead + notes/tasks/meetings/deals/files as local React state so
 * mutations patch from a REST response instead of an Inertia reload.
 *
 * Deferred props seed once on first resolve; later arrivals cannot clobber
 * in-flight edits. `deals` is synchronous and tracks the prop directly.
 * Files are fetched via `lead-contact.files.index` (same pattern as deal files).
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
    const [files, setFiles] = useState<LeadContactFile[]>([]);

    const filesQuery = useApiQuery<EntityResponse<LeadContactFile[]>>({
        path: route("lead-contact.files.index", lead.id),
        options: { staleTime: 30_000 },
    });

    const seeded = useRef({
        notes: notesProp !== undefined,
        tasks: tasksProp !== undefined,
        leadFollowUps: leadFollowUpsProp !== undefined,
        files: false,
        filesLeadId: lead.id,
    });

    // When navigating to another lead without remounting, re-seed files.
    useEffect(() => {
        if (seeded.current.filesLeadId === lead.id) return;
        seeded.current.filesLeadId = lead.id;
        seeded.current.files = false;
        setFiles([]);
    }, [lead.id]);

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
        setLeadFollowUps(leadFollowUpsProp);
        seeded.current.leadFollowUps = true;
    }, [leadFollowUpsProp]);

    useEffect(() => {
        if (dealsProp === undefined) return;
        setDeals((prev) => {
            if (prev.length === 0) return dealsProp;

            const localById = new Map(prev.map((deal) => [deal.id, deal]));
            return dealsProp.map((deal) => {
                const local = localById.get(deal.id);
                if (!local) return deal;

                const propLegs = deal.lead_flight_itineraries;
                const localLegs = local.lead_flight_itineraries;
                if (
                    (propLegs === undefined || propLegs.length === 0) &&
                    localLegs &&
                    localLegs.length > 0
                ) {
                    return { ...deal, lead_flight_itineraries: localLegs };
                }

                return deal;
            });
        });
    }, [dealsProp]);

    useEffect(() => {
        if (!seeded.current.files && filesQuery.data?.data) {
            setFiles(filesQuery.data.data);
            seeded.current.files = true;
        }
    }, [filesQuery.data]);

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
            files,
            setFiles,
            filesLoading: filesQuery.isLoading,
            addNote,
            addTask,
            addLeadFollowUp,
        }),
        [
            addLeadFollowUp,
            addNote,
            addTask,
            deals,
            files,
            filesQuery.isLoading,
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
