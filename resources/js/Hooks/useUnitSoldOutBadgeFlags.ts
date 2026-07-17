import { usePage } from "@inertiajs/react";
import {
    UNIT_SOLD_OUT_BADGE_FLAG,
    UNIT_SOLD_OUT_GRID_DIAGONAL_FLAG,
    type UnitSoldOutGridVariant,
} from "@/lib/unitSoldOutBadgeFlags";

export default function useUnitSoldOutBadgeFlags() {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    const enabled = featureFlags[UNIT_SOLD_OUT_BADGE_FLAG] === true;
    const gridVariant: UnitSoldOutGridVariant =
        featureFlags[UNIT_SOLD_OUT_GRID_DIAGONAL_FLAG] === true
            ? "diagonal"
            : "overlay";

    return { enabled, gridVariant };
}
