@extends('layouts.app')

@push('styles')
    <style>
        pre {
            background: rgba(0,0,0,.05);
            padding: 10px;
            border-radius: 5px;
            color: #d63555;
        }
    </style>
@endpush

@section('content')
    <div class="content-wrapper border-top-0 client-detail-wrapper">
        <div class="row">
            <div class="col-md-6 mb-4">
                <x-cards.data >
                    <x-slot:title>
                        @lang('webhooks::app.requestDetails')
                    </x-slot:title>
                    <table class="table table-striped table-hover mb-0">
                        <tbody>
                                <tr>
                                    <td>@lang('webhooks::app.requestUrl')</td>
                                    <td>{{ $log->action }}</td>
                                </tr>
                                <tr>
                                    <td>@lang('webhooks::app.requestMethod')</td>
                                    <td>{{ $log->method }}</td>
                                </tr>
                                <tr>
                                    <td>@lang('app.date')</td>
                                    <td>{{ $log->created_at->timezone($company->timezone)->translatedFormat($company->date_format.' '.$company->time_format) }}</td>
                                </tr>
                                <tr>
                                    <td>@lang('webhooks::app.webhookFor')</td>
                                    <td>{{ $log->webhookSettings?->webhook_for }}</td>
                                </tr>
                        </tbody>
                    </table>
                </x-cards.data>
            </div>
            <div class="col-md-6 mb-4">
                <x-cards.data >
                    <x-slot:title>
                        @lang('webhooks::app.requestHeaders')
                    </x-slot:title>
                    <table class="table table-striped table-hover mb-0">
                        <tbody>
                            @forelse (json_decode($log->headers) as $key => $value)
                                <tr>
                                    <td>{{ $key }}</td>
                                    <td>{{ is_array($value) ? implode(', ', $value) : $value }}</td>
                                </tr>
                            @empty
                                <x-cards.no-record-found-list colspan="2"/>
                            @endforelse
                        </tbody>
                    </table>
                </x-cards.data>
            </div>
            <div class="col-md-6 mb-4">
                <x-cards.data>
                    <x-slot:title>
                        @lang('webhooks::app.requestBody')
                    </x-slot:title>
                    <x-slot:action>
                        <div class="">
                            <span class="badge badge-info">@lang('webhooks::app.requestFormat'): {{$log->webhookSettings?->request_format}}</span>
                        </div>
                    </x-slot:action>
                    <pre>{!! $log->raw_content !!}</pre>
                </x-cards.data>
            </div>
            <div class="col-md-6 mb-4">
                <x-cards.data>
                    <x-slot:title>
                        @lang('webhooks::app.response')
                    </x-slot:title>
                    <x-slot:action>
                        <div class="">
                            <span class="badge badge-info">{{ $log->response_code }}</span>
                        </div>
                    </x-slot:action>
                    <pre>{{ $log->response }}</pre>
                </x-cards.data>
            </div>
        </div>
    </div>
@endsection

