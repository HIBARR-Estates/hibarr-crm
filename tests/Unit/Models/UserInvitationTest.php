<?php

namespace Tests\Unit\Models;

use App\Models\UserInvitation;
use Tests\TestCase;

class UserInvitationTest extends TestCase
{
    public function test_generated_codes_are_long_and_random(): void
    {
        $code = UserInvitation::generateCode();

        $this->assertSame(40, strlen($code));
        $this->assertNotSame($code, UserInvitation::generateCode());
    }

    public function test_email_restriction_limits_the_accepted_domain(): void
    {
        $invite = new UserInvitation(['email_restriction' => 'hibarr.de']);

        $this->assertTrue($invite->allowsEmail('agent@hibarr.de'));
        $this->assertTrue($invite->allowsEmail('Agent@HIBARR.de'));
        $this->assertFalse($invite->allowsEmail('agent@evil-hibarr.de'));
        $this->assertFalse($invite->allowsEmail('agent@hibarr.de.example.com'));
    }

    public function test_unrestricted_invite_allows_any_email(): void
    {
        $this->assertTrue((new UserInvitation())->allowsEmail('someone@example.com'));
    }
}
