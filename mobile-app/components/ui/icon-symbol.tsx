// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * SF Symbol -> Material Icons, for Android and web. Add a name here when you
 * start using it: `IconSymbolName` is derived from this object, so an unmapped
 * name is a compile error rather than a blank space on Android.
 *
 * `satisfies Partial<Record<...>>`, not `as` — `as` widens the key type to
 * every SF Symbol and defeats that check.
 *
 * Material Icons: https://icons.expo.fyi
 */
const MAPPING = {
  house: 'home',
  sportscourt: 'sports-tennis',
  calendar: 'event',
} as const satisfies Partial<Record<SymbolViewProps['name'], MaterialIconName>>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
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
