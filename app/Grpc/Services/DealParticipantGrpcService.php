<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DealParticipantServiceInterface;
use App\Grpc\Generated\DealParticipant\ListDealParticipantsRequest;
use App\Grpc\Generated\DealParticipant\ListDealParticipantsResponse;
use App\Grpc\Generated\DealParticipant\StreamDealParticipantsRequest;
use App\Grpc\Generated\DealParticipant\DealParticipantBatch;
use App\Grpc\Generated\DealParticipant\DealParticipant as DealParticipantMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Models\DealParticipant;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DealParticipantGrpcService implements DealParticipantServiceInterface
{
    public function List(ContextInterface $ctx, ListDealParticipantsRequest $in): ListDealParticipantsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DealParticipant::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }

            $allowedSortColumns = ['id', 'deal_id', 'user_id', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDealParticipantsResponse();
            foreach ($paginator->items() as $participant) {
                $response->getResult()[] = $this->buildMessage($participant);
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

    public function Stream(ContextInterface $ctx, StreamDealParticipantsRequest $in): DealParticipantBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DealParticipant::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

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
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DealParticipantBatch();
            foreach ($records as $participant) {
                $batch->getResult()[] = $this->buildMessage($participant);
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

    private function buildMessage(DealParticipant $participant): DealParticipantMessage
    {
        $msg = new DealParticipantMessage();
        $msg->setId($participant->id);
        $msg->setDealId($participant->deal_id ?? 0);
        $msg->setUserId($participant->user_id ?? 0);
        $msg->setCreatedAt($this->dateToString($participant->created_at));
        $msg->setUpdatedAt($this->dateToString($participant->updated_at));

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
        \Log::error('DealParticipantGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
