// Ok, the primary goal of this file is just to express my thoughts on how to implement the propery model and its supporting services in a language that I can write quickly and has proper support for types on vscode.

enum ProjectCategory {
    Housing = "Housing",
    Land = "Land",
    CommercialRealEstate = "Commercial Real Estate",
}
enum TransactionType {
    ForSale = "For Sale",
    ForRent = "For Rent",
    ForDailyRental = "For Daily Rental",
}
type ProjectConfiguration = Record<
    ProjectCategory,
    {
        [TransactionType.ForSale]: PropertyType[];
        [TransactionType.ForRent]: PropertyType[];
        [TransactionType.ForDailyRental]: PropertyType[];
        allowableFields: {
            propertyType: boolean;
            price: boolean;
            minRentalPeriod: boolean;
            rentPaymentInterval: boolean;
            typeTitleDeed: boolean;
            titleDeedStage: boolean;
            status: boolean;
            city: boolean;
            map: boolean;
            area: boolean;
            landSize: boolean;
            livingRoom: boolean;
            bedRoom: boolean;
            bathRoom: boolean;
            floorNumber: boolean;
            floorsInBuilding: boolean;
            isThisResidenceWithinASite: boolean;
            exteriorFeatures: boolean;
            interiorFeatures: boolean;
            loacationFeatures: boolean;
            title: boolean;
            description: boolean;
            videoUrl: boolean;
            "360TourUrl": boolean;
            photos: boolean;
            addOns: boolean;
        };
    }
>;

enum PropertyType { //THis should be an actual enum type for php, and the model in php should have this type
    // Housing Types
    Villa = "Villa",
    TwinVilla = "Twin Villa",
    Apartment = "Apartment",
    FamilyHome = "Family Home",
    Townhouse = "Townhouse",
    Loft = "Loft",
    Penthouse = "Penthouse",
    Bungalow = "Bungalow",
    CommercialProperty = "Commercial Property",
    BlockOfApartments = "Block of apartments",
    CompleteBuilding = "Complete Building",
    AbandonedBuilding = "Abandoned Building",
    Residence = "Residence",
    HalfConstruction = "Half Construction",
    TimeShare = "Time Share",

    // Land Types
    ResidentiallyZonedLand = "Residentially Zoned Land",
    Field = "Field",
    ResidentiallyAndCommerciallyZonedLand = "Residentially and Commercially Zoned Land",
    CommerciallyZonedLand = "Commercially Zoned Land",
    IndustriallyZonedLand = "Industrially Zoned land",
    TourismZonedLand = "Tourism Zoned Land",
    OliveGrove = "Olive Grove",

    // Commercial Real Estate Types
    Shop = "Shop",
    Hotel = "Hotel",
    Workplace = "Workplace",
    Warehouse = "Warehouse",
    WorkplaceForSale = "Workplace for sale",
    Office = "Office",
}

export const projectConfiguration: ProjectConfiguration = {
    [ProjectCategory.Housing]: {
        [TransactionType.ForSale]: [
            PropertyType.Villa,
            PropertyType.TwinVilla,
            PropertyType.Apartment,
            PropertyType.FamilyHome,
            PropertyType.Townhouse,
            PropertyType.Loft,
            PropertyType.Penthouse,
            PropertyType.Bungalow,
            PropertyType.CommercialProperty,
            PropertyType.BlockOfApartments,
            PropertyType.CompleteBuilding,
            PropertyType.AbandonedBuilding,
            PropertyType.Residence,
            PropertyType.HalfConstruction,
        ],
        [TransactionType.ForRent]: [
            PropertyType.Villa,
            PropertyType.Apartment,
            PropertyType.TwinVilla,
            PropertyType.FamilyHome,
            PropertyType.Penthouse,
            PropertyType.Bungalow,
            PropertyType.TimeShare,
            PropertyType.CompleteBuilding,
            PropertyType.AbandonedBuilding,
            PropertyType.Residence,
            PropertyType.HalfConstruction,
        ],
        [TransactionType.ForDailyRental]: [
            PropertyType.Villa,
            PropertyType.Apartment,
            PropertyType.TwinVilla,
            PropertyType.FamilyHome,
            PropertyType.Penthouse,
            PropertyType.Bungalow,
            PropertyType.TimeShare,
            PropertyType.CompleteBuilding,
            PropertyType.AbandonedBuilding,
            PropertyType.Residence,
            PropertyType.HalfConstruction,
        ],
        allowableFields: {
            propertyType: true,
            price: true,
            minRentalPeriod: true,
            rentPaymentInterval: true,
            typeTitleDeed: true,
            titleDeedStage: true,
            status: true,
            city: true,
            map: true,
            area: true,
            landSize: false,
            livingRoom: true,
            bedRoom: true,
            bathRoom: true,
            floorNumber: true,
            floorsInBuilding: true,
            isThisResidenceWithinASite: true,
            exteriorFeatures: true,
            interiorFeatures: true,
            loacationFeatures: true,
            title: true,
            description: true,
            videoUrl: true,
            "360TourUrl": true,
            photos: true,
            addOns: true,
        },
    },
    [ProjectCategory.Land]: {
        [TransactionType.ForSale]: [
            PropertyType.ResidentiallyZonedLand,
            PropertyType.Field,
            PropertyType.ResidentiallyAndCommerciallyZonedLand,
            PropertyType.CommerciallyZonedLand,
            PropertyType.IndustriallyZonedLand,
            PropertyType.TourismZonedLand,
            PropertyType.OliveGrove,
        ],
        [TransactionType.ForRent]: [
            PropertyType.ResidentiallyZonedLand,
            PropertyType.Field,
            PropertyType.ResidentiallyAndCommerciallyZonedLand,
            PropertyType.CommerciallyZonedLand,
            PropertyType.IndustriallyZonedLand,
            PropertyType.TourismZonedLand,
            PropertyType.OliveGrove,
        ],
        [TransactionType.ForDailyRental]: [],
        allowableFields: {
            propertyType: true,
            price: true,
            minRentalPeriod: false,
            rentPaymentInterval: false,
            typeTitleDeed: true,
            titleDeedStage: true,
            status: true,
            city: true,
            map: true,
            area: true,
            landSize: true,
            livingRoom: false,
            bedRoom: false,
            bathRoom: false,
            floorNumber: false,
            floorsInBuilding: false,
            isThisResidenceWithinASite: false,
            exteriorFeatures: false,
            interiorFeatures: false,
            loacationFeatures: true,
            title: true,
            description: true,
            videoUrl: true,
            "360TourUrl": true,
            photos: true,
            addOns: false,
        },
    },
    [ProjectCategory.CommercialRealEstate]: {
        [TransactionType.ForSale]: [
            PropertyType.Shop,
            PropertyType.Hotel,
            PropertyType.Workplace,
            PropertyType.Warehouse,
            PropertyType.WorkplaceForSale,
            PropertyType.Office,
        ],
        [TransactionType.ForRent]: [
            PropertyType.Shop,
            PropertyType.Hotel,
            PropertyType.Workplace,
            PropertyType.Warehouse,
            PropertyType.WorkplaceForSale,
            PropertyType.Office,
        ],
        [TransactionType.ForDailyRental]: [
            PropertyType.Shop,
            PropertyType.Hotel,
            PropertyType.Workplace,
            PropertyType.Warehouse,
            PropertyType.WorkplaceForSale,
            PropertyType.Office,
        ],
        allowableFields: {
            propertyType: true,
            price: true,
            minRentalPeriod: true,
            rentPaymentInterval: true,
            typeTitleDeed: true,
            titleDeedStage: true,
            status: true,
            city: true,
            map: true,
            area: true,
            landSize: true,
            livingRoom: false,
            bedRoom: false,
            bathRoom: true,
            floorNumber: true,
            floorsInBuilding: true,
            isThisResidenceWithinASite: false,
            exteriorFeatures: true,
            interiorFeatures: true,
            loacationFeatures: true,
            title: true,
            description: true,
            videoUrl: true,
            "360TourUrl": true,
            photos: true,
            addOns: true,
        },
    },
};

enum TypeTitleDeed {
    ExchangeTitleDeed = "Exchange Title Deed",
    TurkishTitleDeed = "Turkish Title Deed",
    BritishTitleDeed = "British Title Deed",
    TahsisTitleDeed = "Tahsis Title Deed",
    MujahitTitleDeed = "Mujahit Title Deed",
}
enum TypeTitleDeedStage {
    LandTitleDeed = "Land Title Deed",
    SharedHolderTitleDeed = "Shared Holder Title Deed",
    IndividualTitleDeed = "Individual Title Deed",
    IndividualKatIrtirfakliTitleDeed = "Individiual (Kat Irtirfakli) Title Deed",
}

enum Status {
    Available = "Available",
    UnderOffer = "Under offer",
    Sold = "Sold",
    Withdrawn = "Withdrawn",
}

enum FurnitureStatus {
    Unfurnished = "Unfurnished",
    FullyFurnished = "Fully Furnished",
    PartFurnished = "Part Furnished",
    WhiteGoodsOnly = "White Goods Only",
}

enum ExteriorFeature {
    Barbecue = "Barbecue",
    BorderWalls = "Border Walls",
    DoubleGlazing = "Double Glazing",
    ParkingLotClosed = "Parking Lot (Closed)",
    Garage = "Garage",
    Garden = "Garden",
    Generator = "Generator",
    Lift = "Lift",
    ParkingLotOpen = "Parking Lot (Open)",
    PoolPrivate = "Pool (Private)",
    PoolCommonUse = "Pool (Common Use)",
    YellowStoneHouse = "Yellow Stone House",
    SecurityCamera = "Security Camera",
    WaterWell = "Water Well",
    Terrace = "Terrace",
    HeatInsulation = "Heat Insulation",
    WaterTank = "Water Tank",
}
enum InteriorFeature {
    AirConditioning = "Air Conditioning",
    Balcony = "Balcony",
    Bathtub = "Bathtub",
    Blinds = "Blinds",
    BuiltInKitchen = "Built-in Kitchen",
    Closet = "Closet",
    Entryphone = "Entryphone",
    FireAlarm = "Fire Alarm",
    Fireplace = "Fireplace",
    Plasterboard = "Plasterboard",
    LaundryRoom = "Laundry Room",
    ParentsToilet = "Parents Toilet",
    ParentsCloset = "Parents' Closet",
    NaturalMarble = "Natural Marble",
    PanelDoor = "Panel Door",
    Cellar = "Cellar",
    Parquet = "Parquet",
    Shower = "Shower",
    SolarElectricityProduction = "Solar Electricity Production",
    SteelDoor = "Steel Door",
    TVInfrastructure = "TV Infrastructure",
    Cloakroom = "Cloakroom",
    Wallpaper = "Wallpaper",
    Hydrophore = "Hydrophore",
}

enum LocationFeature {
    CityView = "City View",
    MountainView = "Mountain View",
    NatureGreeneryView = "Nature / Greenery View",
    ByTheSea = "By the Sea",
    SeaView = "Sea View",
    Mountainside = "Mountainside",
}
// now, we can use this configuration object to validate the fields when creating or updating a property.

// lets define the property model interface
export interface Property {
    id: number;
    projectId?: number;
    propertyType: PropertyType;
    transactionType: TransactionType;
    price?: number;
    minRentalPeriod?: string; // e.g., "6 months", "1 year"
    rentPaymentInterval?: string; // e.g., "monthly", "yearly"
    typeTitleDeed?: TypeTitleDeed;
    titleDeedStage?: TypeTitleDeedStage;
    status?: Status;
    city: string;
    map: string; // e.g., Google Maps URL
    area: string; // e.g., "Downtown", "Suburbs"
    landSize?: number; // in square meters
    livingRoom?: string; // will be a dropdown
    bedRoom?: string; // will be a dropdown
    bathRoom?: number; // will be a dropdown
    floorNumber?: number;
    floorsInBuilding?: number;
    buildingAge?: number;
    furnitureStatus?: FurnitureStatus;
    isThisResidenceWithinASite?: boolean;
    exteriorFeatures?: ExteriorFeature[]; // e.g., ["Garden", "Balcony"]
    interiorFeatures?: InteriorFeature[]; // e.g., ["Furnished", "Air Conditioning"]
    loacationFeatures?: LocationFeature[]; // e.g., ["Near School", "Sea View"]
    title: string;
    description: string;
    videoUrl?: string;
    "360TourUrl"?: string;
    photos: string[]; // array of photo URLs
    addOns?: string[]; // e.g., ["Furniture", "Appliances"]
    createdAt: Date;
    updatedAt: Date;
}

// Now the needs to be a controller for the Property I'll specify the methods below

// This will actually be a laravel request that will handle the appropriate validation based on the project configuration
type CreatePropertyRequest = Partial<Property>;
// PropertyController
export interface PropertyController {
    // Create a new property
    store(params: CreatePropertyRequest): Promise<Property>;
    // now to update a property they ought to be certain checks to ensure that only certain fields are updated based on the project configuration and the current state of the property, say id status is sold then we can't update the price or transaction type.
    update(id: number, params: CreatePropertyRequest): Promise<Property>;
    // Get a property by ID
    getById(id: number): Promise<Property | null>;
    // Delete a property by ID
    delete(id: number): Promise<boolean>;
    // List properties with optional filters
    index(filters?: Partial<Property>): Promise<Property[]>;

    // now I would like this to be a api routes that laravel will call to pass data to views layer , if I'm using react can't in  a laravel setup should I pass to views or should I use inertiajs, and how does it work ? Or should I have react as a separate frontend app that calls the laravel api endpoints ?
}
