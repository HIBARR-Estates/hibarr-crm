<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadStatusServiceInterface;
use App\Grpc\Generated\LeadStatus\ListLeadStatusesRequest;
use App\Grpc\Generated\LeadStatus\ListLeadStatusesResponse;
use App\Grpc\Generated\LeadStatus\StreamLeadStatusesRequest;
use App\Grpc\Generated\LeadStatus\LeadStatusBatch;
use App\Grpc\Generated\LeadStatus\LeadStatus as LeadStatusMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadStatus;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadStatusGrpcService implements LeadStatusServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadStatusesRequest $in): ListLeadStatusesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'priority';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = LeadStatus::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('type', 'like', "%{$search}%");
            }
            if ($in->hasType()) {
                $query->where('type', $in->getType());
            }
            if ($in->hasDefault()) {
                $query->where('default', $in->getDefault());
            }

            $allowedSortColumns = ['id', 'type', 'priority', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'priority';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadStatusesResponse();
            foreach ($paginator->items() as $leadStatus) {
                $response->getResult()[] = $this->buildMessage($leadStatus);
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

    public function Stream(ContextInterface $ctx, StreamLeadStatusesRequest $in): LeadStatusBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadStatus::where('company_id', $companyId);

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
            if ($in->hasType()) {
                $query->where('type', $in->getType());
            }
            if ($in->hasDefault()) {
                $query->where('default', $in->getDefault());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadStatusBatch();
            foreach ($records as $leadStatus) {
                $batch->getResult()[] = $this->buildMessage($leadStatus);
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

    private function buildMessage(LeadStatus $leadStatus): LeadStatusMessage
    {
        $msg = new LeadStatusMessage();
        $msg->setId($leadStatus->id);
        $msg->setCompanyId($leadStatus->company_id ?? 0);
        $msg->setType($leadStatus->type ?? '');
        $msg->setPriority($leadStatus->priority ?? 0);
        $msg->setDefault((bool) ($leadStatus->default ?? false));
        $msg->setLabelColor($leadStatus->label_color ?? '');
        $msg->setCreatedAt($this->dateToString($leadStatus->created_at));
        $msg->setUpdatedAt($this->dateToString($leadStatus->updated_at));

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
        \Log::error('LeadStatusGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
