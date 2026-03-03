<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadPipelineStageServiceInterface;
use App\Grpc\Generated\LeadPipelineStage\ListLeadPipelineStagesRequest;
use App\Grpc\Generated\LeadPipelineStage\ListLeadPipelineStagesResponse;
use App\Grpc\Generated\LeadPipelineStage\StreamLeadPipelineStagesRequest;
use App\Grpc\Generated\LeadPipelineStage\LeadPipelineStageBatch;
use App\Grpc\Generated\LeadPipelineStage\LeadPipelineStage as LeadPipelineStageMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadPipelineStages;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadPipelineStageGrpcService implements LeadPipelineStageServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadPipelineStagesRequest $in): ListLeadPipelineStagesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            // Scope through pipeline → company_id
            $query = LeadPipelineStages::whereHas('pipeline', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });

            if ($in->getLeadPipelineId() > 0) {
                $query->where('lead_pipeline_id', $in->getLeadPipelineId());
            }
            if ($in->getPipelineStagesId() > 0) {
                $query->where('pipeline_stages_id', $in->getPipelineStagesId());
            }

            $allowedSortColumns = ['id', 'lead_pipeline_id', 'pipeline_stages_id', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadPipelineStagesResponse();
            foreach ($paginator->items() as $stage) {
                $response->getResult()[] = $this->buildMessage($stage);
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

    public function Stream(ContextInterface $ctx, StreamLeadPipelineStagesRequest $in): LeadPipelineStageBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            // Scope through pipeline → company_id
            $query = LeadPipelineStages::whereHas('pipeline', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });

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
            if ($in->getLeadPipelineId() > 0) {
                $query->where('lead_pipeline_id', $in->getLeadPipelineId());
            }
            if ($in->getPipelineStagesId() > 0) {
                $query->where('pipeline_stages_id', $in->getPipelineStagesId());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadPipelineStageBatch();
            foreach ($records as $stage) {
                $batch->getResult()[] = $this->buildMessage($stage);
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

    private function buildMessage(LeadPipelineStages $stage): LeadPipelineStageMessage
    {
        $msg = new LeadPipelineStageMessage();
        $msg->setId($stage->id);
        $msg->setLeadPipelineId($stage->lead_pipeline_id ?? 0);
        $msg->setPipelineStagesId($stage->pipeline_stages_id ?? 0);
        $msg->setCreatedAt($this->dateToString($stage->created_at));
        $msg->setUpdatedAt($this->dateToString($stage->updated_at));

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
        \Log::error('LeadPipelineStageGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
