export interface FallbackVoiceMessageConfig {
    enabled: boolean;
    url?: string | null;
    text?: string | null;
    repeat_count: number;
}

export interface PlayFallbackVoiceMessageOptions {
    config: FallbackVoiceMessageConfig;
    onProgress: (statusText: string) => void;
    onComplete: () => void;
}

/**
 * Handles automated voice message fallback playback (audio or synthesized speech)
 * with iteration repeat tracking and clean cleanup cancellation.
 */
export function playFallbackVoiceMessage({
    config,
    onProgress,
    onComplete,
}: PlayFallbackVoiceMessageOptions): () => void {
    const repeatCount = Math.max(1, config.repeat_count || 1);
    const spokenText = config.text || "We are unable to take your call at this time. Please try again later.";
    const audioUrl = config.url;

    let currentPlayIteration = 1;
    let isCancelled = false;

    const executeIteration = () => {
        if (isCancelled) return;

        if (currentPlayIteration > repeatCount) {
            onComplete();
            return;
        }

        onProgress(`Playing message (${currentPlayIteration} of ${repeatCount})…`);

        if (audioUrl) {
            const audioElement = new Audio(audioUrl);
            audioElement.onended = () => {
                currentPlayIteration++;
                executeIteration();
            };
            audioElement.onerror = () => {
                currentPlayIteration++;
                executeIteration();
            };
            audioElement.play().catch(() => {
                currentPlayIteration++;
                executeIteration();
            });
        } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(spokenText);
            utterance.rate = 0.95;
            utterance.onend = () => {
                currentPlayIteration++;
                executeIteration();
            };
            utterance.onerror = () => {
                currentPlayIteration++;
                executeIteration();
            };
            window.speechSynthesis.speak(utterance);
        } else {
            setTimeout(() => {
                currentPlayIteration++;
                executeIteration();
            }, 3500);
        }
    };

    executeIteration();

    return () => {
        isCancelled = true;
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
    };
}
