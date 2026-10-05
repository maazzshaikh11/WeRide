import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useRouteFit } from '../src/screens/map/useRouteFit';

const PAD: [number, number, number, number] = [100, 60, 240, 32];
const LONG = [
  { lat: 18.5204, lng: 73.8567 },
  { lat: 18.7546, lng: 73.4062 },
];
const SAME = [
  { lat: 18.5204, lng: 73.8567 },
  { lat: 18.5204, lng: 73.8567 },
];

function makeCamera() {
  return { fitBounds: jest.fn(), setCamera: jest.fn() };
}

type Props = {
  camera: ReturnType<typeof makeCamera>;
  mapReady?: boolean;
  following?: boolean;
  points?: typeof LONG;
  signature?: string;
};

let api: ReturnType<typeof useRouteFit> | null = null;

function Harness({ camera, mapReady = true, following = false, points = LONG, signature = 's1' }: Props) {
  api = useRouteFit({
    cameraRef: { current: camera } as any,
    mapReady,
    following,
    points,
    signature,
    padding: PAD,
  });
  return null;
}

function mount(props: Props) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Harness {...props} />);
  });
  return {
    update: (next: Props) =>
      act(() => {
        r.update(<Harness {...next} />);
      }),
  };
}

describe('useRouteFit', () => {
  it('fits the route bounds with UI-clearing padding once the map is ready', () => {
    const camera = makeCamera();
    mount({ camera });
    expect(camera.fitBounds).toHaveBeenCalledTimes(1);
    expect(camera.fitBounds).toHaveBeenCalledWith([73.8567, 18.7546], [73.4062, 18.5204], PAD, 700);
  });

  it('waits for the map to load', () => {
    const camera = makeCamera();
    const m = mount({ camera, mapReady: false });
    expect(camera.fitBounds).not.toHaveBeenCalled();
    m.update({ camera, mapReady: true });
    expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('does not re-fit on a re-route (same signature) — never fights the rider', () => {
    const camera = makeCamera();
    const m = mount({ camera });
    m.update({ camera, points: [...LONG, { lat: 18.6, lng: 73.6 }] }); // route geometry changed
    expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('re-fits when the signature changes (new destination / first route)', () => {
    const camera = makeCamera();
    const m = mount({ camera });
    m.update({ camera, signature: 's2' });
    expect(camera.fitBounds).toHaveBeenCalledTimes(2);
  });

  it('never moves the camera while following the rider', () => {
    const camera = makeCamera();
    mount({ camera, following: true });
    expect(camera.fitBounds).not.toHaveBeenCalled();
    expect(camera.setCamera).not.toHaveBeenCalled();
  });

  it('re-frames the route when leaving follow mode', () => {
    const camera = makeCamera();
    const m = mount({ camera, following: true });
    m.update({ camera, following: false });
    expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('markFitted keeps the rider\'s own camera position when they pan out of follow mode', () => {
    const camera = makeCamera();
    const m = mount({ camera, following: true });
    act(() => api!.markFitted());
    m.update({ camera, following: false });
    expect(camera.fitBounds).not.toHaveBeenCalled();
  });

  it('SAME start and end → centres at street zoom with padding, no fitBounds', () => {
    const camera = makeCamera();
    mount({ camera, points: SAME });
    expect(camera.fitBounds).not.toHaveBeenCalled();
    expect(camera.setCamera).toHaveBeenCalledWith({
      centerCoordinate: [73.8567, 18.5204],
      zoomLevel: 16,
      padding: { paddingTop: 100, paddingRight: 60, paddingBottom: 240, paddingLeft: 32 },
      animationDuration: 700,
    });
  });

  it('does nothing without usable points', () => {
    const camera = makeCamera();
    mount({ camera, points: [] });
    expect(camera.fitBounds).not.toHaveBeenCalled();
    expect(camera.setCamera).not.toHaveBeenCalled();
  });

  it('does not mark the fit as done when the camera ref is not attached yet', () => {
    const camera = makeCamera();
    const ref: { current: any } = { current: null };
    function Late({ ready }: { ready: boolean }) {
      useRouteFit({
        cameraRef: ref as any,
        mapReady: ready,
        following: false,
        points: LONG,
        signature: 'a',
        padding: PAD,
      });
      return null;
    }
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<Late ready />); });
    expect(camera.fitBounds).not.toHaveBeenCalled(); // no camera → nothing to move

    ref.current = camera; // camera attaches later
    act(() => { r.update(<Late ready={false} />); });
    act(() => { r.update(<Late ready />); }); // map (re)loads
    expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  });
});
