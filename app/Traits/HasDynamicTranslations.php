<?php

namespace App\Traits;

use App\Services\DynamicTranslationService;
use Illuminate\Database\Eloquent\Model;

trait HasDynamicTranslations
{
    /**
     * @return array<int, string>
     */
    public function getDynamicTranslatableFields(): array
    {
        $modelFields = property_exists($this, 'translatableFields')
            ? ($this->translatableFields ?? [])
            : [];

        return array_values(array_filter(
            $modelFields,
            static fn ($field): bool => is_string($field) && $field !== ''
        ));
    }

    public function queueDynamicTranslations(bool $onlyDirty = true): void
    {
        $fields = $this->getDynamicTranslatableFields();

        if (empty($fields)) {
            return;
        }

        $texts = [];

        foreach ($fields as $field) {
            if ($onlyDirty && !$this->isDirty($field)) {
                continue;
            }

            $value = $this->getAttribute($field);

            if (!is_string($value) || trim($value) === '') {
                continue;
            }

            $texts[] = $value;
        }

        if (empty($texts)) {
            return;
        }

        /** @var DynamicTranslationService $translationService */
        $translationService = app(DynamicTranslationService::class);
        $translationService->bulkEnsure(array_values(array_unique($texts)));
    }

    public static function dispatchDynamicTranslation(Model $model, bool $onlyDirty = true): void
    {
        if (!method_exists($model, 'queueDynamicTranslations')) {
            return;
        }

        $model->queueDynamicTranslations($onlyDirty);
    }
}