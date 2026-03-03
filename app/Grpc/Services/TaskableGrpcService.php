<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\TaskableServiceInterface;
use App\Grpc\Generated\Taskable\ListTaskablesRequest;
use App\Grpc\Generated\Taskable\ListTaskablesResponse;
use App\Grpc\Generated\Taskable\StreamTaskablesRequest;
use App\Grpc\Generated\Taskable\TaskableBatch;
use App\Grpc\Generated\Taskable\Taskable as TaskableMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Task;
use App\Models\Taskable;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class TaskableGrpcService implements TaskableServiceInterface
{
    public function List(ContextInterface $ctx, ListTaskablesRequest $in): ListTaskablesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = Taskable::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

            if ($in->hasTaskId()) {
                $query->where('task_id', $in->getTaskId());
            }
            if ($in->hasTaskableId()) {
                $query->where('taskable_id', $in->getTaskableId());
            }
            if ($in->hasTaskableType()) {
                $query->where('taskable_type', $in->getTaskableType());
            }

            $allowedSortColumns = ['id', 'task_id', 'taskable_id', 'taskable_type', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListTaskablesResponse();
            foreach ($paginator->items() as $taskable) {
                $response->getResult()[] = $this->buildMessage($taskable);
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

    public function Stream(ContextInterface $ctx, StreamTaskablesRequest $in): TaskableBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Taskable::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasTaskId()) {
                $query->where('task_id', $in->getTaskId());
            }
            if ($in->hasTaskableId()) {
                $query->where('taskable_id', $in->getTaskableId());
            }
            if ($in->hasTaskableType()) {
                $query->where('taskable_type', $in->getTaskableType());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new TaskableBatch();
            foreach ($records as $taskable) {
                $batch->getResult()[] = $this->buildMessage($taskable);
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

    private function buildMessage(Taskable $taskable): TaskableMessage
    {
        $msg = new TaskableMessage();
        $msg->setId($taskable->id);
        $msg->setTaskId($taskable->task_id ?? 0);
        $msg->setTaskableId($taskable->taskable_id ?? 0);
        $msg->setTaskableType($taskable->taskable_type ?? '');
        $msg->setCreatedAt($this->dateToString($taskable->created_at));
        $msg->setUpdatedAt($this->dateToString($taskable->updated_at));

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
        \Log::error('TaskableGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
