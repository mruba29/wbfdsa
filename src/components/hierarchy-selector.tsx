import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { MapPin, Building, Building2, Layers, ChevronDown } from "lucide-react";

const DEMO_DATA = {
  "Chennai": {
    "CM Campus": {
      "Headquarters": ["Ground Floor", "Floor 1", "Floor 2"],
      "Administration Block": ["Ground Floor", "Floor 1"],
    }
  },
  "Madurai": {
    "Velam Mall Campus": {
      "Mall Block A": ["Ground Floor", "Floor 1"],
      "Mall Block B": ["Ground Floor"],
    }
  },
  "Coimbatore": {
    "Sangam Mall Campus": {
      "Main Building": ["Ground Floor", "Floor 1"],
      "Parking Building": ["Ground Floor"],
    }
  }
};

type LocationKeys = keyof typeof DEMO_DATA;

export function HierarchySelector() {
  const { 
    location, setLocation, 
    campus, setCampus, 
    buildingName, setBuildingName, 
    floorName, setFloorName 
  } = useApp();

  const locations = Object.keys(DEMO_DATA);
  
  const campuses = location && DEMO_DATA[location as LocationKeys] 
    ? Object.keys(DEMO_DATA[location as LocationKeys]) 
    : [];
    
  const buildings = (location && campus && (DEMO_DATA[location as LocationKeys] as any)?.[campus]) 
    ? Object.keys((DEMO_DATA[location as LocationKeys] as any)[campus]) 
    : [];
    
  const floors = (location && campus && buildingName && (DEMO_DATA[location as LocationKeys] as any)?.[campus]?.[buildingName]) 
    ? (DEMO_DATA[location as LocationKeys] as any)[campus][buildingName] 
    : [];

  // Reset cascade when parent changes
  useEffect(() => {
    if (location && !locations.includes(location)) setLocation(null);
  }, [location, locations, setLocation]);

  useEffect(() => {
    if (campus && !campuses.includes(campus)) {
      setCampus(null);
      setBuildingName(null);
      setFloorName(null);
    }
  }, [campus, campuses, setCampus, setBuildingName, setFloorName]);

  useEffect(() => {
    if (buildingName && !buildings.includes(buildingName)) {
      setBuildingName(null);
      setFloorName(null);
    }
  }, [buildingName, buildings, setBuildingName, setFloorName]);

  useEffect(() => {
    if (floorName && !floors.includes(floorName)) {
      setFloorName(null);
    }
  }, [floorName, floors, setFloorName]);

  return (
    <div className="hidden lg:flex items-center gap-1.5 text-xs bg-secondary/20 p-1.5 rounded-xl border border-border/40 backdrop-blur-md">
      <Dropdown icon={MapPin} value={location} options={locations} onChange={setLocation} placeholder="Location" />
      <div className="text-muted-foreground/30 font-mono text-[10px] select-none">&gt;</div>
      <Dropdown icon={Building} value={campus} options={campuses} onChange={setCampus} placeholder="Campus" disabled={!location} />
      <div className="text-muted-foreground/30 font-mono text-[10px] select-none">&gt;</div>
      <Dropdown icon={Building2} value={buildingName} options={buildings} onChange={setBuildingName} placeholder="Building" disabled={!campus} />
      <div className="text-muted-foreground/30 font-mono text-[10px] select-none">&gt;</div>
      <Dropdown icon={Layers} value={floorName} options={floors} onChange={setFloorName} placeholder="Floor" disabled={!buildingName} />
    </div>
  );
}

function Dropdown({ icon: Icon, value, options, onChange, placeholder, disabled }: any) {
  return (
    <div className={`relative group ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent bg-transparent hover:border-border/60 hover:bg-card/80 transition-all duration-300">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
        <select 
          className="bg-transparent font-semibold focus:outline-none appearance-none cursor-pointer pr-4 min-w-[80px] max-w-[130px] truncate text-foreground/90 placeholder:text-muted-foreground/70"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="" disabled className="text-muted-foreground">Select {placeholder}</option>
          {options.map((opt: string) => <option key={opt} value={opt} className="bg-card text-foreground font-medium">{opt}</option>)}
        </select>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 absolute right-2.5 pointer-events-none group-hover:text-primary/70 transition-colors" />
      </div>
    </div>
  );
}
