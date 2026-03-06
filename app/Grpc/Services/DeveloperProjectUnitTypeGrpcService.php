<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DeveloperProjectUnitTypeServiceInterface;
use App\Grpc\Generated\DeveloperProjectUnitType\ListDeveloperProjectUnitTypesRequest;
use App\Grpc\Generated\DeveloperProjectUnitType\ListDeveloperProjectUnitTypesResponse;
use App\Grpc\Generated\DeveloperProjectUnitType\StreamDeveloperProjectUnitTypesRequest;
use App\Grpc\Generated\DeveloperProjectUnitType\DeveloperProjectUnitTypeBatch;
use App\Grpc\Generated\DeveloperProjectUnitType\DeveloperProjectUnitType as DeveloperProjectUnitTypeMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\DeveloperProjectUnitType;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DeveloperProjectUnitTypeGrpcService implements DeveloperProjectUnitTypeServiceInterface
{
    public function List(ContextInterface $ctx, ListDeveloperProjectUnitTypesRequest $in): ListDeveloperProjectUnitTypesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DeveloperProjectUnitType::where('company_id', $companyId);

            if ($in->hasDeveloperProjectId()) {
                $query->where('developer_project_id', $in->getDeveloperProjectId());
            }
            if ($in->hasPrimaryCategory()) {
                $query->where('primary_category', $in->getPrimaryCategory());
            }
            if ($in->hasPropertyType()) {
                $query->where('property_type', $in->getPropertyType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('reference_code', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'developer_project_id', 'reference_code', 'primary_category', 'property_type', 'starting_price', 'order', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDeveloperProjectUnitTypesResponse();
            foreach ($paginator->items() as $record) {
                $response->getResult()[] = $this->buildMessage($record);
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

    // ── Stream (bulk dump) ─────────────────────────────────

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectUnitTypesRequest $in): DeveloperProjectUnitTypeBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DeveloperProjectUnitType::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasDeveloperProjectId()) {
                $query->where('developer_project_id', $in->getDeveloperProjectId());
            }
            if ($in->hasPrimaryCategory()) {
                $query->where('primary_category', $in->getPrimaryCategory());
            }
            if ($in->hasPropertyType()) {
                $query->where('property_type', $in->getPropertyType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('reference_code', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DeveloperProjectUnitTypeBatch();
            foreach ($records as $record) {
                $batch->getResult()[] = $this->buildMessage($record);
            }

            $progress = new StreamProgress();
            $progress->setProcessed($records->count());
            $progress->setTotal($total);
            $progress->setIsComplete(true);
            $batch->setProgress($progress);

            return $batch;
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ── Helpers ────────────────────────────────────────────

    private function buildMessage(DeveloperProjectUnitType $record): DeveloperProjectUnitTypeMessage
    {
        $msg = new DeveloperProjectUnitTypeMessage();
        $msg->setId($record->id);
        $msg->setCompanyId($record->company_id ?? 0);
        $msg->setDeveloperProjectId($record->developer_project_id ?? 0);
        $msg->setReferenceCode($record->reference_code ?? '');
        $msg->setPrimaryCategory($record->primary_category ?? '');
        $msg->setPropertyType($record->property_type ?? '');
        $msg->setUnitStyle(is_array($record->unit_style) ? json_encode($record->unit_style) : (string) ($record->unit_style ?? ''));
        $msg->setViewTypes(is_array($record->view_types) ? json_encode($record->view_types) : (string) ($record->view_types ?? ''));
        $msg->setFurnitureStatus($record->furniture_status ?? '');
        $msg->setStartingPrice($record->starting_price !== null ? (string) $record->starting_price : '');
        $msg->setCurrency($record->currency ?? '');
        $msg->setBedrooms((int) ($record->bedrooms ?? 0));
        $msg->setBathrooms((int) ($record->bathrooms ?? 0));
        $msg->setFloor($record->floor ?? '');
        $msg->setFloorsInBuilding((int) ($record->floors_in_building ?? 0));
        $msg->setTotalAreaSqm($record->total_area_sqm !== null ? (string) $record->total_area_sqm : '');
        $msg->setLivingAreaSqm($record->living_area_sqm !== null ? (string) $record->living_area_sqm : '');
        $msg->setTerraceBalconySqm($record->terrace_balcony_sqm !== null ? (string) $record->terrace_balcony_sqm : '');
        $msg->setPlotSizeSqm($record->plot_size_sqm !== null ? (string) $record->plot_size_sqm : '');
        $msg->setCompletionDate($this->dateToString($record->completion_date));
        $msg->setOutsideFeatures(is_array($record->outside_features) ? json_encode($record->outside_features) : (string) ($record->outside_features ?? ''));
        $msg->setInsideFeatures(is_array($record->inside_features) ? json_encode($record->inside_features) : (string) ($record->inside_features ?? ''));
        $msg->setDescription($record->description ?? '');
        $msg->setMilitaryBaseDistanceKm($record->military_base_distance_km !== null ? (string) $record->military_base_distance_km : '');
        $msg->setHasRestrictions((bool) $record->has_restrictions);
        $msg->setRestrictionNotes($record->restriction_notes ?? '');
        $msg->setOrder($record->order ?? 0);
        $msg->setCreatedAt($this->dateToString($record->created_at));
        $msg->setUpdatedAt($this->dateToString($record->updated_at));
        $msg->setDeletedAt($this->dateToString($record->deleted_at));

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        $companyId = $ctx->getValue('authenticated_company_id');
        if (!$companyId) {
            throw new GRPCException(
                'Authentication required. Provide x-api-token and x-company-id in gRPC metadata.',
                StatusCode::UNAUTHENTICATED,
            );
        }
        return (int) $companyId;
    }

    private function dateToString(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('DeveloperProjectUnitTypeGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
