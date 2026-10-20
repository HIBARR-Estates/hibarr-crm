<?php

namespace App\Services;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Exceptions\CrmEventSubmissionException;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * Enforces the rules for a CRM event logged through an authenticated session.
 *
 * The browser is not a trusted source of attribution: it may say who wrote an
 * event and how the event is classified, and it may point the event at any
 * record. A session submission is therefore re-authored server-side and
 * checked against the records and event types the caller may actually use.
 *
 * Token callers are unaffected — they are a separate integration and keep
 * supplying their own author and ingestion metadata.
 */
class CrmEventSubmissionGuard
{
    /**
     * The record types a session submission may target, mapped to the
     * permission that governs reading them.
     *
     * @var array<string, string>
     */
    private const SUPPORTED_MODEL_TYPES = [
        Lead::class => 'view_lead',
        Deal::class => 'view_deals',
    ];

    /**
     * A submitted occurrence date may not be in the future. A small grace
     * window absorbs clock skew between the browser and the server.
     */
    private const FUTURE_GRACE_SECONDS = 60;

    public function __construct(
        private readonly CrmEventService $eventService,
    ) {}

    /**
     * Validate a session-submitted event and return it with server-owned
     * attribution.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws CrmEventSubmissionException
     */
    public function prepare(array $data, User $user, int $companyId): array
    {
        $modelType = $this->resolveModelType($data['model_type'] ?? null);
        $modelId = isset($data['model_id']) ? (int) $data['model_id'] : 0;

        if ($modelType === null || $modelId <= 0) {
            throw new CrmEventSubmissionException('An event must be logged against a Lead or a Deal.', 422);
        }

        $target = $this->resolveTarget($modelType, $modelId, $companyId);

        if ($target === null) {
            throw new CrmEventSubmissionException('The record this event belongs to does not exist.', 404);
        }

        if (! $this->canViewTarget($modelType, $target, $user)) {
            throw new CrmEventSubmissionException('You are not allowed to log events on this record.', 403);
        }

        $eventType = $this->resolveEventType((string) ($data['event_type_slug'] ?? ''), $companyId);

        if ($eventType === null) {
            throw new CrmEventSubmissionException('Unknown event type.', 422);
        }

        if (! $eventType->is_active) {
            throw new CrmEventSubmissionException('This event type is not active.', 422);
        }

        if ($eventType->is_system) {
            throw new CrmEventSubmissionException('System event types cannot be logged by hand.', 422);
        }

        // A type is bound to one record type, or to none at all (usable on
        // any entity) — the same rule the type listing applies.
        if ($eventType->model_type !== null && $eventType->model_type !== $modelType) {
            throw new CrmEventSubmissionException('This event type is not available for this record.', 422);
        }

        $category = $eventType->relationLoaded('category') ? $eventType->category : null;
        if ($category !== null && ! $category->is_active) {
            throw new CrmEventSubmissionException('This event type is not available right now.', 422);
        }

        return array_merge($data, [
            'event_type_slug' => $eventType->slug,
            'model_type' => $modelType,
            'model_id' => $modelId,
            // Attribution is server-owned: the browser cannot choose the
            // author, the classification or the ingestion source.
            'user_id' => (int) $user->id,
            'generation_type' => CrmEventGenerationType::USER_GENERATED->value,
            'source' => CrmEventSource::WEB->value,
            // Correlation and causation are assigned server-side.
            'correlation_id' => $this->eventService->startCorrelation(),
            'causation_id' => null,
            'occurred_at' => $this->resolveOccurredAt($data['occurred_at'] ?? null),
        ]);
    }

    /**
     * The canonical class name of a supported record type, or null when the
     * submission names something that cannot carry an event.
     */
    private function resolveModelType(mixed $raw): ?string
    {
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $normalized = preg_replace('/\\\\+/', '\\', trim($raw)) ?? trim($raw);

        foreach (array_keys(self::SUPPORTED_MODEL_TYPES) as $candidate) {
            if ($normalized === $candidate) {
                return $candidate;
            }

            // Recover the fully-stripped form clients occasionally send
            // ("AppModelsLead"), which would otherwise match no record.
            if (str_replace('\\', '', $candidate) === str_replace('\\', '', $normalized)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * The target record, scoped to the company — a lead or deal from another
     * tenant is not a target at all.
     */
    private function resolveTarget(string $modelType, int $modelId, int $companyId): ?Model
    {
        $model = $modelType === Lead::class ? Lead::class : Deal::class;

        /** @var Lead|Deal|null $target */
        $target = $model::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($modelId)
            ->first();

        return $target;
    }

    /**
     * Whether the caller may read the target — the same rule that guards
     * opening the record itself.
     */
    private function canViewTarget(string $modelType, Model $target, User $user): bool
    {
        if ($modelType === Lead::class) {
            return PermissionService::checkAccess($user, 'view_lead', $target, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ])['canAccess'];
        }

        return PermissionService::checkAccess($user, 'view_deals', $target, [
            'added' => 'added_by',
            'owned' => fn ($u, $deal) => $deal->isVisibleToUser($u->id),
        ])['canAccess'];
    }

    /**
     * The event type for a slug: the company's own type first, then the shared
     * one. System types are not excluded here — the caller checks that, so it
     * can report the precise reason.
     */
    private function resolveEventType(string $slug, int $companyId): ?CrmEventType
    {
        if ($slug === '') {
            return null;
        }

        if ($companyId) {
            $type = CrmEventType::withoutGlobalScopes()
                ->where('slug', $slug)
                ->where('company_id', $companyId)
                ->with('category')
                ->first();

            if ($type) {
                return $type;
            }
        }

        return CrmEventType::withoutGlobalScopes()
            ->where('slug', $slug)
            ->whereNull('company_id')
            ->with('category')
            ->first();
    }

    /**
     * The occurrence date, or null when none was chosen (the service then
     * assigns the current time).
     *
     * A genuine historical date is allowed — including one before the record
     * was created — but a date in the future is not a record of something
     * that happened.
     */
    private function resolveOccurredAt(mixed $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        try {
            $occurredAt = CarbonImmutable::parse((string) $raw);
        } catch (\Throwable) {
            throw new CrmEventSubmissionException('The occurrence date could not be understood.', 422);
        }

        if ($occurredAt->greaterThan(now()->addSeconds(self::FUTURE_GRACE_SECONDS))) {
            throw new CrmEventSubmissionException('The occurrence date cannot be in the future.', 422);
        }

        return $occurredAt->toIso8601String();
    }
}
