<?php

namespace Tests\Feature\Translation;

use App\Helper\Reply;
use App\Models\DynamicTranslation;
use App\Services\DynamicTranslationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ServerSideDynamicTranslationTest extends TestCase
{
    use RefreshDatabase;

    private function seedTranslation(string $en, string $de): void
    {
        $service = app(DynamicTranslationService::class);

        DynamicTranslation::query()->create([
            'hash_key' => $service->hash($en),
            'source_text' => $en,
            'en' => $en,
            'de' => $de,
            'status' => DynamicTranslation::STATUS_COMPLETE,
        ]);
    }

    public function test_english_locale_returns_text_unchanged_without_touching_the_database(): void
    {
        app()->setLocale('eng');

        $this->assertSame('Lead saved.', td('Lead saved.'));
        $this->assertSame(0, DynamicTranslation::query()->count());
    }

    public function test_non_english_locale_uses_stored_translation(): void
    {
        $this->seedTranslation('Lead saved.', 'Lead gespeichert.');
        app()->setLocale('de');

        $this->assertSame('Lead gespeichert.', td('Lead saved.'));
    }

    public function test_missing_translation_falls_back_to_english_and_queues_it(): void
    {
        Queue::fake();
        app()->setLocale('de');

        $this->assertSame('Brand new sentence.', td('Brand new sentence.'));
        $this->assertDatabaseHas('dynamic_translations', ['source_text' => 'Brand new sentence.']);
    }

    public function test_reply_translates_inline_english_but_leaves_keys_and_interpolated_text_alone(): void
    {
        Queue::fake();
        config(['services.dynamic_translation.reply_fallback' => true]);
        $this->seedTranslation('Lead saved.', 'Lead gespeichert.');
        app()->setLocale('de');

        $this->assertSame('Lead gespeichert.', Reply::success('Lead saved.')['message']);
        $this->assertSame('Row 7 skipped', Reply::error('Row 7 skipped')['message']);
        $this->assertSame(0, DynamicTranslation::query()->where('source_text', 'Row 7 skipped')->count());
    }
}
