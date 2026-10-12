import type { ComponentType, ReactNode } from "react";

export type InertiaPageComponent = ComponentType<any> & {
    layout?: (page: ReactNode) => ReactNode;
    /** Guards against re-wrapping on repeat resolve() calls for the same page component. */
    __wrappedWithInnerProviders?: boolean;
};
