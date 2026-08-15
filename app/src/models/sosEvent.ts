/** sos_event model (§6.3). Published by Person B. CRDT OR-Set. */

export interface SosEvent {
  sos_id: string;
  rider_id: string;
  group_id: string;
  lat: number;
  lng: number;
  created_at_hlc: string;
  resolved: boolean;
  resolved_at_hlc: string | null;
}

export function sosEventFromJson(j: Record<string, any>): SosEvent {
  return {
    sos_id: j.sos_id,
    rider_id: j.rider_id,
    group_id: j.group_id,
    lat: Number(j.lat),
    lng: Number(j.lng),
    created_at_hlc: j.created_at_hlc,
    resolved: Boolean(j.resolved),
    resolved_at_hlc: j.resolved_at_hlc ?? null,
  };
}

export function sosEventToJson(e: SosEvent): Record<string, any> {
  return { ...e };
}