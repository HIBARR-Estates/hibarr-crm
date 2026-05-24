<?php

namespace App\Jobs;

use App\Models\DynamicTranslation;
use App\Services\DynamicTranslationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TranslateDynamicContentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;

    protected DynamicTranslation $translation;

    public function __construct(DynamicTranslation $translation)
    {
        $this->translation = $translation;
    }

    public function handle(DynamicTranslationService $dynamicTranslationService): void
    {
        $translation = $this->translation->fresh();

        if (!$translation) {
            Log::warning('TranslateDynamicContentJob: Translation record not found, skipping');
            return;
        }

        if ($translation->isComplete()) {
            return;
        }

        $dynamicTranslationService->translateAll($translation);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('TranslateDynamicContentJob: Job failed', [
            'translation_id' => $this->translation->id ?? null,
            'hash_key' => $this->translation->hash_key ?? null,
            'error' => $exception->getMessage(),
        ]);
    }
}
