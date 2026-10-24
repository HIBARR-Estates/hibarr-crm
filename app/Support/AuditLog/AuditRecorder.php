<?php

namespace App\Support\AuditLog;

use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes one `audit_logs` row per Eloquent create / update / delete / restore
 * and per sign-in event, application-wide, without touching any model.
 *
 * Hooked onto the wildcard `eloquent.*: *` events, so every model is covered
 * — including ones added later — except those in config('audit-log.excluded_models').
 * Writes that skip model events (query-builder updates, `insert()`,
 * `saveQuietly()`, `withoutEvents()`) are not seen.
 *
 * Recording must never change the outcome of the write it describes: every
 * step is wrapped, a failure is reported once and swallowed, and the row is
 * written through the query builder so it fires no events of its own. The
 * insert runs on the same connection as the change, inside any open
 * transaction, so a rolled-back change leaves no audit row behind.
 */
class AuditRecorder
{
    public const TABLE = 'audit_logs';

    private const REDACTED = '[redacted]';

    /** Whether `audit_logs` exists, per connection name ('' for the default). */
    private array $tableReady = [];

    private bool $failureReported = false;

    /** Display name of the queued job being processed, if any. */
    private ?string $currentJob = null;

    public function register(): void
    {
        if (! config('audit-log.enabled', true) || $this->isSkippedCommand()) {
            return;
        }

        foreach (['created', 'updated', 'deleted', 'restored'] as $event) {
            Event::listen("eloquent.{$event}: *", function (string $eventName, array $payload) use ($event) {
                $model = $payload[0] ?? null;

                if ($model instanceof Model) {
                    $this->recordModelEvent($event, $model);
                }

                // Returning nothing keeps later listeners running (`false` would halt them).
                return null;
            });
        }

        Event::listen(Login::class, fn (Login $e) => $this->recordAuthEvent('login', $e->user));
        Event::listen(Logout::class, fn (Logout $e) => $this->recordAuthEvent('logout', $e->user));
        Event::listen(PasswordReset::class, fn (PasswordReset $e) => $this->recordAuthEvent('password_reset', $e->user));
        Event::listen(Failed::class, fn (Failed $e) => $this->recordFailedLogin($e));

        Event::listen(JobProcessing::class, function (JobProcessing $e) {
            $this->currentJob = $this->safely(fn () => $e->job->resolveName());
        });
        Event::listen(JobProcessed::class, function () {
            $this->currentJob = null;
        });
        Event::listen(JobFailed::class, function () {
            $this->currentJob = null;
        });
    }

    public function recordModelEvent(string $event, Model $model): void
    {
        $this->safely(function () use ($event, $model) {
            if ($this->isExcluded($model)) {
                return;
            }

            [$old, $new] = match ($event) {
                'created' => [null, $this->filterAttributes($model, $model->getAttributes())],
                'updated' => $this->updatedValues($model),
                'deleted' => [$this->filterAttributes($model, $model->getRawOriginal()), null],
                'restored' => [null, null],
                default => [null, null],
            };

            if ($event === 'updated' && $old === null && $new === null) {
                return;
            }

            $actor = $this->actor();

            $this->write($model->getConnectionName(), [
                'company_id' => $this->companyIdFor($model, $actor),
                'event' => $event,
                'auditable_type' => $model->getMorphClass(),
                'auditable_id' => $this->stringOrNull($model->getKey(), 64),
                'auditable_label' => $this->labelFor($model),
                'old_values' => $this->encode($old),
                'new_values' => $this->encode($new),
            ], $actor);
        });
    }

    public function recordAuthEvent(string $event, ?Authenticatable $user): void
    {
        $this->safely(function () use ($event, $user) {
            if (! $user) {
                return;
            }

            $model = $user instanceof Model ? $user : null;

            $this->write($model?->getConnectionName(), [
                'company_id' => $model ? $this->intOrNull($model->getAttributes()['company_id'] ?? null) : null,
                'event' => $event,
                'auditable_type' => $model ? $model->getMorphClass() : get_class($user),
                'auditable_id' => $this->stringOrNull($user->getAuthIdentifier(), 64),
                'auditable_label' => $model ? $this->labelFor($model) : null,
                'old_values' => null,
                'new_values' => null,
            ], $user);
        });
    }

    public function recordFailedLogin(Failed $event): void
    {
        $this->safely(function () use ($event) {
            $user = $event->user;
            $model = $user instanceof Model ? $user : null;

            // Only the identifier that was tried — never the password.
            $identifier = collect($event->credentials ?? [])
                ->only(['email', 'username', 'login', 'mobile'])
                ->map(fn ($value) => $this->stringOrNull($value, 255))
                ->filter()
                ->all();

            $this->write($model?->getConnectionName(), [
                'company_id' => $model ? $this->intOrNull($model->getAttributes()['company_id'] ?? null) : null,
                'event' => 'login_failed',
                'auditable_type' => $model ? $model->getMorphClass() : 'App\\Models\\User',
                'auditable_id' => $user ? $this->stringOrNull($user->getAuthIdentifier(), 64) : null,
                'auditable_label' => $model ? $this->labelFor($model) : ($identifier['email'] ?? reset($identifier) ?: null),
                'old_values' => null,
                'new_values' => $this->encode($identifier ?: null),
            ], null);
        });
    }

    /**
     * Old and new values of the attributes this save actually changed, with
     * ignored and read-tracking columns dropped. [null, null] when nothing
     * worth recording changed.
     *
     * @return array{0: ?array, 1: ?array}
     */
    private function updatedValues(Model $model): array
    {
        $changes = $model->getChanges();
        $skip = array_merge(
            (array) config('audit-log.ignored_attributes', []),
            (array) config('audit-log.read_attributes', []),
        );

        $changes = array_diff_key($changes, array_flip($skip));

        // restore() saves `deleted_at = null` first; the `restored` row covers it.
        if (array_keys($changes) === ['deleted_at'] && $changes['deleted_at'] === null) {
            return [null, null];
        }

        if ($changes === []) {
            return [null, null];
        }

        $old = [];
        foreach (array_keys($changes) as $key) {
            $old[$key] = $model->getRawOriginal($key);
        }

        return [$this->filterAttributes($model, $old), $this->filterAttributes($model, $changes)];
    }

    /** Drops ignored attributes, redacts sensitive ones and normalises/truncates values. */
    private function filterAttributes(Model $model, array $attributes): ?array
    {
        $ignored = array_flip((array) config('audit-log.ignored_attributes', []));
        $hidden = array_flip($model->getHidden());
        $out = [];

        foreach ($attributes as $key => $value) {
            if (! is_string($key) || isset($ignored[$key])) {
                continue;
            }

            $out[$key] = (isset($hidden[$key]) || $this->isRedacted($key))
                ? ($value === null ? null : self::REDACTED)
                : $this->normaliseValue($value);
        }

        return $out === [] ? null : $out;
    }

    private function isRedacted(string $key): bool
    {
        $key = strtolower($key);

        foreach ((array) config('audit-log.redacted_attributes', []) as $needle) {
            if ($needle !== '' && str_contains($key, strtolower($needle))) {
                return true;
            }
        }

        return false;
    }

    private function normaliseValue(mixed $value): mixed
    {
        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if ($value instanceof \BackedEnum) {
            $value = $value->value;
        } elseif ($value instanceof \DateTimeInterface) {
            $value = $value->format('Y-m-d H:i:s');
        } elseif (! is_string($value)) {
            $value = json_encode($value, JSON_PARTIAL_OUTPUT_ON_ERROR) ?: '';
        }

        if (! is_string($value)) {
            return $value;
        }

        // Binary blobs would break json_encode of the whole row.
        if (! mb_check_encoding($value, 'UTF-8')) {
            return '[binary]';
        }

        $max = (int) config('audit-log.max_value_length', 2000);

        return $max > 0 ? Str::limit($value, $max) : $value;
    }

    private function isExcluded(Model $model): bool
    {
        if ($model->getTable() === self::TABLE) {
            return true;
        }

        foreach ((array) config('audit-log.excluded_models', []) as $class) {
            if ($model instanceof $class) {
                return true;
            }
        }

        return false;
    }

    /** A human-readable name for the record, read from raw attributes only (no accessors, no queries). */
    private function labelFor(Model $model): ?string
    {
        $attributes = $model->getAttributes() ?: $model->getRawOriginal();

        foreach (['name', 'title', 'heading', 'client_name', 'company_name', 'subject', 'label', 'email', 'filename', 'number'] as $key) {
            $value = $attributes[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return $this->stringOrNull(trim($value), 255);
            }
        }

        return null;
    }

    private function companyIdFor(Model $model, ?Authenticatable $actor): ?int
    {
        $attributes = $model->getAttributes();
        $companyId = $attributes['company_id'] ?? $model->getRawOriginal('company_id');

        if ($companyId === null && $actor instanceof Model) {
            $companyId = $actor->getAttributes()['company_id'] ?? null;
        }

        return $this->intOrNull($companyId);
    }

    /** The signed-in user on whichever guard already resolved one; never forces a lookup. */
    private function actor(): ?Authenticatable
    {
        return $this->safely(function () {
            $default = Auth::getDefaultDriver();

            if (Auth::guard($default)->hasUser()) {
                return Auth::guard($default)->user();
            }

            foreach (array_keys((array) config('auth.guards', [])) as $guard) {
                if ($guard !== $default && Auth::guard($guard)->hasUser()) {
                    return Auth::guard($guard)->user();
                }
            }

            return null;
        });
    }

    private function write(?string $connection, array $row, ?Authenticatable $actor): void
    {
        if (! $this->tableReady($connection)) {
            return;
        }

        $actorModel = $actor instanceof Model ? $actor : null;
        $actorAttributes = $actorModel?->getAttributes() ?? [];

        $row += [
            'user_id' => $actor ? $this->intOrNull($actor->getAuthIdentifier()) : null,
            'user_name' => $this->stringOrNull($actorAttributes['name'] ?? ($actorAttributes['email'] ?? null), 255),
            'created_at' => now(),
        ];

        $row += $this->originContext();

        try {
            DB::connection($connection)->table(self::TABLE)->insert($row);
        } catch (Throwable $e) {
            // Table dropped or not migrated on this connection: stop trying.
            unset($this->tableReady[$connection ?? '']);
            $this->tableReady($connection);

            throw $e;
        }
    }

    private function originContext(): array
    {
        if (app()->runningInConsole()) {
            if ($this->currentJob) {
                return ['source' => 'queue', 'origin' => $this->stringOrNull($this->currentJob, 2048)];
            }

            $command = $_SERVER['argv'][1] ?? null;

            return ['source' => 'console', 'origin' => $command ? $this->stringOrNull('artisan '.$command, 2048) : null];
        }

        $request = request();

        return [
            'source' => $request->is('api/*') ? 'api' : 'web',
            'ip_address' => $this->stringOrNull($request->ip(), 45),
            'user_agent' => $this->stringOrNull($request->userAgent(), 512),
            'http_method' => $this->stringOrNull($request->method(), 10),
            'origin' => $this->stringOrNull($request->url(), 2048),
        ];
    }

    private function tableReady(?string $connection): bool
    {
        $key = $connection ?? '';

        if (! array_key_exists($key, $this->tableReady)) {
            $this->tableReady[$key] = (bool) $this->safely(fn () => Schema::connection($connection)->hasTable(self::TABLE));
        }

        return $this->tableReady[$key];
    }

    private function isSkippedCommand(): bool
    {
        if (! app()->runningInConsole()) {
            return false;
        }

        $command = $_SERVER['argv'][1] ?? null;

        return $command !== null && in_array($command, (array) config('audit-log.skipped_commands', []), true);
    }

    private function encode(?array $values): ?string
    {
        if (! $values) {
            return null;
        }

        return json_encode($values, JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE) ?: null;
    }

    private function stringOrNull(mixed $value, int $max): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_scalar($value) && ! $value instanceof \Stringable) {
            return null;
        }

        return Str::limit((string) $value, $max - 3);
    }

    private function intOrNull(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    /**
     * Runs a recording step; any failure is reported once per process and
     * swallowed so the caller's write is never affected.
     */
    private function safely(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (Throwable $e) {
            if (! $this->failureReported) {
                $this->failureReported = true;

                try {
                    Log::warning('Audit log: failed to record an entry', ['exception' => $e]);
                } catch (Throwable) {
                    // Logging itself failed; nothing more to do.
                }
            }

            return null;
        }
    }
}
