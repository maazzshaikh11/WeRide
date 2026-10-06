/**
 * Contact — step 5 of 5 (demo `contact`): who gets the SOS text first. The rider's REAL emergency contacts
 * (prefsStore.contacts, saved to users/{uid}/private/settings) with remove, an "Add a contact" row (AddContactSheet:
 * name + number, validated), and the live "Preview of the text". Continue needs at least one contact.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, List, ListItem, PressableScale, Icon, Screen, Stepper, TopBar } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import AddContactSheet from '../../sheets/AddContactSheet';
import { usePrefsStore } from '../../store/prefsStore';
import { useProfileStore } from '../../store/profileStore';
import { maskPhone } from '../../utils/phoneMask';

/** The text a contact receives (the live-location link is created by the SOS flow when it really sends). */
export function previewText(name: string): string {
  return `“${name} needs help. Live location: [link to my live position] — sent by WeRide SOS.”`;
}

export default function ContactScreen({ navigation }: any) {
  const { colors, type } = useTheme();
  const contacts = usePrefsStore((s) => s.contacts);
  const removeContact = usePrefsStore((s) => s.removeContact);
  const myName = useProfileStore((s) => s.me?.name);
  const [sheet, setSheet] = useState(false);

  return (
    <View style={{ flex: 1 }} testID="screen-Contact">
      <Screen
        cta={<Button label="Continue" onPress={() => navigation.navigate('Drill')} disabled={contacts.length === 0} testID="contact-continue" />}
      >
        <TopBar onBack={() => navigation.goBack()} />
        <Stepper step={5} />
        <Text style={type.label}>STEP 5 OF 5</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Who do we call{'\n'}first?</Text>
        <Text style={[type.body, { marginTop: 12 }]}>If you ever press SOS, this person gets a text with your live location, along with the crew.</Text>

        <List style={{ marginTop: 24 }}>
          {contacts.map((c, i) => (
            <ListItem
              key={c.id}
              first={i === 0}
              icon={i === 0 ? 'heart' : 'users'}
              accentIcon
              title={c.name}
              subtitle={maskPhone(c.number)}
              testID={`contact-row-${c.id}`}
              right={
                <PressableScale
                  onPress={() => removeContact(c.id)}
                  haptic="warning"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${c.name}`}
                  testID={`remove-${c.id}`}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="trash" size={20} color={colors.ink3} />
                </PressableScale>
              }
            />
          ))}
          <ListItem
            first={contacts.length === 0}
            icon="plus"
            title="Add a contact"
            subtitle={contacts.length === 0 ? 'Their name and number' : undefined}
            onPress={() => setSheet(true)}
            testID="add-contact-row"
          />
        </List>

        <Card style={{ marginTop: 16, backgroundColor: colors.card2 }} testID="sms-preview">
          <Text style={type.label}>PREVIEW OF THE TEXT</Text>
          <Text style={[type.body, { marginTop: 8, color: colors.ink, fontSize: 15 }]} testID="sms-preview-text">
            {previewText(myName?.trim() || 'Your name')}
          </Text>
        </Card>
      </Screen>
      <AddContactSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}
