// Links to Naver Map (네이버 지도). On phones with the Naver Map app the https link can open the app;
// otherwise it opens the mobile or desktop web map.

export type MapPlace = { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null };

// Searches by road address: Naver shows the exact spot and lists the places at that address (the store
// is usually there). Store names alone are often generic ("로또방"), and the map-center parameter is
// ignored for search URLs, so coordinates are not used.
export function naverMapUrl(place: MapPlace): string | null {
  const query = place.address?.trim() || place.name?.trim();
  return query ? `https://map.naver.com/p/search/${encodeURIComponent(query)}` : null;
}
