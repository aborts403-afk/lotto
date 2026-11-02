import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { parseTicketQr, type TicketQr } from '@/lib/lotto/check';

const FRAME = 240;

// Full-screen camera that reads the QR code on a lottery ticket. Calls onTicket once with the parsed
// ticket and closes; other QR codes show a hint and scanning continues.
export function QrScanner({ visible, onClose, onTicket }: { visible: boolean; onClose: () => void; onTicket: (t: TicketQr) => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState<string | null>(null);
  const handled = useRef(false);
  const lastBad = useRef('');

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const ticket = parseTicketQr(data);
    if (ticket) {
      handled.current = true;
      onTicket(ticket);
      onClose();
    } else if (data !== lastBad.current) {
      lastBad.current = data;
      setHint('로또 6/45 용지의 QR 코드가 아니에요');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => {
        handled.current = false;
        lastBad.current = '';
        setHint(null);
      }}
      onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
        ) : (
          <View style={[styles.center, { paddingHorizontal: Spacing.four }]}>
            <ThemedText type="heading" style={styles.white}>
              카메라 권한이 필요해요
            </ThemedText>
            <ThemedText type="small" style={[styles.soft, styles.centerText]}>
              복권 용지의 QR 코드를 읽어 회차와 번호를 바로 가져와요. 사진은 저장하지 않아요.
            </ThemedText>
            {permission && !permission.canAskAgain ? (
              <Button label="설정에서 허용하기" variant="primary" onPress={() => void Linking.openSettings()} />
            ) : (
              <Button label="카메라 허용" variant="primary" onPress={() => void requestPermission()} />
            )}
          </View>
        )}

        {permission?.granted && (
          <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.frame} />
            <ThemedText type="smallBold" style={[styles.white, styles.guide]}>
              {hint ?? '용지의 QR 코드를 네모 안에 맞춰 주세요'}
            </ThemedText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [styles.close, { top: insets.top + 12 }, pressed && styles.pressed]}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  centerText: { textAlign: 'center' },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.8)' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  frame: { width: FRAME, height: FRAME, borderRadius: Radius.lg, borderWidth: 3, borderColor: '#FFFFFF' },
  guide: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, paddingHorizontal: Spacing.four, textAlign: 'center' },
  close: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
