"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
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
    const bounds = L.latLngBounds(activities.map((a) => [a.lat, a.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [activities, map]);

  return null;
}

type Props = {
  activities: Activity[];
  activeId: string | null;
  /** Called when a pin is clicked, to highlight it (does not change view). */
  onMarkerClick?: (id: string) => void;
  /** Called when the "View in list" link inside a popup is clicked. */
  onViewInList?: (id: string) => void;
};

export function ActivityMap({ activities, activeId, onMarkerClick, onViewInList }: Props) {
  const markers = useMemo(() => activities.filter((a) => a.lat && a.lng), [activities]);

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
      {markers.map((activity) => (
        <Marker
          key={activity.id}
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
              <button
                type="button"
                onClick={() => onViewInList?.(activity.id)}
                className="block w-full text-center mt-2 rounded-lg bg-teal-600 text-white text-sm font-medium py-1.5 hover:bg-teal-700 transition"
              >
                View in list →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
