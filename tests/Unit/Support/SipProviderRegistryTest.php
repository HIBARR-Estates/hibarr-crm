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

    public function test_platform_decides_default_max_concurrent_calls(): void
    {
        $this->assertSame(2, SipProviderRegistry::defaultMaxConcurrentCalls('sipgate'));
        $this->assertSame(2, SipProviderRegistry::defaultMaxConcurrentCalls('unknown'));
    }

    public function test_platform_decides_stun_url(): void
    {
        $this->assertSame(
            'stun:stun.sipgate.de:3478',
            SipProviderRegistry::stunUrl('sipgate'),
        );
        $this->assertNull(SipProviderRegistry::stunUrl('unknown'));
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

    public function test_sha256_digest_uses_the_same_construction_as_md5_with_sha256(): void
    {
        $h = fn (string $v): string => hash('sha256', $v);
        $ha1 = $h('alice:example.com:secret');
        $expected = $h($ha1.':n1:00000001:c1:auth:'.$h('REGISTER:sip:example.com'));

        $this->assertSame($expected, SipProviderRegistry::signDigestChallenge(
            username: 'alice',
            password: 'secret',
            realm: 'example.com',
            method: 'REGISTER',
            uri: 'sip:example.com',
            nonce: 'n1',
            qop: 'auth',
            nc: '00000001',
            cnonce: 'c1',
            algorithm: 'SHA-256',
        ));
    }

    public function test_auth_int_hashes_the_empty_body_in_the_challenge_algorithm(): void
    {
        $ha1 = md5('alice:example.com:secret');
        $expected = md5($ha1.':n1:00000001:c1:auth-int:'.md5('INVITE:sip:1@example.com:'.md5('')));

        $this->assertSame($expected, SipProviderRegistry::signDigestChallenge(
            'alice', 'secret', 'example.com', 'INVITE', 'sip:1@example.com', 'n1', 'auth-int', '00000001', 'c1',
        ));
    }

    public function test_an_unsupported_algorithm_is_never_signed(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        SipProviderRegistry::signDigestChallenge('a', 'b', 'r', 'REGISTER', 'sip:r', 'n', algorithm: 'SHA-512-256');
    }

    public function test_unknown_provider_profile_is_the_generic_one(): void
    {
        $profile = SipProviderRegistry::clientProfile(null);

        $this->assertNull($profile['key']);
        $this->assertNull($profile['sip_domain']);
        $this->assertSame(['MD5'], $profile['digest_algorithms']);
        $this->assertSame([['urls' => SipProviderRegistry::DEFAULT_STUN]], $profile['ice_servers']);
        $this->assertStringContainsString('your SIP provider', $profile['messages']['not_registered']);
        $this->assertStringNotContainsString(':provider', json_encode($profile['messages']));
    }

    public function test_every_registered_provider_profile_is_complete(): void
    {
        $keys = array_keys(SipProviderRegistry::DEFAULT_CLIENT_PROFILE['messages']);

        foreach (SipProviderRegistry::names() as $name) {
            $profile = SipProviderRegistry::clientProfile($name);

            $this->assertSame($name, $profile['key']);
            $this->assertNotSame([], $profile['digest_algorithms'], "{$name} must sign with at least one algorithm");
            $this->assertNotNull(SipProviderRegistry::digestRealm($name), "{$name} needs a digestRealm for realm pinning");
            foreach ($keys as $key) {
                $this->assertArrayHasKey($key, $profile['messages'], "{$name} profile is missing {$key}");
            }
            $this->assertStringNotContainsString(':provider', json_encode($profile['messages']));
        }
    }
}
