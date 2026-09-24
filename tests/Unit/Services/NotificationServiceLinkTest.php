<?php

namespace Tests\Unit\Services;

use App\Services\NotificationService;
use ReflectionClass;
use Tests\TestCase;

class NotificationServiceLinkTest extends TestCase
{
    public function test_new_lead_created_links_to_lead_show(): void
    {
        $link = $this->invokeGetNotificationLink('new_lead_created', [
            'id' => 42,
            'name' => 'Jane Doe',
        ]);

        $this->assertNotNull($link);
        $this->assertStringContainsString('lead-contact/42', $link);
        $this->assertStringNotContainsString('/deals/', $link);
    }

    public function test_lead_follow_up_overdue_without_action_url_links_to_lead_meetings_tab(): void
    {
        $link = $this->invokeGetNotificationLink('lead_follow_up_overdue', [
            'id' => 7,
            'lead_id' => 7,
            'follow_up_id' => 99,
        ]);

        $this->assertNotNull($link);
        $this->assertStringContainsString('lead-contact/7', $link);
        $this->assertStringContainsString('tab=meetings', $link);
        $this->assertStringNotContainsString('/deals/', $link);
    }

    public function test_lead_follow_up_overdue_prefers_deal_when_both_ids_present(): void
    {
        $link = $this->invokeGetNotificationLink('lead_follow_up_overdue', [
            'id' => 7,
            'lead_id' => 7,
            'deal_id' => 10,
            'follow_up_id' => 99,
        ]);

        $this->assertNotNull($link);
        $this->assertStringContainsString('deals/10', $link);
        $this->assertStringContainsString('tab=meetings', $link);
    }

    public function test_lead_imported_links_to_lead_index(): void
    {
        $link = $this->invokeGetNotificationLink('lead_imported', [
            'leads' => [['lead_name' => 'A']],
        ]);

        $this->assertNotNull($link);
        $this->assertStringContainsString('lead-contact', $link);
        $this->assertStringNotContainsString('/deals/', $link);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function invokeGetNotificationLink(string $typeSlug, array $data): ?string
    {
        $service = app(NotificationService::class);
        $reflection = new ReflectionClass($service);
        $method = $reflection->getMethod('getNotificationLink');
        $method->setAccessible(true);

        return $method->invoke($service, $typeSlug, $data);
    }
}
