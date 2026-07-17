<?php

namespace Tests\Unit;

use App\Models\Property;
use App\Models\PropertyCollaborator;
use App\Services\PropertyAuthorizationService;
use App\Services\PropertyCollaboratorService;
use Illuminate\Support\Facades\Route;
use Tests\PropertyEditAccessTestCase;

class PropertyAuthorizationServiceTest extends PropertyEditAccessTestCase
{
    public function test_collaborator_editable_fields_include_public_listing_fields(): void
    {
        $service = app(PropertyAuthorizationService::class);
        $fields = $service->collaboratorEditableFields();

        $this->assertContains('description', $fields);
        $this->assertContains('price', $fields);
        $this->assertNotContains('owner_info', $fields);
        $this->assertNotContains('status', $fields);
    }

    public function test_property_is_collaborator_checks_active_pivot_rows(): void
    {
        \DB::table('property_collaborators')->insert([
            'property_id' => $this->propertyId,
            'user_id' => $this->requesterId,
            'granted_at' => now(),
            'granted_via' => PropertyCollaborator::GRANTED_VIA_ACCESS_REQUEST,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $property = Property::withoutGlobalScopes()->find($this->propertyId);

        $this->assertTrue($property->isCollaborator($this->requesterId));
        $this->assertFalse($property->isCollaborator($this->creatorId));
    }

    public function test_collaborator_service_grant_and_revoke(): void
    {
        $property = Property::withoutGlobalScopes()->find($this->propertyId);
        $service = app(PropertyCollaboratorService::class);

        $service->grant($property, $this->requesterId);
        $this->assertTrue($property->fresh()->isCollaborator($this->requesterId));

        $revoker = \App\Models\User::withoutGlobalScopes()->find($this->creatorId);
        $service->revoke($property->fresh(), $this->requesterId, $revoker);
        $this->assertFalse($property->fresh()->isCollaborator($this->requesterId));
    }

    public function test_edit_access_routes_are_registered(): void
    {
        $this->assertTrue(Route::has('edit-access-requests.index'));
        $this->assertTrue(Route::has('edit-access-requests.store'));
        $this->assertTrue(Route::has('edit-access-requests.approve'));
        $this->assertTrue(Route::has('properties.collaborators.destroy'));
        $this->assertTrue(Route::has('properties.watchers.store-self'));
    }
}
