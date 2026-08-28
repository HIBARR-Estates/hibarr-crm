/**
 * Injected once (id-guarded) rather than per-mount, since the launcher tab
 * can mount/unmount as the pending count crosses zero while the dock itself
 * stays alive.
 */
export function ensureDockAnimationsInjected(): void {
    if (typeof document === "undefined") return;
    if (document.getElementById("hb-attendance-dock-animations")) return;

    const style = document.createElement("style");
    style.id = "hb-attendance-dock-animations";
    style.textContent = `
@keyframes hb-attendance-nudge{0%,88%,100%{transform:translateY(-50%) translateX(0)}92%{transform:translateY(-50%) translateX(-7px)}96%{transform:translateY(-50%) translateX(-3px)}}
@keyframes hb-attendance-glow{0%,100%{box-shadow:-4px 6px 18px rgba(22,41,77,0.12)}50%{box-shadow:-4px 6px 22px rgba(26,107,181,0.5)}}
@keyframes hb-attendance-badge{0%,100%{transform:scale(1)}45%{transform:scale(1.25)}}
@keyframes hb-attendance-panel-in{from{opacity:0;transform:translateX(28px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}
@media (prefers-reduced-motion: no-preference) {
    .hb-attendance-tab{animation:hb-attendance-nudge 4.5s ease-in-out infinite,hb-attendance-glow 2.8s ease-in-out infinite}
    .hb-attendance-tab-badge{animation:hb-attendance-badge 2.8s ease-in-out infinite}
}
.hb-attendance-tab:hover{animation:none;transform:translateY(-50%) translateX(-4px)}
.hb-attendance-panel-enter{animation:hb-attendance-panel-in .3s cubic-bezier(.22,1,.36,1)}
`;
    document.head.appendChild(style);
}
