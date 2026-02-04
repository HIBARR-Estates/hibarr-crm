@extends('mail.layouts.base')

@section('title', __('email.taskUpdate.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('You can view the full details and take action on this task by clicking the button below:'))
@section('intro', __('Just a quick heads up about a task update!'))
@section('content')
    {!! $content !!}
@endsection