<?php

namespace Tests\Unit\AiSummary;

use App\Services\AiSummary\HibarrAiSummaryService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HibarrAiSummaryServiceSlugTest extends TestCase
{
    private const SLUG = 'lead-summary';

    private const URL = 'https://ai.test/v1/ai/execute/lead-summary';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.ai.base_url' => 'https://ai.test/v1/',
            'services.ai.api_key' => 'secret-key',
            'services.ai.timeout' => 5,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(): array
    {
        return [
            'status_line' => 'Investor buying in Antalya.',
            'summary' => 'Wants a **2-bed in Antalya** for **€200–250K** cash.',
            'facts' => [['kind' => 'location', 'value' => 'Antalya']],
        ];
    }

    private function envelope(string $output): array
    {
        return [
            'success' => true,
            'message' => 'AI execution completed successfully',
            'data' => ['slug' => self::SLUG, 'output' => $output],
        ];
    }

    public function test_it_posts_only_the_data_to_the_slug_endpoint(): void
    {
        Http::fake([self::URL => Http::response($this->envelope(json_encode($this->summary())))]);

        $input = ['lead' => ['type' => 'buyer'], 'sections' => ['notes' => [['text' => 'Wants Antalya — sea view']]]];

        $result = (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, $input);

        $this->assertSame($this->summary(), $result);

        Http::assertSentCount(1);
        Http::assertSent(function (Request $request) use ($input) {
            $body = $request->data();

            return $request->method() === 'POST'
                && $request->url() === self::URL
                && $request->hasHeader('x-api-key', 'secret-key')
                // The data is the user prompt, unescaped unicode and all…
                && $body['userPrompt'] === json_encode($input, JSON_UNESCAPED_UNICODE)
                // …and nothing the saved config already owns is sent from here.
                && array_keys($body) === ['userPrompt'];
        });
    }

    public function test_it_reads_json_wrapped_in_a_markdown_fence(): void
    {
        $fenced = "```json\n".json_encode($this->summary())."\n```";
        Http::fake([self::URL => Http::response($this->envelope($fenced))]);

        $this->assertSame(
            $this->summary(),
            (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []])
        );
    }

    public function test_the_slug_is_url_encoded(): void
    {
        Http::fake(['https://ai.test/v1/ai/execute/*' => Http::response($this->envelope('{"ok":true}'))]);

        (new HibarrAiSummaryService())->executeAgentBySlug('odd slug/with?chars', ['lead' => []]);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://ai.test/v1/ai/execute/odd%20slug%2Fwith%3Fchars');
    }

    public function test_a_missing_config_is_reported_by_slug(): void
    {
        Http::fake([self::URL => Http::response(['success' => false, 'message' => 'Not found'], 404)]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('AI config "lead-summary" was not found or is inactive.');

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);
    }

    public function test_other_http_failures_are_a_generic_request_failure(): void
    {
        Http::fake([self::URL => Http::response(['success' => false], 502)]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('AI summary API request failed.');

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);
    }

    public function test_an_empty_output_is_rejected(): void
    {
        Http::fake([self::URL => Http::response($this->envelope(''))]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('AI summary API returned an empty output.');

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);
    }

    public function test_output_that_is_not_json_is_rejected(): void
    {
        Http::fake([self::URL => Http::response($this->envelope('Sorry, I cannot help with that.'))]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('AI summary completion was not valid JSON.');

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);
    }

    public function test_a_connection_failure_becomes_a_timeout_error(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28'));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('The AI summary request timed out.');

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);
    }

    public function test_the_api_key_header_is_omitted_when_no_key_is_configured(): void
    {
        config(['services.ai.api_key' => null]);
        Http::fake([self::URL => Http::response($this->envelope('{"ok":true}'))]);

        (new HibarrAiSummaryService())->executeAgentBySlug(self::SLUG, ['lead' => []]);

        Http::assertSent(fn (Request $request) => ! $request->hasHeader('x-api-key'));
    }
}
