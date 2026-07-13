<?php

namespace App\Grpc\Interceptors;

use App\Models\ApiToken;
use Illuminate\Support\Facades\Log;
use Spiral\Core\CoreInterceptorInterface;
use Spiral\Core\CoreInterface;
use Spiral\RoadRunner\GRPC\ContextInterface;

/**
 * gRPC Authentication Interceptor
 * 
 * Validates API token and company ID from gRPC metadata headers.
 * Mirrors the logic from App\Http\Middleware\ApiTokenAuth for HTTP requests.
 */
class AuthInterceptor implements CoreInterceptorInterface
{
    /**
     * Metadata keys for authentication.
     */
    private const METADATA_API_TOKEN = 'x-api-token';
    private const METADATA_COMPANY_ID = 'x-company-id';

    /**
     * Process the gRPC call with authentication validation.
     *
     * @param CallContextInterface $context
     * @param string $controller
     * @param string $action
     * @param array $parameters
     * @return mixed
     * @throws \Spiral\RoadRunner\GRPC\Exception\GRPCException
     */
    public function process(string $controller, string $action, array $parameters, CoreInterface $core): mixed
    {
        // Extract context from parameters (RoadRunner passes context in parameters)
        $context = $parameters['ctx'] ?? null;
        
        if ($context === null) {
            throw new \Spiral\RoadRunner\GRPC\Exception\GRPCException(
                'Missing request context',
                \Spiral\RoadRunner\GRPC\StatusCode::INTERNAL
            );
        }

        // Get metadata from context
        // RoadRunner stores gRPC metadata as top-level context values (NOT nested under a 'metadata' key).
        // Each value is an array of strings (gRPC allows repeated header values).
        $token = $this->getContextMetadata($context, self::METADATA_API_TOKEN);
        $companyId = $this->getContextMetadata($context, self::METADATA_COMPANY_ID);

        Log::debug("gRPC Auth - API Token: " . ($token ? substr($token, 0, 10) . '...' : 'null'));
        Log::debug("gRPC Auth - Company ID: " . $companyId);

        // Validate presence of required credentials
        if (empty($token) || empty($companyId)) {
            throw new \Spiral\RoadRunner\GRPC\Exception\GRPCException(
                'Missing authentication credentials. Required headers: x-api-token, x-company-id',
                \Spiral\RoadRunner\GRPC\StatusCode::UNAUTHENTICATED
            );
        }

        // Validate token against database
        $tokenData = $this->validateToken($token, $companyId);

        if ($tokenData === null) {
            throw new \Spiral\RoadRunner\GRPC\Exception\GRPCException(
                'Invalid API token or company ID',
                \Spiral\RoadRunner\GRPC\StatusCode::UNAUTHENTICATED
            );
        }

        if ($tokenData->revoked) {
            throw new \Spiral\RoadRunner\GRPC\Exception\GRPCException(
                'API token has been revoked',
                \Spiral\RoadRunner\GRPC\StatusCode::UNAUTHENTICATED
            );
        }

        // Store validated company_id in context for downstream services
        // This allows gRPC services to access the authenticated company
        $parameters['authenticated_company_id'] = (int) $companyId;
        $parameters['token_data'] = $tokenData;

        // Proceed with the call
        return $core->callAction($controller, $action, $parameters);
    }

    /**
     * Extract a metadata value from the gRPC context.
     *
     * RoadRunner stores gRPC headers as top-level context keys.
     * Each value is an array of strings (e.g. ['my-token-value']).
     * gRPC metadata keys are always lowercased by the protocol.
     *
     * @param ContextInterface $context
     * @param string $key
     * @return string|null
     */
    private function getContextMetadata(ContextInterface $context, string $key): ?string
    {
        $value = $context->getValue($key);

        if ($value === null) {
            // gRPC spec lowercases all metadata keys, but try both just in case
            $value = $context->getValue(strtolower($key));
        }

        if (is_array($value)) {
            return $value[0] ?? null;
        }

        return is_string($value) ? $value : null;
    }

    /**
     * Validate the API token against the database.
     *
     * @param string $token
     * @param string|int $companyId
     * @return object|null
     */
    private function validateToken(string $token, string|int $companyId): ?object
    {
        return ApiToken::findByPlainToken($token, (int) $companyId);
    }
}
