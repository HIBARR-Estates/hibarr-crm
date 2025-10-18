import { PageProps as InertiaPageProps } from "@inertiajs/core";

declare module "@inertiajs/core" {
    interface PageProps extends InertiaPageProps {
        auth: {
            user: {
                id: number;
                name: string;
                email: string;
            };
        };
        flash?: {
            success?: string;
            error?: string;
        };
        isDarkMode?: boolean; // Example additional prop, not implemented yet
    }
}
