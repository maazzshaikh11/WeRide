/**
 * RouteControls — shared handle for MapScreen's RoutePanel to trigger
 * route recalculation (toggle avoid hazards) and Google Maps deep link.
 * RouteOverlay registers its handlers here (single instance per group).
 * Person C's RoutingClient/routeStore remain the source of truth.
 */
type ToggleAvoidHazards = () => void | Promise<void>;

let _toggleAvoidHazards: ToggleAvoidHazards | null = null;

export function registerToggleAvoidHazards(fn: ToggleAvoidHazards | null): void {
  _toggleAvoidHazards = fn;
}

export function getToggleAvoidHazards(): ToggleAvoidHazards | null {
  return _toggleAvoidHazards;
}