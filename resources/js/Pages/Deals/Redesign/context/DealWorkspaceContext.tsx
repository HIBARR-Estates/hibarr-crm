import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Task } from "@/Types/api/tasks";

interface DealWorkspaceValue {
    deal: Deal;
    setDeal: Dispatch<SetStateAction<Deal>>;
    notes: Note[];
    setNotes: Dispatch<SetStateAction<Note[]>>;
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
    dealFollowUps: DealFollowup[];
    setDealFollowUps: Dispatch<SetStateAction<DealFollowup[]>>;
    files: DealFile[];
    setFiles: Dispatch<SetStateAction<DealFile[]>>;
}

const DealWorkspaceContext = createContext<DealWorkspaceValue | null>(null);

interface DealWorkspaceProviderProps {
    deal: Deal;
    notes?: Note[];
    tasks?: Task[];
    dealFollowUps?: DealFollowup[];
    files?: DealFile[];
    children: ReactNode;
}

/**
 * Holds the deal + its deferred relations as local React state so mutations
 * can patch them directly from a REST response instead of an Inertia reload.
 * Deferred props (notes/tasks/dealFollowUps/files) arrive as `undefined` and
 * are copied into local state the moment Inertia resolves them; after that,
 * local state is the source of truth and no longer re-synced from props.
 */
export function DealWorkspaceProvider({
    deal: initialDeal,
    notes: initialNotes,
    tasks: initialTasks,
    dealFollowUps: initialDealFollowUps,
    files: initialFiles,
    children,
}: DealWorkspaceProviderProps) {
    const [deal, setDeal] = useState<Deal>(initialDeal);
    const [notes, setNotes] = useState<Note[]>(initialNotes ?? []);
    const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
    const [dealFollowUps, setDealFollowUps] = useState<DealFollowup[]>(
        initialDealFollowUps ?? [],
    );
    const [files, setFiles] = useState<DealFile[]>(initialFiles ?? []);

    useEffect(() => {
        setDeal(initialDeal);
    }, [initialDeal]);

    useEffect(() => {
        if (initialNotes !== undefined) setNotes(initialNotes);
    }, [initialNotes]);

    useEffect(() => {
        if (initialTasks !== undefined) setTasks(initialTasks);
    }, [initialTasks]);

    useEffect(() => {
        if (initialDealFollowUps !== undefined) setDealFollowUps(initialDealFollowUps);
    }, [initialDealFollowUps]);

    useEffect(() => {
        if (initialFiles !== undefined) setFiles(initialFiles);
    }, [initialFiles]);

    const value = useMemo<DealWorkspaceValue>(
        () => ({
            deal,
            setDeal,
            notes,
            setNotes,
            tasks,
            setTasks,
            dealFollowUps,
            setDealFollowUps,
            files,
            setFiles,
        }),
        [deal, notes, tasks, dealFollowUps, files],
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
