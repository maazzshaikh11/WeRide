/// <reference types="node" />
/**
 * The app uses the real logo.jpeg everywhere: in-app <Logo>, launcher icons, splash.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image, StyleSheet } from 'react-native';

import Logo, { LOGO_SOURCE } from '../src/components/Logo';

const root = path.resolve(__dirname, '..');
const sha = (p: string) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');

describe('real logo', () => {
  it('the bundled copy is byte-identical to logo.jpeg in the repo root', () => {
    expect(sha(path.join(root, 'assets/images/logo.jpeg'))).toBe(sha(path.join(root, '..', 'logo.jpeg')));
  });

  it('is a 1254x1254 JPEG', () => {
    const b = fs.readFileSync(path.join(root, 'assets/images/logo.jpeg'));
    expect(b.readUInt16BE(0)).toBe(0xffd8);
    // find the SOF0/SOF2 marker for dimensions
    let i = 2;
    while (i < b.length) {
      const marker = b.readUInt16BE(i);
      if (marker === 0xffc0 || marker === 0xffc2) {
        expect([b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]).toEqual([1254, 1254]);
        return;
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    throw new Error('no SOF marker');
  });

  it('the old traced mark is no longer used by any screen', () => {
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p);
    });
    walk(path.join(root, 'src'));
    for (const f of files) expect(fs.readFileSync(f, 'utf8')).not.toContain('logo-mark.png');
  });

  it('ships the launch assets: Android splash and iOS LaunchLogo', () => {
    expect(fs.existsSync(path.join(root, 'android/app/src/main/res/drawable-nodpi/launch_logo.png'))).toBe(true);
    expect(fs.readFileSync(path.join(root, 'android/app/src/main/res/values/styles.xml'), 'utf8')).toContain('@drawable/launch_screen');
    const sb = fs.readFileSync(path.join(root, 'ios/weride/LaunchScreen.storyboard'), 'utf8');
    expect(sb).toContain('image="LaunchLogo"');
    expect(sb).not.toContain('Powered by React Native');
    for (const n of [1, 2, 3]) {
      expect(fs.existsSync(path.join(root, `ios/weride/Images.xcassets/LaunchLogo.imageset/launch-logo@${n}x.png`))).toBe(true);
    }
  });
});

describe('<Logo>', () => {
  it('renders logo.jpeg cropped to its tile, labelled WeRide', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Logo size={112.8} />);
    });
    const box = tree.root.findByProps({ testID: 'weride-logo' });
    expect(box.props.accessibilityLabel).toBe('WeRide');
    const boxStyle = StyleSheet.flatten(box.props.style);
    expect(boxStyle.width).toBeCloseTo(112.8);
    expect(boxStyle.borderRadius).toBeCloseTo(112.8 * 0.224);
    const img = tree.root.findByType(Image);
    expect(img.props.source).toBe(LOGO_SOURCE);
    const st = StyleSheet.flatten(img.props.style);
    // the 1254px artwork is scaled so the 1128px tile fills the box
    expect(st.width).toBeCloseTo((112.8 * 1254) / 1128);
    expect(st.left).toBeCloseTo((-62 * 112.8) / 1128);
    act(() => tree.unmount());
  });
});
