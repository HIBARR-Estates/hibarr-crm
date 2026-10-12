import type { InertiaPageComponent } from "./loadPage.types";

export type { InertiaPageComponent };

export async function loadPageModule(name: string) {
    return (await import(
        /* webpackChunkName: "pages-[request]" */
        `../Pages/${name}.tsx`
    )) as { default: InertiaPageComponent };
}
