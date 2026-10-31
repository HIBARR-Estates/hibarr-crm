<?php

namespace Tests\Unit\Support;

use App\Support\SipProviderRegistry;
use Tests\TestCase;

class SipProviderRegistryTest extends TestCase
{
    public function test_sipgate_is_a_supported_platform(): void
    {
        $this->assertSame(['sipgate'], SipProviderRegistry::names());
        $this->assertTrue(SipProviderRegistry::supports('sipgate'));
    }

    public function test_unknown_or_empty_platforms_are_not_supported(): void
    {
        $this->assertFalse(SipProviderRegistry::supports('twilio'));
        $this->assertFalse(SipProviderRegistry::supports(''));
        $this->assertFalse(SipProviderRegistry::supports(null));
        $this->assertNull(SipProviderRegistry::defaults('twilio'));
    }

    public function test_platform_decides_the_websocket_endpoint(): void
    {
        $this->assertSame(
            'wss://sip.sipgate.de',
            SipProviderRegistry::wssUrl('sipgate'),
        );
        $this->assertNull(SipProviderRegistry::wssUrl('twilio'));
    }

    public function test_platform_resolves_the_sip_uri_from_the_username(): void
    {
        $this->assertSame(
            'sip:4711@sipgate.de',
            SipProviderRegistry::sipUri('sipgate', '4711'),
        );
        $this->assertSame(
            'sip:4711@sipgate.de',
            SipProviderRegistry::sipUri('sipgate', ' 4711 '),
        );
    }

    public function test_sip_uri_is_unresolvable_without_a_username(): void
    {
        $this->assertNull(SipProviderRegistry::sipUri('sipgate', null));
        $this->assertNull(SipProviderRegistry::sipUri('sipgate', '   '));
        $this->assertNull(SipProviderRegistry::sipUri('twilio', '4711'));
    }
}
