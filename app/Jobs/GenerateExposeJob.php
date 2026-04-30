<?php

namespace App\Jobs;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\ExposeJob;
use App\Models\Property;
use App\Models\User;
use App\Notifications\ExposeReadyNotification;
use App\Services\FileStorageService;
use App\Services\PdfExpose\Builders\TemplateRenderer;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\PdfExpose\Generators\PdfGenerator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateExposeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Max execution time – Browsershot can take a while on large PDFs.
     */
    public int $timeout = 300;

    /**
     * Do not retry — PDF generation is expensive and failures are usually
     * caused by missing data, not transient network issues.
     */
    public int $tries = 1;

    public function __construct(private int $exposeJobId) {}

    public function handle(
        TemplateRenderer $renderer,
        PdfGenerator $generator,
        FileStorageService $fileStorageService
    ): void {
        $exposeJob = ExposeJob::findOrFail($this->exposeJobId);
        $exposeJob->update(['status' => ExposeJob::STATUS_PROCESSING]);

        $tempPath = null;

        try {
            $config = $this->buildConfig($exposeJob);

            // Render Blade → HTML
            $html = $renderer->render($config);

            // Save PDF to a local temp file (avoids streaming it back synchronously)
            $tempDir = storage_path('app/temp/expose');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            $tempPath = $tempDir . '/' . uniqid('expose_', true) . '.pdf';

            $generator->saveToFile($html, $config, $tempPath);

            // Upload to the external file storage (Minio via API)
            $uploadResult = $fileStorageService->uploadFromPath(
                $tempPath,
                $exposeJob->filename,
                'backend-uploads'
            );

            $exposeJob->update([
                'status'       => ExposeJob::STATUS_READY,
                'download_url' => $uploadResult['downloadUrl'],
                'object_path'  => $uploadResult['objectPath'],
                'expires_at'   => now()->addDays(7),
            ]);

            // Notify the user via in-app notification
            $user = User::find($exposeJob->user_id);
            if ($user) {
                $user->notify(new ExposeReadyNotification($exposeJob));
            }
        } catch (\Throwable $e) {
            Log::error('GenerateExposeJob failed', [
                'expose_job_id' => $this->exposeJobId,
                'error'         => $e->getMessage(),
                'trace'         => $e->getTraceAsString(),
            ]);

            $exposeJob->update([
                'status'        => ExposeJob::STATUS_FAILED,
                'error_message' => $e->getMessage(),
            ]);
        } finally {
            if ($tempPath && file_exists($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * Reconstruct the ExposeConfiguration from the stored job record.
     */
    private function buildConfig(ExposeJob $exposeJob): ExposeConfiguration
    {
        $payload = $exposeJob->payload ?? [];
        $clientData = [
            'client_name'  => $payload['client_name'] ?? null,
            'client_email' => $payload['client_email'] ?? null,
        ];

        switch ($exposeJob->entity_type) {
            case ExposeJob::ENTITY_PROPERTY:
                $property = Property::with(['product.addedBy', 'assets'])->findOrFail($exposeJob->entity_id);
                return ExposeConfiguration::fromProperty($property, 'expose-template', $clientData);

            case ExposeJob::ENTITY_DEVELOPER_PROJECT:
                $project = DeveloperProject::with(['developer', 'location', 'assets', 'unitTypes.assets'])
                    ->findOrFail($exposeJob->entity_id);
                return ExposeConfiguration::fromDeveloperProject($project, 'project-expose-template', $clientData);

            case ExposeJob::ENTITY_UNIT_TYPE:
                $unitType = DeveloperProjectUnitType::with([
                    'project.developer',
                    'project.location',
                    'project.assets',
                    'assets',
                ])->findOrFail($exposeJob->sub_entity_id);
                return ExposeConfiguration::fromUnitType($unitType, 'expose-template', $clientData);

            default:
                throw new \InvalidArgumentException("Unknown entity_type: {$exposeJob->entity_type}");
        }
    }
}
