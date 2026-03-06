<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\TaskCategoryServiceInterface;
use App\Grpc\Generated\TaskCategory\ListTaskCategoriesRequest;
use App\Grpc\Generated\TaskCategory\ListTaskCategoriesResponse;
use App\Grpc\Generated\TaskCategory\StreamTaskCategoriesRequest;
use App\Grpc\Generated\TaskCategory\TaskCategoryBatch;
use App\Grpc\Generated\TaskCategory\TaskCategory as TaskCategoryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\TaskCategory;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class TaskCategoryGrpcService implements TaskCategoryServiceInterface
{
    public function List(ContextInterface $ctx, ListTaskCategoriesRequest $in): ListTaskCategoriesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'category_name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = TaskCategory::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('category_name', 'like', "%{$search}%");
            }

            $allowedSortColumns = ['id', 'category_name', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'category_name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListTaskCategoriesResponse();
            foreach ($paginator->items() as $category) {
                $response->getResult()[] = $this->buildMessage($category);
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

    public function Stream(ContextInterface $ctx, StreamTaskCategoriesRequest $in): TaskCategoryBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = TaskCategory::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('category_name', 'like', "%{$search}%");
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new TaskCategoryBatch();
            foreach ($records as $category) {
                $batch->getResult()[] = $this->buildMessage($category);
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

    private function buildMessage(TaskCategory $category): TaskCategoryMessage
    {
        $msg = new TaskCategoryMessage();
        $msg->setId($category->id);
        $msg->setCompanyId($category->company_id ?? 0);
        $msg->setAddedBy($category->added_by ?? 0);
        $msg->setLastUpdatedBy($category->last_updated_by ?? 0);
        $msg->setCategoryName($category->category_name ?? '');
        $msg->setCreatedAt($this->dateToString($category->created_at));
        $msg->setUpdatedAt($this->dateToString($category->updated_at));

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
        \Log::error('TaskCategoryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
