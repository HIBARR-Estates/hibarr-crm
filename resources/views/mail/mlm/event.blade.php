@extends('mail.layouts.base')

@section('content')
    @include('mail.entity.activity', [
        'badgeLabel' => $badgeLabel ?? __('email.mlm.badge'),
        'introText' => $introText ?? '',
        'detailHtml' => $detailHtml ?? '',
        'content' => $content ?? '',
        'actionText' => $actionText ?? __('app.view'),
        'url' => $url ?? '#',
        'footerNote' => $footerNote ?? '',
    ])
@endsection
