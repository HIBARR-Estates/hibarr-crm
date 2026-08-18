<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadServiceInterface;
use App\Grpc\Generated\Lead\CreateLeadRequest;
use App\Grpc\Generated\Lead\GetLeadRequest;
use App\Grpc\Generated\Lead\UpdateLeadRequest;
use App\Grpc\Generated\Lead\DeleteLeadRequest;
use App\Grpc\Generated\Lead\ListLeadsRequest;
use App\Grpc\Generated\Lead\ListLeadsResponse;
use App\Grpc\Generated\Lead\StreamLeadsRequest;
use App\Grpc\Generated\Lead\LeadBatch;
use App\Grpc\Generated\Lead\LeadResponse;
use App\Grpc\Generated\Lead\Lead as LeadMessage;
use App\Grpc\Generated\Common\PBEmpty;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Lead;
use App\Support\LeadSearchQuery;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadGrpcService implements LeadServiceInterface
{
    public function Create(ContextInterface $ctx, CreateLeadRequest $in): LeadResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $data = ['client_name' => $in->getClientName(), 'company_id' => $companyId];

            $optionalFields = [
                'getClientEmail' => 'client_email',
                'getCompanyName' => 'company_name',
                'getSalutation' => 'salutation',
                'getGender' => 'gender',
                'getContactType' => 'contact_type',
                'getMobile' => 'mobile',
                'getCell' => 'cell',
                'getOffice' => 'office',
                'getWebsite' => 'website',
                'getAddress' => 'address',
                'getCity' => 'city',
                'getState' => 'state',
                'getCountry' => 'country',
                'getPostalCode' => 'postal_code',
            ];

            foreach ($optionalFields as $getter => $field) {
                $hasMethod = 'has' . substr($getter, 3);
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $data[$field] = $in->$getter();
                }
            }

            if ($in->hasSourceId()) $data['source_id'] = $in->getSourceId();
            if ($in->hasStatusId()) $data['status_id'] = $in->getStatusId();
            if ($in->hasCategoryId()) $data['category_id'] = $in->getCategoryId();
            if ($in->hasAgentId()) $data['agent_id'] = $in->getAgentId();
            if ($in->hasCurrencyId()) $data['currency_id'] = $in->getCurrencyId();
            if ($in->hasLeadOwner()) $data['lead_owner'] = $in->getLeadOwner();
            if ($in->hasTotalValue()) $data['total_value'] = $in->getTotalValue();
            if ($in->hasNextFollowUp()) $data['next_follow_up'] = $in->getNextFollowUp();

            DB::beginTransaction();
            try {
                $lead = new Lead();
                $lead->fill($data);
                $lead->company_id = $companyId;
                $lead->save();

                if ($in->hasCustomFieldsJson()) {
                    $customFields = json_decode($in->getCustomFieldsJson(), true);
                    if ($customFields && method_exists($lead, 'updateCustomFieldData')) {
                        $lead->updateCustomFieldData($customFields);
                    }
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

            return $this->buildResponse($lead);
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Get(ContextInterface $ctx, GetLeadRequest $in): LeadResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Lead ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $lead = Lead::where('company_id', $companyId)->find($id);

            if (!$lead) {
                throw new GRPCException("Lead not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            return $this->buildResponse($lead);
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Update(ContextInterface $ctx, UpdateLeadRequest $in): LeadResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Lead ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $lead = Lead::where('company_id', $companyId)->find($id);

            if (!$lead) {
                throw new GRPCException("Lead not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $data = [];
            $fields = [
                'hasClientName' => ['getClientName', 'client_name'],
                'hasClientEmail' => ['getClientEmail', 'client_email'],
                'hasCompanyName' => ['getCompanyName', 'company_name'],
                'hasSalutation' => ['getSalutation', 'salutation'],
                'hasGender' => ['getGender', 'gender'],
                'hasContactType' => ['getContactType', 'contact_type'],
                'hasMobile' => ['getMobile', 'mobile'],
                'hasCell' => ['getCell', 'cell'],
                'hasOffice' => ['getOffice', 'office'],
                'hasWebsite' => ['getWebsite', 'website'],
                'hasAddress' => ['getAddress', 'address'],
                'hasCity' => ['getCity', 'city'],
                'hasState' => ['getState', 'state'],
                'hasCountry' => ['getCountry', 'country'],
                'hasPostalCode' => ['getPostalCode', 'postal_code'],
                'hasSourceId' => ['getSourceId', 'source_id'],
                'hasStatusId' => ['getStatusId', 'status_id'],
                'hasCategoryId' => ['getCategoryId', 'category_id'],
                'hasAgentId' => ['getAgentId', 'agent_id'],
                'hasCurrencyId' => ['getCurrencyId', 'currency_id'],
                'hasLeadOwner' => ['getLeadOwner', 'lead_owner'],
                'hasTotalValue' => ['getTotalValue', 'total_value'],
                'hasNextFollowUp' => ['getNextFollowUp', 'next_follow_up'],
            ];

            foreach ($fields as $hasMethod => [$getter, $column]) {
                if (method_exists($in, $hasMethod) && $in->$hasMethod()) {
                    $data[$column] = $in->$getter();
                }
            }

            DB::beginTransaction();
            try {
                $lead->fill($data);
                $lead->save();

                if ($in->hasCustomFieldsJson()) {
                    $customFields = json_decode($in->getCustomFieldsJson(), true);
                    if ($customFields && method_exists($lead, 'updateCustomFieldData')) {
                        $lead->updateCustomFieldData($customFields);
                    }
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

            return $this->buildResponse($lead);
        } catch (GRPCException $e) {
            throw $e;
        } catch (ValidationException $e) {
            throw $this->mapValidationException($e);
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function Delete(ContextInterface $ctx, DeleteLeadRequest $in): PBEmpty
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $id = $in->getId();

            if ($id <= 0) {
                throw new GRPCException('Lead ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $lead = Lead::where('company_id', $companyId)->find($id);

            if (!$lead) {
                throw new GRPCException("Lead not found with ID: {$id}", StatusCode::NOT_FOUND);
            }

            $lead->forceDelete();

            return new PBEmpty();
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    public function List(ContextInterface $ctx, ListLeadsRequest $in): ListLeadsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = Lead::where('company_id', $companyId);

            if ($in->hasSourceId()) $query->where('source_id', $in->getSourceId());
            if ($in->hasStatusId()) $query->where('status_id', $in->getStatusId());
            if ($in->hasCategoryId()) $query->where('category_id', $in->getCategoryId());
            if ($in->hasAgentId()) $query->where('agent_id', $in->getAgentId());
            if ($in->hasLeadOwner()) $query->where('lead_owner', $in->getLeadOwner());
            if ($in->hasContactType()) $query->where('contact_type', $in->getContactType());
            if ($in->hasCity()) $query->where('city', 'like', '%' . $in->getCity() . '%');
            if ($in->hasCountry()) $query->where('country', 'like', '%' . $in->getCountry() . '%');
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('client_name', 'like', "%{$search}%")
                      ->orWhere('client_email', 'like', "%{$search}%")
                      ->orWhere('company_name', 'like', "%{$search}%");
                    LeadSearchQuery::applyContactMethodMatch($q, $search);
                });
            }
            if ($in->hasCreatedFrom()) $query->where('created_at', '>=', $in->getCreatedFrom());
            if ($in->hasCreatedTo()) $query->where('created_at', '<=', $in->getCreatedTo());

            $allowedSortColumns = ['id', 'client_name', 'client_email', 'total_value', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) $sortBy = 'created_at';

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadsResponse();
            foreach ($paginator->items() as $lead) {
                $response->getResult()[] = $this->buildMessage($lead);
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

    public function Stream(ContextInterface $ctx, StreamLeadsRequest $in): LeadBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Lead::where('company_id', $companyId);

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
            if ($in->hasSourceId()) {
                $query->where('source_id', $in->getSourceId());
            }
            if ($in->hasStatusId()) {
                $query->where('status_id', $in->getStatusId());
            }
            if ($in->hasCategoryId()) {
                $query->where('category_id', $in->getCategoryId());
            }
            if ($in->hasContactType()) {
                $query->where('contact_type', $in->getContactType());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadBatch();
            foreach ($records as $lead) {
                $batch->getResult()[] = $this->buildMessage($lead);
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

    private function buildResponse(Lead $lead): LeadResponse
    {
        $response = new LeadResponse();
        $response->setLead($this->buildMessage($lead));
        return $response;
    }

    private function buildMessage(Lead $lead): LeadMessage
    {
        $msg = new LeadMessage();
        $msg->setId($lead->id);
        $msg->setClientName($lead->client_name ?? '');
        $msg->setClientEmail($lead->client_email ?? '');
        $msg->setCompanyName($lead->company_name ?? '');
        $msg->setSalutation($lead->salutation?->value ?? '');
        $msg->setGender($lead->gender?->value ?? '');
        $msg->setContactType(is_object($lead->contact_type) ? $lead->contact_type->value : ($lead->contact_type ?? ''));
        $msg->setMobile($lead->mobile ?? '');
        $msg->setCell($lead->cell ?? '');
        $msg->setOffice($lead->office ?? '');
        $msg->setWebsite($lead->website ?? '');
        $msg->setAddress($lead->address ?? '');
        $msg->setCity($lead->city ?? '');
        $msg->setState($lead->state ?? '');
        $msg->setCountry($lead->country ?? '');
        $msg->setPostalCode($lead->postal_code ?? '');
        $msg->setSourceId($lead->source_id ?? 0);
        $msg->setStatusId($lead->status_id ?? 0);
        $msg->setCategoryId($lead->category_id ?? 0);
        $msg->setAgentId($lead->agent_id ?? 0);
        $msg->setCurrencyId($lead->currency_id ?? 0);
        $msg->setCompanyId($lead->company_id ?? 0);
        $msg->setLeadOwner($lead->lead_owner ?? 0);
        $msg->setAddedBy($lead->added_by ?? 0);
        $msg->setLastUpdatedBy($lead->last_updated_by ?? 0);
        $msg->setTotalValue((float) ($lead->total_value ?? 0));
        $msg->setColumnPriority($lead->column_priority ?? 0);
        $msg->setNextFollowUp($this->dateToString($lead->next_follow_up));
        $msg->setCreatedAt($this->dateToString($lead->created_at));
        $msg->setUpdatedAt($this->dateToString($lead->updated_at));

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        // Read the validated company ID injected by AuthenticatingInvoker.
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
        \Log::error('LeadGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
