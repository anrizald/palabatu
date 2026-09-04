import { useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'

// Turns the live map into a "click to pick a point" surface for as long as
// it's mounted -- shared by the add wizard's spot step (picking a new
// crag's required pin) and any other inline "change location" affordance.
// Pure event listener, no UI of its own; the caller renders its own
// instructional chip/overlay elsewhere on the page.
export default function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e: LeafletMouseEvent) {
            onPick(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}
