import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { Currency } from "@/Types/common";

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
        currencies?: Currency[];
        default_currency_symbol?: string;
        default_currency_code?: string;
        isDarkMode?: boolean; // Example additional prop, not implemented yet
    }
}
