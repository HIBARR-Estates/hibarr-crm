<?php

namespace Tests\Unit\Support;

use App\Support\MailPreheader;
use Tests\TestCase;

class MailPreheaderTest extends TestCase
{
    public function test_hidden_html_includes_text_and_padding(): void
    {
        $html = MailPreheader::hiddenHtml('Open the lead to get started.');

        $this->assertStringContainsString('Open the lead to get started.', $html);
        $this->assertStringContainsString('display:none', $html);
        $this->assertStringContainsString('mso-hide:all', $html);
        $this->assertStringContainsString('&nbsp;&zwnj;', $html);
        $this->assertSame(
            MailPreheader::PAD_UNITS,
            substr_count($html, '&nbsp;&zwnj;')
        );
    }

    public function test_sanitize_strips_tags_and_caps_length(): void
    {
        $this->assertSame(
            'Hello world',
            MailPreheader::sanitize('<p>Hello<br>world</p>')
        );

        $long = str_repeat('a', 200);
        $this->assertSame(90, strlen(MailPreheader::sanitize($long)));
    }

    public function test_sanitize_counts_multibyte_characters_for_max_length(): void
    {
        $multibyte = str_repeat('ü', 120);

        $this->assertSame(90, mb_strlen(MailPreheader::sanitize($multibyte), 'UTF-8'));
    }

    public function test_empty_input_yields_empty_html(): void
    {
        $this->assertSame('', MailPreheader::hiddenHtml(''));
        $this->assertSame('', MailPreheader::hiddenHtml('   '));
    }
}
