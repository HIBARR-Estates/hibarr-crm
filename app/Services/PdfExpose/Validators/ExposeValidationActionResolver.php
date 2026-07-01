<?php

namespace App\Services\PdfExpose\Validators;

class ExposeValidationActionResolver
{
    /**
     * Attach navigation actions to validation warnings.
     *
     * @param  array<int, array<string, mixed>>  $warnings
     * @param  array<string, mixed>  $context
     * @return array<int, array<string, mixed>>
     */
    public function attachActions(array $warnings, array $context): array
    {
        foreach ($warnings as $index => $warning) {
            $action = $this->resolveAction($warning['field'] ?? '', $context);

            if ($action !== null) {
                $warnings[$index]['action'] = $action;
            }
        }

        return $warnings;
    }

    private function resolveAction(string $field, array $context): ?array
    {
        $exposeContext = $context['context'] ?? 'property';

        if (str_starts_with($field, 'assets.')) {
            return $this->resolveAssetAction(substr($field, 7), $context, $exposeContext);
        }

        return match ($field) {
            'unit_type_description',
            'description',
            'bedrooms',
            'bathrooms',
            'living_area_sqm',
            'property_type',
            'features',
            'title',
            'price' => $this->resolveUnitTypeOrPropertyFieldAction($field, $context, $exposeContext),
            'city',
            'distances',
            'location_infrastructure',
            'location_airports' => $this->locationAction($context),
            'footer_image',
            'outro_details' => $this->linkAction('Configure footer', route('expose-configuration.show')),
            'developer',
            'completion_date',
            'construction_status',
            'starting_price',
            'payment_plan' => $this->projectOverviewAction($context, $exposeContext),
            'unit_types' => $this->projectSectionAction($context, 'unit_types', 'Manage unit types'),
            'facilities' => $this->projectSectionAction($context, 'facilities', 'Manage facilities'),
            'agent.name' => $this->propertyEditAction($context, $exposeContext, 'Edit property'),
            default => null,
        };
    }

    private function resolveAssetAction(string $tag, array $context, string $exposeContext): ?array
    {
        if ($exposeContext === 'property') {
            $propertyId = $context['property_id'] ?? null;

            if (!$propertyId) {
                return null;
            }

            return $this->linkAction(
                'Manage photos',
                route('properties.assets.index', $propertyId)
            );
        }

        if ($exposeContext === 'unit_type') {
            $projectId = $context['project_id'] ?? null;
            $unitTypeId = $context['unit_type_id'] ?? null;

            if ($projectId && $unitTypeId) {
                return $this->linkAction(
                    'Edit unit type photos',
                    $this->projectShowUrl($projectId, [
                        'section' => 'unit_types',
                        'edit_unit_type' => $unitTypeId,
                    ])
                );
            }
        }

        if (in_array($exposeContext, ['unit_type', 'developer_project'], true)) {
            $projectId = $context['project_id'] ?? null;

            if (!$projectId) {
                return null;
            }

            $section = $this->projectSectionForAssetTag($tag);

            return $this->linkAction(
                'Manage photos',
                $this->projectShowUrl($projectId, ['section' => $section])
            );
        }

        return null;
    }

    private function resolveUnitTypeOrPropertyFieldAction(
        string $field,
        array $context,
        string $exposeContext
    ): ?array {
        if ($exposeContext === 'unit_type') {
            $projectId = $context['project_id'] ?? null;
            $unitTypeId = $context['unit_type_id'] ?? null;

            if (!$projectId || !$unitTypeId) {
                return null;
            }

            return $this->linkAction(
                'Edit unit type',
                $this->projectShowUrl($projectId, [
                    'section' => 'unit_types',
                    'edit_unit_type' => $unitTypeId,
                ])
            );
        }

        if ($exposeContext === 'developer_project') {
            return $this->projectOverviewAction($context, $exposeContext);
        }

        return $this->propertyEditAction($context, $exposeContext, 'Edit property');
    }

    private function locationAction(array $context): ?array
    {
        $locationId = $context['location_id'] ?? null;

        if (!$locationId) {

            return $this->linkAction(
                'Edit location',
                route('project-locations.show', $locationId)
            );
            
            $projectId = $context['project_id'] ?? null;

            if (!$projectId) {
                return null;
            }

            return $this->linkAction(
                'Edit project',
                $this->projectShowUrl($projectId, ['section' => 'overview', 'edit' => '1'])
            );
        }

        return null;
    }

    private function projectOverviewAction(array $context, string $exposeContext): ?array
    {
        if (!in_array($exposeContext, ['developer_project', 'unit_type'], true)) {
            return null;
        }

        $projectId = $context['project_id'] ?? null;

        if (!$projectId) {
            return null;
        }

        return $this->linkAction(
            'Edit project',
            $this->projectShowUrl($projectId, ['section' => 'overview', 'edit' => '1'])
        );
    }

    private function projectSectionAction(array $context, string $section, string $label): ?array
    {
        $projectId = $context['project_id'] ?? null;

        if (!$projectId) {
            return null;
        }

        return $this->linkAction(
            $label,
            $this->projectShowUrl($projectId, ['section' => $section])
        );
    }

    private function propertyEditAction(array $context, string $exposeContext, string $label): ?array
    {
        if ($exposeContext !== 'property') {
            return null;
        }

        $propertyId = $context['property_id'] ?? null;

        if (!$propertyId) {
            return null;
        }

        return $this->linkAction(
            $label,
            route('properties.show', $propertyId) . '?edit=1'
        );
    }

    private function projectSectionForAssetTag(string $tag): string
    {
        return match ($tag) {
            'exterior' => 'exterior',
            'interior' => 'interior',
            'floor-plan', 'site-plan' => 'siteplan',
            'facilities' => 'facilities',
            default => 'photos',
        };
    }

    private function projectShowUrl(int $projectId, array $query = []): string
    {
        $url = route('developer-projects.show', $projectId);

        if ($query === []) {
            return $url;
        }

        return $url . '?' . http_build_query($query);
    }

    private function linkAction(string $label, string $href): array
    {
        return [
            'type' => 'link',
            'label' => $label,
            'href' => $href,
        ];
    }
}
