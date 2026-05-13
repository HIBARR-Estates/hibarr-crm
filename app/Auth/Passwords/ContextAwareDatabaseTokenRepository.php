<?php

namespace App\Auth\Passwords;

use Illuminate\Auth\Passwords\DatabaseTokenRepository;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Support\Carbon;

class ContextAwareDatabaseTokenRepository extends DatabaseTokenRepository
{
    public const TYPE_STANDARD = 'standard';

    public const TYPE_EMPLOYEE_INVITE = 'employee_invite';

    /** Employee password setup links (API-invited users) stay callable longer than forgot-password links. */
    private const EMPLOYEE_INVITE_TTL_SECONDS = 604800; // 7 days

    public function exists(CanResetPasswordContract $user, $token)
    {
        $record = (array) $this->getTable()->where(
            'email', $user->getEmailForPasswordReset()
        )->first();

        return $record
            && ! $this->tokenExpiredForRecord($record)
            && $this->hasher->check($token, $record['token']);
    }

    public function deleteExpired()
    {
        $standardCutoff = Carbon::now()->subSeconds((int) $this->expires);
        $inviteCutoff = Carbon::now()->subSeconds(self::EMPLOYEE_INVITE_TTL_SECONDS);

        $this->getTable()->where(function ($query) use ($standardCutoff, $inviteCutoff) {
            $query->where(function ($q) use ($standardCutoff) {
                $q->where(function ($q2) {
                    $q2->whereNull('type')->orWhere('type', self::TYPE_STANDARD);
                });
                $q->where('created_at', '<', $standardCutoff);
            })->orWhere(function ($q) use ($inviteCutoff) {
                $q->where('type', self::TYPE_EMPLOYEE_INVITE);
                $q->where('created_at', '<', $inviteCutoff);
            });
        })->delete();
    }

    protected function getPayload($email, $token)
    {
        return [
            'email' => $email,
            'token' => $this->hasher->make($token),
            'created_at' => new Carbon,
            'type' => self::TYPE_STANDARD,
        ];
    }

    protected function tokenExpiredForRecord(array $record): bool
    {
        $ttlSeconds = $this->ttlSecondsForRecord($record);

        return Carbon::parse($record['created_at'])->addSeconds($ttlSeconds)->isPast();
    }

    private function ttlSecondsForRecord(array $record): int
    {
        $type = $record['type'] ?? null;

        if ($type === self::TYPE_EMPLOYEE_INVITE) {
            return self::EMPLOYEE_INVITE_TTL_SECONDS;
        }

        return (int) $this->expires;
    }
}
