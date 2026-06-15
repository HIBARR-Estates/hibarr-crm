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
use Throwable;

class GenerateExposeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const QUEUE = 'expose';

    /**
     * Max execution time – Browsershot can take a while on large PDFs.
     */
    public int $timeout = 420;

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
        $startedAt = microtime(true);

        try {
            $phaseStarted = microtime(true);
            $config = $this->buildConfig($exposeJob);
            $this->logPhase('build_config', $phaseStarted, $this->exposeJobId);

            $phaseStarted = microtime(true);
            $html = $renderer->render($config);
            $this->logPhase('render_html', $phaseStarted, $this->exposeJobId, [
                'html_bytes' => strlen($html),
            ]);

            $tempDir = storage_path('app/temp/expose');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            $tempPath = $tempDir . '/' . uniqid('expose_', true) . '.pdf';

            $phaseStarted = microtime(true);
            $generator->saveToFile($html, $config, $tempPath);
            $this->logPhase('browsershot_pdf', $phaseStarted, $this->exposeJobId, [
                'pdf_bytes' => file_exists($tempPath) ? filesize($tempPath) : 0,
            ]);

            $phaseStarted = microtime(true);
            $uploadResult = $fileStorageService->uploadFromPath(
                $tempPath,
                $exposeJob->filename,
                'backend-uploads'
            );
            $this->logPhase('upload_pdf', $phaseStarted, $this->exposeJobId);

            $exposeJob->update([
                'status'       => ExposeJob::STATUS_READY,
                'download_url' => $uploadResult['downloadUrl'],
                'object_path'  => $uploadResult['objectPath'],
                'expires_at'   => now()->addDays(7),
            ]);

            $user = User::find($exposeJob->user_id);
            if ($user) {
                $user->notify(new ExposeReadyNotification($exposeJob));
            }

            Log::info('GenerateExposeJob completed', [
                'expose_job_id' => $this->exposeJobId,
                'total_ms'      => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        } catch (Throwable $e) {
            Log::error('GenerateExposeJob failed', [
                'expose_job_id' => $this->exposeJobId,
                'error'         => $e->getMessage(),
                'trace'         => $e->getTraceAsString(),
                'elapsed_ms'    => (int) round((microtime(true) - $startedAt) * 1000),
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
     * Ensure the expose_jobs row is marked failed when the queue worker kills the job.
     */
    public function failed(?Throwable $exception): void
    {
        $message = $exception?->getMessage() ?? 'PDF generation timed out or was interrupted.';

        Log::error('GenerateExposeJob failed (queue)', [
            'expose_job_id' => $this->exposeJobId,
            'error'         => $message,
        ]);

        ExposeJob::where('id', $this->exposeJobId)
            ->whereIn('status', [ExposeJob::STATUS_QUEUED, ExposeJob::STATUS_PROCESSING])
            ->update([
                'status'        => ExposeJob::STATUS_FAILED,
                'error_message' => $message,
            ]);
    }

    private function logPhase(string $phase, float $startedAt, int $exposeJobId, array $extra = []): void
    {
        Log::info('GenerateExposeJob phase', array_merge([
            'expose_job_id' => $exposeJobId,
            'phase'         => $phase,
            'duration_ms'   => (int) round((microtime(true) - $startedAt) * 1000),
        ], $extra));
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

        $generatedBy = $exposeJob->user_id
            ? User::with(['employeeDetail.designation', 'company.defaultAddress'])->find($exposeJob->user_id)
            : null;

        switch ($exposeJob->entity_type) {
            case ExposeJob::ENTITY_PROPERTY:
                $property = Property::with(['product.addedBy', 'assets'])->findOrFail($exposeJob->entity_id);
                return ExposeConfiguration::fromProperty(
                    $property,
                    'expose-template',
                    $clientData,
                    [],
                    $generatedBy,
                    $exposeJob->company_id
                );

            case ExposeJob::ENTITY_DEVELOPER_PROJECT:
                $project = DeveloperProject::with(['developer', 'location', 'assets', 'unitTypes.assets'])
                    ->findOrFail($exposeJob->entity_id);
                return ExposeConfiguration::fromDeveloperProject(
                    $project,
                    'project-expose-template',
                    $clientData,
                    $generatedBy,
                    $exposeJob->company_id
                );

            case ExposeJob::ENTITY_UNIT_TYPE:
                $unitType = DeveloperProjectUnitType::with([
                    'project.developer',
                    'project.location',
                    'project.assets',
                    'assets',
                ])->findOrFail($exposeJob->sub_entity_id);
                return ExposeConfiguration::fromUnitType(
                    $unitType,
                    'expose-template',
                    $clientData,
                    $generatedBy,
                    $exposeJob->company_id
                );

            default:
                throw new \InvalidArgumentException("Unknown entity_type: {$exposeJob->entity_type}");
        }
    }
}
