import { Linking } from 'react-native';

import { Button } from '@/components/button';
import { naverMapUrl, type MapPlace } from '@/lib/naver-map';

// Opens the place in Naver Map (new tab on web, the Naver Map app or browser on phones).
export function MapButton({ place, label = '지도' }: { place: MapPlace; label?: string }) {
  const url = naverMapUrl(place);
  if (!url) return null;
  return (
    <Button
      label={label}
      icon="map"
      size="sm"
      variant="tonal"
      accessibilityLabel={`${place.name ?? '판매점'} 네이버 지도에서 보기`}
      onPress={() => void Linking.openURL(url)}
    />
  );
}
