<?php

namespace App\Email\Console;

use App\Email\Connections\ConnectionManager;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use Illuminate\Console\Command;

/**
 * Support / ops path for mailbox stop control. Stops and resumes without
 * deleting CRM history — same lifecycle as the agent UI (E-12 / E-33).
 */
class ManageMailboxCommand extends Command
{
    protected $signature = 'email:mailbox
                            {action : stop, resume, or status}
                            {uuid : CRM connection uuid}
                            {--force : Skip confirmation prompts}';

    protected $description = 'Stop, resume, or inspect a mailbox connection (support path; history preserved on stop)';

    public function handle(ConnectionManager $manager): int
    {
        $action = strtolower(trim((string) $this->argument('action')));
        $uuid = trim((string) $this->argument('uuid'));

        $connection = EmailConnection::withoutGlobalScopes()->where('uuid', $uuid)->first();

        if ($connection === null) {
            $this->error('Connection not found.');

            return self::FAILURE;
        }

        return match ($action) {
            'status' => $this->showStatus($connection),
            'stop' => $this->stop($manager, $connection),
            'resume' => $this->resume($manager, $connection),
            default => $this->invalidAction($action),
        };
    }

    private function stop(ConnectionManager $manager, EmailConnection $connection): int
    {
        if (! $this->option('force')
            && ! $this->confirm('Stop sync and send for '.$connection->identity_email.'? Existing CRM copies stay readable.')) {
            $this->warn('Aborted.');

            return self::FAILURE;
        }

        $updated = $manager->stop($connection);

        $this->info('Stopped '.$updated->identity_email.' ('.$updated->uuid.').');
        $this->line('Status: '.$updated->status->value);
        $this->line('Copies preserved: '.$this->copyCount($updated));

        return self::SUCCESS;
    }

    private function resume(ConnectionManager $manager, EmailConnection $connection): int
    {
        $updated = $manager->resume($connection);

        $this->info('Resume result for '.$updated->identity_email.' ('.$updated->uuid.').');
        $this->line('Status: '.$updated->status->value);
        if ($updated->last_error_code !== null) {
            $this->line('Last error: '.$updated->last_error_code);
        }

        return self::SUCCESS;
    }

    private function showStatus(EmailConnection $connection): int
    {
        $this->table(
            ['Field', 'Value'],
            [
                ['uuid', $connection->uuid],
                ['identity_email', $connection->identity_email],
                ['owner_user_id', (string) $connection->user_id],
                ['company_id', (string) $connection->company_id],
                ['provider', $connection->provider],
                ['status', $connection->status->value],
                ['sync_stopped_at', $connection->sync_stopped_at?->toIso8601String() ?? ''],
                ['last_sync_at', $connection->last_sync_at?->toIso8601String() ?? ''],
                ['last_error_code', $connection->last_error_code ?? ''],
                ['mailbox_copies', (string) $this->copyCount($connection)],
                ['syncable', $connection->isSyncable() ? 'yes' : 'no'],
            ],
        );

        return self::SUCCESS;
    }

    private function copyCount(EmailConnection $connection): int
    {
        return EmailMailboxCopy::withoutGlobalScopes()
            ->where('connection_id', $connection->id)
            ->count();
    }

    private function invalidAction(string $action): int
    {
        $this->error("Unknown action [{$action}]. Use stop, resume, or status.");

        return self::FAILURE;
    }
}
