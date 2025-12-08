<div class="expose-container horizontal-premium">
    <!-- Layout for Landscape -->
    <div style="display: flex; height: 100vh;">
        <!-- Left Sidebar -->
        <div style="width: 30%; background-color: #2c3e50; color: white; padding: 30px; display: flex; flex-direction: column;">
            @if(isset($data['company']['logo']))
                <img src="{{ $data['company']['logo'] }}" alt="Logo" style="max-width: 100%; margin-bottom: 30px;">
            @endif

            <h1 style="font-size: 24px; margin-bottom: 10px;">{{ $data['title'] }}</h1>
            <p style="color: #bdc3c7; margin-bottom: 30px;">{{ $data['address'] }}</p>

            <div style="margin-top: auto;">
                <div style="border-top: 1px solid #7f8c8d; padding-top: 20px;">
                    <p style="font-size: 28px; font-weight: bold; color: #e74c3c;">{{ $data['price'] }}</p>
                </div>
                
                <div style="margin-top: 30px;">
                    <h3>Contact</h3>
                    <p><strong>{{ $data['agent']['name'] }}</strong></p>
                    <p>{{ $data['agent']['email'] }}</p>
                    <p>{{ $data['agent']['phone'] }}</p>
                </div>
            </div>
        </div>

        <!-- Right Content -->
        <div style="width: 70%; padding: 0;">
            <!-- Hero Image -->
            @if(!empty($data['images']))
                <div style="width: 100%; height: 50vh; overflow: hidden;">
                    <img src="{{ $data['images'][0] }}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            @endif

            <div style="padding: 30px;">
                <!-- Stats -->
                <div style="display: flex; gap: 30px; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
                    <div>
                        <span style="color: #7f8c8d; font-size: 12px;">BEDROOMS</span>
                        <div style="font-size: 20px; font-weight: bold;">{{ $data['bedrooms'] }}</div>
                    </div>
                    <div>
                        <span style="color: #7f8c8d; font-size: 12px;">BATHROOMS</span>
                        <div style="font-size: 20px; font-weight: bold;">{{ $data['bathrooms'] }}</div>
                    </div>
                    <div>
                        <span style="color: #7f8c8d; font-size: 12px;">AREA</span>
                        <div style="font-size: 20px; font-weight: bold;">{{ $data['area'] }} m²</div>
                    </div>
                </div>

                <!-- Description -->
                <div style="column-count: 2; column-gap: 30px; line-height: 1.6; font-size: 14px;">
                    {!! $data['description'] !!}
                </div>
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <!-- Second Page: Gallery & Features -->
    <div style="padding: 30px;">
        <h2 style="margin-bottom: 20px;">Gallery</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
            @foreach(array_slice($data['images'], 1, 6) as $image)
                <div style="height: 200px; overflow: hidden; border-radius: 4px;">
                    <img src="{{ $image }}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            @endforeach
        </div>

        @if(!empty($data['features']))
            <h2 style="margin-bottom: 20px;">Features</h2>
            <ul style="columns: 3; list-style-position: inside;">
                @foreach($data['features'] as $feature)
                    <li style="margin-bottom: 5px;">{{ $feature }}</li>
                @endforeach
            </ul>
        @endif
    </div>
</div>
