import { db, type BuildingType, type ZoneType, type SpecialNeedCategory, logActivity } from "./db";
import { computeIndividualVulnerability } from "./vulnerability";
import { syncFullDatabase } from "@/services/dbSync";

const buildingSeeds: Array<{
  name: string;
  type: BuildingType;
  address: string;
  floors: number;
  totalArea: number;
  constructionType: string;
  fireResistanceRating: string;
}> = [
  {
    name: "Meridian Grand Hotel",
    type: "Hotel",
    address: "120 Harbor Ave, District 4",
    floors: 6,
    totalArea: 18400,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "2-hour",
  },
  {
    name: "Saint Clare Medical Center",
    type: "Hospital",
    address: "88 Wellness Blvd",
    floors: 5,
    totalArea: 24500,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "3-hour",
  },
  {
    name: "Crestline Galleria",
    type: "Shopping Mall",
    address: "501 Market Square",
    floors: 3,
    totalArea: 32000,
    constructionType: "Type II — Steel",
    fireResistanceRating: "1-hour",
  },
  {
    name: "Apex Tower",
    type: "Office",
    address: "1 Apex Plaza",
    floors: 4,
    totalArea: 14200,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "2-hour",
  },
  {
    name: "Northbridge University Hall",
    type: "University",
    address: "245 Campus Way",
    floors: 2,
    totalArea: 9800,
    constructionType: "Type III — Masonry",
    fireResistanceRating: "1-hour",
  },
];

const zoneTypes: ZoneType[] = ["Lobby", "Office", "Corridor", "Conference", "Storage"];
const hospitalZones: ZoneType[] = ["Patient", "Office", "Corridor", "Storage"];
const mallZones: ZoneType[] = ["Retail", "Corridor", "Storage"];

function zonesForBuilding(type: BuildingType): ZoneType[] {
  if (type === "Hospital") return hospitalZones;
  if (type === "Shopping Mall") return mallZones;
  return zoneTypes;
}

// Layout zones on a 100x100 grid as a 2x3 mosaic
const zoneRects = [
  { x: 4, y: 6, w: 44, h: 38 },
  { x: 52, y: 6, w: 44, h: 38 },
  { x: 4, y: 48, w: 28, h: 46 },
  { x: 36, y: 48, w: 28, h: 46 },
  { x: 68, y: 48, w: 28, h: 46 },
];

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN NAMES
// ─────────────────────────────────────────────────────────────────────────────
const indianFirstNames = [
  "Aaditya",
  "Abhinav",
  "Abhishek",
  "Aishwarya",
  "Ajay",
  "Akash",
  "Amitabh",
  "Ananya",
  "Anil",
  "Anita",
  "Anjali",
  "Ankit",
  "Anurag",
  "Arjun",
  "Aruna",
  "Aryan",
  "Ashok",
  "Bhavna",
  "Chetan",
  "Deepak",
  "Deepika",
  "Dhruv",
  "Divya",
  "Ekta",
  "Farida",
  "Gaurav",
  "Geeta",
  "Harsh",
  "Isha",
  "Jaya",
  "Karan",
  "Kavita",
  "Kirti",
  "Krishnamurthy",
  "Kunal",
  "Lakshmi",
  "Mahesh",
  "Manish",
  "Meera",
  "Mohan",
  "Nandini",
  "Neha",
  "Nikhil",
  "Nisha",
  "Pankaj",
  "Pooja",
  "Pradeep",
  "Prakash",
  "Prathyusha",
  "Priya",
  "Rahul",
  "Rajesh",
  "Ramesh",
  "Ravi",
  "Rekha",
  "Ritesh",
  "Rohit",
  "Rupal",
  "Sachin",
  "Sanjay",
  "Sanya",
  "Sarika",
  "Seema",
  "Shikha",
  "Shivam",
  "Shruti",
  "Sneha",
  "Srinivasan",
  "Suhas",
  "Sumedha",
  "Sunita",
  "Suresh",
  "Swati",
  "Tanvi",
  "Tarun",
  "Uday",
  "Uma",
  "Vandana",
  "Varun",
  "Venkatesh",
  "Vijay",
  "Vimal",
  "Vinay",
  "Vishal",
  "Vivek",
  "Yamini",
  "Yash",
  "Zara",
];
const indianLastNames = [
  "Agarwal",
  "Banerjee",
  "Bose",
  "Chakraborty",
  "Chandra",
  "Chatterjee",
  "Deshpande",
  "Dubey",
  "Garg",
  "Ghosh",
  "Gupta",
  "Iyer",
  "Jain",
  "Joshi",
  "Kapoor",
  "Kaur",
  "Khanna",
  "Kumar",
  "Mahajan",
  "Mehta",
  "Mishra",
  "Mukherjee",
  "Nair",
  "Pandey",
  "Patel",
  "Pillai",
  "Prasad",
  "Rao",
  "Reddy",
  "Saxena",
  "Sharma",
  "Shukla",
  "Singh",
  "Sinha",
  "Srivastava",
  "Subramaniam",
  "Thakur",
  "Tiwari",
  "Tripathi",
  "Varma",
  "Verma",
  "Yadav",
];
const departments = [
  "Operations",
  "Security",
  "Administration",
  "Engineering",
  "Housekeeping",
  "Medical",
  "IT",
  "Finance",
  "HR",
  "Facility Management",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export async function seedIfEmpty() {
  // Always fetch latest data from Google Sheets when the app loads
  await syncFullDatabase();
  
  // Fallback: If the database is still empty (e.g. if the Google Sheet URL is broken or missing),
  // seed the local mock data so the dashboard isn't completely empty.
  const count = await db.buildings.count();
  if (count === 0) {
    console.log("[WB-FDVA] Database is empty after sync attempt. Falling back to local mock data.");
    await seedInfosystemBuildings();
  }
}

interface City {
  name: string;
  lat: number;
  lng: number;
  count: number;
}

const CITIES: City[] = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, count: 4 },
  { name: "Pune", lat: 18.5204, lng: 73.8567, count: 3 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867, count: 3 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, count: 3 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, count: 3 },
  { name: "Noida", lat: 28.5355, lng: 77.391, count: 2 },
  { name: "Gurugram", lat: 28.4595, lng: 77.0266, count: 2 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, count: 2 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, count: 2 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873, count: 2 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673, count: 2 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558, count: 2 },
];

export async function seedInfosystemBuildings() {
  const allBuildings = await db.buildings.toArray();
  const count = allBuildings.filter((b) => b.ownerName === "Infosystem").length;
  if (count > 0) return; // already seeded

  const now = Date.now();
  let buildingIndex = 1;

  for (const city of CITIES) {
    for (let c = 0; c < city.count; c++) {
      const floors = 3 + (buildingIndex % 7); // 3 to 9 floors
      const totalArea = 8000 + (buildingIndex % 5) * 6000; // 8000 to 32000

      const offsetLat = (c - (city.count - 1) / 2) * 0.015 + (Math.random() - 0.5) * 0.003;
      const offsetLng = (c - (city.count - 1) / 2) * 0.015 + (Math.random() - 0.5) * 0.003;

      const type: BuildingType =
        buildingIndex % 10 === 0 ? "Data Center" : buildingIndex % 7 === 0 ? "Mixed Use" : "Office";
      const bName = `Infosystem Campus Block ${String.fromCharCode(65 + c)}${buildingIndex}`;
      const bAddress = `Sector ${12 + c}, Tech Zone, ${city.name}`;

      const buildingId = await db.buildings.add({
        name: bName,
        ownerName: "Infosystem",
        type,
        floors,
        totalArea,
        constructionType: "Type I — Non-combustible",
        fireResistanceRating: buildingIndex % 3 === 0 ? "3-hour" : "2-hour",
        address: bAddress,
        city: city.name,
        state:
          city.name === "Noida" ? "Uttar Pradesh" : city.name === "Gurugram" ? "Haryana" : "State",
        country: "India",
        latitude: city.lat + offsetLat,
        longitude: city.lng + offsetLng,
        createdAt: now - buildingIndex * 3600000,
      });

      // Seed floors and zones for each building
      const floorCount = Math.min(floors, 3); // cap floors per building for speed
      for (let lvl = 1; lvl <= floorCount; lvl++) {
        const totalExits = lvl === 1 ? 4 : 3;
        const floorId = await db.floors.add({
          buildingId,
          level: lvl,
          name: lvl === 1 ? "Ground Floor" : `Floor ${lvl}`,
          totalExits,
          availableExits: totalExits,
          blockedExits: 0,
          elevatorWorking: true,
        });

        // Add 3 zones per floor
        const zones = ["Lobby", "Office", "Corridor"];
        for (let zi = 0; zi < zones.length; zi++) {
          const ztype = zones[zi] as ZoneType;
          await db.zones.add({
            buildingId,
            floorId,
            zoneId: `IS-${buildingIndex}-F${lvl}-Z${zi + 1}`,
            name: `${ztype} ${zi + 1}`,
            type: ztype,
            area: 80 + zi * 30,
            occupancy: Math.floor(10 + Math.random() * 40),
            specialNeeds: Math.random() < 0.2 ? Math.floor(Math.random() * 3) : 0,
            x: 10 + zi * 30,
            y: 20,
            w: 25,
            h: 60,
          });
        }
      }

      buildingIndex++;
    }
  }

  await logActivity("building", `Seeded 30 Infosystem buildings across 12 cities.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// IVA PERSONNEL RESEED
// Runs on every startup. Replaces all personnel if the table is empty OR if
// the records are stale (score = 0 means the v3 migration backfill ran but
// IVA was never actually calculated, or old foreign names are present).
// ─────────────────────────────────────────────────────────────────────────────
export async function reseedPersonnelIfNeeded(): Promise<void> {
  // Obsolete: since seedIfEmpty fetches the latest from Google Sheets on load,
  // there is no need to manually force a reseed. The Google Sheet is the source of truth.
  return Promise.resolve();
}
