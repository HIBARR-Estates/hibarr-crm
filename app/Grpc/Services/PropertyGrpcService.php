<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\PropertyServiceInterface;
use App\Grpc\Generated\Property\CreatePropertyRequest;
use App\Grpc\Generated\Property\GetPropertyRequest;
use App\Grpc\Generated\Property\UpdatePropertyRequest;
use App\Grpc\Generated\Property\DeletePropertyRequest;
use App\Grpc\Generated\Property\ListPropertiesRequest;
use App\Grpc\Generated\Property\ListPropertiesResponse;
use App\Grpc\Generated\Property\PropertyResponse;
use App\Grpc\Generated\Property\Property as PropertyMessage;
use App\Grpc\Generated\Common\PBEmpty;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Models\Property;
use App\Services\PropertyService;
use Illuminate\Validation\ValidationException;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class PropertyGrpcService implements PropertyServiceInterface
{
    public function __construct(
        private PropertyService $propertyService,
    ) {}

    public function Create(ContextInterface $ctx, CreatePropertyRequest $in): PropertyResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $data = [
                'title'         => $in->getTitle(),
                'property_type' => $in->getPropertyType(),
                'sale_type'     => $in->getSaleType(),
                'company_id'    => $companyId,
            ];

            $simpleFields = [
                'hasDescription' => ['getDescription', 'description'],
                'hasPrimaryCategory' => ['getPrimaryCategory', 'primary_category'],
                'hasUnitStyle' => ['getUnitStyle', 'unit_style'],
                'hasConstructionStatus' => ['getConstructionStatus', 'construction_status'],
                'hasStatus' => ['getStatus', 'status'],
                'hasCity' => ['getCity', 'city'],
                'hasArea' => ['getArea', 'area'],
                'hasState' => ['getState', 'state'],
                'hasLandSize' => ['getLandSize', 'land_size'],
                'hasLivingAreaSqm' => ['getLivingAreaSqm', 'living_area_sqm'],
                'hasTerraceAreaSqm' => ['getTerraceAreaSqm', 'terrace_area_sqm'],
                'hasBedrooms' => ['getBedrooms', 'bedrooms'],
                'hasBathrooms' => ['getBathrooms', 'bathrooms'],
                'hasLivingRoom' => ['getLivingRoom', 'living_room'],
                'hasFloorNumber' => ['getFloorNumber', 'floor_number'],
                'hasFloorsInBuilding' => ['getFloorsInBuilding', 'floors_in_building'],
                'hasBuildingAge' => ['getBuildingAge', 'building_age'],
                'hasCompletionDate' => ['getCompletionDate', 'completion_date'],
                'hasFurnitureStatus' => ['getFurnitureStatus', 'furniture_status'],
                'hasCurrentOccupancy' => ['getCurrentOccupancy', 'current_occupancy'],
                'hasIsPublished' => ['getIsPublished', 'is_published'],
                'hasAllow101Evler' => ['getAllow101Evler', 'allow_101evler'],
                'hasAllowHangiev' => ['getAllowHangiev', 'allow_hangiev'],
                'hasProductId' => ['getProductId', 'product_id'],
                'hasDeveloperProjectId' => ['getDeveloperProjectId', 'developer_project_id'],
                'hasProjectLocationId' => ['getProjectLocationId', 'project_location_id'],
                'hasResponsibleAgentId' => ['getResponsibleAgentId', 'responsible_agent_id'],
            ];

            foreach ($simpleFields as $hasMethod => [$getter, $column]) {
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $data[$column] = $in->$getter();
                }
            }

            // JSON fields
            $jsonFields = [
                'hasPriceJson' => ['getPriceJson', 'price'],
                'hasViewTypesJson' => ['getViewTypesJson', 'view_types'],
                'hasExteriorFeaturesJson' => ['getExteriorFeaturesJson', 'exterior_features'],
                'hasInteriorFeaturesJson' => ['getInteriorFeaturesJson', 'interior_features'],
                'hasLocationFeaturesJson' => ['getLocationFeaturesJson', 'location_features'],
                'hasPhotosJson' => ['getPhotosJson', 'photos'],
                'hasAddOnsJson' => ['getAddOnsJson', 'add_ons'],
                'hasDocumentsChecklistJson' => ['getDocumentsChecklistJson', 'documents_checklist'],
                'hasOwnerInfoJson' => ['getOwnerInfoJson', 'owner_info'],
                'hasLegalInfoJson' => ['getLegalInfoJson', 'legal_info'],
                'hasFinancialInfoJson' => ['getFinancialInfoJson', 'financial_info'],
                'hasLandDetailsJson' => ['getLandDetailsJson', 'land_details'],
            ];

            foreach ($jsonFields as $hasMethod => [$getter, $column]) {
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $decoded = json_decode($in->$getter(), true);
                    if ($decoded !== null) {
                        $data[$column] = $decoded;
                    }
                }
            }

            $property = $this->propertyService->createProperty($data);

            return $this->buildResponse($property);
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Get(ContextInterface $ctx, GetPropertyRequest $in): PropertyResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $property = null;

            if ($in->getId() > 0) {
                $property = Property::where('company_id', $companyId)->find($in->getId());
            } elseif ($in->hasSlug() && $in->getSlug()) {
                $property = Property::where('company_id', $companyId)->where('slug', $in->getSlug())->first();
            } elseif ($in->hasReferenceCode() && $in->getReferenceCode()) {
                $property = Property::where('company_id', $companyId)->where('reference_code', $in->getReferenceCode())->first();
            } else {
                throw new GRPCException('Property identifier required: id, slug, or reference_code', StatusCode::INVALID_ARGUMENT);
            }

            if (!$property) {
                throw new GRPCException('Property not found', StatusCode::NOT_FOUND);
            }

            return $this->buildResponse($property);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Update(ContextInterface $ctx, UpdatePropertyRequest $in): PropertyResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Property ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $property = Property::where('company_id', $companyId)->find($id);

            if (!$property) {
                throw new GRPCException("Property not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $data = [];

            $simpleFields = [
                'hasTitle' => ['getTitle', 'title'],
                'hasDescription' => ['getDescription', 'description'],
                'hasPropertyType' => ['getPropertyType', 'property_type'],
                'hasPrimaryCategory' => ['getPrimaryCategory', 'primary_category'],
                'hasUnitStyle' => ['getUnitStyle', 'unit_style'],
                'hasConstructionStatus' => ['getConstructionStatus', 'construction_status'],
                'hasSaleType' => ['getSaleType', 'sale_type'],
                'hasStatus' => ['getStatus', 'status'],
                'hasCity' => ['getCity', 'city'],
                'hasArea' => ['getArea', 'area'],
                'hasState' => ['getState', 'state'],
                'hasLandSize' => ['getLandSize', 'land_size'],
                'hasLivingAreaSqm' => ['getLivingAreaSqm', 'living_area_sqm'],
                'hasTerraceAreaSqm' => ['getTerraceAreaSqm', 'terrace_area_sqm'],
                'hasBedrooms' => ['getBedrooms', 'bedrooms'],
                'hasBathrooms' => ['getBathrooms', 'bathrooms'],
                'hasLivingRoom' => ['getLivingRoom', 'living_room'],
                'hasFloorNumber' => ['getFloorNumber', 'floor_number'],
                'hasFloorsInBuilding' => ['getFloorsInBuilding', 'floors_in_building'],
                'hasBuildingAge' => ['getBuildingAge', 'building_age'],
                'hasCompletionDate' => ['getCompletionDate', 'completion_date'],
                'hasFurnitureStatus' => ['getFurnitureStatus', 'furniture_status'],
                'hasCurrentOccupancy' => ['getCurrentOccupancy', 'current_occupancy'],
                'hasIsPublished' => ['getIsPublished', 'is_published'],
                'hasAllow101Evler' => ['getAllow101Evler', 'allow_101evler'],
                'hasAllowHangiev' => ['getAllowHangiev', 'allow_hangiev'],
                'hasProductId' => ['getProductId', 'product_id'],
                'hasDeveloperProjectId' => ['getDeveloperProjectId', 'developer_project_id'],
                'hasProjectLocationId' => ['getProjectLocationId', 'project_location_id'],
                'hasResponsibleAgentId' => ['getResponsibleAgentId', 'responsible_agent_id'],
            ];

            foreach ($simpleFields as $hasMethod => [$getter, $column]) {
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $data[$column] = $in->$getter();
                }
            }

            $jsonFields = [
                'hasPriceJson' => ['getPriceJson', 'price'],
                'hasViewTypesJson' => ['getViewTypesJson', 'view_types'],
                'hasExteriorFeaturesJson' => ['getExteriorFeaturesJson', 'exterior_features'],
                'hasInteriorFeaturesJson' => ['getInteriorFeaturesJson', 'interior_features'],
                'hasLocationFeaturesJson' => ['getLocationFeaturesJson', 'location_features'],
                'hasPhotosJson' => ['getPhotosJson', 'photos'],
                'hasAddOnsJson' => ['getAddOnsJson', 'add_ons'],
                'hasDocumentsChecklistJson' => ['getDocumentsChecklistJson', 'documents_checklist'],
                'hasOwnerInfoJson' => ['getOwnerInfoJson', 'owner_info'],
                'hasLegalInfoJson' => ['getLegalInfoJson', 'legal_info'],
                'hasFinancialInfoJson' => ['getFinancialInfoJson', 'financial_info'],
                'hasLandDetailsJson' => ['getLandDetailsJson', 'land_details'],
            ];

            foreach ($jsonFields as $hasMethod => [$getter, $column]) {
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $decoded = json_decode($in->$getter(), true);
                    if ($decoded !== null) {
                        $data[$column] = $decoded;
                    }
                }
            }

            $property = $this->propertyService->updateProperty($property, $data);

            return $this->buildResponse($property);
        } catch (GRPCException $e) {
            throw $e;
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Delete(ContextInterface $ctx, DeletePropertyRequest $in): PBEmpty
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Property ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $property = Property::where('company_id', $companyId)->find($id);

            if (!$property) {
                throw new GRPCException("Property not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $this->propertyService->deleteProperty($property);

            return new PBEmpty();
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function List(ContextInterface $ctx, ListPropertiesRequest $in): ListPropertiesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = Property::where('company_id', $companyId);

            if ($in->hasPropertyType()) $query->where('property_type', $in->getPropertyType());
            if ($in->hasPrimaryCategory()) $query->where('primary_category', $in->getPrimaryCategory());
            if ($in->hasSaleType()) $query->where('sale_type', $in->getSaleType());
            if ($in->hasStatus()) $query->where('status', $in->getStatus());
            if ($in->hasCity()) $query->where('city', $in->getCity());
            if ($in->hasArea()) $query->where('area', $in->getArea());
            if ($in->hasMinBedrooms()) $query->where('bedrooms', '>=', $in->getMinBedrooms());
            if ($in->hasMaxBedrooms()) $query->where('bedrooms', '<=', $in->getMaxBedrooms());
            if ($in->hasMinSize()) $query->where('living_area_sqm', '>=', $in->getMinSize());
            if ($in->hasMaxSize()) $query->where('living_area_sqm', '<=', $in->getMaxSize());
            if ($in->hasResponsibleAgentId()) $query->where('responsible_agent_id', $in->getResponsibleAgentId());
            if ($in->hasDeveloperProjectId()) $query->where('developer_project_id', $in->getDeveloperProjectId());
            if ($in->hasIsPublished()) $query->where('is_published', $in->getIsPublished());
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) $query->where('created_at', '>=', $in->getCreatedFrom());
            if ($in->hasCreatedTo()) $query->where('created_at', '<=', $in->getCreatedTo());

            $allowedSortColumns = ['id', 'title', 'city', 'bedrooms', 'bathrooms', 'land_size', 'living_area_sqm', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) $sortBy = 'created_at';

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListPropertiesResponse();
            foreach ($paginator->items() as $property) {
                $response->getProperties()[] = $this->buildMessage($property);
            }

            $meta = new PaginationMeta();
            $meta->setCurrentPage($paginator->currentPage());
            $meta->setPerPage($paginator->perPage());
            $meta->setTotal($paginator->total());
            $meta->setTotalPages($paginator->lastPage());
            $meta->setHasMore($paginator->hasMorePages());
            $response->setPagination($meta);

            return $response;
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ── Helpers ────────────────────────────────────────────

    private function buildResponse(Property $property): PropertyResponse
    {
        $response = new PropertyResponse();
        $response->setProperty($this->buildMessage($property));
        return $response;
    }

    private function buildMessage(Property $property): PropertyMessage
    {
        $msg = new PropertyMessage();
        $msg->setId($property->id);
        $msg->setTitle($property->title ?? '');
        $msg->setSlug($property->slug ?? '');
        $msg->setDescription($property->description ?? '');
        $msg->setReferenceCode($property->reference_code ?? '');
        $msg->setPropertyType($property->property_type ?? '');
        $msg->setPrimaryCategory($property->primary_category ?? '');
        $msg->setUnitStyle($property->unit_style ?? '');
        $msg->setConstructionStatus($property->construction_status ?? '');
        $msg->setSaleType($property->sale_type ?? '');
        $msg->setStatus($property->status ?? '');
        $msg->setPriceJson(is_array($property->price) ? json_encode($property->price) : ($property->price ?? ''));
        $msg->setCity($property->city ?? '');
        $msg->setArea($property->area ?? '');
        $msg->setState($property->state ?? '');
        $msg->setLandSize((float) ($property->land_size ?? 0));
        $msg->setLivingAreaSqm((float) ($property->living_area_sqm ?? 0));
        $msg->setTerraceAreaSqm((float) ($property->terrace_area_sqm ?? 0));
        $msg->setBedrooms($property->bedrooms ?? 0);
        $msg->setBathrooms($property->bathrooms ?? 0);
        $msg->setLivingRoom($property->living_room ?? 0);
        $msg->setFloorNumber($property->floor_number ?? 0);
        $msg->setFloorsInBuilding($property->floors_in_building ?? 0);
        $msg->setBuildingAge($property->building_age ?? 0);
        $msg->setCompletionDate($this->dateToString($property->completion_date));
        $msg->setFurnitureStatus($property->furniture_status ?? '');
        $msg->setCurrentOccupancy($property->current_occupancy ?? '');

        // JSON array fields
        $jsonArrayFields = [
            'view_types' => 'setViewTypesJson',
            'exterior_features' => 'setExteriorFeaturesJson',
            'interior_features' => 'setInteriorFeaturesJson',
            'location_features' => 'setLocationFeaturesJson',
            'photos' => 'setPhotosJson',
            'add_ons' => 'setAddOnsJson',
            'documents_checklist' => 'setDocumentsChecklistJson',
            'owner_info' => 'setOwnerInfoJson',
            'legal_info' => 'setLegalInfoJson',
            'financial_info' => 'setFinancialInfoJson',
            'land_details' => 'setLandDetailsJson',
        ];

        foreach ($jsonArrayFields as $attr => $setter) {
            $value = $property->$attr;
            $msg->$setter(is_array($value) ? json_encode($value) : ($value ?? ''));
        }

        $msg->setIsPublished((bool) ($property->is_published ?? false));
        $msg->setPublishedAt($this->dateToString($property->published_at));
        $msg->setAllow101Evler((bool) ($property->allow_101evler ?? false));
        $msg->setAllowHangiev((bool) ($property->allow_hangiev ?? false));
        $msg->setProductId($property->product_id ?? 0);
        $msg->setDeveloperProjectId($property->developer_project_id ?? 0);
        $msg->setProjectLocationId($property->project_location_id ?? 0);
        $msg->setResponsibleAgentId($property->responsible_agent_id ?? 0);
        $msg->setAddedBy($property->added_by ?? 0);
        $msg->setCompanyId($property->company_id ?? 0);
        $msg->setCreatedAt($this->dateToString($property->created_at));
        $msg->setUpdatedAt($this->dateToString($property->updated_at));

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        // RoadRunner stores gRPC metadata as top-level context values (not under a 'metadata' key).
        // Each value is an array of strings.
        $values = $ctx->getValue('x-company-id');
        $companyId = is_array($values) ? ($values[0] ?? null) : $values;
        if (!$companyId) {
            throw new GRPCException('Company context not found. Send x-company-id in gRPC metadata.', StatusCode::UNAUTHENTICATED);
        }
        return (int) $companyId;
    }

    private function mapValidationException(ValidationException $e): GRPCException
    {
        $errors = [];
        foreach ($e->errors() as $field => $messages) {
            foreach ($messages as $message) {
                $errors[] = "{$field}: {$message}";
            }
        }
        return new GRPCException('Validation failed: ' . implode('; ', $errors), StatusCode::INVALID_ARGUMENT);
    }

    private function dateToString(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('PropertyGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
