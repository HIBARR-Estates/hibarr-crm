import React, { createContext, useContext, useMemo, useState } from "react";

interface MobileSidebarContextValue {
    mobileOpen: boolean;
    openMobileSidebar: () => void;
    closeMobileSidebar: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(
    null,
);

export const MobileSidebarProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const value = useMemo(
        () => ({
            mobileOpen,
            openMobileSidebar: () => setMobileOpen(true),
            closeMobileSidebar: () => setMobileOpen(false),
        }),
        [mobileOpen],
    );

    return (
        <MobileSidebarContext.Provider value={value}>
            {children}
        </MobileSidebarContext.Provider>
    );
};

/**
 * Returns no-op handlers when used outside a MobileSidebarProvider (e.g.
 * pages that don't render DashboardLayout) so callers don't need to guard.
 */
export function useMobileSidebar(): MobileSidebarContextValue {
    const ctx = useContext(MobileSidebarContext);
    if (!ctx) {
        return {
            mobileOpen: false,
            openMobileSidebar: () => {},
            closeMobileSidebar: () => {},
        };
    }
    return ctx;
}
