<?php

namespace Tests\Unit\Models;

use App\Models\User;
use Tests\TestCase;

class UserTwoFactorCodeTest extends TestCase
{
    public function test_matching_unexpired_code_is_valid(): void
    {
        $user = $this->userWithCode('123456', now()->addMinutes(5)->toDateTimeString());

        $this->assertTrue($user->hasValidTwoFactorCode('123456'));
    }

    public function test_wrong_code_is_rejected(): void
    {
        $user = $this->userWithCode('123456', now()->addMinutes(5)->toDateTimeString());

        $this->assertFalse($user->hasValidTwoFactorCode('654321'));
        $this->assertFalse($user->hasValidTwoFactorCode(''));
    }

    public function test_expired_code_is_rejected(): void
    {
        $user = $this->userWithCode('123456', now()->subMinute()->toDateTimeString());

        $this->assertFalse($user->hasValidTwoFactorCode('123456'));
    }

    public function test_missing_code_or_expiry_is_rejected(): void
    {
        $this->assertFalse($this->userWithCode(null, now()->addMinutes(5)->toDateTimeString())->hasValidTwoFactorCode(''));
        $this->assertFalse($this->userWithCode('123456', null)->hasValidTwoFactorCode('123456'));
    }

    private function userWithCode(?string $code, ?string $expiresAt): User
    {
        $user = new User();
        $user->setRawAttributes([
            'two_factor_code' => $code,
            'two_factor_expires_at' => $expiresAt,
        ]);

        return $user;
    }
}
