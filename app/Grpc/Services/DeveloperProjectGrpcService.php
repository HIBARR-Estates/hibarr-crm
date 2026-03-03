<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DeveloperProjectServiceInterface;
use App\Grpc\Generated\DeveloperProject\ListDeveloperProjectsRequest;
use App\Grpc\Generated\DeveloperProject\ListDeveloperProjectsResponse;
use App\Grpc\Generated\DeveloperProject\StreamDeveloperProjectsRequest;
use App\Grpc\Generated\DeveloperProject\DeveloperProjectBatch;
use App\Grpc\Generated\DeveloperProject\DeveloperProject as DeveloperProjectMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\DeveloperProject;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DeveloperProjectGrpcService implements DeveloperProjectServiceInterface
{
    public function List(ContextInterface $ctx, ListDeveloperProjectsRequest $in): ListDeveloperProjectsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DeveloperProject::where('company_id', $companyId);

            if ($in->hasDeveloperId()) {
                $query->where('developer_id', $in->getDeveloperId());
            }
            if ($in->hasConstructionStatus()) {
                $query->where('construction_status', $in->getConstructionStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('reference_code', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'name', 'reference_code', 'developer_id', 'construction_status', 'starting_price', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDeveloperProjectsResponse();
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

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectsRequest $in): DeveloperProjectBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DeveloperProject::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasDeveloperId()) {
                $query->where('developer_id', $in->getDeveloperId());
            }
            if ($in->hasConstructionStatus()) {
                $query->where('construction_status', $in->getConstructionStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('reference_code', 'like', "%{$search}%");
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

            $batch = new DeveloperProjectBatch();
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

    private function buildMessage(DeveloperProject $record): DeveloperProjectMessage
    {
        $msg = new DeveloperProjectMessage();
        $msg->setId($record->id);
        $msg->setCompanyId($record->company_id ?? 0);
        $msg->setDeveloperId($record->developer_id ?? 0);
        $msg->setProjectLocationId($record->project_location_id ?? 0);
        $msg->setName($record->name ?? '');
        $msg->setReferenceCode($record->reference_code ?? '');
        $msg->setDescription($record->description ?? '');
        $msg->setGoogleDriveLink($record->google_drive_link ?? '');
        $msg->setAvailabilityLink($record->availability_link ?? '');
        $msg->setStartingPrice($record->starting_price !== null ? (string) $record->starting_price : '');
        $msg->setPrimaryCategories(is_array($record->primary_categories) ? json_encode($record->primary_categories) : (string) ($record->primary_categories ?? ''));
        $msg->setTitleDeedType($record->title_deed_type ?? '');
        $msg->setUnitTypes(is_array($record->unit_types) ? json_encode($record->unit_types) : (string) ($record->unit_types ?? ''));
        $msg->setNumberOfUnits($record->number_of_units ?? 0);
        $msg->setNumberOfBlocks($record->number_of_blocks ?? 0);
        $msg->setProjectTotalAreaSqm($record->project_total_area_sqm !== null ? (string) $record->project_total_area_sqm : '');
        $msg->setConstructionStatus($record->construction_status ?? '');
        $msg->setCompletionDate($this->dateToString($record->completion_date));
        $msg->setNumberOfPhases($record->number_of_phases ?? 0);
        $msg->setFurniturePackage($record->furniture_package ?? '');
        $msg->setRentalGuarantee((bool) $record->rental_guarantee);
        $msg->setPaymentPlan(is_array($record->payment_plan) || is_object($record->payment_plan) ? json_encode($record->payment_plan) : (string) ($record->payment_plan ?? ''));
        $msg->setFacilities(is_array($record->facilities) ? json_encode($record->facilities) : (string) ($record->facilities ?? ''));
        $msg->setDistances(is_array($record->distances) || is_object($record->distances) ? json_encode($record->distances) : (string) ($record->distances ?? ''));
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
        \Log::error('DeveloperProjectGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
