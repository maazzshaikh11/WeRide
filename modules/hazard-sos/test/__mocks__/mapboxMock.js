// Mock @rnmapbox/maps for testing
module.exports = {
  __esModule: true,
  MapView: ({ children, style }: any) => children,
  ShapeSource: ({ children, id, shape }: any) => children,
  FillLayer: ({ id, style }: any) => null,
  SymbolLayer: ({ id, style }: any) => null,
  MarkerView: ({ children, coordinate, onPress, anchor }: any) => 
    typeof children === 'function' ? children({ onPress }) : children,
  Camera: ({ children }: any) => children,
};