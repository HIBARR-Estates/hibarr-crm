<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DealServiceInterface;
use App\Grpc\Generated\Deal\CreateDealRequest;
use App\Grpc\Generated\Deal\GetDealRequest;
use App\Grpc\Generated\Deal\UpdateDealRequest;
use App\Grpc\Generated\Deal\DeleteDealRequest;
use App\Grpc\Generated\Deal\ListDealsRequest;
use App\Grpc\Generated\Deal\ListDealsResponse;
use App\Grpc\Generated\Deal\StreamDealsRequest;
use App\Grpc\Generated\Deal\DealBatch;
use App\Grpc\Generated\Deal\DealResponse;
use App\Grpc\Generated\Deal\Deal as DealMessage;
use App\Grpc\Generated\Common\PBEmpty;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Services\DealCreationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DealGrpcService implements DealServiceInterface
{
    public function __construct(
        private DealCreationService $dealService,
    ) {}

    public function Create(ContextInterface $ctx, CreateDealRequest $in): DealResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $data = [
                'name'            => $in->getName(),
                'lead_contact'    => $in->getContactId() ?: null,
                'agent_id'        => $in->getAgentId() ?: null,
                'pipeline'        => $in->getPipelineId() ?: null,
                'stage_id'        => $in->getPipelineStageId() ?: null,
                'source_id'       => $in->getSourceId() ?: null,
                'category_id'     => $in->getCategoryId() ?: null,
                'currency_id'     => $in->getCurrencyId() ?: null,
                'value'           => $in->getTotalValue() ?: 0,
                'close_date'      => $in->getCloseDate() ?: null,
                'company_id'      => $companyId,
                'deal_watcher'    => iterator_to_array($in->getWatcherIds()),
                'participant_ids' => iterator_to_array($in->getParticipantIds()),
                'package_id'      => iterator_to_array($in->getPackageIds()),
                'product_ids'     => iterator_to_array($in->getProductIds()),
            ];

            $deal = $this->dealService->processDeal($data);

            return $this->buildResponse($deal);
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Get(ContextInterface $ctx, GetDealRequest $in): DealResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Deal ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $deal = Deal::where('company_id', $companyId)
                ->with(['dealWatchers', 'dealParticipants', 'packages', 'products'])
                ->find($id);

            if (!$deal) {
                throw new GRPCException("Deal not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            return $this->buildResponse($deal);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Update(ContextInterface $ctx, UpdateDealRequest $in): DealResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Deal ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $deal = Deal::where('company_id', $companyId)->find($id);

            if (!$deal) {
                throw new GRPCException("Deal not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $data = [];
            if ($in->hasName()) $data['name'] = $in->getName();
            if ($in->hasContactId()) $data['lead_id'] = $in->getContactId();
            if ($in->hasAgentId()) $data['agent_id'] = $in->getAgentId();
            if ($in->hasPipelineId()) $data['lead_pipeline_id'] = $in->getPipelineId();
            if ($in->hasPipelineStageId()) $data['pipeline_stage_id'] = $in->getPipelineStageId();
            if ($in->hasSourceId()) $data['source_id'] = $in->getSourceId();
            if ($in->hasCategoryId()) $data['category_id'] = $in->getCategoryId();
            if ($in->hasCurrencyId()) $data['currency_id'] = $in->getCurrencyId();
            if ($in->hasTotalValue()) $data['total_value'] = $in->getTotalValue();
            if ($in->hasCloseDate()) $data['close_date'] = $in->getCloseDate();

            DB::beginTransaction();
            try {
                $deal->fill($data);
                $deal->save();

                $watcherIds = iterator_to_array($in->getWatcherIds());
                $participantIds = iterator_to_array($in->getParticipantIds());
                $packageIds = iterator_to_array($in->getPackageIds());
                $productIds = iterator_to_array($in->getProductIds());

                if (!empty($watcherIds)) $deal->dealWatchers()->sync($watcherIds);
                if (!empty($participantIds)) $deal->dealParticipants()->sync($participantIds);
                if (!empty($packageIds)) $deal->packages()->sync($packageIds);
                if (!empty($productIds)) $deal->products()->sync($productIds);

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

            $deal->load(['dealWatchers', 'dealParticipants', 'packages', 'products']);

            return $this->buildResponse($deal);
        } catch (GRPCException $e) {
            throw $e;
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Delete(ContextInterface $ctx, DeleteDealRequest $in): PBEmpty
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Deal ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $deal = Deal::where('company_id', $companyId)->find($id);

            if (!$deal) {
                throw new GRPCException("Deal not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $deal->delete();

            return new PBEmpty();
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function List(ContextInterface $ctx, ListDealsRequest $in): ListDealsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = Deal::where('company_id', $companyId)
                ->with(['dealWatchers', 'dealParticipants', 'packages', 'products']);

            if ($in->hasContactId()) $query->where('lead_id', $in->getContactId());
            if ($in->hasAgentId()) $query->where('agent_id', $in->getAgentId());
            if ($in->hasPipelineId()) $query->where('lead_pipeline_id', $in->getPipelineId());
            if ($in->hasPipelineStageId()) $query->where('pipeline_stage_id', $in->getPipelineStageId());
            if ($in->hasSourceId()) $query->where('source_id', $in->getSourceId());
            if ($in->hasCategoryId()) $query->where('category_id', $in->getCategoryId());
            if ($in->hasSearch()) $query->where('name', 'like', '%' . $in->getSearch() . '%');
            if ($in->hasCreatedFrom()) $query->where('created_at', '>=', $in->getCreatedFrom());
            if ($in->hasCreatedTo()) $query->where('created_at', '<=', $in->getCreatedTo());

            $allowedSortColumns = ['id', 'name', 'total_value', 'close_date', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) $sortBy = 'created_at';

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDealsResponse();
            foreach ($paginator->items() as $deal) {
                $response->getResult()[] = $this->buildMessage($deal);
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

    public function Stream(ContextInterface $ctx, StreamDealsRequest $in): DealBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Deal::where('company_id', $companyId)
                ->with(['dealWatchers', 'dealParticipants', 'packages', 'products']);

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
            if ($in->hasPipelineId()) {
                $query->where('lead_pipeline_id', $in->getPipelineId());
            }
            if ($in->hasPipelineStageId()) {
                $query->where('pipeline_stage_id', $in->getPipelineStageId());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DealBatch();
            foreach ($records as $deal) {
                $batch->getResult()[] = $this->buildMessage($deal);
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

    private function buildResponse(Deal $deal): DealResponse
    {
        $response = new DealResponse();
        $response->setDeal($this->buildMessage($deal));
        return $response;
    }

    private function buildMessage(Deal $deal): DealMessage
    {
        $msg = new DealMessage();
        $msg->setId($deal->id);
        $msg->setName($deal->name ?? '');
        $msg->setContactId($deal->lead_id ?? 0);
        $msg->setAgentId($deal->agent_id ?? 0);
        $msg->setPipelineId($deal->lead_pipeline_id ?? 0);
        $msg->setPipelineStageId($deal->pipeline_stage_id ?? 0);
        $msg->setSourceId($deal->source_id ?? 0);
        $msg->setCategoryId($deal->category_id ?? 0);
        $msg->setCurrencyId($deal->currency_id ?? 0);
        $msg->setCompanyId($deal->company_id ?? 0);
        $msg->setClientId($deal->client_id ?? 0);
        $msg->setAddedBy($deal->added_by ?? 0);
        $msg->setLastUpdatedBy($deal->last_updated_by ?? 0);
        $msg->setTotalValue((float) ($deal?->value ?? 0));
        $msg->setCloseDate($this->dateToString($deal->close_date));
        $msg->setNextFollowUpDate($this->dateToString($deal->next_follow_up_date));
        $msg->setColumnPriority($deal->column_priority ?? 0);
        $msg->setBitrixId($deal->bitrix_id ?? '');
        $msg->setCreatedAt($this->dateToString($deal->created_at));
        $msg->setUpdatedAt($this->dateToString($deal->updated_at));

        if ($deal->relationLoaded('dealWatchers')) {
            $msg->setWatcherIds($deal->dealWatchers->pluck('id')->toArray());
        }
        if ($deal->relationLoaded('dealParticipants')) {
            $msg->setParticipantIds($deal->dealParticipants->pluck('id')->toArray());
        }
        if ($deal->relationLoaded('packages')) {
            $msg->setPackageIds($deal->packages->pluck('id')->toArray());
        }
        if ($deal->relationLoaded('products')) {
            $msg->setProductIds($deal->products->pluck('id')->toArray());
        }

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        // Read the validated company ID injected by AuthenticatingInvoker.
        // This is set after token validation — never reads raw metadata directly.
        $companyId = $ctx->getValue('authenticated_company_id');
        if (!$companyId) {
            throw new GRPCException(
                'Authentication required. Provide x-api-token and x-company-id in gRPC metadata.',
                StatusCode::UNAUTHENTICATED,
            );
        }
        return (int) $companyId;
    }

    private function mapValidationException(ValidationException $e): GRPCException
    {
        $errors = [];
        foreach ($e->errors() as $field => $messages) {
            foreach ($messages as $message) {
                $errors[] = "{$field}: {$message}";
            }
        }
        return new GRPCException('Validation failed: ' . implode('; ', $errors), StatusCode::INVALID_ARGUMENT);
    }

    private function dateToString(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('DealGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
