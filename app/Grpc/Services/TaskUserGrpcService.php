<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\TaskUserServiceInterface;
use App\Grpc\Generated\TaskUser\ListTaskUsersRequest;
use App\Grpc\Generated\TaskUser\ListTaskUsersResponse;
use App\Grpc\Generated\TaskUser\StreamTaskUsersRequest;
use App\Grpc\Generated\TaskUser\TaskUserBatch;
use App\Grpc\Generated\TaskUser\TaskUser as TaskUserMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Task;
use App\Models\TaskUser;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class TaskUserGrpcService implements TaskUserServiceInterface
{
    public function List(ContextInterface $ctx, ListTaskUsersRequest $in): ListTaskUsersResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = TaskUser::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

            if ($in->hasTaskId()) {
                $query->where('task_id', $in->getTaskId());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }

            $allowedSortColumns = ['id', 'task_id', 'user_id', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListTaskUsersResponse();
            foreach ($paginator->items() as $taskUser) {
                $response->getResult()[] = $this->buildMessage($taskUser);
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

    public function Stream(ContextInterface $ctx, StreamTaskUsersRequest $in): TaskUserBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = TaskUser::whereIn('task_id', Task::where('company_id', $companyId)->select('id'));

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

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new TaskUserBatch();
            foreach ($records as $taskUser) {
                $batch->getResult()[] = $this->buildMessage($taskUser);
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

    private function buildMessage(TaskUser $taskUser): TaskUserMessage
    {
        $msg = new TaskUserMessage();
        $msg->setId($taskUser->id);
        $msg->setTaskId($taskUser->task_id ?? 0);
        $msg->setUserId($taskUser->user_id ?? 0);
        $msg->setCreatedAt($this->dateToString($taskUser->created_at));
        $msg->setUpdatedAt($this->dateToString($taskUser->updated_at));

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
        \Log::error('TaskUserGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
