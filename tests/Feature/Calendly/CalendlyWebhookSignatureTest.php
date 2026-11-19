<?php

namespace Tests\Feature\Calendly;

use App\Http\Controllers\CalendlyWebhookController;
use PHPUnit\Framework\TestCase;

class CalendlyWebhookSignatureTest extends TestCase
{
    private const KEY = 'a-signing-key-the-admin-chose';

    private const BODY = '{"event":"invitee.created","payload":{}}';

    private function header(int $timestamp, string $body = self::BODY, string $key = self::KEY): string
    {
        return 't='.$timestamp.',v1='.hash_hmac('sha256', $timestamp.'.'.$body, $key);
    }

    public function test_a_delivery_signed_with_the_saved_key_is_accepted(): void
    {
        $this->assertTrue(CalendlyWebhookController::validSignature($this->header(1_800_000_000), self::BODY, self::KEY, 1_800_000_010));
    }

    public function test_a_wrong_key_or_changed_body_is_refused(): void
    {
        $header = $this->header(1_800_000_000);

        $this->assertFalse(CalendlyWebhookController::validSignature($header, self::BODY, 'another-key', 1_800_000_010));
        $this->assertFalse(CalendlyWebhookController::validSignature($header, '{"event":"invitee.created","payload":{"x":1}}', self::KEY, 1_800_000_010));
    }

    public function test_an_old_delivery_is_refused_so_it_cannot_be_replayed(): void
    {
        $header = $this->header(1_800_000_000);

        $this->assertTrue(CalendlyWebhookController::validSignature($header, self::BODY, self::KEY, 1_800_000_179));
        $this->assertFalse(CalendlyWebhookController::validSignature($header, self::BODY, self::KEY, 1_800_000_181));
    }

    public function test_a_missing_or_malformed_header_is_refused(): void
    {
        foreach (['', 'garbage', 't=1800000000', 'v1=abc', 't=abc,v1=abc'] as $header) {
            $this->assertFalse(CalendlyWebhookController::validSignature($header, self::BODY, self::KEY, 1_800_000_000), $header);
        }
    }
}
