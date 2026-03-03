<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadSourceServiceInterface;
use App\Grpc\Generated\LeadSource\ListLeadSourcesRequest;
use App\Grpc\Generated\LeadSource\ListLeadSourcesResponse;
use App\Grpc\Generated\LeadSource\StreamLeadSourcesRequest;
use App\Grpc\Generated\LeadSource\LeadSourceBatch;
use App\Grpc\Generated\LeadSource\LeadSource as LeadSourceMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadSource;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadSourceGrpcService implements LeadSourceServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadSourcesRequest $in): ListLeadSourcesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'type';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = LeadSource::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('type', 'like', "%{$search}%");
            }
            if ($in->hasType()) {
                $query->where('type', $in->getType());
            }

            $allowedSortColumns = ['id', 'type', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'type';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadSourcesResponse();
            foreach ($paginator->items() as $leadSource) {
                $response->getResult()[] = $this->buildMessage($leadSource);
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

    public function Stream(ContextInterface $ctx, StreamLeadSourcesRequest $in): LeadSourceBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadSource::where('company_id', $companyId);

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
                $query->where('type', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadSourceBatch();
            foreach ($records as $leadSource) {
                $batch->getResult()[] = $this->buildMessage($leadSource);
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

    private function buildMessage(LeadSource $leadSource): LeadSourceMessage
    {
        $msg = new LeadSourceMessage();
        $msg->setId($leadSource->id);
        $msg->setCompanyId($leadSource->company_id ?? 0);
        $msg->setAddedBy($leadSource->added_by ?? 0);
        $msg->setLastUpdatedBy($leadSource->last_updated_by ?? 0);
        $msg->setType($leadSource->type ?? '');
        $msg->setCreatedAt($this->dateToString($leadSource->created_at));
        $msg->setUpdatedAt($this->dateToString($leadSource->updated_at));

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
        \Log::error('LeadSourceGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
