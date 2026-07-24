"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { Activity } from "@/types/activity";
import { formatDateRange, formatPrice } from "@/lib/format";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const activeIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [34, 56],
  iconAnchor: [17, 56],
  popupAnchor: [1, -46],
  shadowSize: [56, 56],
  className: "hue-rotate-[130deg] saturate-150",
});

const SOUTH_LONDON_CENTER: [number, number] = [51.435, -0.11];

function FitBounds({ activities }: { activities: Activity[] }) {
  const map = useMap();

  useEffect(() => {
    if (activities.length === 0) return;
    // Container may be zero-sized here if the map is currently hidden (e.g. behind
    // the mobile List/Map toggle) — MapVisibilityFix re-fits once it becomes visible.
    if (map.getContainer().offsetWidth === 0) return;
    const bounds = L.latLngBounds(activities.map((a) => [a.lat, a.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [activities, map]);

  return null;
}

/**
 * Leaflet caches the container size at init time. If the map mounts while hidden
 * (display: none, as on the mobile List/Map toggle) that cache stays at (0, 0)
 * even after the container becomes visible, which throws "invalid LatLng object:
 * (NaN, NaN)" on any subsequent pan/zoom. Watch for the container gaining real
 * size and invalidate + re-fit when it does.
 */
function MapVisibilityFix({
  activities,
  focusId,
}: {
  activities: Activity[];
  focusId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let wasHidden = container.offsetWidth === 0 || container.offsetHeight === 0;

    const observer = new ResizeObserver(() => {
      const isHidden = container.offsetWidth === 0 || container.offsetHeight === 0;
      if (!isHidden) {
        map.invalidateSize();
        // Skip the all-markers refit if a specific activity is focused —
        // FlyToActive owns centering on that one instead.
        if (wasHidden && !focusId && activities.length > 0) {
          const bounds = L.latLngBounds(activities.map((a) => [a.lat, a.lng] as [number, number]));
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }
      }
      wasHidden = isHidden;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [map, activities, focusId]);

  return null;
}

function FlyToActive({
  activities,
  focusId,
  markerRefs,
}: {
  activities: Activity[];
  focusId: string | null;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusId) return;
    const activity = activities.find((a) => a.id === focusId);
    if (!activity) return;
    // Guard against flying while the container is still zero-sized (see
    // MapVisibilityFix) — invalidateSize is a no-op once it's already correct.
    map.invalidateSize();
    if (map.getContainer().offsetWidth === 0) return;
    map.flyTo([activity.lat, activity.lng], Math.max(map.getZoom(), 14), { duration: 0.75 });
    markerRefs.current.get(focusId)?.openPopup();
  }, [focusId, activities, map, markerRefs]);

  return null;
}

type Props = {
  activities: Activity[];
  activeId: string | null;
  /** Set only on click (not hover) — pans/zooms the map to this activity. */
  focusId: string | null;
  /** Called when a pin is clicked, to highlight it (does not change view). */
  onMarkerClick?: (id: string) => void;
  /** Called when the "View in list" link inside a popup is clicked. */
  onViewInList?: (id: string) => void;
};

export function ActivityMap({ activities, activeId, focusId, onMarkerClick, onViewInList }: Props) {
  const markers = useMemo(() => activities.filter((a) => a.lat && a.lng), [activities]);
  const markerRefs = useRef(new Map<string, L.Marker>());

  return (
    <MapContainer
      center={SOUTH_LONDON_CENTER}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds activities={markers} />
      <MapVisibilityFix activities={markers} focusId={focusId} />
      <FlyToActive activities={markers} focusId={focusId} markerRefs={markerRefs} />
      {markers.map((activity) => (
        <Marker
          key={activity.id}
          ref={(marker) => {
            if (marker) markerRefs.current.set(activity.id, marker);
            else markerRefs.current.delete(activity.id);
          }}
          position={[activity.lat, activity.lng]}
          icon={activity.id === activeId ? activeIcon : defaultIcon}
          eventHandlers={{
            click: () => onMarkerClick?.(activity.id),
          }}
        >
          <Popup minWidth={220}>
            <div className="text-sm space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900 leading-snug">{activity.title}</p>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    activity.isFree
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {formatPrice(activity)}
                </span>
              </div>
              <p className="text-slate-600">
                📍 {activity.venue}, {activity.borough}
              </p>
              <p className="text-slate-600">
                🎂 Ages {activity.ageMin}–{activity.ageMax} · 📅{" "}
                {formatDateRange(activity.startDate, activity.endDate)}
              </p>
              {onViewInList && (
                <button
                  type="button"
                  onClick={() => onViewInList(activity.id)}
                  className="block w-full text-center mt-2 rounded-lg bg-teal-600 text-white text-sm font-medium py-1.5 hover:bg-teal-700 transition"
                >
                  View in list →
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
