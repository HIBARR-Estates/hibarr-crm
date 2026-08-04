<?php

namespace App\Services\Reminders;

use App\Jobs\Reminders\SendReminderJob;
use App\Models\EntityReminderDefault;
use App\Models\Reminder;
use App\Models\User;
use App\Models\UserReminderPreference;
use App\Support\ReminderFeature;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class ReminderCreator
{
    /**
     * @param  array<int, array{type: string, id?: int|null, email?: string|null}>  $recipients
     * @param  array<int, int>|null  $cadenceMinutes  minutes before eventAt
     * @param  array{message?: string|null, created_by?: int|null, added_by?: int|null}  $meta
     * @return array<int, Reminder>
     */
    public function createForEntity(
        int $companyId,
        string $entityType,
        int $entityId,
        CarbonInterface $eventAt,
        array $recipients,
        ?array $cadenceMinutes = null,
        array $meta = []
    ): array {
        if (!ReminderFeature::enabledForCompany($companyId)) {
            return [];
        }

        $created = [];
        $now = now();
        $actorId = $meta['added_by'] ?? $meta['created_by'] ?? null;

        foreach ($recipients as $recipient) {
            $recipientType = (string) ($recipient['type'] ?? '');
            $recipientId = isset($recipient['id']) ? (int) $recipient['id'] : null;
            $recipientEmail = isset($recipient['email']) ? trim((string) $recipient['email']) : null;

            if ($recipientType === Reminder::RECIPIENT_EMAIL) {
                if ($recipientEmail === null || $recipientEmail === '') {
                    continue;
                }
                $recipientId = null;
            } elseif ($recipientType === Reminder::RECIPIENT_USER || $recipientType === Reminder::RECIPIENT_LEAD) {
                if (!$recipientId) {
                    continue;
                }
                if ($recipientEmail === null || $recipientEmail === '') {
                    $recipientEmail = $this->resolveRecipientEmail($recipientType, $recipientId);
                }
            } else {
                continue;
            }

            if ($recipientEmail === null || $recipientEmail === '') {
                continue;
            }

            $minutesList = $cadenceMinutes
                ?? $this->resolveCadenceMinutes($companyId, $entityType, $recipientType, $recipientId);

            foreach ($minutesList as $minutesBefore) {
                $minutesBefore = (int) $minutesBefore;
                // Only create offsets that can still fire (e.g. skip 60/30 when meeting is in 15m).
                $secondsUntilEvent = Carbon::parse($eventAt)->getTimestamp() - $now->getTimestamp();
                $minutesUntilEvent = (int) floor($secondsUntilEvent / 60);
                if ($minutesBefore > $minutesUntilEvent) {
                    continue;
                }

                $remindAt = Carbon::parse($eventAt)->copy()->subMinutes($minutesBefore);

                $reminder = Reminder::query()->create([
                    'company_id' => $companyId,
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                    'remind_at' => $remindAt,
                    'status' => Reminder::STATUS_PENDING,
                    'channel' => Reminder::CHANNEL_EMAIL,
                    'recipient_type' => $recipientType,
                    'recipient_id' => $recipientId,
                    'recipient_email' => mb_strtolower($recipientEmail),
                    'message' => $meta['message'] ?? null,
                    'created_by' => $meta['created_by'] ?? $actorId,
                    'added_by' => $meta['added_by'] ?? $actorId,
                    'last_updated_by' => $actorId,
                ]);

                $created[] = $reminder;

                if ($remindAt->lessThanOrEqualTo($now)) {
                    SendReminderJob::dispatch($reminder->id)->onQueue('reminders-send');
                }
            }
        }

        return $created;
    }

    public function cancelOpenForEntity(string $entityType, int $entityId): int
    {
        return Reminder::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->whereIn('status', [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED])
            ->update([
                'status' => Reminder::STATUS_CANCELLED,
                'updated_at' => now(),
            ]);
    }

    /**
     * @param  array<int, array{type: string, id?: int|null, email?: string|null}>  $recipients
     * @param  array<int, int>|null  $cadenceMinutes
     * @param  array{message?: string|null, created_by?: int|null, added_by?: int|null}  $meta
     * @return array<int, Reminder>
     */
    public function rebuildForEntity(
        int $companyId,
        string $entityType,
        int $entityId,
        CarbonInterface $eventAt,
        array $recipients,
        ?array $cadenceMinutes = null,
        array $meta = []
    ): array {
        if (!ReminderFeature::enabledForCompany($companyId)) {
            return [];
        }

        $this->cancelOpenForEntity($entityType, $entityId);

        return $this->createForEntity(
            $companyId,
            $entityType,
            $entityId,
            $eventAt,
            $recipients,
            $cadenceMinutes,
            $meta
        );
    }

    /**
     * @return array<int, int>
     */
    public function resolveCadenceMinutes(
        int $companyId,
        string $entityType,
        string $recipientType,
        ?int $recipientId
    ): array {
        if ($recipientType === Reminder::RECIPIENT_USER && $recipientId) {
            $prefs = UserReminderPreference::getRemindersForUser($recipientId, 'meeting');
            $fromPrefs = $this->offsetsToMinutes($prefs);
            if ($fromPrefs !== []) {
                return $fromPrefs;
            }
        }

        $fromEntity = EntityReminderDefault::forCompanyAndType($companyId, $entityType);
        if ($fromEntity !== null && $fromEntity !== []) {
            return $fromEntity;
        }

        return EntityReminderDefault::configDefaultsAsMinutes();
    }

    /**
     * @param  array<int, array{time?: int, type?: string}|int>  $offsets
     * @return array<int, int>
     */
    public function offsetsToMinutes(array $offsets): array
    {
        $minutes = [];
        foreach ($offsets as $offset) {
            $value = EntityReminderDefault::offsetToMinutes($offset);
            if ($value !== null) {
                $minutes[] = $value;
            }
        }

        return array_values(array_unique($minutes));
    }

    private function resolveRecipientEmail(string $recipientType, int $recipientId): ?string
    {
        if ($recipientType === Reminder::RECIPIENT_USER) {
            $email = User::query()->where('id', $recipientId)->value('email');

            return is_string($email) && $email !== '' ? $email : null;
        }

        if ($recipientType === Reminder::RECIPIENT_LEAD) {
            $lead = \App\Models\Lead::query()->find($recipientId);
            if (!$lead) {
                return null;
            }

            $email = $lead->client_email
                ?? $lead->email
                ?? null;

            return is_string($email) && $email !== '' ? $email : null;
        }

        return null;
    }
}
