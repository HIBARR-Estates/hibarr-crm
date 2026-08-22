<?php

namespace Tests\Unit\Models;

use App\Models\EmailTemplate;
use Tests\TestCase;

class EmailTemplateSampleValuesTest extends TestCase
{
    public function test_resolves_merge_tags_to_sample_values()
    {
        $resolved = EmailTemplate::resolveSampleTags('{{assignedByName}} assigned you to a lead.');

        $this->assertSame('Mark Taylor assigned you to a lead.', $resolved);
    }

    public function test_resolves_tags_inside_attributes()
    {
        $resolved = EmailTemplate::resolveSampleTags('<a href="{{leadUrl}}">View</a>');

        $this->assertSame('<a href="https://example.com/view">View</a>', $resolved);
    }

    public function test_guesses_value_kinds_from_tag_names()
    {
        $this->assertSame('jane.doe@example.com', EmailTemplate::sampleValueFor('leadEmail'));
        $this->assertSame('Jane Doe', EmailTemplate::sampleValueFor('client_name'));
        $this->assertSame('+49 151 234 5678', EmailTemplate::sampleValueFor('lead_mobile'));
        $this->assertSame('€250,000', EmailTemplate::sampleValueFor('dealValue'));
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}|.+/', EmailTemplate::sampleValueFor('created_at'));
    }

    public function test_unknown_tag_falls_back_to_readable_label()
    {
        $this->assertSame('Some Custom Thing', EmailTemplate::sampleValueFor('some_custom_thing'));
    }

    public function test_text_without_tags_passes_through()
    {
        $this->assertSame('Plain text', EmailTemplate::resolveSampleTags('Plain text'));
        $this->assertSame('', EmailTemplate::resolveSampleTags(''));
        $this->assertNull(EmailTemplate::resolveSampleTags(null));
    }

    public function test_preview_html_resolves_samples_when_asked_and_not_otherwise()
    {
        $withSamples = EmailTemplate::renderPreviewHtml('<p>Hi {{clientName}}</p>', 'Subject {{name}}', null, 'custom', resolveSamples: true);

        $this->assertStringContainsString('Jane Doe', $withSamples);
        $this->assertStringNotContainsString('{{clientName}}', $withSamples);
        $this->assertStringContainsString('<title>Subject Jane Doe</title>', $withSamples);

        $withoutSamples = EmailTemplate::renderPreviewHtml('<p>Hi {{clientName}}</p>', 'Subject', null, 'custom');

        $this->assertStringContainsString('{{clientName}}', $withoutSamples);
    }
}
