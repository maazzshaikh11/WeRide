/**
 * AddContactSheet — add an emergency contact (name + number). Validated with userService.normalizeNumber (via
 * prefsStore.addContact, which also saves to users/{uid}/private/settings); problems show inline under the field.
 * Used by Contact (first launch) and Me → Safety.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Sheet, TextField } from '../ui';
import { useTheme } from '../theme/ThemeProvider';
import { normalizeNumber } from '../services/userService';
import { usePrefsStore } from '../store/prefsStore';
import type { EmergencyContact } from '../models/domain';

export interface AddContactSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the saved contact, just before the sheet closes. */
  onAdded?: (c: EmergencyContact) => void;
  [extra: string]: any;
}

export const NAME_ERROR = 'Enter a name.';
export const NUMBER_ERROR = 'Enter a valid number: 7 to 15 digits, with your country code if it is not local.';
export const DUPLICATE_ERROR = 'That number is already in your list.';
export const SAVE_ERROR = 'Could not save the contact. Check your connection and try again.';
/** A write made offline is queued by Firestore and acknowledged on reconnect; the list already shows it. */
export const SAVE_WAIT_MS = 3000;

export default function AddContactSheet({ visible, onClose, onAdded }: AddContactSheetProps) {
  const { type, colors } = useTheme();
  const addContact = usePrefsStore((s) => s.addContact);
  const contacts = usePrefsStore((s) => s.contacts);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const numberRef = useRef<TextInput>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // A fresh form every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName('');
      setNumber('');
      setNameError(null);
      setNumberError(null);
      setFormError(null);
      setBusy(false);
    }
  }, [visible]);

  const save = async () => {
    if (busy) return;
    const nm = name.trim();
    const normalized = normalizeNumber(number);
    const nErr = nm ? null : NAME_ERROR;
    let numErr: string | null = null;
    if (!normalized) numErr = NUMBER_ERROR;
    else if (contacts.some((c) => c.number === normalized)) numErr = DUPLICATE_ERROR;
    setNameError(nErr);
    setNumberError(numErr);
    setFormError(null);
    if (nErr || numErr) return;

    setBusy(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const saved = await Promise.race([
        addContact(nm, number),
        new Promise<'queued'>((resolve) => { timer = setTimeout(() => resolve('queued'), SAVE_WAIT_MS); }),
      ]);
      if (!alive.current) return;
      if (saved === null) {
        setNumberError(NUMBER_ERROR);
        return;
      }
      if (saved !== 'queued') onAdded?.(saved);
      onClose();
    } catch {
      if (alive.current) setFormError(SAVE_ERROR);
    } finally {
      if (timer) clearTimeout(timer);
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-AddContact" accessibilityLabel="Add a contact">
      <Text style={type.h2} accessibilityRole="header">Add a contact</Text>
      <Text style={[type.body, { marginTop: 8 }]}>They get a text with your live location if you ever press SOS.</Text>
      <Text style={[type.fieldLabel, { marginTop: 20, marginBottom: 8, marginLeft: 2 }]}>NAME</Text>
      <TextField
        value={name}
        onChangeText={(v) => { setName(v); if (nameError) setNameError(null); }}
        error={nameError}
        placeholder="Mom"
        maxLength={40}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => numberRef.current?.focus()}
        editable={!busy}
        accessibilityLabel="Contact name input"
        testID="contact-name"
      />
      <Text style={[type.fieldLabel, { marginTop: 16, marginBottom: 8, marginLeft: 2 }]}>NUMBER</Text>
      <TextField
        ref={numberRef}
        value={number}
        onChangeText={(v) => { setNumber(v); if (numberError) setNumberError(null); }}
        error={numberError}
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="done"
        onSubmitEditing={save}
        editable={!busy}
        accessibilityLabel="Contact number input"
        testID="contact-number"
      />
      {formError ? (
        <Text style={[type.sm, { marginTop: 12, color: colors.bad }]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="contact-form-error">
          {formError}
        </Text>
      ) : null}
      <View style={{ marginTop: 20 }}>
        <Button label="Save contact" onPress={save} loading={busy} testID="contact-save" />
      </View>
    </Sheet>
  );
}
