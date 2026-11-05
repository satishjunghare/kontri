import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height of the phone's bottom system bar (3-button navigation or gesture bar).
 * Apps draw edge to edge on current Android, so bottom content needs this much
 * extra padding to stay clear of the bar. It is 0 on phones and browsers without one.
 */
export function useBottomInset(): number {
  return useSafeAreaInsets().bottom;
}
