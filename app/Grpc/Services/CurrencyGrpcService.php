<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\CurrencyServiceInterface;
use App\Grpc\Generated\Currency\ListCurrenciesRequest;
use App\Grpc\Generated\Currency\ListCurrenciesResponse;
use App\Grpc\Generated\Currency\StreamCurrenciesRequest;
use App\Grpc\Generated\Currency\CurrencyBatch;
use App\Grpc\Generated\Currency\Currency as CurrencyMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Currency;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class CurrencyGrpcService implements CurrencyServiceInterface
{
    public function List(ContextInterface $ctx, ListCurrenciesRequest $in): ListCurrenciesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'currency_name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = Currency::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('currency_name', 'like', "%{$search}%")
                      ->orWhere('currency_code', 'like', "%{$search}%")
                      ->orWhere('currency_symbol', 'like', "%{$search}%");
                });
            }
            if ($in->hasCurrencyCode()) {
                $query->where('currency_code', $in->getCurrencyCode());
            }
            if ($in->hasIsCryptocurrency()) {
                $query->where('is_cryptocurrency', $in->getIsCryptocurrency());
            }

            $allowedSortColumns = ['id', 'currency_name', 'currency_code', 'exchange_rate', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'currency_name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListCurrenciesResponse();
            foreach ($paginator->items() as $currency) {
                $response->getResult()[] = $this->buildMessage($currency);
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

    public function Stream(ContextInterface $ctx, StreamCurrenciesRequest $in): CurrencyBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Currency::where('company_id', $companyId);

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
                    $q->where('currency_name', 'like', "%{$search}%")
                      ->orWhere('currency_code', 'like', "%{$search}%")
                      ->orWhere('currency_symbol', 'like', "%{$search}%");
                });
            }
            if ($in->hasCurrencyCode()) {
                $query->where('currency_code', $in->getCurrencyCode());
            }
            if ($in->hasIsCryptocurrency()) {
                $query->where('is_cryptocurrency', $in->getIsCryptocurrency());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new CurrencyBatch();
            foreach ($records as $currency) {
                $batch->getResult()[] = $this->buildMessage($currency);
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

    private function buildMessage(Currency $currency): CurrencyMessage
    {
        $msg = new CurrencyMessage();
        $msg->setId($currency->id);
        $msg->setCurrencyName($currency->currency_name ?? '');
        $msg->setCurrencySymbol($currency->currency_symbol ?? '');
        $msg->setCurrencyCode($currency->currency_code ?? '');
        $msg->setExchangeRate((float) ($currency->exchange_rate ?? 0));
        $msg->setIsCryptocurrency($currency->is_cryptocurrency ?? 'no');
        $msg->setUsdPrice((float) ($currency->usd_price ?? 0));
        $msg->setCurrencyPosition($currency->currency_position ?? 'left');
        $msg->setNoOfDecimal($currency->no_of_decimal ?? 0);
        $msg->setThousandSeparator($currency->thousand_separator ?? '');
        $msg->setDecimalSeparator($currency->decimal_separator ?? '');
        $msg->setCompanyId($currency->company_id ?? 0);
        $msg->setCreatedAt($this->dateToString($currency->created_at));
        $msg->setUpdatedAt($this->dateToString($currency->updated_at));

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
        \Log::error('CurrencyGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
