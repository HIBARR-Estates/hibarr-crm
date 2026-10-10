<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\UserPermissionResyncCompleted;
use App\Services\ResyncUserPermissionsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Rebuilds `user_permissions` from role templates for a single company.
 *
 * Runs off the HTTP request because a real user table does not fit inside
 * max_execution_time, and holds a per-company lock so two admins clicking
 * the button cannot run two full rewrites concurrently.
 */
class ResyncUserPermissionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * A full rewrite is long-running; do not retry — a partial rewrite is
     * re-runnable and retrying blindly would compound the damage.
     */
    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(
        private int $companyId,
        private ?int $triggeredByUserId = null
    ) {}

    public static function lockName(int $companyId): string
    {
        return 'resync-user-permissions:'.$companyId;
    }

    public function handle(ResyncUserPermissionsService $resync): void
    {
        $lock = Cache::lock(self::lockName($this->companyId), $this->timeout + 60);

        if (! $lock->get()) {
            Log::warning('ResyncUserPermissionsJob skipped: a resync is already running', [
                'company_id' => $this->companyId,
                'triggered_by' => $this->triggeredByUserId,
            ]);

            $this->notifyActor(__('messages.resyncUserPermissionsAlreadyRunning'), null);

            return;
        }

        try {
            if (! $resync->backfillRoleTemplates($this->companyId)) {
                throw new \RuntimeException('Backfilling role templates failed for company '.$this->companyId);
            }

            $counts = $resync->resync($this->companyId);

            Log::info('Resynced user permissions from role templates', [
                'company_id' => $this->companyId,
                'triggered_by' => $this->triggeredByUserId,
                'synced' => $counts['synced'],
                'skipped_no_role' => $counts['skipped_no_role'],
                'skipped_admin' => $counts['skipped_admin'],
            ]);

            $this->notifyActor(
                __('messages.resyncUserPermissionsSuccess', [
                    'synced' => $counts['synced'],
                    'skipped' => $counts['skipped_no_role'],
                ]),
                $counts
            );
        } catch (\Throwable $e) {
            Log::error('ResyncUserPermissionsJob failed', [
                'company_id' => $this->companyId,
                'triggered_by' => $this->triggeredByUserId,
                'exception' => $e->getMessage(),
            ]);

            $this->notifyActor(__('messages.resyncUserPermissionsFailed'), null);

            throw $e;
        } finally {
            $lock->release();
        }
    }

    /**
     * @param  array{synced: int, skipped_no_role: int, skipped_admin: int}|null  $counts
     */
    private function notifyActor(string $message, ?array $counts): void
    {
        if (! $this->triggeredByUserId) {
            return;
        }

        $actor = User::withoutGlobalScopes()->find($this->triggeredByUserId);

        if (! $actor) {
            return;
        }

        $actor->notify(new UserPermissionResyncCompleted(
            $this->companyId,
            $message,
            $counts
        ));
    }
}
