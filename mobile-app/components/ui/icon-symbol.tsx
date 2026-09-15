// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * SF Symbol -> Material Icons. IconSymbolName is derived from this object, so
 * an unmapped name is a compile error instead of a blank space on Android.
 * `satisfies` rather than `as`: `as` widens the key type to every SF Symbol
 * and defeats that check. Names: https://icons.expo.fyi
 */
const MAPPING = {
  house: 'home',
  sportscourt: 'sports-tennis',
  calendar: 'event',
} as const satisfies Partial<Record<SymbolViewProps['name'], MaterialIconName>>;

export type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
