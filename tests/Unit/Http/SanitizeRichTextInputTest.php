<?php

namespace Tests\Unit\Http;

use App\Http\Controllers\EmailTemplateController;
use App\Http\Controllers\TicketController;
use App\Http\Middleware\SanitizeRichTextInput;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Tests\TestCase;

class SanitizeRichTextInputTest extends TestCase
{
    private const PAYLOAD = '<p>note</p><img src=x onerror=alert(1)>';

    public function test_rich_text_keys_are_sanitized_on_post_put_and_patch(): void
    {
        foreach (['POST', 'PUT', 'PATCH'] as $method) {
            $request = $this->handle(Request::create('/notes', $method, ['description' => self::PAYLOAD, 'message' => self::PAYLOAD]));

            foreach (['description', 'message'] as $key) {
                $this->assertStringContainsString('<p>note</p>', $request->input($key), "{$method} {$key}");
                $this->assertStringNotContainsString('onerror', $request->input($key), "{$method} {$key}");
            }
        }
    }

    public function test_nested_rich_text_keys_are_sanitized(): void
    {
        $request = $this->handle(Request::create('/notes', 'POST', ['notes' => [['details' => self::PAYLOAD]]]));

        $this->assertStringNotContainsString('onerror', $request->input('notes.0.details'));
    }

    public function test_json_bodies_are_sanitized(): void
    {
        $request = Request::create('/notes', 'PATCH', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['details' => self::PAYLOAD]));

        $this->assertStringNotContainsString('onerror', $this->handle($request)->input('details'));
    }

    public function test_email_template_fields_stay_raw_on_the_template_editor_routes(): void
    {
        $template = '<html><head><style>p { color: red; }</style></head><body><p onclick="x()">Hi</p></body></html>';

        $request = Request::create('/account/settings/email-templates/1', 'PUT', [
            'body' => $template,
            'subject' => '<b>Subject</b>',
            'preheader' => '<i>Preheader</i>',
        ]);
        $request->setRouteResolver(fn () => new Route('PUT', 'account/settings/email-templates/{email_template}', ['uses' => EmailTemplateController::class . '@update']));

        $request = $this->handle($request);

        $this->assertSame($template, $request->input('body'));
        $this->assertSame('<b>Subject</b>', $request->input('subject'));
        $this->assertSame('<i>Preheader</i>', $request->input('preheader'));
    }

    public function test_template_field_names_are_sanitized_on_other_routes(): void
    {
        $request = Request::create('/account/tickets', 'POST', ['subject' => self::PAYLOAD, 'body' => self::PAYLOAD]);
        $request->setRouteResolver(fn () => new Route('POST', 'account/tickets', ['uses' => TicketController::class . '@store']));

        $request = $this->handle($request);

        $this->assertStringNotContainsString('onerror', $request->input('subject'));
        $this->assertStringNotContainsString('onerror', $request->input('body'));
    }

    public function test_non_rich_text_keys_are_left_to_the_xss_middleware(): void
    {
        $request = $this->handle(Request::create('/notes', 'POST', ['name' => self::PAYLOAD]));

        $this->assertSame(self::PAYLOAD, $request->input('name'));
    }

    public function test_plain_text_values_are_not_rewritten(): void
    {
        $request = $this->handle(Request::create('/notes', 'POST', ['details' => "Tom & Jerry <3\nsecond line"]));

        $this->assertSame("Tom & Jerry <3\nsecond line", $request->input('details'));
    }

    public function test_read_requests_are_not_touched(): void
    {
        $request = $this->handle(Request::create('/notes', 'GET', ['description' => self::PAYLOAD]));

        $this->assertSame(self::PAYLOAD, $request->input('description'));
    }

    private function handle(Request $request): Request
    {
        $seen = null;

        (new SanitizeRichTextInput())->handle($request, function (Request $request) use (&$seen) {
            $seen = $request;

            return response('ok');
        });

        return $seen;
    }
}
