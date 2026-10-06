/** iOS only: the keyboard height, so a bottom sheet can lift its button above it (Android resizes the window itself). */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useSheetKeyboardInset(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setH(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}
