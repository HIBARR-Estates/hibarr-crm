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
import { Automation, AutomationCatalog, AutomationStat, EmailTemplate, MetaEvent } from "../types";

interface AutomationWorkspaceValue {
    automations: Automation[];
    setAutomations: Dispatch<SetStateAction<Automation[]>>;
    automationsLoading: boolean;
    automationStats: Record<number, AutomationStat>;
    templates: EmailTemplate[];
    setTemplates: Dispatch<SetStateAction<EmailTemplate[]>>;
    templatesLoading: boolean;
    metaEvents: MetaEvent[];
    setMetaEvents: Dispatch<SetStateAction<MetaEvent[]>>;
    metaEventsLoading: boolean;
    catalog: AutomationCatalog | null;
    catalogLoading: boolean;
}

const AutomationWorkspaceContext = createContext<AutomationWorkspaceValue | null>(null);

interface AutomationWorkspaceProviderProps {
    automations?: Automation[];
    automationStats?: Record<number, AutomationStat>;
    templates?: EmailTemplate[];
    metaEvents?: MetaEvent[];
    catalog?: AutomationCatalog;
    children: ReactNode;
}

/**
 * Holds automations/templates/catalog as local React state so mutations can
 * patch them directly from a JSON response instead of an Inertia reload.
 * All three arrive as Inertia deferred props (one combined follow-up request,
 * see AutomationSettingController@index) and seed local state once — after
 * that, local state is the source of truth for the rest of the page visit.
 */
export function AutomationWorkspaceProvider({
    automations: automationsProp,
    automationStats: automationStatsProp,
    templates: templatesProp,
    metaEvents: metaEventsProp,
    catalog: catalogProp,
    children,
}: AutomationWorkspaceProviderProps) {
    const [automations, setAutomations] = useState<Automation[]>(() => automationsProp ?? []);
    const [automationStats, setAutomationStats] = useState<Record<number, AutomationStat>>(
        () => automationStatsProp ?? {},
    );
    const [templates, setTemplates] = useState<EmailTemplate[]>(() => templatesProp ?? []);
    const [metaEvents, setMetaEvents] = useState<MetaEvent[]>(() => metaEventsProp ?? []);
    const [catalog, setCatalog] = useState<AutomationCatalog | null>(() => catalogProp ?? null);

    const seeded = useRef({
        automations: automationsProp !== undefined,
        templates: templatesProp !== undefined,
        metaEvents: metaEventsProp !== undefined,
        catalog: catalogProp !== undefined,
    });

    useEffect(() => {
        if (!seeded.current.automations && automationsProp !== undefined) {
            setAutomations(automationsProp);
            seeded.current.automations = true;
        }
    }, [automationsProp]);

    useEffect(() => {
        if (automationStatsProp !== undefined) {
            setAutomationStats(automationStatsProp);
        }
    }, [automationStatsProp]);

    useEffect(() => {
        if (!seeded.current.templates && templatesProp !== undefined) {
            setTemplates(templatesProp);
            seeded.current.templates = true;
        }
    }, [templatesProp]);

    useEffect(() => {
        if (!seeded.current.metaEvents && metaEventsProp !== undefined) {
            setMetaEvents(metaEventsProp);
            seeded.current.metaEvents = true;
        }
    }, [metaEventsProp]);

    useEffect(() => {
        if (!seeded.current.catalog && catalogProp !== undefined) {
            setCatalog(catalogProp);
            seeded.current.catalog = true;
        }
    }, [catalogProp]);

    const value = useMemo<AutomationWorkspaceValue>(
        () => ({
            automations,
            setAutomations,
            automationsLoading: automationsProp === undefined,
            automationStats,
            templates,
            setTemplates,
            templatesLoading: templatesProp === undefined,
            metaEvents,
            setMetaEvents,
            metaEventsLoading: metaEventsProp === undefined,
            catalog,
            catalogLoading: catalogProp === undefined,
        }),
        [
            automations,
            automationsProp,
            automationStats,
            templates,
            templatesProp,
            metaEvents,
            metaEventsProp,
            catalog,
            catalogProp,
        ],
    );

    return (
        <AutomationWorkspaceContext.Provider value={value}>
            {children}
        </AutomationWorkspaceContext.Provider>
    );
}

export function useAutomationWorkspace() {
    const ctx = useContext(AutomationWorkspaceContext);
    if (!ctx) {
        throw new Error("useAutomationWorkspace must be used within an AutomationWorkspaceProvider");
    }
    return ctx;
}
