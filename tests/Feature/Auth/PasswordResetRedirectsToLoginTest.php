<?php

namespace Tests\Feature\Auth;

use App\Http\Middleware\VerifyCsrfToken;
use Tests\TestCase;

class PasswordResetRedirectsToLoginTest extends TestCase
{
    public function test_forgot_password_page_redirects_to_login(): void
    {
        $this->get('/forgot-password')->assertRedirect(route('login'));
    }

    public function test_forgot_password_submit_redirects_to_login(): void
    {
        $this->withoutMiddleware(VerifyCsrfToken::class)
            ->post('/forgot-password')
            ->assertRedirect(route('login'));
    }

    public function test_reset_password_page_redirects_to_login(): void
    {
        $this->get('/reset-password/example-token')->assertRedirect(route('login'));
    }

    public function test_reset_password_submit_redirects_to_login(): void
    {
        $this->withoutMiddleware(VerifyCsrfToken::class)
            ->post('/reset-password')
            ->assertRedirect(route('login'));
    }
}
