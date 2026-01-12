<?php

namespace App\Http\Controllers;

use App\Services\FormDataService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FormDataController extends Controller
{
    public function __construct(
        private FormDataService $formDataService
    ) {
        $this->middleware('auth');
    }

    /**
     * Get form data by type with optional pagination and filters
     */
    public function index(Request $request, string $type): JsonResponse
    {

        // Convert string boolean values to actual booleans
        if ($request->has('paginate')) {
            $paginateValue = $request->get('paginate');
            if (is_string($paginateValue)) {
                $request->merge([
                    'paginate' => $paginateValue === 'true' ? true : false
                ]);
            }
        }
        $request->validate([
            'search' => 'sometimes|string|max:255',
            'paginate' => 'sometimes|boolean',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'page' => 'sometimes|integer|min:1',
            'pipeline_id' => 'sometimes|integer',
            'limit' => 'sometimes|integer|min:1|max:1000',
        ]);

        $allowedTypes = [
            'salutations', 'genders', 'categories', 'sources', 'employees',
            'lead-pipelines', 'lead-stages', 'products', 'countries',
            'lead-agents', 'client-categories', 'languages', 'leads', 'packages'
        ];

        if (!in_array($type, $allowedTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid type specified',
                'allowed_types' => $allowedTypes
            ], 400);
        }

        try {
            $data = $this->formDataService->getData($type, $request);
            
            return response()->json([
                'success' => true,
                'data' => $data,
                'type' => $type
            ]);
            
        } catch (\Exception $e) {
            \Log::error('FormData API Error', [
                'type' => $type,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch form data'
            ], 500);
        }
    }

    /**
     * Get multiple form data types in a single request
     */
    public function batch(Request $request): JsonResponse
    {
        $request->validate([
            'types' => 'required|array|max:10',
            'types.*' => 'required|string',
        ]);

        $allowedTypes = [
            'salutations', 'genders', 'categories', 'sources', 'employees',
            'lead-pipelines', 'lead-stages', 'products', 'countries',
            'lead-agents', 'client-categories', 'languages', 'leads', 'packages'
        ];

        $types = $request->get('types');
        $invalidTypes = array_diff($types, $allowedTypes);
        
        if (!empty($invalidTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid types specified: ' . implode(', ', $invalidTypes),
                'allowed_types' => $allowedTypes
            ], 400);
        }

        try {
            $results = [];
            
            foreach ($types as $type) {
                $results[$type] = $this->formDataService->getData($type, $request);
            }
            
            return response()->json([
                'success' => true,
                'data' => $results
            ]);
            
        } catch (\Exception $e) {
            \Log::error('FormData Batch API Error', [
                'types' => $types,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch form data'
            ], 500);
        }
    }
}