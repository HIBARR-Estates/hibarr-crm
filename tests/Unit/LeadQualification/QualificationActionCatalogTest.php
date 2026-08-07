<?php

namespace Tests\Unit\LeadQualification;

use App\Enums\QualificationActionType;
use App\Services\Qualification\QualificationActionCatalog;
use Tests\TestCase;

class QualificationActionCatalogTest extends TestCase
{
    public function test_catalog_exposes_version_and_core_actions(): void
    {
        $catalog = new QualificationActionCatalog();
        $payload = $catalog->toArray();

        $this->assertSame(1, $payload['version']);
        $types = array_column($payload['actions'], 'type');
        $this->assertContains(QualificationActionType::BookConsultation->value, $types);
        $this->assertContains(QualificationActionType::InviteWebinar->value, $types);
        $this->assertContains(QualificationActionType::CreateTask->value, $types);
    }

    public function test_executable_types(): void
    {
        $catalog = new QualificationActionCatalog();
        $this->assertTrue($catalog->isExecutable('book_consultation'));
        $this->assertTrue($catalog->isExecutable('invite_webinar'));
        $this->assertTrue($catalog->isNoOp('schedule_callback'));
        $this->assertFalse($catalog->isExecutable('create_task'));
    }
}
