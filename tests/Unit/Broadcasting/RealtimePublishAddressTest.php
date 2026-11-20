<?php

namespace Tests\Unit\Broadcasting;

use Tests\TestCase;

/**
 * The app publishes events to Reverb over the internal address when one is given, while browsers keep
 * using the public one. Without it, publishing falls back to the public address.
 */
class RealtimePublishAddressTest extends TestCase
{
    private const VARS = ['REVERB_HOST', 'REVERB_PORT', 'REVERB_SCHEME', 'REVERB_PUBLISH_HOST', 'REVERB_PUBLISH_PORT', 'REVERB_PUBLISH_SCHEME'];

    protected function tearDown(): void
    {
        foreach (self::VARS as $var) {
            putenv($var);
        }

        parent::tearDown();
    }

    public function test_publishing_uses_the_internal_address_when_one_is_set(): void
    {
        $this->setEnv(['REVERB_HOST' => 'ws.example.test', 'REVERB_PORT' => '443', 'REVERB_SCHEME' => 'https',
            'REVERB_PUBLISH_HOST' => 'reverb', 'REVERB_PUBLISH_PORT' => '8080', 'REVERB_PUBLISH_SCHEME' => 'http']);

        $options = $this->reverbConnection()['options'];

        $this->assertSame('reverb', $options['host']);
        $this->assertEquals(8080, $options['port']);
        $this->assertSame('http', $options['scheme']);
        $this->assertFalse($options['useTLS']);
    }

    public function test_publishing_falls_back_to_the_public_address(): void
    {
        $this->setEnv(['REVERB_HOST' => 'ws.example.test', 'REVERB_PORT' => '443', 'REVERB_SCHEME' => 'https']);

        $options = $this->reverbConnection()['options'];

        $this->assertSame('ws.example.test', $options['host']);
        $this->assertEquals(443, $options['port']);
        $this->assertSame('https', $options['scheme']);
        $this->assertTrue($options['useTLS']);
    }

    /** @param  array<string, string>  $values */
    private function setEnv(array $values): void
    {
        foreach (self::VARS as $var) {
            putenv($var);
        }
        foreach ($values as $name => $value) {
            putenv("{$name}={$value}");
        }
    }

    /** @return array<string, mixed> */
    private function reverbConnection(): array
    {
        return (require base_path('config/broadcasting.php'))['connections']['reverb'];
    }
}
