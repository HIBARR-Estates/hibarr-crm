<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DealHistoryServiceInterface;
use App\Grpc\Generated\DealHistory\ListDealHistoriesRequest;
use App\Grpc\Generated\DealHistory\ListDealHistoriesResponse;
use App\Grpc\Generated\DealHistory\StreamDealHistoriesRequest;
use App\Grpc\Generated\DealHistory\DealHistoryBatch;
use App\Grpc\Generated\DealHistory\DealHistory as DealHistoryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Models\DealHistory;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DealHistoryGrpcService implements DealHistoryServiceInterface
{
    public function List(ContextInterface $ctx, ListDealHistoriesRequest $in): ListDealHistoriesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DealHistory::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasEventType()) {
                $query->where('event_type', $in->getEventType());
            }
            if ($in->hasCreatedBy()) {
                $query->where('created_by', $in->getCreatedBy());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'deal_id', 'event_type', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDealHistoriesResponse();
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

    public function Stream(ContextInterface $ctx, StreamDealHistoriesRequest $in): DealHistoryBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DealHistory::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

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
            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasEventType()) {
                $query->where('event_type', $in->getEventType());
            }
            if ($in->hasCreatedBy()) {
                $query->where('created_by', $in->getCreatedBy());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DealHistoryBatch();
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

    private function buildMessage(DealHistory $history): DealHistoryMessage
    {
        $msg = new DealHistoryMessage();
        $msg->setId($history->id);
        $msg->setDealId($history->deal_id ?? 0);
        $msg->setCreatedBy($history->created_by ?? 0);
        $msg->setDealStageToId($history->deal_stage_to_id ?? 0);
        $msg->setEventType($history->event_type ?? '');
        $msg->setDealStageFromId($history->deal_stage_from_id ?? 0);
        $msg->setFileId($history->file_id ?? 0);
        $msg->setTaskId($history->task_id ?? 0);
        $msg->setFollowUpId($history->follow_up_id ?? 0);
        $msg->setNoteId($history->note_id ?? 0);
        $msg->setProposalId($history->proposal_id ?? 0);
        $msg->setAgentId($history->agent_id ?? 0);
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
        \Log::error('DealHistoryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
