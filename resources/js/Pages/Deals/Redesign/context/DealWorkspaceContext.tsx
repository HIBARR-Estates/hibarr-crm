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
import useTranslation from "@/Hooks/useTranslation";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import type { Deal } from "@/Types/api/deals";
import {
    PAYMENT_INVALIDATION_FLAG,
    PAYMENT_INVALIDATION_REQUIRED,
    type DealPaymentRequest,
    type DealPaymentState,
} from "@/Types/api/deal-payment";
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
    /** The deal's current (non-failed, non-invalidated) payment request. */
    paymentRequest: DealPaymentRequest | null;
    /** Every request the deal has had, newest first — invalidated ones included. */
    paymentRequests: DealPaymentRequest[];
    /** Patch one request into local state from a mutation response. */
    upsertPaymentRequest: (request: DealPaymentRequest) => void;
    paymentRequestLoading: boolean;
    refreshPaymentRequest: () => Promise<void>;
    /**
     * Runs a value-changing write. When the deal has an unpaid payment
     * request, the user is warned first and `call` receives the flag that
     * lets the server invalidate it; the request list is refreshed after.
     * Rejects with PaymentInvalidationCancelled if the user backs out.
     */
    withPaymentInvalidation: <T>(
        call: (flags: Record<string, boolean>) => Promise<T>,
    ) => Promise<T>;
}

/** Thrown by withPaymentInvalidation when the user declines the warning. */
export class PaymentInvalidationCancelled extends Error {
    constructor() {
        super("payment_invalidation_cancelled");
        this.name = "PaymentInvalidationCancelled";
    }
}

/**
 * The 409 value-writing endpoints answer with while an unpaid request exists
 * and the flag wasn't sent — covers both raw axios errors and the response
 * body useApiMutate rethrows.
 */
function isInvalidationRequired(error: unknown): boolean {
    const err = error as {
        code?: string;
        response?: { status?: number; data?: { code?: string } };
    };
    return (
        err?.response?.data?.code === PAYMENT_INVALIDATION_REQUIRED
        || err?.code === PAYMENT_INVALIDATION_REQUIRED
    );
}

const EMPTY_PAYMENT_STATE: DealPaymentState = { active: null, requests: [] };

/** The server returns { active, requests }; tolerate a bare request for safety. */
function toPaymentState(data: unknown): DealPaymentState {
    if (!data) return EMPTY_PAYMENT_STATE;
    const state = data as Partial<DealPaymentState>;
    if (Array.isArray(state.requests)) {
        return { active: state.active ?? null, requests: state.requests };
    }
    const single = data as DealPaymentRequest;
    return { active: single, requests: [single] };
}

const DealWorkspaceContext = createContext<DealWorkspaceValue | null>(null);

export { DealWorkspaceContext };

interface DealWorkspaceProviderProps {
    deal: Deal;
    children: ReactNode;
    paymentEnabled?: boolean;
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
    paymentEnabled = false,
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
    const paymentRequestQuery = useApiQuery<EntityResponse<DealPaymentState | null>>({
        path: route("deals.payment-request.show", deal.id),
        options: { staleTime: 30_000, enabled: paymentEnabled },
    });

    const { t } = useTranslation();
    const [notes, setNotes] = useState<Note[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [dealFollowUps, setDealFollowUps] = useState<DealFollowup[]>([]);
    const [files, setFiles] = useState<DealFile[]>([]);
    const [paymentState, setPaymentState] = useState<DealPaymentState>(EMPTY_PAYMENT_STATE);
    // Resolver for the one invalidation warning that can be open at a time.
    const [invalidationPrompt, setInvalidationPrompt] = useState<
        ((accepted: boolean) => void) | null
    >(null);

    // Seed local state the first time each query resolves; later background
    // refetches (e.g. on window refocus) must not clobber in-progress
    // mutations, so this only fires once per entity.
    const seeded = useRef({
        notes: false,
        tasks: false,
        dealFollowUps: false,
        files: false,
        paymentRequest: false,
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
            paymentRequest: false,
            dealId: deal.id,
        };
        setNotes([]);
        setTasks([]);
        setDealFollowUps([]);
        setFiles([]);
        setPaymentState(EMPTY_PAYMENT_STATE);
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

    useEffect(() => {
        if (!paymentEnabled || seeded.current.paymentRequest) {
            return;
        }
        if (paymentRequestQuery.data === undefined) {
            return;
        }
        setPaymentState(toPaymentState(paymentRequestQuery.data.data));
        seeded.current.paymentRequest = true;
    }, [paymentEnabled, paymentRequestQuery.data]);

    const refreshPaymentRequest = useCallback(async () => {
        if (!paymentEnabled) return;
        const result = await paymentRequestQuery.refetch();
        if (result.data?.data !== undefined) {
            setPaymentState(toPaymentState(result.data.data));
        }
    }, [paymentEnabled, paymentRequestQuery]);

    const upsertPaymentRequest = useCallback((request: DealPaymentRequest) => {
        setPaymentState((prev) => {
            const exists = prev.requests.some((r) => r.id === request.id);
            const requests = exists
                ? prev.requests.map((r) => (r.id === request.id ? request : r))
                : [request, ...prev.requests];
            const isActive = request.ui_state !== "failed" && request.ui_state !== "invalidated";
            const active = isActive
                ? request
                : prev.active?.id === request.id
                  ? null
                  : prev.active;
            return { active, requests };
        });
    }, []);

    const confirmPaymentInvalidation = useCallback(
        () =>
            new Promise<boolean>((resolve) => {
                // Wrapped: a bare function passed to a state setter is
                // treated as an updater, not stored.
                setInvalidationPrompt(() => resolve);
            }),
        [],
    );

    const closeInvalidationPrompt = useCallback(
        (accepted: boolean) => {
            invalidationPrompt?.(accepted);
            setInvalidationPrompt(null);
        },
        [invalidationPrompt],
    );

    const withPaymentInvalidation = useCallback(
        async <T,>(call: (flags: Record<string, boolean>) => Promise<T>): Promise<T> => {
            const accepted = { [PAYMENT_INVALIDATION_FLAG]: true };

            // Known unpaid request: warn before sending anything, so the
            // server's 409 (and any toast a generic mutation helper shows for
            // it) never happens on the common path.
            if (paymentState.active?.ui_state === "pending_payment") {
                if (!(await confirmPaymentInvalidation())) {
                    throw new PaymentInvalidationCancelled();
                }
                const result = await call(accepted);
                void refreshPaymentRequest();
                return result;
            }

            try {
                return await call({});
            } catch (error) {
                // Local state was stale (request created elsewhere) — the
                // server caught it; warn now and retry once.
                if (!isInvalidationRequired(error)) throw error;
                if (!(await confirmPaymentInvalidation())) {
                    void refreshPaymentRequest();
                    throw new PaymentInvalidationCancelled();
                }
                const result = await call(accepted);
                void refreshPaymentRequest();
                return result;
            }
        },
        [confirmPaymentInvalidation, paymentState.active, refreshPaymentRequest],
    );

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
            paymentRequest: paymentState.active,
            paymentRequests: paymentState.requests,
            upsertPaymentRequest,
            paymentRequestLoading: paymentEnabled && paymentRequestQuery.isLoading,
            refreshPaymentRequest,
            withPaymentInvalidation,
        }),
        [
            deal,
            notes,
            tasks,
            dealFollowUps,
            files,
            paymentState,
            paymentEnabled,
            notesQuery.isLoading,
            tasksQuery.isLoading,
            dealFollowUpsQuery.isLoading,
            filesQuery.isLoading,
            paymentRequestQuery.isLoading,
            refreshPaymentRequest,
            upsertPaymentRequest,
            withPaymentInvalidation,
        ],
    );

    return (
        <DealWorkspaceContext.Provider value={value}>
            {children}
            <ConfirmDialog
                open={invalidationPrompt !== null}
                title={t("pages.deals.payment_request.invalidate_title")}
                message={t("pages.deals.payment_request.invalidate_message")}
                confirmLabel={t("pages.deals.payment_request.invalidate_confirm")}
                cancelLabel={t("pages.deals.payment_request.cancel")}
                danger
                // Above the value editor and other redesign modals (1300).
                zIndex={1400}
                onConfirm={() => closeInvalidationPrompt(true)}
                onCancel={() => closeInvalidationPrompt(false)}
            />
        </DealWorkspaceContext.Provider>
    );
}

const runWithoutGuard = <T,>(call: (flags: Record<string, boolean>) => Promise<T>) =>
    call({});

/**
 * withPaymentInvalidation for components that can also render outside the
 * deal page's provider (shared Features/ modals). Without a provider the
 * write is sent as-is and the server's own refusal is what the user sees.
 */
export function usePaymentInvalidationGuard(): DealWorkspaceValue["withPaymentInvalidation"] {
    return useContext(DealWorkspaceContext)?.withPaymentInvalidation ?? runWithoutGuard;
}

export function useDealWorkspace() {
    const ctx = useContext(DealWorkspaceContext);
    if (!ctx) {
        throw new Error("useDealWorkspace must be used within a DealWorkspaceProvider");
    }
    return ctx;
}
