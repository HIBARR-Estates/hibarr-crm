import {
    createContext,
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
import type { DealFile } from "@/Types/api/file";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Task } from "@/Types/api/tasks";

interface EntityResponse<T> {
    status: string;
    data: T;
}

interface DealWorkspaceValue {
    deal: Deal;
    setDeal: Dispatch<SetStateAction<Deal>>;
    notes: Note[];
    setNotes: Dispatch<SetStateAction<Note[]>>;
    notesLoading: boolean;
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
    tasksLoading: boolean;
    dealFollowUps: DealFollowup[];
    setDealFollowUps: Dispatch<SetStateAction<DealFollowup[]>>;
    dealFollowUpsLoading: boolean;
    files: DealFile[];
    setFiles: Dispatch<SetStateAction<DealFile[]>>;
    filesLoading: boolean;
}

const DealWorkspaceContext = createContext<DealWorkspaceValue | null>(null);

interface DealWorkspaceProviderProps {
    deal: Deal;
    children: ReactNode;
}

/**
 * Holds the deal + its notes/tasks/meetings/files as local React state so
 * mutations can patch them directly from a REST response instead of an
 * Inertia reload. Each entity is fetched independently via its own JSON
 * endpoint (deals.notes.index / deals.tasks.index / deals.meetings.index /
 * deals.files.index) exactly like offers/recommendations already do, instead
 * of riding the page's Inertia deferred-prop bundle — one slow/broken fetch
 * can no longer stall the others. Each query's data seeds local state once;
 * after that, local state is the source of truth and mutations (not
 * background refetches) keep it current.
 */
export function DealWorkspaceProvider({
    deal: initialDeal,
    children,
}: DealWorkspaceProviderProps) {
    const [deal, setDeal] = useState<Deal>(initialDeal);
    useEffect(() => {
        // Sync from props when the deal identity changes, or when Inertia
        // refreshes the same deal. Never wipe local itinerary legs with an
        // undefined/missing relation (Lead page deals often omit them until
        // patched, and Lead ItineraryTab re-feeds a new object after sync).
        setDeal((prev) => {
            if (prev.id !== initialDeal.id) {
                return initialDeal;
            }

            const nextLegs = initialDeal.lead_flight_itineraries;
            const prevLegs = prev.lead_flight_itineraries;
            const legs = nextLegs !== undefined ? nextLegs : prevLegs;

            return {
                ...initialDeal,
                lead_flight_itineraries: legs,
            };
        });
    }, [initialDeal]);

    const notesQuery = useApiQuery<EntityResponse<Note[]>>({
        path: route("deals.notes.index", deal.id),
        options: { staleTime: 30_000 },
    });
    const tasksQuery = useApiQuery<EntityResponse<Task[]>>({
        path: route("deals.tasks.index", deal.id),
        options: { staleTime: 30_000 },
    });
    const dealFollowUpsQuery = useApiQuery<EntityResponse<DealFollowup[]>>({
        path: route("deals.meetings.index", deal.id),
        options: { staleTime: 30_000 },
    });
    const filesQuery = useApiQuery<EntityResponse<DealFile[]>>({
        path: route("deals.files.index", deal.id),
        options: { staleTime: 30_000 },
    });

    const [notes, setNotes] = useState<Note[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [dealFollowUps, setDealFollowUps] = useState<DealFollowup[]>([]);
    const [files, setFiles] = useState<DealFile[]>([]);

    // Seed local state the first time each query resolves; later background
    // refetches (e.g. on window refocus) must not clobber in-progress
    // mutations, so this only fires once per entity.
    const seeded = useRef({
        notes: false,
        tasks: false,
        dealFollowUps: false,
        files: false,
        dealId: deal.id,
    });

    // Re-seed when navigating to another deal without remounting the provider.
    useEffect(() => {
        if (seeded.current.dealId === deal.id) return;
        seeded.current = {
            notes: false,
            tasks: false,
            dealFollowUps: false,
            files: false,
            dealId: deal.id,
        };
        setNotes([]);
        setTasks([]);
        setDealFollowUps([]);
        setFiles([]);
    }, [deal.id]);

    useEffect(() => {
        if (!seeded.current.notes && notesQuery.data?.data) {
            setNotes(notesQuery.data.data);
            seeded.current.notes = true;
        }
    }, [notesQuery.data]);

    useEffect(() => {
        if (!seeded.current.tasks && tasksQuery.data?.data) {
            setTasks(tasksQuery.data.data);
            seeded.current.tasks = true;
        }
    }, [tasksQuery.data]);

    useEffect(() => {
        if (!seeded.current.dealFollowUps && dealFollowUpsQuery.data?.data) {
            setDealFollowUps(dealFollowUpsQuery.data.data);
            seeded.current.dealFollowUps = true;
        }
    }, [dealFollowUpsQuery.data]);

    useEffect(() => {
        // Seed once per deal. Merge any files already patched in by an upload
        // that raced ahead of this first fetch, so they don't disappear.
        if (seeded.current.files || filesQuery.data?.data === undefined) {
            return;
        }
        const serverFiles = filesQuery.data.data;
        setFiles((prev) => {
            if (prev.length === 0) return serverFiles;
            const serverIds = new Set(serverFiles.map((file) => file.id));
            const localOnly = prev.filter((file) => !serverIds.has(file.id));
            return [...localOnly, ...serverFiles];
        });
        seeded.current.files = true;
    }, [filesQuery.data]);

    const value = useMemo<DealWorkspaceValue>(
        () => ({
            deal,
            setDeal,
            notes,
            setNotes,
            notesLoading: notesQuery.isLoading,
            tasks,
            setTasks,
            tasksLoading: tasksQuery.isLoading,
            dealFollowUps,
            setDealFollowUps,
            dealFollowUpsLoading: dealFollowUpsQuery.isLoading,
            files,
            setFiles,
            filesLoading: filesQuery.isLoading,
        }),
        [
            deal,
            notes,
            tasks,
            dealFollowUps,
            files,
            notesQuery.isLoading,
            tasksQuery.isLoading,
            dealFollowUpsQuery.isLoading,
            filesQuery.isLoading,
        ],
    );

    return (
        <DealWorkspaceContext.Provider value={value}>
            {children}
        </DealWorkspaceContext.Provider>
    );
}

export function useDealWorkspace() {
    const ctx = useContext(DealWorkspaceContext);
    if (!ctx) {
        throw new Error("useDealWorkspace must be used within a DealWorkspaceProvider");
    }
    return ctx;
}
