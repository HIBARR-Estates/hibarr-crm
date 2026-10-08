<?php

namespace App\Email\FollowUps;

use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Shared attach helper for CRM create endpoints. Failures surface as HTTP
 * errors; a missing source field is ignored.
 */
trait AttachesSourceEmail
{
    protected function attachSourceEmail(User $actor, Model $followable, mixed $sourceEmailMessageId): void
    {
        if ($sourceEmailMessageId === null || $sourceEmailMessageId === '') {
            return;
        }

        try {
            app(FollowUpLinker::class)->attachFromRequest($actor, $followable, $sourceEmailMessageId);
        } catch (DomainException $exception) {
            throw new HttpException(422, $exception->getMessage(), $exception);
        } catch (Throwable $exception) {
            // Email module unavailable (flag off / schema missing) — create still succeeds.
            report($exception);
        }
    }

    protected function sourceEmailMessageIdFor(Model $followable): ?string
    {
        try {
            return app(FollowUpLinker::class)->sourceUuidFor($followable);
        } catch (Throwable) {
            return null;
        }
    }
}
