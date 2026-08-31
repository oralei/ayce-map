import { useEffect, useState } from 'react'
import axios from 'axios'
import type { PlaceResult } from './MainMap'
import EmptyState from './panels/EmptyState'
import LoadingState from './panels/LoadingState'
import DiscoverPanel from './panels/DiscoverPanel'
import ManagePanel from './panels/ManagePanel'

interface RestaurantViewProps {
    place: PlaceResult | null
}

// shape of a row from the 'locations' table
export interface LocationRecord {
    id: string // bigint serialized as string — see server.ts BigInt.toJSON shim
    google_place_id: string
    name: string
    address: string | null
    latitude: number
    longitude: number
    rating: number | null
}

interface LocationCheckResponse {
    exists: boolean
    location?: LocationRecord
}

interface AddErrorState {
    placeId: string
    message: string
}

type ViewState = 'empty' | 'loading' | 'discover' | 'manage'

function getViewState(place: PlaceResult | null, exists: boolean | null): ViewState {
    if (!place) return 'empty'
    if (exists === null) return 'loading'
    return exists ? 'manage' : 'discover'
}

export function RestaurantView({ place }: RestaurantViewProps) {
    const [lastCheck, setLastCheck] = useState<{ placeId: string; exists: boolean } | null>(null)
    const [location, setLocation] = useState<LocationRecord | null>(null)
    const [adding, setAdding] = useState(false)
    const [addError, setAddError] = useState<AddErrorState | null>(null)

    useEffect(() => {
        if (!place) return
        let cancelled = false

        axios.get<LocationCheckResponse>('http://localhost:8080/location', {
            params: { google_place_id: place.google_place_id },
        })
            .then((res) => {
                if (cancelled) return
                setLastCheck({ placeId: place.google_place_id, exists: res.data.exists })
                setLocation(res.data.location ?? null)
            })
            .catch((err) => console.error(err))

        return () => { cancelled = true }
    }, [place])

    const exists = place && lastCheck?.placeId === place.google_place_id ? lastCheck.exists : null
    const displayedError = place && addError?.placeId === place.google_place_id ? addError.message : null
    const viewState = getViewState(place, exists)

    const handleAddToList = async () => {
        if (!place || adding) return
        setAdding(true)
        setAddError(null)

        try {
            const res = await axios.post<LocationRecord>('http://localhost:8080/location', {
                google_place_id: place.google_place_id,
                name: place.name,
                address: place.address,
                latitude: place.lat,
                longitude: place.lng,
                rating: null,
            })
            setLastCheck({ placeId: place.google_place_id, exists: true })
            setLocation(res.data)
        } catch (err) {
            console.error(err)
            setAddError({ placeId: place.google_place_id, message: "couldn't add — try again" })
        } finally {
            setAdding(false)
        }
    }

    switch (viewState) {
        case 'empty':
            return <EmptyState />
        case 'loading':
            return <LoadingState place={place!} />
        case 'discover':
            return <DiscoverPanel place={place!} adding={adding} error={displayedError} onAdd={handleAddToList} />
        case 'manage':
            return <ManagePanel place={place!} location={location!} />
    }
}

export default RestaurantView