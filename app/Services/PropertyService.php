<?php

namespace App\Services;

use App\Models\Property;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PropertyService
{
    /**
     * Create a new property.
     *
     * @param array $data
     * @param User|null $user
     * @return Property
     * @throws \Exception
     */
    public function createProperty(array $data, ?User $user = null): Property
    {
        $user = $user ?? auth()->user();

        DB::beginTransaction();

        try {
            $property = new Property();
            
            // Basic required fields
            $property->title = $data['title'];
            $property->description = $data['description'] ?? null;
            $property->property_type = $data['property_type'];
            $property->sale_type = $data['sale_type'];
            
            // Classification
            $property->primary_category = $data['primary_category'] ?? null;
            $property->unit_style = $data['unit_style'] ?? null;
            $property->construction_status = $data['construction_status'] ?? null;
            $property->status = $data['status'] ?? Property::STATUS_AVAILABLE;
            
            // Pricing
            if (isset($data['price'])) {
                $property->price = $data['price'];
            }
            
            // Location
            $property->city = $data['city'] ?? null;
            $property->area = $data['area'] ?? null;
            $property->state = $data['state'] ?? null;
            
            // Dimensions
            $property->land_size = $data['land_size'] ?? null;
            $property->living_area_sqm = $data['living_area_sqm'] ?? null;
            $property->terrace_area_sqm = $data['terrace_area_sqm'] ?? null;
            
            // Property details
            $property->bedrooms = $data['bedrooms'] ?? null;
            $property->bathrooms = $data['bathrooms'] ?? null;
            $property->living_room = $data['living_room'] ?? null;
            $property->floor_number = $data['floor_number'] ?? null;
            $property->floors_in_building = $data['floors_in_building'] ?? null;
            $property->building_age = $data['building_age'] ?? null;
            $property->completion_date = $data['completion_date'] ?? null;
            
            // Status details
            $property->furniture_status = $data['furniture_status'] ?? null;
            $property->current_occupancy = $data['current_occupancy'] ?? null;
            
            // Features (JSON arrays)
            $property->view_types = $data['view_types'] ?? [];
            $property->exterior_features = $data['exterior_features'] ?? [];
            $property->interior_features = $data['interior_features'] ?? [];
            $property->location_features = $data['location_features'] ?? [];
            
            // Media and documents
            $property->photos = $data['photos'] ?? [];
            $property->add_ons = $data['add_ons'] ?? [];
            $property->documents_checklist = $data['documents_checklist'] ?? [];
            
            // Additional info
            $property->owner_info = $data['owner_info'] ?? [];
            $property->legal_info = $data['legal_info'] ?? [];
            $property->financial_info = $data['financial_info'] ?? [];
            $property->land_details = $data['land_details'] ?? [];
            
            // Publishing settings
            $property->is_published = $data['is_published'] ?? false;
            $property->allow_101evler = $data['allow_101evler'] ?? false;
            $property->allow_hangiev = $data['allow_hangiev'] ?? false;
            
            if ($property->is_published && empty($property->published_at)) {
                $property->published_at = now();
            }
            
            // Foreign keys
            $property->product_id = $data['product_id'] ?? null;
            $property->developer_project_id = $data['developer_project_id'] ?? null;
            $property->project_location_id = $data['project_location_id'] ?? null;
            $property->responsible_agent_id = $data['responsible_agent_id'] ?? null;
            
            // Set added_by
            $property->added_by = $user?->id;
            
            $property->save();

            DB::commit();

            return $property;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update an existing property.
     *
     * @param Property $property
     * @param array $data
     * @param User|null $user
     * @return Property
     * @throws \Exception
     */
    public function updateProperty(Property $property, array $data, ?User $user = null): Property
    {
        DB::beginTransaction();

        try {
            // Update only provided fields
            $fillableFields = [
                'title', 'description', 'property_type', 'primary_category',
                'unit_style', 'construction_status', 'sale_type', 'status',
                'city', 'area', 'state', 'land_size', 'living_area_sqm',
                'terrace_area_sqm', 'bedrooms', 'bathrooms', 'living_room',
                'floor_number', 'floors_in_building', 'building_age',
                'completion_date', 'furniture_status', 'current_occupancy',
                'is_published', 'allow_101evler', 'allow_hangiev',
                'product_id', 'developer_project_id', 'project_location_id',
                'responsible_agent_id',
            ];
            
            foreach ($fillableFields as $field) {
                if (array_key_exists($field, $data)) {
                    $property->{$field} = $data[$field];
                }
            }
            
            // Handle price separately due to accessor/mutator
            if (array_key_exists('price', $data)) {
                $property->price = $data['price'];
            }
            
            // Handle JSON array fields
            $jsonArrayFields = [
                'view_types', 'exterior_features', 'interior_features',
                'location_features', 'photos', 'add_ons', 'documents_checklist',
                'owner_info', 'legal_info', 'financial_info', 'land_details',
            ];
            
            foreach ($jsonArrayFields as $field) {
                if (array_key_exists($field, $data)) {
                    $property->{$field} = $data[$field];
                }
            }
            
            // Handle published_at timestamp
            if (isset($data['is_published']) && $data['is_published'] && empty($property->published_at)) {
                $property->published_at = now();
            }
            
            $property->save();

            DB::commit();

            return $property;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Delete a property.
     *
     * @param Property $property
     * @return bool
     */
    public function deleteProperty(Property $property): bool
    {
        return $property->delete();
    }

    /**
     * Get a single property by ID.
     *
     * @param int $id
     * @return Property|null
     */
    public function getProperty(int $id): ?Property
    {
        return Property::find($id);
    }

    /**
     * Get a property by slug.
     *
     * @param string $slug
     * @return Property|null
     */
    public function getPropertyBySlug(string $slug): ?Property
    {
        return Property::where('slug', $slug)->first();
    }

    /**
     * Get a property by reference code.
     *
     * @param string $referenceCode
     * @return Property|null
     */
    public function getPropertyByReference(string $referenceCode): ?Property
    {
        // Reference code is computed, may need to parse or search differently
        // For now, attempt direct lookup if stored
        return Property::where('reference_code', $referenceCode)->first();
    }

    /**
     * List properties with pagination and filters.
     *
     * @param array $filters
     * @param int $perPage
     * @param int $page
     * @param string $sortBy
     * @param string $sortOrder
     * @return LengthAwarePaginator
     */
    public function listProperties(
        array $filters = [],
        int $perPage = 15,
        int $page = 1,
        string $sortBy = 'created_at',
        string $sortOrder = 'desc'
    ): LengthAwarePaginator {
        $query = Property::query();

        $this->applyFilters($query, $filters);

        // Validate sort order
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        
        // Validate sort column to prevent SQL injection
        $allowedSortColumns = [
            'id', 'title', 'price', 'city', 'bedrooms', 'bathrooms',
            'land_size', 'living_area_sqm', 'created_at', 'updated_at',
            'published_at', 'status', 'property_type', 'sale_type',
        ];
        
        if (!in_array($sortBy, $allowedSortColumns)) {
            $sortBy = 'created_at';
        }

        return $query
            ->orderBy($sortBy, $sortOrder)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Get properties as a cursor for streaming (bulk export).
     *
     * @param array $filters
     * @param int|null $sinceId
     * @param string|null $sinceUpdated
     * @param array|null $specificIds
     * @return \Illuminate\Support\LazyCollection
     */
    public function streamProperties(
        array $filters = [],
        ?int $sinceId = null,
        ?string $sinceUpdated = null,
        ?array $specificIds = null
    ): \Illuminate\Support\LazyCollection {
        $query = Property::query();

        // Apply incremental sync filters
        if ($sinceId !== null) {
            $query->where('id', '>', $sinceId);
        }

        if ($sinceUpdated !== null) {
            $query->where('updated_at', '>=', $sinceUpdated);
        }

        if ($specificIds !== null && count($specificIds) > 0) {
            $query->whereIn('id', $specificIds);
        }

        $this->applyFilters($query, $filters);

        return $query->orderBy('id', 'asc')->cursor();
    }

    /**
     * Apply filters to a property query.
     *
     * @param Builder $query
     * @param array $filters
     * @return void
     */
    protected function applyFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['property_type'])) {
            $query->where('property_type', $filters['property_type']);
        }

        if (!empty($filters['primary_category'])) {
            $query->where('primary_category', $filters['primary_category']);
        }

        if (!empty($filters['sale_type'])) {
            $query->where('sale_type', $filters['sale_type']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        if (!empty($filters['area'])) {
            $query->where('area', $filters['area']);
        }

        if (isset($filters['min_bedrooms'])) {
            $query->where('bedrooms', '>=', $filters['min_bedrooms']);
        }

        if (isset($filters['max_bedrooms'])) {
            $query->where('bedrooms', '<=', $filters['max_bedrooms']);
        }

        if (isset($filters['min_price'])) {
            // Note: price is JSON, may need raw query or computed column
            $query->whereRaw("JSON_EXTRACT(price, '$.amount') >= ?", [$filters['min_price']]);
        }

        if (isset($filters['max_price'])) {
            $query->whereRaw("JSON_EXTRACT(price, '$.amount') <= ?", [$filters['max_price']]);
        }

        if (isset($filters['min_size'])) {
            $query->where('living_area_sqm', '>=', $filters['min_size']);
        }

        if (isset($filters['max_size'])) {
            $query->where('living_area_sqm', '<=', $filters['max_size']);
        }

        if (!empty($filters['responsible_agent_id'])) {
            $query->where('responsible_agent_id', $filters['responsible_agent_id']);
        }

        if (!empty($filters['developer_project_id'])) {
            $query->where('developer_project_id', $filters['developer_project_id']);
        }

        if (isset($filters['is_published'])) {
            $query->where('is_published', $filters['is_published']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('reference_code', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['created_from'])) {
            $query->where('created_at', '>=', $filters['created_from']);
        }

        if (!empty($filters['created_to'])) {
            $query->where('created_at', '<=', $filters['created_to']);
        }
    }

    /**
     * Count total properties matching filters (for streaming progress).
     *
     * @param array $filters
     * @param int|null $sinceId
     * @param string|null $sinceUpdated
     * @param array|null $specificIds
     * @return int
     */
    public function countProperties(
        array $filters = [],
        ?int $sinceId = null,
        ?string $sinceUpdated = null,
        ?array $specificIds = null
    ): int {
        $query = Property::query();

        if ($sinceId !== null) {
            $query->where('id', '>', $sinceId);
        }

        if ($sinceUpdated !== null) {
            $query->where('updated_at', '>=', $sinceUpdated);
        }

        if ($specificIds !== null && count($specificIds) > 0) {
            $query->whereIn('id', $specificIds);
        }

        $this->applyFilters($query, $filters);

        return $query->count();
    }
}
