{{--
    Shared renderer for notification types that don't need bespoke markup.
    Callers set $title, $text, and either $linkUrl (a ready-made URL) or
    $linkRoute (+ optional $linkParam) before @include-ing this file.
    route() failures degrade to no link instead of breaking the whole
    dropdown — a bad route name here must never take down every other
    notification in the list.
--}}
@php
    $__link = '';
    if (!empty($linkUrl)) {
        $__link = $linkUrl;
    } elseif (!empty($linkRoute)) {
        try {
            $__link = isset($linkParam) && $linkParam !== null
                ? route($linkRoute, $linkParam)
                : route($linkRoute);
        } catch (\Throwable $e) {
            $__link = '';
        }
    }
@endphp
<x-cards.notification :notification="$notification" :link="$__link"
                      :image="$image ?? (user()?->image_url ?? '')"
                      :title="$title ?? ''" :text="$text ?? null"
                      :time="$notification->created_at"/>
