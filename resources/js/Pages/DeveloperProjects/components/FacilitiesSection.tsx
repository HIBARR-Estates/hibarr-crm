import React from "react";
import { Empty } from "antd";
import type { ReactNode } from "react";
import { Waves, Dumbbell, Sparkles, UtensilsCrossed, ParkingSquare, Baby, Trophy, Wind, ShieldCheck, Wifi, Clapperboard, TreePine, Sailboat, Bike, ShoppingCart, HeartPulse, BriefcaseBusiness, Building2 } from "lucide-react";

// ── Icon map for common facility names ───────────────────────────────────
// Returns an inline SVG icon for known facility types, falling back to a generic icon.
function getFacilityIcon(facility: string): ReactNode {
    const key = facility.toLowerCase().replace(/[\s-]+/g, "_");

    if (key.includes("pool") || key.includes("swimming")) return <Waves />;
if (key.includes("gym") || key.includes("fitness")) return <Dumbbell />;
if (key.includes("spa") || key.includes("sauna") || key.includes("steam")) return <Sparkles />;
if (key.includes("restaurant") || key.includes("cafe") || key.includes("coffee") || key.includes("bar")) return <UtensilsCrossed />;
if (key.includes("parking") || key.includes("car")) return <ParkingSquare />;
if (key.includes("playground") || key.includes("kids") || key.includes("children")) return <Baby />;
if (key.includes("tennis") || key.includes("basketball") || key.includes("sport") || key.includes("court")) return <Trophy />;
if (key.includes("yoga") || key.includes("meditation") || key.includes("zen")) return <Wind />;
if (key.includes("security") || key.includes("cctv") || key.includes("guard")) return <ShieldCheck />;
if (key.includes("wifi") || key.includes("internet")) return <Wifi />;
if (key.includes("cinema") || key.includes("movie") || key.includes("theatre")) return <Clapperboard />;
if (key.includes("garden") || key.includes("park") || key.includes("green")) return <TreePine />;
if (key.includes("beach") || key.includes("sea") || key.includes("water")) return <Sailboat />;
if (key.includes("trail") || key.includes("running") || key.includes("bike") || key.includes("cycling")) return <Bike />;
if (key.includes("market") || key.includes("supermarket") || key.includes("shop")) return <ShoppingCart />;
if (key.includes("medical") || key.includes("hospital") || key.includes("clinic") || key.includes("pharmacy")) return <HeartPulse />;
if (key.includes("conference") || key.includes("cowork") || key.includes("lounge") || key.includes("work")) return <BriefcaseBusiness />;
    return <Building2 />;
}

// ── Component ─────────────────────────────────────────────────────────────
const FacilitiesSection: React.FC<{ facilities: string[] }> = ({ facilities }) => {
    if (facilities.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg flex items-center justify-center p-8">
                <Empty description="No facilities found" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {facilities.map((facility, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                    <span className="text-[#1a2a6c] flex-shrink-0">
                        {getFacilityIcon(facility)}
                    </span>
                    <span className="text-sm font-medium text-gray-700 capitalize leading-tight">
                        {facility.split("_").join(" ")}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default FacilitiesSection;
