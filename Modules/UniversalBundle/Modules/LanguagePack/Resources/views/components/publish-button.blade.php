<button type="button"
    class="btn @if ($isLanguagePublished) btn-outline-danger @else btn-outline-primary @endif rounded f-14 p-2 languagePackPublish"
    data-language-code="{{ $languageCode }}" data-republish="{{ $isLanguagePublished ? 'true' : 'false' }}"
    data-toggle="popover" data-placement="top" data-content="@lang($isLanguagePublished ? 'languagepack::app.republishButtonPopover' : 'languagepack::app.publishButtonPopover', ['language' => $language->language_name])" data-html="true" data-trigger="hover">
    <i class="fa @if ($isLanguagePublished) fa-redo @else fa-language @endif mr-2"></i>
    @if ($isLanguagePublished)
        @lang('languagepack::app.republish')
    @else
        @lang('languagepack::app.publish')
    @endif
</button>
