import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { useState, useCallback } from 'react'

export interface PlaceResult {
    id: string
    google_place_id: string
    name: string
    address: string | null
    lat: number
    lng: number
    tags: string[]
    rating: number | null
}

interface MainMapProps {
    onSelectPlace: (place: PlaceResult | null) => void
}

const containerStyle = {
    width: '100%',
    height: '100%',
}

const center = {
    lat: 50.41241888678845, 
    lng: -104.63000327995762,
}

// Map options: Hides all default Google POIs
const mapOptions: google.maps.MapOptions = {
    styles: [
        { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.school', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.park', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.medical', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.government', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }], },
        {
            featureType: 'transit',
            stylers: [{ visibility: 'off' }],
        },
    ],
}

export function MainMap({ onSelectPlace }: MainMapProps) {
    const [places, setPlaces] = useState<PlaceResult[]>([])
    const [selected, setSelected] = useState<PlaceResult | null>(null)

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: String(import.meta.env.VITE_GOOGLE_MAPS_KEY),
        libraries: ['places'],
    })

    // Fetch food & drink places when the map loads
    const onLoad = useCallback(async (map: google.maps.Map) => {
        // Load the new Places library
        const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary

        const request: google.maps.places.SearchNearbyRequest = {
            // New Places API: food & drink place types
            includedTypes: ['restaurant', 'fast_food_restaurant', 'cafe', 'diner', 'food_court', 'pub'],               // make a big enum for this later, for now only show "restaurants"
            locationRestriction: {
                center: map.getCenter() || center,
                radius: 3000, // Search radius in meters
            },
            fields: ['id', 'displayName', 'location', 'rating', 'formattedAddress'],
            maxResultCount: 20,
        }

        try {
            const { places } = await Place.searchNearby(request)
            
            const formattedPlaces: PlaceResult[] = places.map((place) => ({
                id: place.id,
                google_place_id: place.id,
                name: place.displayName || 'Unknown',
                address: place.formattedAddress ?? null,
                lat: place.location?.lat() || 0,
                lng: place.location?.lng() || 0,
                tags: ["Test Tag"],
                rating: place.rating ?? null,
            }))

            setPlaces(formattedPlaces)
        } catch (error) {
            console.error('Error fetching places:', error)
        }
    }, [])

    if (!isLoaded) return <></>

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            options={mapOptions}
            zoom={13}
            onLoad={onLoad}
        >
            {/* Google Places */}
            {places.map((place) => (
                <Marker
                    key={place.id}
                    position={{ lat: place.lat, lng: place.lng }}
                    onClick={() => {
                        setSelected(place)
                        onSelectPlace(place)
                    }}
                />
            ))}

            {selected && (
                <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => {
                        setSelected(null)
                        onSelectPlace(null)
                    }}
                >
                    <div><h3>{selected.name != null ? selected.name : selected.google_place_id}</h3></div>
                </InfoWindow>
            )}
        </GoogleMap>
    )
}

export default MainMap