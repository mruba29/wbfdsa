import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "Admin" | "Incident Commander" | "Responder";

interface AppState {
  role: UserRole;
  setRole: (r: UserRole) => void;
  activeBuildingId: number | null;
  setActiveBuilding: (id: number | null) => void;
  organization: string | null;
  setOrganization: (org: string | null) => void;
  
  location: string | null;
  setLocation: (loc: string | null) => void;
  campus: string | null;
  setCampus: (campus: string | null) => void;
  buildingName: string | null;
  setBuildingName: (b: string | null) => void;
  floorName: string | null;
  setFloorName: (f: string | null) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      role: "Admin",
      setRole: (role) => set({ role }),
      activeBuildingId: null,
      setActiveBuilding: (id) => set({ activeBuildingId: id }),
      organization: null,
      setOrganization: (org) => set({ organization: org }),
      
      location: null,
      setLocation: (location) => set({ location }),
      campus: null,
      setCampus: (campus) => set({ campus }),
      buildingName: null,
      setBuildingName: (buildingName) => set({ buildingName }),
      floorName: null,
      setFloorName: (floorName) => set({ floorName }),
    }),
    {
      name: "wbfdva-app-storage",
    }
  )
);
