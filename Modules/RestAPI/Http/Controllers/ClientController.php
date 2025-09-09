<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Models\Role;
use Modules\RestAPI\Entities\Client;
use Modules\RestAPI\Http\Requests\Client\CreateRequest;
use Modules\RestAPI\Http\Requests\Client\DeleteRequest;
use Modules\RestAPI\Http\Requests\Client\IndexRequest;
use Modules\RestAPI\Http\Requests\Client\ShowRequest;
use Modules\RestAPI\Http\Requests\Client\UpdateRequest;

class ClientController extends ApiBaseController
{
    protected $model = Client::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;

    public function modifyIndex($query)
    {
        return $query->visibility();
    }

    public function stored(Client $client)
    {
        $clientDetail = request()->all('client_detail')['client_detail'];
        $data = request()->all('client_detail')['client_detail'];
        $data['category_id'] = $data['category']['id'] ?? null;
        $data['sub_category_id'] = $data['sub_category']['id'] ?? null;
        unset($data['category']);
        unset($data['sub_category']);
        $client->clientDetail()->create($clientDetail);

        $clientRole = Role::where('name', 'client')->first();
        $client->attachRole($clientRole);

        // To add custom fields data
        if (request()->get('custom_fields_data')) {
            $client->clientDetail()->updateCustomFieldData(request()->get('custom_fields_data'));
        }

        return $client;
    }

    public function updating(Client $client)
    {
        $data = request()->all('client_detail')['client_detail'];
        $data['category_id'] = $data['category']['id'] ?? null;
        $data['sub_category_id'] = $data['sub_category']['id'] ?? null;
        unset($data['category']);
        unset($data['sub_category']);
        $client->client_details()->update($data);

        return $client;
    }
}
