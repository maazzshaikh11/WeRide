/**
 * NewCrewSheet — "Start a crew": a name, then a real crew with its own code.
 * After creating, the sheet shows the code (Copy / Share) and a Continue button; `onCreated(crewId)` fires when the
 * rider continues or dismisses the sheet, so whoever opened it (Crews tab, CrewStart) moves on only after they saw the code.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Crew } from '../models/domain';
import { CREW_NAME_MAX, CREW_NAME_MIN, CrewError, createCrew } from '../services/crewService';
import { useToastStore } from '../store/toastStore';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Sheet, TextField } from '../ui';
import useKeyboardInset from '../screens/garage/crew/useSheetKeyboardInset';

export interface NewCrewSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (crewId: string, crew?: Crew) => void;
}

export default function NewCrewSheet({ visible, onClose, onCreated }: NewCrewSheetProps) {
  const { colors, type } = useTheme();
  const kb = useKeyboardInset();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Crew | null>(null);
  const alive = useRef(true);
  const announced = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
      setBusy(false);
      setCreated(null);
      announced.current = false;
    }
  }, [visible]);

  const clean = name.trim().replace(/\s+/g, ' ');
  const valid = clean.length >= CREW_NAME_MIN && clean.length <= CREW_NAME_MAX;

  const create = async () => {
    if (busy) return;
    if (!valid) {
      setError(`A crew name is ${CREW_NAME_MIN} to ${CREW_NAME_MAX} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const crew = await createCrew(clean);
      if (alive.current) setCreated(crew);
    } catch (e) {
      if (alive.current) setError(e instanceof CrewError ? e.message : 'Could not create the crew. Try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const finish = () => {
    if (created && !announced.current) {
      announced.current = true;
      onClose();
      onCreated?.(created.id, created);
      return;
    }
    onClose();
  };

  const copy = () => {
    if (!created) return;
    Clipboard.setString(created.join_code);
    useToastStore.getState().push('Code copied', 'success');
  };
  const share = async () => {
    if (!created) return;
    try {
      await Share.share({ message: `Join my crew "${created.name}" on WeRide with code ${created.join_code}.` });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Sheet visible={visible} onClose={created ? finish : onClose} testID="sheet-NewCrew" accessibilityLabel="Start a crew">
      {created ? (
        <View testID="newcrew-done">
          <Text style={type.label} accessibilityRole="header">{'CREW CREATED'}</Text>
          <Text style={[type.h2, { marginTop: 8 }]}>{created.name}</Text>
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={[type.num, { fontSize: 44, lineHeight: 48, letterSpacing: 44 * 0.16 }]} accessibilityLabel={`Crew code ${created.join_code.split('').join(' ')}`} testID="newcrew-code">
              {created.join_code}
            </Text>
            <Text style={[type.sm, { marginTop: 8, textAlign: 'center' }]}>Anyone with this code can join. You can share it again from the crew page.</Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button label="Copy" variant="soft" style={{ flex: 1 }} leading={<Icon name="copy" size={20} color={colors.ink} />} onPress={copy} accessibilityLabel="Copy crew code" />
            <Button label="Share" variant="soft" style={{ flex: 1 }} leading={<Icon name="share" size={20} color={colors.ink} />} onPress={share} accessibilityLabel="Share crew code" />
          </View>
          <Button label="Continue" style={{ marginTop: 8 }} onPress={finish} testID="newcrew-continue" />
        </View>
      ) : (
        <View>
          <Text style={type.h2} accessibilityRole="header">Start a crew</Text>
          <Text style={[type.sm, { marginTop: 8 }]}>Name it. We make a code. You invite.</Text>
          <TextField
            containerStyle={{ marginTop: 16 }}
            placeholder="Crew name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            maxLength={CREW_NAME_MAX}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={create}
            error={error}
            accessibilityLabel="Crew name"
            testID="newcrew-name"
          />
          <Button label="Create crew" style={{ marginTop: 16 }} loading={busy} onPress={create} testID="newcrew-create" />
          {kb > 0 ? <View style={{ height: kb }} /> : null}
        </View>
      )}
    </Sheet>
  );
}
