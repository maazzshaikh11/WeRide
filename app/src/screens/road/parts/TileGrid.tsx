/** 3-column grid of RiderTiles (demo `grid-template-columns: repeat(3,1fr); gap: 10`); short last rows keep the column width. */
import React from 'react';
import { View } from 'react-native';
import { RiderTile } from '../../../ui';

export interface TileSpec {
  uid: string;
  name: string;
  initials: string;
  color?: string;
  status: string;
  ready?: boolean;
  me?: boolean;
  role?: string;
}

export default function TileGrid({ tiles, style, testID }: { tiles: TileSpec[]; style?: object; testID?: string }) {
  const rows: TileSpec[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));
  return (
    <View style={[{ gap: 10 }, style]} testID={testID}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((t) => (
            <RiderTile key={t.uid} testID={`tile-${t.uid}`} name={t.name} initials={t.initials} color={t.color} status={t.status} ready={t.ready} me={t.me} role={t.role} />
          ))}
          {Array.from({ length: 3 - row.length }, (_, k) => (
            <View key={`pad${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
