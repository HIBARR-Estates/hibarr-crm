<?php

namespace App\Console\Commands;

use App\Models\DeveloperProjectUnitType;
use App\Models\Reminder;
use App\Models\User;
use App\Services\Reminders\ReminderCreator;
use App\Support\ReminderFeature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Dev/test helper: set remind_at a few minutes ahead on every unit and
 * create pending reminder rows that fire at that time (offset 0).
 *
 * Example:
 *   php artisan reminders:seed-dummy-units --user=1 --minutes=2
 *   php artisan reminders:send-due   # after those minutes elapse
 */
class SeedDummyUnitReminders extends Command
{
    protected $signature = 'reminders:seed-dummy-units
                            {--company= : Limit to a company id}
                            {--minutes=2 : Minutes from now when the reminder should fire}
                            {--user= : User id that receives every dummy reminder (required unless unit has added_by)}
                            {--limit= : Max number of units to process}
                            {--dry-run : Print actions without writing}';

    protected $description = 'Create dummy unit reminders that fire in the next couple of minutes';

    public function handle(ReminderCreator $creator): int
    {
        $minutes = max(1, (int) $this->option('minutes'));
        $companyFilter = $this->option('company');
        $userId = $this->option('user') !== null && $this->option('user') !== ''
            ? (int) $this->option('user')
            : null;
        $limit = $this->option('limit') !== null && $this->option('limit') !== ''
            ? max(1, (int) $this->option('limit'))
            : null;
        $dryRun = (bool) $this->option('dry-run');

        $forcedUser = null;
        if ($userId !== null) {
            $forcedUser = User::query()->find($userId);
            if (! $forcedUser || ! is_string($forcedUser->email) || $forcedUser->email === '') {
                $this->error("User {$userId} not found or has no email.");

                return self::FAILURE;
            }
        }

        $eventAt = Carbon::now()->addMinutes($minutes);
        // Offset 0 → remind_at equals event time (fires in --minutes).
        $cadence = [['time' => 0, 'type' => 'minute']];

        $query = DeveloperProjectUnitType::withoutGlobalScopes()
            ->whereNotNull('company_id')
            ->orderBy('id');

        if ($companyFilter !== null && $companyFilter !== '') {
            $query->where('company_id', (int) $companyFilter);
        }

        if ($limit !== null) {
            $query->limit($limit);
        }

        $units = $query->get();
        if ($units->isEmpty()) {
            $this->warn('No unit types found.');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            '%s %d unit(s); reminders will fire at %s (UTC) [+%d min].',
            $dryRun ? '[dry-run]' : 'Seeding',
            $units->count(),
            $eventAt->toDateTimeString(),
            $minutes
        ));

        $created = 0;
        $skipped = 0;
        $flagBlocked = 0;

        foreach ($units as $unit) {
            $companyId = (int) $unit->company_id;

            if (! ReminderFeature::enabledForCompany($companyId)) {
                $this->line("  skip unit #{$unit->id}: ReminderFeature off for company {$companyId}");
                $flagBlocked++;
                continue;
            }

            $recipients = $this->resolveRecipients($unit, $forcedUser);
            if ($recipients === []) {
                $this->line("  skip unit #{$unit->id}: no recipient (pass --user=)");
                $skipped++;
                continue;
            }

            $label = $unit->display_label ?? $unit->reference_code ?? "Unit #{$unit->id}";

            if ($dryRun) {
                $this->line("  would seed unit #{$unit->id} ({$label}) → {$recipients[0]['email']}");
                $created++;
                continue;
            }

            $unit->remind_at = $eventAt;
            $unit->reminders = $cadence;
            $unit->save();

            $rows = $creator->rebuildForEntity(
                $companyId,
                Reminder::ENTITY_UNIT,
                (int) $unit->id,
                $eventAt,
                $recipients,
                [0],
                [
                    'message' => '[dummy] '.$label,
                    'created_by' => $forcedUser?->id ?? $unit->added_by,
                    'added_by' => $forcedUser?->id ?? $unit->added_by,
                ]
            );

            $created += count($rows);
            $this->line("  unit #{$unit->id}: ".count($rows).' reminder(s)');
        }

        $this->newLine();
        $this->info("Done. reminders created/updated: {$created}; skipped (no recipient): {$skipped}; flag-blocked: {$flagBlocked}");
        if (! $dryRun && $created > 0) {
            $this->comment('When due, run: php artisan reminders:prepare && php artisan reminders:send-due');
            $this->comment('Or wait for the scheduled workers (prepare ~15m window, send-due every minute).');
        }

        return self::SUCCESS;
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function resolveRecipients(DeveloperProjectUnitType $unit, ?User $forcedUser): array
    {
        if ($forcedUser !== null) {
            return [[
                'type' => Reminder::RECIPIENT_USER,
                'id' => (int) $forcedUser->id,
                'email' => $forcedUser->email,
            ]];
        }

        if (! empty($unit->added_by)) {
            $user = User::query()->find((int) $unit->added_by);
            if ($user && is_string($user->email) && $user->email !== '') {
                return [[
                    'type' => Reminder::RECIPIENT_USER,
                    'id' => (int) $user->id,
                    'email' => $user->email,
                ]];
            }
        }

        return [];
    }
}
