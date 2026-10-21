import React, { useState } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { UI } from '../../constants/ui';
import { InfoSheet, SheetAction } from './InfoSheet';

export interface DropdownOption<T extends string> {
  key: T;
  label: string;
}

interface DropdownPillProps<T extends string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (key: T) => void;
  title?: string;
}

export function DropdownPill<T extends string>({ options, value, onChange, title = 'Select range' }: DropdownPillProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current.label}`}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {current.label}
        </Text>
        <ChevronDown size={14} color={UI.textSecondary} strokeWidth={2} />
      </Pressable>
      <InfoSheet visible={open} title={title} onClose={() => setOpen(false)}>
        {options.map((opt) => (
          <SheetAction
            key={opt.key}
            label={opt.label}
            selected={opt.key === value}
            onPress={() => {
              onChange(opt.key);
              setOpen(false);
            }}
          />
        ))}
      </InfoSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    color: UI.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
});
