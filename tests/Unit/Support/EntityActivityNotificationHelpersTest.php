<?php

namespace Tests\Unit\Support;

use App\Support\EntityActivityMailBuilder;
use App\Support\EntityActivityNotificationUrl;
use Tests\TestCase;

class EntityActivityNotificationHelpersTest extends TestCase
{
    public function test_note_excerpt_returns_first_five_words(): void
    {
        $excerpt = EntityActivityMailBuilder::noteExcerpt(
            '<p>One two three four five six seven</p>',
        );

        $this->assertSame('One two three four five…', $excerpt);
    }

    public function test_note_excerpt_returns_null_for_empty_body(): void
    {
        $this->assertNull(EntityActivityMailBuilder::noteExcerpt('<p></p>'));
    }

    public function test_deal_activity_url_includes_notes_tab(): void
    {
        $url = EntityActivityNotificationUrl::dealShowUrl(42, 'note_added');

        $this->assertStringContainsString('deals/', $url);
        $this->assertStringContainsString('tab=notes', $url);
    }

    public function test_lead_activity_url_includes_tasks_tab(): void
    {
        $url = EntityActivityNotificationUrl::leadShowUrl(7, 'task_updated');

        $this->assertStringContainsString('lead-contact/', $url);
        $this->assertStringContainsString('tab=tasks', $url);
    }
}
