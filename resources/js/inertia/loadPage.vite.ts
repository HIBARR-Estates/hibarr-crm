import type { InertiaPageComponent } from "./loadPage.types";

export type { InertiaPageComponent };

const pageModules = import.meta.glob<{ default: InertiaPageComponent }>(
    "../Pages/**/*.tsx",
);

export async function loadPageModule(name: string) {
    const path = `../Pages/${name}.tsx`;
    const importPage = pageModules[path];
    if (!importPage) {
        throw new Error(`Page not found: ${path}`);
    }
    return importPage();
}
