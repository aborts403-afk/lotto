import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.center}>
          로또 노트
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          확률은 같지만, 당첨되면 혼자 다 가져가는 번호
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">준비 중</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            최신 당첨번호, 번호 생성기, 내 번호 당첨 확인 기능이 곧 추가됩니다.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  center: { textAlign: 'center' },
  card: { gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.four },
});
