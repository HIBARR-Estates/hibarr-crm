<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadCategoryServiceInterface;
use App\Grpc\Generated\LeadCategory\ListLeadCategoriesRequest;
use App\Grpc\Generated\LeadCategory\ListLeadCategoriesResponse;
use App\Grpc\Generated\LeadCategory\StreamLeadCategoriesRequest;
use App\Grpc\Generated\LeadCategory\LeadCategoryBatch;
use App\Grpc\Generated\LeadCategory\LeadCategory as LeadCategoryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadCategory;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadCategoryGrpcService implements LeadCategoryServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadCategoriesRequest $in): ListLeadCategoriesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'category_name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = LeadCategory::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('category_name', 'like', "%{$search}%");
            }
            if ($in->hasIsDefault()) {
                $query->where('is_default', $in->getIsDefault());
            }

            $allowedSortColumns = ['id', 'category_name', 'is_default', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'category_name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadCategoriesResponse();
            foreach ($paginator->items() as $leadCategory) {
                $response->getResult()[] = $this->buildMessage($leadCategory);
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

    public function Stream(ContextInterface $ctx, StreamLeadCategoriesRequest $in): LeadCategoryBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadCategory::where('company_id', $companyId);

            // Incremental filters
            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            // Domain-specific filters
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('category_name', 'like', "%{$search}%");
            }
            if ($in->hasIsDefault()) {
                $query->where('is_default', $in->getIsDefault());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadCategoryBatch();
            foreach ($records as $leadCategory) {
                $batch->getResult()[] = $this->buildMessage($leadCategory);
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

    private function buildMessage(LeadCategory $leadCategory): LeadCategoryMessage
    {
        $msg = new LeadCategoryMessage();
        $msg->setId($leadCategory->id);
        $msg->setCompanyId($leadCategory->company_id ?? 0);
        $msg->setAddedBy($leadCategory->added_by ?? 0);
        $msg->setLastUpdatedBy($leadCategory->last_updated_by ?? 0);
        $msg->setCategoryName($leadCategory->category_name ?? '');
        $msg->setIsDefault((bool) ($leadCategory->is_default ?? false));
        $msg->setCreatedAt($this->dateToString($leadCategory->created_at));
        $msg->setUpdatedAt($this->dateToString($leadCategory->updated_at));

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
        \Log::error('LeadCategoryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
