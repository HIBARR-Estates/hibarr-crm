<?php

declare(strict_types=1);

namespace App\Grpc\Interceptors;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\Invoker;
use Spiral\RoadRunner\GRPC\InvokerInterface;
use Spiral\RoadRunner\GRPC\Method;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use Spiral\RoadRunner\GRPC\StatusCode;

/**
 * Authenticating Invoker decorator.
 *
 * Wraps the default Invoker to validate x-api-token and x-company-id
 * from gRPC metadata before every service call. On success, it injects
 * `authenticated_company_id` (int) and `token_data` (object) into the
 * context so downstream services receive validated, trustworthy data.
 *
 * This replaces the old CoreInterceptorInterface-based AuthInterceptor
 * which could never be wired into RoadRunner's gRPC Server because
 * the Server uses InvokerInterface, not Spiral's HMVC CoreInterface.
 */
class AuthenticatingInvoker implements InvokerInterface
{
    private const METADATA_API_TOKEN = 'x-api-token';
    private const METADATA_COMPANY_ID = 'x-company-id';

    public function __construct(
        private readonly InvokerInterface $inner = new Invoker(),
    ) {}

    /**
     * @inheritDoc
     */
    public function invoke(
        ServiceInterface $service,
        Method $method,
        ContextInterface $ctx,
        ?string $input,
    ): string {
        $ctx = $this->authenticate($ctx);

        return $this->inner->invoke($service, $method, $ctx, $input);
    }

    /**
     * Validate the API token and company ID, returning an enriched context.
     *
     * @throws GRPCException UNAUTHENTICATED on invalid/missing credentials
     */
    private function authenticate(ContextInterface $ctx): ContextInterface
    {
        $token = $this->getMetadataValue($ctx, self::METADATA_API_TOKEN);
        $companyId = $this->getMetadataValue($ctx, self::METADATA_COMPANY_ID);

        Log::debug('gRPC Auth', [
            'token'      => $token ? substr($token, 0, 10) . '...' : null,
            'company_id' => $companyId,
        ]);

        if (empty($token) || empty($companyId)) {
            throw new GRPCException(
                'Missing authentication credentials. Required metadata: x-api-token, x-company-id',
                StatusCode::UNAUTHENTICATED,
            );
        }

        $tokenData = DB::table('api_tokens')
            ->where('token', $token)
            ->where('company_id', $companyId)
            ->first();

        if ($tokenData === null) {
            throw new GRPCException(
                'Invalid API token or company ID',
                StatusCode::UNAUTHENTICATED,
            );
        }

        if (!empty($tokenData->revoked)) {
            throw new GRPCException(
                'API token has been revoked',
                StatusCode::UNAUTHENTICATED,
            );
        }

        // Inject validated data into context for downstream services.
        // Services read these via $ctx->getValue('authenticated_company_id').
        return $ctx
            ->withValue('authenticated_company_id', (int) $companyId)
            ->withValue('token_data', $tokenData);
    }

    /**
     * Read a single metadata value from the gRPC context.
     *
     * RoadRunner stores gRPC headers as top-level context keys.
     * Each value is an array of strings (gRPC allows repeated headers).
     */
    private function getMetadataValue(ContextInterface $ctx, string $key): ?string
    {
        // gRPC spec lowercases all metadata keys
        $value = $ctx->getValue($key) ?? $ctx->getValue(strtolower($key));

        if (is_array($value)) {
            return $value[0] ?? null;
        }

        return is_string($value) ? $value : null;
    }
}
