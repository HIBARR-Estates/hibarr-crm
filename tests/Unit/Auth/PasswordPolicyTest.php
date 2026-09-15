<?php

namespace Tests\Unit\Auth;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Tests\TestCase;

class PasswordPolicyTest extends TestCase
{
    public function test_weak_passwords_are_rejected(): void
    {
        foreach (['short12', 'onlyletterslong', '1234567890'] as $password) {
            $this->assertTrue($this->fails($password), "'{$password}' should be rejected");
        }
    }

    public function test_long_password_with_letters_and_numbers_is_accepted(): void
    {
        $this->assertFalse($this->fails('correcthorse42'));
    }

    private function fails(string $password): bool
    {
        return Validator::make(['password' => $password], ['password' => ['required', Password::defaults()]])->fails();
    }
}
