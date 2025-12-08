<div class="expose-container vertical-standard">
    <!-- Header Section -->
    <div class="header" style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        @if(isset($data['company']['logo']))
            <img src="{{ $data['company']['logo'] }}" alt="Logo" style="max-height: 60px;">
        @endif
        <h1 style="color: #2c3e50; margin-top: 10px;">{{ $data['title'] }}</h1>
        <p style="font-size: 18px; color: #7f8c8d;">{{ $data['address'] }}</p>
    </div>

    <!-- Main Image -->
    @if(!empty($data['images']))
        <div class="main-image" style="width: 100%; height: 400px; overflow: hidden;">
            <img src="{{ $data['images'][0] }}" style="width: 100%; object-fit: cover;">
        </div>
    @endif

    <!-- Key Details -->
    <div class="details-grid" style="display: flex; flex-wrap: wrap; padding: 20px; gap: 20px; justify-content: center;">
        <div class="detail-item" style="text-align: center; min-width: 100px;">
            <strong>Price</strong><br>
            {{ $data['price'] }}
        </div>
        <div class="detail-item" style="text-align: center; min-width: 100px;">
            <strong>Bedrooms</strong><br>
            {{ $data['bedrooms'] }}
        </div>
        <div class="detail-item" style="text-align: center; min-width: 100px;">
            <strong>Bathrooms</strong><br>
            {{ $data['bathrooms'] }}
        </div>
        <div class="detail-item" style="text-align: center; min-width: 100px;">
            <strong>Area</strong><br>
            {{ $data['area'] }} m²
        </div>
    </div>

    <!-- Description -->
    <div class="content-section" style="padding: 20px;">
        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Description</h2>
        <div style="line-height: 1.6;">
            {!! $data['description'] !!}
        </div>
    </div>

    <!-- Features -->
    @if(!empty($data['features']))
    <div class="content-section" style="padding: 20px; background-color: #f9f9f9;">
        <h2 style="border-bottom: 2px solid #ddd; padding-bottom: 10px;">Features</h2>
        <ul style="columns: 2; list-style-position: inside;">
            @foreach($data['features'] as $feature)
                <li>{{ $feature }}</li>
            @endforeach
        </ul>
    </div>
    @endif

    <!-- Gallery -->
    @if(count($data['images']) > 1)
    <div class="gallery" style="padding: 20px;">
        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Gallery</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            @foreach(array_slice($data['images'], 1, 6) as $image)
                <div style="width: 32%; height: 150px; overflow: hidden;">
                    <img src="{{ $image }}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            @endforeach
        </div>
    </div>
    @endif

    <!-- Contact -->
    <div class="footer" style="padding: 30px; background-color: #2c3e50; color: white; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3>Contact Agent</h3>
                <p><strong>{{ $data['agent']['name'] }}</strong></p>
                <p>{{ $data['agent']['email'] }}</p>
                <p>{{ $data['agent']['phone'] }}</p>
            </div>
            @if($config->options['include_qr_code'] ?? false)
                <div class="qr-code">
                    <!-- QR Code Placeholder -->
                    <div style="width: 100px; height: 100px; background: white;"></div>
                </div>
            @endif
        </div>
    </div>
</div>
