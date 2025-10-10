declare global {
    interface Window {
        route: (name: string, params?: any, absolute?: boolean) => string;
    }

    // Simple route function for development
    function route(name: string, params?: any, absolute?: boolean): string;
}

export {};