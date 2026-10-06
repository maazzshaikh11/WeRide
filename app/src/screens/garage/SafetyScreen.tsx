/**
 * Safety — SOS & emergency (docs/DEMO_PARITY_SPEC.md §3). How SOS works, the real emergency contacts, crash
 * detection, the hold time that drives every SOS hold, and the practice drill.
 */
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Icon, List, ListItem, PressableScale, SectionLabel, Segmented, Toggle } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { usePrefsStore } from '../../store/prefsStore';
import { useToastStore } from '../../store/toastStore';
import type { HoldMs } from '../../models/domain';
import AddContactSheet from '../../sheets/AddContactSheet';
import InverseRail from './parts/InverseRail';
import SubScreen, { FieldLabel, NavLike } from './parts/SubScreen';
import { maskPhone } from '../../utils/phoneMask';

const HOLD_OPTIONS = [
  { value: '1000', label: '1.0 s' },
  { value: '1500', label: '1.5 s' },
  { value: '2000', label: '2.0 s' },
] as const;

export default function SafetyScreen({ navigation }: { navigation?: NavLike }) {
  const { colors, type } = useTheme();
  const prefs = usePrefsStore((s) => s.prefs);
  const contacts = usePrefsStore((s) => s.contacts);
  const setPref = usePrefsStore((s) => s.setPref);
  const removeContact = usePrefsStore((s) => s.removeContact);
  const push = useToastStore((s) => s.push);
  const [adding, setAdding] = useState(false);

  const hold = (prefs.hold_ms / 1000).toFixed(1);

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'They will no longer get a ready-to-send text when you send an SOS.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { removeContact(id); } },
    ]);

  const setHold = (v: string) => {
    const ms = Number(v) as HoldMs;
    setPref('hold_ms', ms);
    push(`SOS hold set to ${(ms / 1000).toFixed(1)} s`, 'success');
  };

  return (
    <SubScreen title={'SOS &\nemergency'} navigation={navigation} testID="screen-Safety">
      <Card style={{ marginTop: 24, backgroundColor: colors.ink }} testID="sos-how">
        <Text style={[type.h3, { color: colors.bg }]}>How SOS works</Text>
        <View style={{ marginTop: 16 }}>
          <InverseRail
            items={[
              { title: `Hold for ${hold} s`, sub: 'A tap can’t trigger it. Release early and nothing happens.', tone: 'bad' },
              { title: 'Crew alerted instantly', sub: 'Crew alert + your emergency contacts get a ready-to-send text with your live location.', tone: 'pri' },
              { title: 'Works with no signal', sub: 'It’s saved on the phone and retries until it’s delivered.', tone: 'ok' },
            ]}
          />
        </View>
      </Card>

      <SectionLabel>Emergency contacts</SectionLabel>
      <List>
        {contacts.map((c, i) => (
          <ListItem
            key={c.id}
            first={i === 0}
            icon="heart"
            accentIcon
            title={c.name}
            subtitle={maskPhone(c.number)}
            testID={`contact-${c.id}`}
            right={
              <PressableScale
                onPress={() => confirmDelete(c.id, c.name)}
                haptic="warning"
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.name}`}
                testID={`contact-delete-${c.id}`}
                style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line }}
              >
                <Icon name="trash" size={18} color={colors.ink} />
              </PressableScale>
            }
          />
        ))}
        <ListItem
          first={contacts.length === 0}
          icon="plus"
          title="Add a contact"
          chevron={false}
          onPress={() => setAdding(true)}
          testID="contact-add"
          accessibilityLabel="Add a contact"
        />
      </List>

      <SectionLabel>Triggers</SectionLabel>
      <List>
        <ListItem
          first
          title="Crash detection"
          subtitle="A hard impact starts a 15 s “Are you OK?” countdown, then sends SOS."
          right={<Toggle value={prefs.crash} onChange={(v) => setPref('crash', v)} accessibilityLabel="Crash detection" testID="toggle-crash" />}
        />
      </List>

      <FieldLabel top={16}>Hold time</FieldLabel>
      <Segmented options={HOLD_OPTIONS} value={String(prefs.hold_ms)} onChange={setHold} testID="seg-hold" />
      <Text style={[type.sm, { marginTop: 8 }]}>Longer is safer from accidents. Shorter is faster. 1.5 s is the default.</Text>

      <Button
        label="Run an SOS drill"
        leading={<Icon name="shield" size={22} color={colors.priInk} />}
        onPress={() => navigation?.navigate?.('Drill', { fromSettings: true })}
        style={{ marginTop: 24 }}
        testID="sos-drill"
      />
      <Text style={[type.sm, { marginTop: 8, textAlign: 'center' }]}>Nobody is alerted during a drill.</Text>

      <AddContactSheet visible={adding} onClose={() => setAdding(false)} />
    </SubScreen>
  );
}
