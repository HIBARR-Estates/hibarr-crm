<?php

namespace App\Services;

use App\Models\Property;
use App\Models\User;
use App\Support\PermissionGates;

class PropertyAuthorizationService
{
    public const ROLE_ADMIN = 'admin';
    public const ROLE_CREATOR = 'creator';
    public const ROLE_RESPONSIBLE_AGENT = 'responsible_agent';
    public const ROLE_COLLABORATOR = 'collaborator';
    public const ROLE_WATCHER = 'watcher';
    public const ROLE_VIEWER = 'viewer';
    public const ROLE_NONE = 'none';

    /**
     * Fields collaborators may update (public listing scope).
     *
     * @return list<string>
     */
    public function collaboratorEditableFields(): array
    {
        return [
            'description',
            'title',
            'video_url',
            'tour_360_url',
            'photos',
            'price',
            'minimal_rental_period',
            'rent_payment_interval',
            'exterior_features',
            'interior_features',
            'location_features',
            'outside_features',
            'inside_features',
            'view_types',
            'add_ons',
            'bedrooms',
            'bathrooms',
            'living_room',
            'floor_number',
            'floors_in_building',
            'building_age',
            'completion_date',
            'furniture_status',
            'construction_status',
            'unit_style',
            'land_size',
            'living_area_sqm',
            'terrace_area_sqm',
            'gross_sqm',
            'balcony_count',
            'balcony_net_sqm',
            'open_to_swap',
            'swap_notes',
            'city',
            'area',
            'map',
            'distances',
            'latitude',
            'longitude',
            'address',
        ];
    }

    /**
     * @return list<string>
     */
    public function getRoles(User $user, Property $property): array
    {
        $roles = [];

        if ($this->isPropertyAdmin($user)) {
            $roles[] = self::ROLE_ADMIN;
        }

        if ($property->isCreator($user->id)) {
            $roles[] = self::ROLE_CREATOR;
        }

        if ($property->isResponsibleAgent($user->id)) {
            $roles[] = self::ROLE_RESPONSIBLE_AGENT;
        }

        if ($property->isCollaborator($user->id)) {
            $roles[] = self::ROLE_COLLABORATOR;
        }

        if ($property->isWatcher($user->id)) {
            $roles[] = self::ROLE_WATCHER;
        }

        if (
            empty($roles)
            && $property->is_published
            && $this->hasViewPermission($user)
        ) {
            $roles[] = self::ROLE_VIEWER;
        }

        if (empty($roles)) {
            $roles[] = self::ROLE_NONE;
        }

        return $roles;
    }

    public function canEditProperty(User $user, Property $property): bool
    {
        return $this->canEditPropertyByUserId($user->id, $property, $this->isPropertyAdmin($user));
    }

    public function canEditPropertyByUserId(?int $userId, Property $property, bool $isAdmin = false): bool
    {
        if ($userId === null) {
            return false;
        }

        if ($isAdmin) {
            return true;
        }

        return $property->isCreator($userId)
            || $property->isResponsibleAgent($userId)
            || $property->isCollaborator($userId);
    }

    public function isCollaboratorOnly(User $user, Property $property): bool
    {
        return $property->isCollaborator($user->id)
            && !$property->isCreator($user->id)
            && !$property->isResponsibleAgent($user->id)
            && !$this->isPropertyAdmin($user);
    }

    public function canEditField(User $user, Property $property, string $field): bool
    {
        if (!$this->canEditProperty($user, $property)) {
            return false;
        }

        if ($this->isCollaboratorOnly($user, $property)) {
            return in_array($field, $this->collaboratorEditableFields(), true);
        }

        return true;
    }

    public function canDeleteProperty(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return $property->isCreator($user->id) || $property->isResponsibleAgent($user->id);
    }

    public function canViewProperty(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        if ($property->isCreator($user->id) || $property->isResponsibleAgent($user->id)) {
            return true;
        }

        if ($property->isCollaborator($user->id) || $property->isWatcher($user->id)) {
            return true;
        }

        if ($property->is_published && $this->hasViewPermission($user)) {
            return true;
        }

        return false;
    }

    public function canViewOwnerInfo(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return $property->isCreator($user->id) || $property->isResponsibleAgent($user->id);
    }

    public function canManageTeam(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return $property->isCreator($user->id) || $property->isResponsibleAgent($user->id);
    }

    public function canAddSelfAsWatcher(User $user, Property $property): bool
    {
        if ($property->isWatcher($user->id)) {
            return false;
        }

        return $property->isCollaborator($user->id);
    }

    public function canRequestEditAccess(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return false;
        }

        if ($property->isCreator($user->id) || $property->isResponsibleAgent($user->id)) {
            return false;
        }

        if ($property->isCollaborator($user->id)) {
            return false;
        }

        return (bool) $property->is_published;
    }

    public function canRespondToEditAccessRequest(User $user, Property $property): bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return $property->isResponsibleAgent($user->id);
    }

    public function isPropertyAdmin(User $user): bool
    {
        return PermissionGates::canManageProperties($user);
    }

    protected function hasViewPermission(User $user): bool
    {
        $permission = $user->permission('view_product');

        return in_array($permission, ['all', 'added', 4, 1], true);
    }
}
