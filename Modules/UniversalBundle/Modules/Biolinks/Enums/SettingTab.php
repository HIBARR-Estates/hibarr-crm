<?php

namespace Modules\Biolinks\Enums;

enum SettingTab: string
{

    // phpcs:disable
    case BACKGROUND = 'Background';
    case VERIFIED_BADGE = 'Verified badge';
    case BRANDING = 'Branding';
    case PROTECTION = 'Protection';
    case SEO = 'Seo';
    // case ADVANCED = 'Advanced';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::BACKGROUND => __('biolinks::app.' . $this->value),
            self::VERIFIED_BADGE => __('biolinks::app.' . $this->value),
            self::BRANDING => __('biolinks::app.' . $this->value),
            self::PROTECTION => __('biolinks::app.' . $this->value),
            self::SEO => __('biolinks::app.' . $this->value),
            // self::ADVANCED => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
