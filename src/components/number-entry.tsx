import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { LottoBall } from '@/components/lotto-ball';
import { NumberPicker } from '@/components/number-picker';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseNumbers } from '@/lib/lotto/check';

// Six slots showing the picked numbers in order; empty slots are dashed circles.
export function NumberSlots({ numbers, size = 40 }: { numbers: readonly number[]; size?: number }) {
  const theme = useTheme();
  const sorted = [...numbers].sort((a, b) => a - b);
  return (
    <View style={styles.slots}>
      {Array.from({ length: 6 }, (_, i) =>
        sorted[i] ? (
          <LottoBall key={i} n={sorted[i]} size={size} />
        ) : (
          <View key={i} style={[styles.slot, { width: size, height: size, borderRadius: size / 2, borderColor: theme.border }]} />
        ),
      )}
    </View>
  );
}

/**
 * Pick six numbers: slots on top, a text field ("3 11 24 …") and the 1..45 grid, kept in sync.
 * `numbers` is controlled by the parent; `onLimit` is called when a 7th number is tapped.
 */
export function NumberEntry({
  numbers,
  onChange,
  onLimit,
}: {
  numbers: readonly number[];
  onChange: (next: number[]) => void;
  onLimit?: () => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(numbers.join(' '));
  const [last, setLast] = useState(numbers);
  if (last !== numbers && numbers.join(' ') !== parseNumbers(text).join(' ')) {
    // Changed from outside (picker, clear, prefill): mirror it in the text field.
    setLast(numbers);
    setText(numbers.join(' '));
  }
  const onPick = (n: number) => {
    if (numbers.includes(n)) onChange(numbers.filter((x) => x !== n));
    else if (numbers.length < 6) onChange([...numbers, n]);
    else onLimit?.();
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <NumberSlots numbers={numbers} />
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            onChange(parseNumbers(v));
          }}
          placeholder="숫자로 입력해도 돼요 (예: 3 11 24 30 41 45)"
          placeholderTextColor={theme.textTertiary}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="번호 직접 입력"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
        />
        {numbers.length > 0 && <Button label="지우기" size="sm" variant="ghost" onPress={() => onChange([])} />}
      </View>
      <NumberPicker fixed={numbers} onPress={onPick} />
      {numbers.length < 6 && (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
          번호를 {6 - numbers.length}개 더 골라 주세요
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  head: { alignItems: 'center' },
  slots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  slot: { borderWidth: 2, borderStyle: 'dashed' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 15 },
  center: { textAlign: 'center' },
});
