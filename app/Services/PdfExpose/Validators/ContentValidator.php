<?php

namespace App\Services\PdfExpose\Validators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;

class ContentValidator
{
    /**
     * Required image counts per tag for expose template
     */
    private array $imageRequirements = [
        'hero' => ['min' => 1, 'label' => 'Hero image'],
        'exterior' => ['min' => 5, 'label' => 'Exterior images'],
        'interior' => ['min' => 2, 'label' => 'Interior images'],
        'facilities' => ['min' => 6, 'label' => 'Facilities images'],
        'floor-plan' => ['min' => 1, 'label' => 'Floor plan'],
        'area' => ['min' => 1, 'label' => 'Area/location image'],
    ];

    /**
     * Validation rules per entity type
     */
    private array $rules = [
        'property' => [
            'required' => [
                'title' => ['label' => 'Property title', 'message' => 'Property title is required'],
                'price' => ['label' => 'Property price', 'message' => 'Property price is required'],
                'city' => ['label' => 'Property city', 'message' => 'Property city is required'],
            ],
            'recommended' => [
                'description' => ['label' => 'Property description', 'message' => 'Property description is recommended'],
                'bedrooms' => ['label' => 'Bedrooms', 'message' => 'Number of bedrooms is recommended'],
                'bathrooms' => ['label' => 'Bathrooms', 'message' => 'Number of bathrooms is recommended'],
                'living_area_sqm' => ['label' => 'Living area (sqm)', 'message' => 'Living area (sqm) is recommended'],
                'property_type' => ['label' => 'Property type', 'message' => 'Property type is recommended'],
            ],
            'optimal' => [
                'features' => ['label' => 'Property features', 'message' => 'Property features enhance the expose'],
                'agent.name' => ['label' => 'Agent name', 'message' => 'Agent information improves credibility'],
                'distances' => ['label' => 'Distance information', 'message' => 'Distance information enhances the infrastructure page'],
            ],
        ],
        'developer_project' => [
            'required' => [
                'title' => ['label' => 'Project title', 'message' => 'Project title is required'],
                'developer' => ['label' => 'Developer name', 'message' => 'Developer name is required'],
                'city' => ['label' => 'Project city/area', 'message' => 'Project city/area is required'],
            ],
            'recommended' => [
                'description' => ['label' => 'Project description', 'message' => 'Project description is recommended'],
                'completion_date' => ['label' => 'Completion date', 'message' => 'Completion date is recommended'],
                'construction_status' => ['label' => 'Construction status', 'message' => 'Construction status is recommended'],
                'starting_price' => ['label' => 'Starting price', 'message' => 'Starting price is recommended'],
                'unit_types' => ['label' => 'Unit types', 'message' => 'Unit type summaries enhance the brochure'],
            ],
            'optimal' => [
                'facilities' => ['label' => 'Facilities', 'message' => 'Facility information enhances the brochure'],
                'distances' => ['label' => 'Distance information', 'message' => 'Distance information enhances the infrastructure page'],
                'payment_plan' => ['label' => 'Payment plan', 'message' => 'Payment plan details improve buyer engagement'],
            ],
        ],
    ];

    /**
     * Validate configuration and return warnings
     *
     * @return array Array of warnings with severity levels
     */
    public function validate(ExposeConfiguration $config): array
    {
        $warnings = [];
        $rules = $this->rules[$config->entityType] ?? [];

        foreach ($rules['required'] ?? [] as $field => $rule) {
            if (!$config->has($field) || empty($config->get($field))) {
                $warnings[] = $this->makeWarning('error', $field, $rule['label'], $rule['message']);
            }
        }

        foreach ($rules['recommended'] ?? [] as $field => $rule) {
            $value = $config->get($field);

            if ($field === 'images') {
                if (empty($value) || count($value) < 3) {
                    $warnings[] = $this->makeWarning('warning', $field, $rule['label'], $rule['message']);
                }
            } elseif (!$config->has($field) || empty($value)) {
                $warnings[] = $this->makeWarning('warning', $field, $rule['label'], $rule['message']);
            }
        }

        foreach ($rules['optimal'] ?? [] as $field => $rule) {
            if (!$config->has($field) || empty($config->get($field))) {
                $warnings[] = $this->makeWarning('info', $field, $rule['label'], $rule['message']);
            }
        }

        $warnings = array_merge($warnings, $this->checkFallbackWarnings($config));

        $overflowWarnings = $this->checkTextOverflow($config);
        $warnings = array_merge($warnings, $overflowWarnings);

        if (in_array($config->entityType, ['property', 'developer_project'])) {
            $imageWarnings = $this->checkImageCounts($config);
            $warnings = array_merge($warnings, $imageWarnings);
        }

        return $warnings;
    }

    private function makeWarning(string $severity, string $field, string $label, string $message): array
    {
        return [
            'severity' => $severity,
            'field' => $field,
            'label' => $label,
            'message' => $message,
        ];
    }

    /**
     * Check if required image counts are met
     */
    private function checkImageCounts(ExposeConfiguration $config): array
    {
        $warnings = [];
        $assets = $config->get('assets', []);

        foreach ($this->imageRequirements as $tag => $requirement) {
            $count = count($assets[$tag] ?? []);
            $minRequired = $requirement['min'];
            $label = $requirement['label'];
            $field = "assets.{$tag}";

            if ($count === 0) {
                $severity = in_array($tag, ['hero', 'exterior']) ? 'error' : 'warning';
                $warnings[] = $this->makeWarning(
                    $severity,
                    $field,
                    $label,
                    "No images uploaded (requires {$minRequired})"
                );
            } elseif ($count < $minRequired) {
                $warnings[] = $this->makeWarning(
                    'warning',
                    $field,
                    $label,
                    "{$count} of {$minRequired} required"
                );
            }
        }

        return $warnings;
    }

    private function checkFallbackWarnings(ExposeConfiguration $config): array
    {
        $warnings = [];

        if ($config->get('unit_type_description_provided') === false) {
            $warnings[] = $this->makeWarning(
                'warning',
                'unit_type_description',
                'Unit type description',
                'Not populated. The expose will fall back to project-level content if available.'
            );
        }

        if (empty($config->get('location_infrastructure', []))) {
            $warnings[] = $this->makeWarning(
                'warning',
                'location_infrastructure',
                'Project location infrastructure',
                'Not populated. Add nearby infrastructure details to enrich the expose.'
            );
        }

        if (empty($config->get('location_airports', []))) {
            $warnings[] = $this->makeWarning(
                'warning',
                'location_airports',
                'Project location airports',
                'Not populated. Add airport travel details to enrich the expose.'
            );
        }

        $outro = $config->get('expose_global_config.outro', []);
        $hasOutroText = !empty(trim((string) ($outro['title'] ?? '')))
            || !empty(trim((string) ($outro['description'] ?? '')));
        $hasFooterImage = !empty($outro['primary_image_url'] ?? null)
            || !empty($outro['secondary_image_url'] ?? null);

        if (!$hasFooterImage) {
            $warnings[] = $this->makeWarning(
                'warning',
                'footer_image',
                'Footer image',
                'Not populated. Add a footer image to avoid an incomplete closing page.'
            );
        }

        if (($outro['enabled'] ?? false) && !$hasOutroText) {
            $warnings[] = $this->makeWarning(
                'warning',
                'outro_details',
                'Outro details',
                'Not populated. Add the closing title or description to complete the PDF footer section.'
            );
        }

        return $warnings;
    }

    /**
     * Check for potential text overflow issues
     */
    private function checkTextOverflow(ExposeConfiguration $config): array
    {
        $warnings = [];
        $maxLengths = [
            'title' => ['label' => 'Title', 'max' => 100],
            'description' => ['label' => 'Description', 'max' => 1500],
        ];

        foreach ($maxLengths as $field => $fieldConfig) {
            $value = $config->get($field, '');
            $length = strlen($value);
            $maxLength = $fieldConfig['max'];

            if ($length > $maxLength) {
                $warnings[] = $this->makeWarning(
                    'warning',
                    $field,
                    $fieldConfig['label'],
                    "Very long ({$length} characters). It may overflow on the PDF."
                );
            }
        }

        return $warnings;
    }

    /**
     * Check if configuration has blocking errors
     */
    public function hasBlockingErrors(array $warnings): bool
    {
        return collect($warnings)
            ->where('severity', 'error')
            ->isNotEmpty();
    }
}
