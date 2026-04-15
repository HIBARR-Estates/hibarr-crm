/**
 * Shared facility icon mapping.
 *
 * Maps Lucide icon identifiers (stored in DB) to their React components.
 * Used by:
 * - FacilitiesSection (display)
 * - ConfigItemModal icon picker (selection)
 * - ConstructionProjectFacilitiesSection (checkboxes)
 */

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
    Waves,
    Dumbbell,
    Sparkles,
    UtensilsCrossed,
    ParkingSquare,
    Baby,
    Trophy,
    Wind,
    ShieldCheck,
    Wifi,
    Clapperboard,
    TreePine,
    Sailboat,
    Bike,
    ShoppingCart,
    HeartPulse,
    BriefcaseBusiness,
    Building2,
} from "lucide-react";

export interface FacilityIconOption {
    value: string;
    label: string;
    component: ComponentType<LucideProps>;
}

/**
 * All available icons that can be assigned to a facility.
 * The `value` is stored in the DB `icon` column.
 */
export const FACILITY_ICON_OPTIONS: FacilityIconOption[] = [
    { value: "waves", label: "Waves (Pool / Water)", component: Waves },
    { value: "dumbbell", label: "Dumbbell (Gym)", component: Dumbbell },
    {
        value: "sparkles",
        label: "Sparkles (Spa / Beauty)",
        component: Sparkles,
    },
    {
        value: "utensils-crossed",
        label: "Utensils (Restaurant / Café)",
        component: UtensilsCrossed,
    },
    { value: "parking-square", label: "Parking", component: ParkingSquare },
    { value: "baby", label: "Baby (Kids / Playground)", component: Baby },
    { value: "trophy", label: "Trophy (Sports / Courts)", component: Trophy },
    { value: "wind", label: "Wind (Yoga / Meditation)", component: Wind },
    {
        value: "shield-check",
        label: "Shield (Security)",
        component: ShieldCheck,
    },
    { value: "wifi", label: "Wifi (Internet)", component: Wifi },
    {
        value: "clapperboard",
        label: "Clapperboard (Cinema)",
        component: Clapperboard,
    },
    { value: "tree-pine", label: "Tree (Garden / Park)", component: TreePine },
    { value: "sailboat", label: "Sailboat (Beach / Sea)", component: Sailboat },
    { value: "bike", label: "Bike (Cycling / Walking)", component: Bike },
    {
        value: "shopping-cart",
        label: "Shopping Cart (Market)",
        component: ShoppingCart,
    },
    {
        value: "heart-pulse",
        label: "Heart Pulse (Medical)",
        component: HeartPulse,
    },
    {
        value: "briefcase-business",
        label: "Briefcase (Management)",
        component: BriefcaseBusiness,
    },
    { value: "building-2", label: "Building (General)", component: Building2 },
];

/** Quick lookup: icon value → Component */
const ICON_MAP = new Map<string, ComponentType<LucideProps>>(
    FACILITY_ICON_OPTIONS.map((o) => [o.value, o.component]),
);

/**
 * Resolve a stored icon identifier to its Lucide component.
 * Falls back to Building2 for unknown/null values.
 */
export function getFacilityIconComponent(
    iconName: string | null | undefined,
): ComponentType<LucideProps> {
    if (!iconName) return Building2;
    return ICON_MAP.get(iconName) ?? Building2;
}
