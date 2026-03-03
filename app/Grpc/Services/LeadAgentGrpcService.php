<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadAgentServiceInterface;
use App\Grpc\Generated\LeadAgent\ListLeadAgentsRequest;
use App\Grpc\Generated\LeadAgent\ListLeadAgentsResponse;
use App\Grpc\Generated\LeadAgent\StreamLeadAgentsRequest;
use App\Grpc\Generated\LeadAgent\LeadAgentBatch;
use App\Grpc\Generated\LeadAgent\LeadAgent as LeadAgentMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadAgent;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadAgentGrpcService implements LeadAgentServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadAgentsRequest $in): ListLeadAgentsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = LeadAgent::where('company_id', $companyId);

            if ($in->hasStatus()) {
                $query->where('status', $in->getStatus());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }
            if ($in->hasLeadCategoryId()) {
                $query->where('lead_category_id', $in->getLeadCategoryId());
            }

            $allowedSortColumns = ['id', 'user_id', 'status', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'created_at';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadAgentsResponse();
            foreach ($paginator->items() as $leadAgent) {
                $response->getResult()[] = $this->buildMessage($leadAgent);
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

    public function Stream(ContextInterface $ctx, StreamLeadAgentsRequest $in): LeadAgentBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadAgent::where('company_id', $companyId);

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
            if ($in->hasStatus()) {
                $query->where('status', $in->getStatus());
            }
            if ($in->hasLeadCategoryId()) {
                $query->where('lead_category_id', $in->getLeadCategoryId());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadAgentBatch();
            foreach ($records as $leadAgent) {
                $batch->getResult()[] = $this->buildMessage($leadAgent);
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

    private function buildMessage(LeadAgent $leadAgent): LeadAgentMessage
    {
        $msg = new LeadAgentMessage();
        $msg->setId($leadAgent->id);
        $msg->setCompanyId($leadAgent->company_id ?? 0);
        $msg->setUserId($leadAgent->user_id ?? 0);
        $msg->setLeadCategoryId($leadAgent->lead_category_id ?? 0);
        $msg->setAddedBy($leadAgent->added_by ?? 0);
        $msg->setLastUpdatedBy($leadAgent->last_updated_by ?? 0);
        $msg->setStatus($leadAgent->status ?? '');
        $msg->setCreatedAt($this->dateToString($leadAgent->created_at));
        $msg->setUpdatedAt($this->dateToString($leadAgent->updated_at));

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
        \Log::error('LeadAgentGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
