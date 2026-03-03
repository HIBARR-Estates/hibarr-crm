<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\PipelineStageServiceInterface;
use App\Grpc\Generated\PipelineStage\ListPipelineStagesRequest;
use App\Grpc\Generated\PipelineStage\ListPipelineStagesResponse;
use App\Grpc\Generated\PipelineStage\StreamPipelineStagesRequest;
use App\Grpc\Generated\PipelineStage\PipelineStageBatch;
use App\Grpc\Generated\PipelineStage\PipelineStage as PipelineStageMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\PipelineStage;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class PipelineStageGrpcService implements PipelineStageServiceInterface
{
    public function List(ContextInterface $ctx, ListPipelineStagesRequest $in): ListPipelineStagesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'priority';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = PipelineStage::where('company_id', $companyId);

            if ($in->hasLeadPipelineId()) {
                $query->where('lead_pipeline_id', $in->getLeadPipelineId());
            }
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

            $response = new ListPipelineStagesResponse();
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

    public function Stream(ContextInterface $ctx, StreamPipelineStagesRequest $in): PipelineStageBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = PipelineStage::where('company_id', $companyId);

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
            if ($in->hasLeadPipelineId()) {
                $query->where('lead_pipeline_id', $in->getLeadPipelineId());
            }
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

            $batch = new PipelineStageBatch();
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

    private function buildMessage(PipelineStage $stage): PipelineStageMessage
    {
        $msg = new PipelineStageMessage();
        $msg->setId($stage->id);
        $msg->setCompanyId($stage->company_id ?? 0);
        $msg->setLeadPipelineId($stage->lead_pipeline_id ?? 0);
        $msg->setName($stage->name ?? '');
        $msg->setSlug($stage->slug ?? '');
        $msg->setPriority($stage->priority ?? 0);
        $msg->setDefault((bool) ($stage->default ?? false));
        $msg->setLabelColor($stage->label_color ?? '');
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
        \Log::error('PipelineStageGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
