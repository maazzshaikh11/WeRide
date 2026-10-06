/** InviteSheet — the crew's code, big, with a QR of it, Copy (clipboard + toast) and Share (system share sheet). */
import React from 'react';
import { Share, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QrCode from '../components/QrCode';
import type { Crew } from '../models/domain';
import { useToastStore } from '../store/toastStore';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Sheet } from '../ui';

export interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  crew: Pick<Crew, 'name' | 'join_code'> | null | undefined;
}

export default function InviteSheet({ visible, onClose, crew }: InviteSheetProps) {
  const { colors, type } = useTheme();
  const code = crew?.join_code ?? '';

  const copy = () => {
    if (!code) return;
    Clipboard.setString(code);
    useToastStore.getState().push('Code copied', 'success');
  };
  const share = async () => {
    if (!code || !crew) return;
    try {
      await Share.share({ message: `Join my crew "${crew.name}" on WeRide. Open the app, tap Join with code and enter ${code}.` });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Invite" accessibilityLabel="Invite riders">
      <Text style={type.label} numberOfLines={1}>{`INVITE TO ${(crew?.name ?? '').toUpperCase()}`}</Text>
      <Text style={[type.h2, { marginTop: 8 }]} accessibilityRole="header">Share the code</Text>
      {code ? (
        <>
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={[type.num, { fontSize: 44, lineHeight: 48, letterSpacing: 44 * 0.16 }]} accessibilityLabel={`Crew code ${code.split('').join(' ')}`} testID="invite-code">
              {code}
            </Text>
            <Text style={[type.sm, { marginTop: 8, textAlign: 'center' }]}>Anyone with this code can join</Text>
          </Card>
          <View testID="invite-qr" style={{ alignSelf: 'center', marginTop: 18, width: 150, height: 150, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, overflow: 'hidden' }}>
            <QrCode value={code} size={147} radius={16} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button label="Copy" variant="soft" style={{ flex: 1 }} leading={<Icon name="copy" size={20} color={colors.ink} />} onPress={copy} accessibilityLabel="Copy crew code" testID="invite-copy" />
            <Button label="Share" style={{ flex: 1 }} leading={<Icon name="share" size={20} color={colors.priInk} />} onPress={share} accessibilityLabel="Share crew code" testID="invite-share" />
          </View>
        </>
      ) : (
        <Text style={[type.sm, { marginTop: 16 }]}>This crew has no code yet.</Text>
      )}
    </Sheet>
  );
}
