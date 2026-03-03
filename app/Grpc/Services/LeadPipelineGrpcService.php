<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadPipelineServiceInterface;
use App\Grpc\Generated\LeadPipeline\ListLeadPipelinesRequest;
use App\Grpc\Generated\LeadPipeline\ListLeadPipelinesResponse;
use App\Grpc\Generated\LeadPipeline\StreamLeadPipelinesRequest;
use App\Grpc\Generated\LeadPipeline\LeadPipelineBatch;
use App\Grpc\Generated\LeadPipeline\LeadPipeline as LeadPipelineMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadPipeline;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadPipelineGrpcService implements LeadPipelineServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadPipelinesRequest $in): ListLeadPipelinesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'priority';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = LeadPipeline::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('slug', 'like', "%{$search}%");
                });
            }
            if ($in->hasDefault()) {
                $query->where('default', $in->getDefault());
            }

            $allowedSortColumns = ['id', 'name', 'priority', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'priority';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadPipelinesResponse();
            foreach ($paginator->items() as $pipeline) {
                $response->getResult()[] = $this->buildMessage($pipeline);
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

    public function Stream(ContextInterface $ctx, StreamLeadPipelinesRequest $in): LeadPipelineBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadPipeline::where('company_id', $companyId);

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
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('slug', 'like', "%{$search}%");
                });
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

            $batch = new LeadPipelineBatch();
            foreach ($records as $pipeline) {
                $batch->getResult()[] = $this->buildMessage($pipeline);
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

    private function buildMessage(LeadPipeline $pipeline): LeadPipelineMessage
    {
        $msg = new LeadPipelineMessage();
        $msg->setId($pipeline->id);
        $msg->setCompanyId($pipeline->company_id ?? 0);
        $msg->setName($pipeline->name ?? '');
        $msg->setSlug($pipeline->slug ?? '');
        $msg->setPriority($pipeline->priority ?? 0);
        $msg->setLabelColor($pipeline->label_color ?? '');
        $msg->setDefault((bool) ($pipeline->default ?? false));
        $msg->setAddedBy($pipeline->added_by ?? 0);
        $msg->setCreatedAt($this->dateToString($pipeline->created_at));
        $msg->setUpdatedAt($this->dateToString($pipeline->updated_at));

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
        \Log::error('LeadPipelineGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
