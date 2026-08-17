{{--
  Keep in sync with resources/views/mail/plunk/entity-activity.plunk.html
  Plunk: ENTITY_ACTIVITY_PLUNK_TEMPLATE_ID — see plunk/TEMPLATE_REGISTRY.md
--}}
@extends('mail.entity.activity')

@php
    $badgeLabel = $badgeLabel ?? 'Deal Activity';
    $actionDescription = __('Click the button below to view the deal details.');
@endphp
