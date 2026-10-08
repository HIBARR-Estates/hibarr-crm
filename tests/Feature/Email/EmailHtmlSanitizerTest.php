<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMessage;
use App\Email\Support\Charset;
use App\Email\Support\EmailHtmlSanitizer;
use Tests\Concerns\BuildsEmailSchema;
use Tests\TestCase;

class EmailHtmlSanitizerTest extends TestCase
{
    use BuildsEmailSchema;

    public function test_script_and_event_handlers_are_stripped(): void
    {
        $safe = $this->clean(
            '<p onclick="steal()" onmouseover="x()">Hello <b>there</b></p>'
            .'<script>alert(1)</script>'
            .'<img src="x" onerror="alert(2)">'
            .'<a href="javascript:alert(3)">click</a>'
            .'<svg onload="alert(4)"><circle r="1"/></svg>'
            .'<style>p{color:red}</style>'
            .'<iframe src="https://evil.test/frame"></iframe>'
            .'<form action="https://evil.test/post"><input name="password"><button>Go</button></form>'
            .'<object data="https://evil.test/x.swf"></object>'
            .'<meta http-equiv="refresh" content="0;url=https://evil.test">',
        );

        $this->assertStringContainsString('Hello <b>there</b>', $safe);

        foreach (['script', 'onclick', 'onmouseover', 'onerror', 'onload', 'alert', 'javascript:', 'steal', '<svg', '<style', 'color:red',
            '<iframe', '<form', '<input', '<button', '<object', '<meta', 'evil.test'] as $gone) {
            $this->assertStringNotContainsStringIgnoringCase($gone, $safe, $gone);
        }
    }

    public function test_remote_images_and_other_remote_resources_are_not_loaded(): void
    {
        $safe = $this->clean(
            '<p>Our offer</p>'
            .'<img src="https://tracker.test/pixel.gif?id=42" width="1" height="1" alt="">'
            .'<img src="http://tracker.test/banner.png" srcset="https://tracker.test/2x.png 2x" alt="Banner">'
            .'<img src="//tracker.test/protocol-relative.png">'
            .'<img src="data:image/png;base64,iVBORw0KGgo=">'
            .'<div style="background-image:url(https://tracker.test/bg.png); background:url(\'https://tracker.test/bg2.png\'); color:#333">Styled</div>'
            .'<table background="https://tracker.test/table.png"><tr><td>Cell</td></tr></table>'
            .'<link rel="stylesheet" href="https://tracker.test/mail.css">'
            .'<video src="https://tracker.test/v.mp4" poster="https://tracker.test/p.png"></video>',
        );

        $this->assertStringContainsString('Our offer', $safe);
        $this->assertStringContainsString('Styled', $safe);
        $this->assertStringContainsString('Cell', $safe);

        foreach (['<img', 'tracker.test', 'srcset', 'url(', 'background', '<link', '<video', 'data:image'] as $gone) {
            $this->assertStringNotContainsStringIgnoringCase($gone, $safe, $gone);
        }
    }

    public function test_links_are_kept_and_open_safely(): void
    {
        $safe = $this->clean(
            '<p><a href="https://example.test/listing/7">The listing</a> '
            .'<a href="mailto:agent@agency.test">Mail me</a> '
            .'<a href="data:text/html,<script>alert(1)</script>">data</a> '
            .'<a href="vbscript:msgbox(1)">vb</a></p>',
        );

        $this->assertStringContainsString('href="https://example.test/listing/7"', $safe);
        $this->assertStringContainsString('href="mailto:agent@agency.test"', $safe);
        $this->assertStringContainsString('target="_blank"', $safe);
        $this->assertStringContainsString('noopener', $safe);
        $this->assertStringContainsString('noreferrer', $safe);
        $this->assertStringNotContainsString('data:text', $safe);
        $this->assertStringNotContainsString('vbscript', $safe);
    }

    public function test_empty_or_markup_only_html_has_no_safe_copy(): void
    {
        $this->assertNull($this->clean(null));
        $this->assertNull($this->clean('   '));
        $this->assertNull($this->clean('<script>alert(1)</script><img src="https://tracker.test/p.gif">'));
    }

    public function test_a_declared_charset_is_decoded_and_the_original_is_kept_when_that_fails(): void
    {
        $latin1 = "<html><head><meta charset=\"iso-8859-1\"></head><body>Caf\xE9 M\xFCller</body></html>";

        $this->assertSame('iso-8859-1', Charset::declaredIn($latin1));
        $this->assertSame('windows-1252', Charset::declaredIn('<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">'));
        $this->assertNull(Charset::declaredIn('<p>No declaration</p>'));

        $decoded = Charset::toUtf8($latin1, Charset::declaredIn($latin1));

        $this->assertStringContainsString('Café Müller', $decoded);
        $this->assertTrue(mb_check_encoding($decoded, 'UTF-8'));

        // Already UTF-8, declared or not: untouched.
        $this->assertSame('Grüße ✓', Charset::toUtf8('Grüße ✓', 'utf-8'));
        $this->assertSame('Grüße ✓', Charset::toUtf8('Grüße ✓'));
        $this->assertNull(Charset::toUtf8(null));

        // A charset nobody can decode: the body is kept, not dropped.
        $this->assertSame('Plain words', Charset::toUtf8('Plain words', 'x-klingon-9'));

        // Kept, and still storable: only the bytes that are not UTF-8 are replaced.
        $kept = Charset::toUtf8("Caf\xE9 stays readable", 'x-klingon-9');

        $this->assertStringStartsWith('Caf', $kept);
        $this->assertStringEndsWith(' stays readable', $kept);
        $this->assertTrue(mb_check_encoding($kept, 'UTF-8'));
    }

    public function test_ingest_stores_raw_html_safe_html_and_text(): void
    {
        $this->buildEmailSchema();

        $connection = EmailConnection::factory()->forUser($this->makeEmailUser())->create();
        $raw = "<html><head><meta charset=\"iso-8859-1\"></head><body><p onclick=\"x()\">Caf\xE9</p><img src=\"https://tracker.test/p.gif\"><script>alert(1)</script></body></html>";

        $copy = app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-1',
            direction: MessageDirection::Inbound,
            from: new EmailAddress('stranger@example.test'),
            to: [$connection->identity_email],
            subject: 'Hello',
            textBody: "Caf\xC3\xA9",
            htmlRaw: $raw,
            rfcMessageId: '<a@mail.test>',
            folder: 'INBOX',
        ));

        $message = EmailMessage::withoutGlobalScopes()->findOrFail($copy->message_id);

        // Raw: as received (in UTF-8), script and tracker included — for the sanitizer only.
        $this->assertStringContainsString('<script>alert(1)</script>', $message->html_raw);
        $this->assertStringContainsString('tracker.test', $message->html_raw);
        $this->assertStringContainsString('Café', $message->html_raw);
        $this->assertArrayNotHasKey('html_raw', $message->toArray());

        // Safe: what may be shown.
        $this->assertStringContainsString('Café', $message->html_safe);
        $this->assertStringNotContainsString('script', $message->html_safe);
        $this->assertStringNotContainsString('onclick', $message->html_safe);
        $this->assertStringNotContainsString('tracker.test', $message->html_safe);
        $this->assertStringNotContainsString('<img', $message->html_safe);

        $this->assertSame('Café', $message->text_body);

        // A second sync changes nothing.
        app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-1',
            direction: MessageDirection::Inbound,
            from: new EmailAddress('stranger@example.test'),
            to: [$connection->identity_email],
            htmlRaw: '<p>Something else</p>',
            rfcMessageId: '<a@mail.test>',
        ));

        $this->assertSame($message->html_safe, $message->fresh()->html_safe);
        $this->assertSame($message->html_raw, $message->fresh()->html_raw);
    }

    public function test_a_thin_payload_gets_its_safe_html_when_the_full_one_arrives(): void
    {
        $this->buildEmailSchema();

        $connection = EmailConnection::factory()->forUser($this->makeEmailUser())->create();
        $message = fn (?string $html, bool $partial) => new NormalizedMessage(
            providerMessageId: 'prov-1',
            direction: MessageDirection::Inbound,
            from: new EmailAddress('stranger@example.test'),
            to: [$connection->identity_email],
            htmlRaw: $html,
            partial: $partial,
        );

        $copy = app(MessageIngestor::class)->ingestNormalized($connection, $message(null, true));

        $this->assertNull(EmailMessage::withoutGlobalScopes()->findOrFail($copy->message_id)->html_safe);

        app(MessageIngestor::class)->ingestNormalized($connection, $message('<p onclick="x()">Full <i>body</i></p>', false));

        $stored = EmailMessage::withoutGlobalScopes()->findOrFail($copy->message_id);

        $this->assertStringContainsString('Full <i>body</i>', $stored->html_safe);
        $this->assertStringNotContainsString('onclick', $stored->html_safe);
    }

    private function clean(?string $html): ?string
    {
        return app(EmailHtmlSanitizer::class)->clean($html);
    }
}
