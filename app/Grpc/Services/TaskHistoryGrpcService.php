<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\TaskHistoryServiceInterface;
use App\Grpc\Generated\TaskHistory\ListTaskHistoriesRequest;
use App\Grpc\Generated\TaskHistory\ListTaskHistoriesResponse;
use App\Grpc\Generated\TaskHistory\StreamTaskHistoriesRequest;
use App\Grpc\Generated\TaskHistory\TaskHistoryBatch;
use App\Grpc\Generated\TaskHistory\TaskHistory as TaskHistoryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Task;
use App\Models\TaskHistory;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class TaskHistoryGrpcService implements TaskHistoryServiceInterface
{
    public function List(ContextInterface $ctx, ListTaskHistoriesRequest $in): ListTaskHistoriesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = TaskHistory::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

            if ($in->hasTaskId()) {
                $query->where('task_id', $in->getTaskId());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }
            if ($in->hasBoardColumnId()) {
                $query->where('board_column_id', $in->getBoardColumnId());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('details', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'task_id', 'user_id', 'board_column_id', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListTaskHistoriesResponse();
            foreach ($paginator->items() as $history) {
                $response->getResult()[] = $this->buildMessage($history);
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

    public function Stream(ContextInterface $ctx, StreamTaskHistoriesRequest $in): TaskHistoryBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = TaskHistory::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

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
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }
            if ($in->hasBoardColumnId()) {
                $query->where('board_column_id', $in->getBoardColumnId());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('details', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new TaskHistoryBatch();
            foreach ($records as $history) {
                $batch->getResult()[] = $this->buildMessage($history);
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

    private function buildMessage(TaskHistory $history): TaskHistoryMessage
    {
        $msg = new TaskHistoryMessage();
        $msg->setId($history->id);
        $msg->setTaskId($history->task_id ?? 0);
        $msg->setSubTaskId($history->sub_task_id ?? 0);
        $msg->setUserId($history->user_id ?? 0);
        $msg->setBoardColumnId($history->board_column_id ?? 0);
        $msg->setDetails($history->details ?? '');
        $msg->setCreatedAt($this->dateToString($history->created_at));
        $msg->setUpdatedAt($this->dateToString($history->updated_at));

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
        \Log::error('TaskHistoryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
