<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: Arial, Helvetica, sans-serif;
        color: #1f2933;
        background: #ffffff;
    }

    .page {
        page-break-after: always;
        width: 100%;
        height: 100vh;
        position: relative;
    }

    .page:last-child {
        page-break-after: auto;
    }

    h1, h2, h3 {
        font-weight: 600;
        letter-spacing: -0.02em;
    }

    h1 { font-size: 34px; }
    h2 { font-size: 28px; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; }

    p {
        font-size: 14px;
        line-height: 1.6;
        color: #4b5563;
    }

    .muted { color: #6b7280; }

    .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 30px 0;
    }

    .img-cover {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .grid {
        display: grid;
        gap: 16px;
    }

    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-4 { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); }

    .card {
        border: 1px solid #e5e7eb;
        padding: 20px;
        background: #ffffff;
    }
</style>

<!-- Page 1: Cover -->
<div class="page" style="display:flex;">
    <div style="width:35%; padding:50px; border-right:1px solid #e5e7eb; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
            <p class="muted" style="margin-bottom:40px;">{{ $data['created_at'] }}</p>
            <h1 style="margin-bottom:20px;">
                Property<br>Overview
            </h1>
            <p class="muted">
                Curated listing prepared for your review
            </p>
        </div>

        <div>
            <h3>Your Agent</h3>
            <div class="divider"></div>
            <p style="font-weight:600;">{{ $data['agent']['name'] }}</p>
            <p>{{ $data['agent']['email'] }}</p>
            <p>{{ $data['agent']['phone'] }}</p>
        </div>
    </div>

    <div style="width:65%;">
        @php $hero = $data['assets']['hero'] ?? []; @endphp
        @if(count($hero) >= 4)
            <div class="grid grid-4" style="height:100%;">
                @foreach(array_slice($hero,0,4) as $img)
                    <img src="{{ $img }}" class="img-cover">
                @endforeach
            </div>
        @elseif(count($hero) > 0)
            <img src="{{ $hero[0] }}" class="img-cover">
        @endif
    </div>
</div>

<!-- Page 2: Property Summary -->
<div class="page" style="padding:60px;">
    <h1 style="margin-bottom:10px;">{{ $data['title'] }}</h1>
    <p class="muted" style="margin-bottom:40px;">{{ $data['address'] }}</p>

    <div class="card" style="margin-bottom:40px;">
        <h3>Asking Price</h3>
        <p style="font-size:32px; font-weight:600; color:#111827;">{{ $data['price'] }}</p>
    </div>

    <div class="grid grid-2">
        <div class="card">
            <h3>Area</h3>
            <p>{{ $data['area'] ?? 'N/A' }} m²</p>
        </div>
        <div class="card">
            <h3>Type</h3>
            <p>{{ $data['property_type'] ?? 'N/A' }}</p>
        </div>
        <div class="card">
            <h3>Bathrooms</h3>
            <p>{{ $data['bathrooms'] ?? 'N/A' }}</p>
        </div>
        <div class="card">
            <h3>Building Age</h3>
            <p>{{ $data['building_age'] ?? 'N/A' }} years</p>
        </div>
    </div>
</div>

<!-- Page 3: Exterior -->
<div class="page" style="padding:60px;">
    <h2 style="margin-bottom:30px;">Exterior</h2>
    @php $exterior = $data['assets']['exterior'] ?? []; @endphp
    <div class="grid grid-3" style="height:calc(100% - 80px);">
        @foreach(array_slice($exterior,0,9) as $img)
            <img src="{{ $img }}" class="img-cover">
        @endforeach
    </div>
</div>

<!-- Page 4: Interior -->
<div class="page" style="padding:60px;">
    <h2 style="margin-bottom:30px;">Interior</h2>
    @php $interior = $data['assets']['interior'] ?? []; @endphp
    <div class="grid grid-3" style="height:calc(100% - 80px);">
        @foreach(array_slice($interior,0,9) as $img)
            <img src="{{ $img }}" class="img-cover">
        @endforeach
    </div>
</div>

<!-- Page 5: Floor Plan -->
<div class="page" style="padding:60px;">
    <h2 style="margin-bottom:30px;">Floor Plan</h2>
    @php $plans = $data['assets']['floor-plan'] ?? []; @endphp
    <div class="grid grid-2" style="height:calc(100% - 80px);">
        @foreach(array_slice($plans,0,4) as $img)
            <div class="card" style="height:100%;">
                <img src="{{ $img }}" style="width:100%; height:100%; object-fit:contain;">
            </div>
        @endforeach
    </div>
</div>

<!-- Page 6: Features -->
<div class="page" style="padding:60px;">
    <h2 style="margin-bottom:30px;">Facilities & Features</h2>

    <div class="grid grid-3">
        @foreach(array_merge(
            $data['exterior_features'] ?? [],
            $data['interior_features'] ?? [],
            $data['location_features'] ?? []
        ) as $feature)
            <div class="card">
                <p>{{ $feature }}</p>
            </div>
        @endforeach
    </div>
</div>

<!-- Page 7: Description -->
<div class="page" style="padding:60px;">
    <h2 style="margin-bottom:30px;">Property Description</h2>
    <div style="max-width:900px;">
        {!! $data['description'] ?? '<p class="muted">No description provided.</p>' !!}
    </div>
</div>

<!-- Page 8: Contact -->
<div class="page" style="display:flex;">
    <div style="width:60%;">
        @php $footer = $data['assets']['footer'] ?? []; @endphp
        @if(count($footer))
            <img src="{{ $footer[0] }}" class="img-cover">
        @endif
    </div>

    <div style="width:40%; padding:60px; border-left:1px solid #e5e7eb;">
        <h2 style="margin-bottom:20px;">Contact</h2>
        <p style="font-weight:600;">{{ $data['agent']['name'] }}</p>
        <p>{{ $data['agent']['email'] }}</p>
        <p>{{ $data['agent']['phone'] }}</p>

        @if(isset($data['company']['logo']))
            <div class="divider"></div>
            <img src="{{ $data['company']['logo'] }}" style="max-width:140px;">
        @endif
    </div>
</div>
