<?php

namespace Tests\Unit\Support;

use App\Support\DeveloperProjectVisibility;
use Tests\TestCase;

class DeveloperProjectVisibilityTest extends TestCase
{
    public function test_project_edit_permission_accepts_an_edit_scope_and_rejects_none(): void
    {
        $denied = new class
        {
            public function permission(string $name): string|false
            {
                return $name === 'edit_developer_projects' ? 'none' : false;
            }
        };

        $allowed = new class
        {
            public function permission(string $name): string|false
            {
                return $name === 'edit_developer_projects' ? 'all' : false;
            }
        };

        $this->assertFalse(DeveloperProjectVisibility::canEditProjects($denied));
        $this->assertTrue(DeveloperProjectVisibility::canEditProjects($allowed));
    }
}
