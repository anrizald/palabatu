// Distance helpers, shared. These lived as three byte-identical copies
// (Directory.tsx, Landing.tsx, add-sheet/types.ts), each carrying a comment
// explaining that a shared module wasn't worth the indirection yet. That
// held while each page's geo need was its own; it stopped holding once
// components/SpotCard.tsx became a real shared component that formats a
// distance for callers on both pages. One implementation now, imported by
// all of them.

export type Geo = { lat: number; lng: number }

// Great-circle distance in km.
export function haversineKm(a: Geo, b: Geo): number {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
}

// Metres under a kilometre, one decimal above it -- "800 m" reads as
// walkable and "3.1 km" reads as a drive, which is the actual decision the
// number is there to support.
export function formatDistance(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
