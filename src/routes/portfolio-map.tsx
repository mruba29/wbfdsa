import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Search,
  Sparkles,
  Building2,
  Globe,
  ShieldAlert,
  CheckCircle,
  Navigation,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db, type Building } from "@/lib/db";
import { seedInfosystemBuildings } from "@/lib/seed";
import { assessBuilding } from "@/lib/vulnerability";
import { toast } from "sonner";

export const Route = createFileRoute("/portfolio-map")({
  head: () => ({
    meta: [
      { title: "Portfolio Map — WB-FDVA" },
      {
        name: "description",
        content: "Interactive geographical map view of all buildings and clients across cities.",
      },
    ],
  }),
  component: PortfolioMapPage,
});

const CITIES_LIST = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Noida", lat: 28.5355, lng: 77.391 },
  { name: "Gurugram", lat: 28.4595, lng: 77.0266 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
];

function PortfolioMapPage() {
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const floors = useLiveQuery(() => db.floors.toArray(), []);
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const incidents = useLiveQuery(() => db.incidents.toArray(), []);

  const [customer, setCustomer] = useState<"Infosystem" | "TrustGrid Demo Org" | "All">(
    "Infosystem",
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Google Map states
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<"no-key" | "invalid-key" | "no-internet" | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string>(localStorage.getItem("wb-maps-api-key") || "");
  const markersRef = useRef<any[]>([]);

  // Sync API key from localStorage if set after component mount
  useEffect(() => {
    if (!mapsApiKey) {
      const storedKey = localStorage.getItem("wb-maps-api-key") || "";
      if (storedKey) setMapsApiKey(storedKey);
    }
  }, []);

  // Filter buildings by customer
  const customerBuildings = (buildings ?? []).filter((b) => {
    if (customer === "Infosystem") return b.ownerName === "Infosystem";
    if (customer === "TrustGrid Demo Org") return b.ownerName !== "Infosystem";
    return true;
  });

  // Check if Infosystem needs seeding
  const showInfosystemSeedBanner = customer === "Infosystem" && customerBuildings.length === 0;

  // Filter buildings by city and search query
  const filteredBuildings = customerBuildings.filter((b) => {
    const matchesCity = !selectedCity || b.city === selectedCity;
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.city || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCity && matchesSearch;
  });

  // Calculate stats for customer
  const totalBuildingsCount = customerBuildings.length;
  const uniqueCitiesCount = new Set(customerBuildings.map((b) => b.city).filter(Boolean)).size;

  const totalOccupants = (() => {
    if (!zones) return 0;
    const bIds = new Set(customerBuildings.map((b) => b.id));
    return zones.filter((z) => bIds.has(z.buildingId)).reduce((s, z) => s + z.occupancy, 0);
  })();

  const activeIncidentsCount = (() => {
    if (!incidents) return 0;
    const bIds = new Set(customerBuildings.map((b) => b.id));
    return incidents.filter((i) => bIds.has(i.buildingId) && i.status === "active").length;
  })();

  // Calculate building risk on the fly
  const getBuildingRisk = (building: Building) => {
    if (!floors || !zones) return { maxRisk: "SAFE", avgScore: 0 };
    const bFloors = floors.filter((f) => f.buildingId === building.id);
    const bZones = zones.filter((z) => z.buildingId === building.id);
    const bIncidents = (incidents ?? []).filter(
      (i) => i.buildingId === building.id && i.status === "active",
    );
    const activeIncLevel =
      bIncidents.length > 0
        ? (bFloors.find((f) => f.id === bIncidents[0].floorId)?.level ?? null)
        : null;
    const impacts = assessBuilding(bZones, bFloors, activeIncLevel);

    if (impacts.length === 0) return { maxRisk: "SAFE", avgScore: 0 };

    const maxRisk = impacts.some((i) => i.risk === "RED")
      ? "RED"
      : impacts.some((i) => i.risk === "ORANGE")
        ? "ORANGE"
        : impacts.some((i) => i.risk === "YELLOW")
          ? "YELLOW"
          : "SAFE";

    const avgScore = Math.round(
      impacts.reduce((s, i) => s + i.breakdown.total, 0) / impacts.length,
    );
    return { maxRisk, avgScore };
  };

  // Seed Infosystem data on click
  const handleSeedInfosystem = async () => {
    setSeeding(true);
    try {
      await seedInfosystemBuildings();
      toast.success("Successfully seeded 30 buildings in 12 cities for Infosystem!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to seed buildings database.");
    } finally {
      setSeeding(false);
    }
  };

  // Load Google Maps script dynamically when API key is available
  useEffect(() => {
    const win = window as any;
    if (!mapsApiKey) {
      // No API key – keep map in demo mode
      setMapReady(false);
      setMapError("no-key");
      return;
    }
    
    // Auth failure callback (Google Maps API calls this if key is invalid)
    win.gm_authFailure = () => {
      setMapError("invalid-key");
      setMapReady(false);
    };

    if (win.google && win.google.maps) {
      setMapReady(true);
      setMapError(null);
      return;
    }

    win.initGoogleMap = () => {
      setMapReady(true);
      setMapError(null);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&callback=initGoogleMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setMapError("no-internet");
    document.head.appendChild(script);

    return () => {
      // Clean up script and callback
      win.initGoogleMap = undefined;
      win.gm_authFailure = undefined;
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [mapsApiKey]);
  // Initialize Map Instance
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const win = window as any;
    // Premium Slate/Dark Google Maps style JSON
    const darkStyles = [
      { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#94a3b8" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#cbd5e1" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#0f172a" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#475569" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#334155" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1e293b" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#94a3b8" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#475569" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#334155" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0f172a" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#334155" }],
      },
    ];

    const map = new win.google.maps.Map(mapRef.current, {
      center: { lat: 21.0, lng: 78.0 }, // Center of India
      zoom: 5,
      styles: darkStyles,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      mapTypeControlOptions: {
         mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
      },
      zoomControlOptions: {
        position: win.google.maps.ControlPosition.RIGHT_BOTTOM,
      },
    });

    setMapInstance(map);
  }, [mapReady]);

  // Update markers when filtered buildings list changes
  useEffect(() => {
    const win = window as any;
    if (!mapInstance || !win.google || !win.google.maps) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new win.google.maps.LatLngBounds();
    let validMarkersCount = 0;

    filteredBuildings.forEach((b) => {
      if (b.latitude === undefined || b.longitude === undefined) return;

      const latLng = { lat: b.latitude, lng: b.longitude };
      bounds.extend(latLng);
      validMarkersCount++;

      const { maxRisk, avgScore } = getBuildingRisk(b);
      const color =
        maxRisk === "RED"
          ? "#ef4444"
          : maxRisk === "ORANGE"
            ? "#f97316"
            : maxRisk === "YELLOW"
              ? "#eab308"
              : "#22c55e";

      const marker = new win.google.maps.Marker({
        position: latLng,
        map: mapInstance,
        title: b.name,
        icon: {
          path: win.google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: selectedBuildingId === b.id ? 11 : 7.5,
        },
      });

      const infoContent = `
        <div style="color: #0f172a; padding: 4px; font-family: sans-serif; min-width: 200px; max-width: 260px;">
          <div style="text-transform: uppercase; font-size: 9px; color: #64748b; font-weight: 600; letter-spacing: 0.05em;">${b.type}</div>
          <h4 style="margin: 2px 0 4px 0; font-size: 13px; font-weight: 700; color: #1e293b;">${b.name}</h4>
          <p style="margin: 0 0 8px 0; color: #475569; font-size: 10px; line-height: 1.3;">${b.address}</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 10px;">
            <div>
              <span style="color: #64748b; display: block; font-size: 9px;">Risk Class</span>
              <span style="font-weight: bold; color: ${color};">${maxRisk === "SAFE" ? "NORMAL" : maxRisk} (${avgScore})</span>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 9px;">Floors / Area</span>
              <span style="color: #1e293b; font-weight: 600;">${b.floors} floors / ${b.totalArea.toLocaleString()} m²</span>
            </div>
          </div>
          <a href="/floor-plans" style="display: block; text-align: center; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 5px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-top: 4px;">View Floor Plans</a>
        </div>
      `;

      const infoWindow = new win.google.maps.InfoWindow({
        content: infoContent,
      });

      marker.addListener("click", () => {
        setSelectedBuildingId(b.id!);
        infoWindow.open(mapInstance, marker);
      });

      markersRef.current.push(marker);
    });

    // Zoom/Pan Map to encompass all markers
    if (validMarkersCount > 0) {
      if (validMarkersCount === 1) {
        const singleLoc = filteredBuildings[0];
        mapInstance.setCenter({ lat: singleLoc.latitude!, lng: singleLoc.longitude! });
        mapInstance.setZoom(13);
      } else {
        mapInstance.fitBounds(bounds);
        // Constrain extreme zoom when bounds are very small
        const listener = win.google.maps.event.addListener(mapInstance, "bounds_changed", () => {
          if (mapInstance.getZoom() > 15) mapInstance.setZoom(15);
          win.google.maps.event.removeListener(listener);
        });
      }
    }
  }, [mapInstance, filteredBuildings, selectedCity]);

  // Center on building when clicked in the sidebar
  const handleSelectBuilding = (b: Building) => {
    setSelectedBuildingId(b.id!);
    const win = window as any;
    if (mapInstance && b.latitude !== undefined && b.longitude !== undefined) {
      mapInstance.setCenter({ lat: b.latitude, lng: b.longitude });
      mapInstance.setZoom(15);

      // Find the corresponding marker and trigger click
      const idx = filteredBuildings.findIndex((fb) => fb.id === b.id);
      if (idx !== -1 && markersRef.current[idx]) {
        winGoogleTriggerClick(markersRef.current[idx]);
      }
    }
  };

  const winGoogleTriggerClick = (marker: any) => {
    const win = window as any;
    if (win.google && win.google.maps && marker) {
      win.google.maps.event.trigger(marker, "click");
    }
  };

  return (
    <AppShell
      title="Portfolio Map"
      subtitle="Geographical distribution and status"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Client:</span>
          <select
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value as any);
              setSelectedCity(null);
              setSelectedBuildingId(null);
            }}
            className="h-9 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold"
          >
            <option value="Infosystem">Infosystem (30 Buildings)</option>
            <option value="TrustGrid Demo Org">TrustGrid Demo Org</option>
            <option value="All">All Portfolio</option>
          </select>
        </div>
      }
    >
      {showInfosystemSeedBanner ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center max-w-2xl mx-auto my-12 flex flex-col items-center gap-4 shadow-md backdrop-blur">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          <h2 className="text-lg font-bold">No Seeded Buildings for Infosystem</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Infosystem has 30 buildings spread across 12 major Indian cities. Click the button below
            to automatically generate the complete portfolio details in your local database.
          </p>
          <button
            onClick={handleSeedInfosystem}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {seeding ? "Generating Portfolio..." : "Seed Infosystem Portfolio"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 h-[calc(100vh-140px)]">
          {/* KPI Summary Block */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiItem
              label="Total Buildings"
              value={totalBuildingsCount}
              icon={Building2}
              color="var(--chart-3)"
            />
            <KpiItem
              label="Cities Covered"
              value={uniqueCitiesCount}
              icon={Globe}
              color="var(--chart-4)"
            />
            <KpiItem
              label="Active Incidents"
              value={activeIncidentsCount}
              icon={ShieldAlert}
              color={activeIncidentsCount > 0 ? "var(--risk-red)" : "var(--risk-green)"}
            />
            <KpiItem
              label="Total Occupants"
              value={totalOccupants.toLocaleString()}
              icon={Navigation}
              color="var(--chart-2)"
            />
          </div>

          <div className="flex-1 min-h-0 grid lg:grid-cols-[320px_1fr] border border-border rounded-lg overflow-hidden bg-card">
            {/* Left sidebar directory */}
            <div className="flex flex-col min-h-0 border-r border-border bg-card/50">
              {/* Search and Filters */}
              <div className="p-3 border-b border-border space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search buildings or cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Cities horizontal scroll */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className={`px-2 py-1 rounded-sm shrink-0 border transition-colors ${
                      !selectedCity
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:bg-secondary/70"
                    }`}
                  >
                    All Cities
                  </button>
                  {CITIES_LIST.filter(
                    (city) =>
                      customer !== "Infosystem" ||
                      (buildings ?? []).some(
                        (b) => b.city === city.name && b.ownerName === "Infosystem",
                      ),
                  ).map((city) => (
                    <button
                      key={city.name}
                      onClick={() => {
                        setSelectedCity(city.name);
                        // Center map on city
                        if (mapInstance) {
                          mapInstance.setCenter({ lat: city.lat, lng: city.lng });
                          mapInstance.setZoom(11);
                        }
                      }}
                      className={`px-2 py-1 rounded-sm shrink-0 border transition-colors ${
                        selectedCity === city.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-muted-foreground border-border hover:bg-secondary/70"
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buildings List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {filteredBuildings.map((b) => {
                  const { maxRisk, avgScore } = getBuildingRisk(b);
                  const isSelected = selectedBuildingId === b.id;
                  const statusColor =
                    maxRisk === "RED"
                      ? "text-risk-red bg-risk-red/10 border-risk-red/20"
                      : maxRisk === "ORANGE"
                        ? "text-risk-orange bg-risk-orange/10 border-risk-orange/20"
                        : maxRisk === "YELLOW"
                          ? "text-risk-yellow bg-risk-yellow/10 border-risk-yellow/20"
                          : "text-risk-green bg-risk-green/10 border-risk-green/20";

                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBuilding(b)}
                      className={`p-3 text-left cursor-pointer transition-colors ${
                        isSelected ? "bg-secondary" : "hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs font-bold truncate text-foreground">{b.name}</h4>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${statusColor}`}
                        >
                          {maxRisk === "SAFE" ? "NORMAL" : maxRisk}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {b.address}
                      </p>
                      <div className="flex gap-3 text-[9px] text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {b.city}
                        </span>
                        <span>{b.floors} floors</span>
                        <span>{b.totalArea.toLocaleString()} m²</span>
                      </div>
                    </div>
                  );
                })}
                {filteredBuildings.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No buildings found matching search criteria.
                  </div>
                )}
              </div>
            </div>

            {/* Google Map Panel */}
            <div className="relative h-full w-full bg-secondary/20">
               <div ref={mapRef} className="h-full w-full transition-opacity duration-300 ease-in-out" style={{ opacity: mapReady ? 1 : 0 }} />
               {mapError === "no-key" && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                   <div className="bg-black/85 text-yellow-500 border border-yellow-500/20 px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                     <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0" />
                     <span>Google Maps API Key not configured.</span>
                   </div>
                 </div>
               )}
               {mapError === "invalid-key" && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                   <div className="bg-risk-red/10 text-risk-red border border-risk-red/20 px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                     <ShieldAlert className="h-5 w-5 shrink-0" />
                     <span>Invalid Google Maps API Key.</span>
                   </div>
                 </div>
               )}
               {mapError === "no-internet" && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                   <div className="bg-secondary text-risk-red border border-border px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                     <ShieldAlert className="h-5 w-5 shrink-0" />
                     <span>Unable to load Google Maps.</span>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function KpiItem({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between shadow-sm">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-extrabold truncate mt-0.5">{value}</div>
      </div>
      <div
        className="h-8 w-8 rounded-md flex items-center justify-center bg-secondary/60 text-muted-foreground shrink-0 ml-2"
        style={{ color }}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
