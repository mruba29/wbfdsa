import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { db, type Zone, type FireInventory } from "@/lib/db";
import { computeIndividualVulnerability } from "@/lib/vulnerability";
import { 
  ShieldAlert, 
  Flame, 
  Users, 
  Thermometer, 
  Wind, 
  AlertTriangle,
  Lightbulb,
  Compass,
  ArrowRight,
  Eye,
  Info
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";

function parseDXF(dxfText: string) {
  const lines = dxfText.split(/\r?\n/);
  const entities: any[] = [];
  let currentEntity: any = null;
  let inEntitiesSection = false;

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i+1].trim();

    if (code === 0) {
      if (value === "SECTION") {
        continue;
      }
      if (value === "ENDSEC") {
        inEntitiesSection = false;
        continue;
      }
      if (inEntitiesSection) {
        if (currentEntity) {
          entities.push(currentEntity);
        }
        currentEntity = { type: value, points: [], layer: "" };
      }
    } else if (code === 2 && value === "ENTITIES") {
      inEntitiesSection = true;
    } else if (inEntitiesSection && currentEntity) {
      if (code === 8) {
        currentEntity.layer = value;
      } else if (code === 10) {
        if (currentEntity.type === "LINE") {
          currentEntity.x1 = parseFloat(value);
        } else {
          currentEntity.points.push({ x: parseFloat(value), y: 0 });
        }
      } else if (code === 20) {
        if (currentEntity.type === "LINE") {
          currentEntity.y1 = parseFloat(value);
        } else if (currentEntity.points.length > 0) {
          currentEntity.points[currentEntity.points.length - 1].y = parseFloat(value);
        }
      } else if (code === 11) {
        currentEntity.x2 = parseFloat(value);
      } else if (code === 21) {
        currentEntity.y2 = parseFloat(value);
      } else if (code === 40) {
        currentEntity.radius = parseFloat(value);
      } else if (code === 50) {
        currentEntity.startAngle = parseFloat(value);
      } else if (code === 51) {
        currentEntity.endAngle = parseFloat(value);
      }
    }
  }
  if (currentEntity) {
    entities.push(currentEntity);
  }
  return entities;
}

interface Walkthrough3DProps {
  buildingName: string;
  floorLevel: number;
  floorId: number;
  zones: Zone[];
  simulationTime: number;
  highlightedElement: string | null;
  onZoneClick: (zone: Zone) => void;
  selectedZone: Zone | null;
  drawing?: string | null;
}

export function Walkthrough3D({
  buildingName,
  floorLevel,
  floorId,
  zones,
  simulationTime,
  highlightedElement,
  onZoneClick,
  selectedZone,
  drawing
}: Walkthrough3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredRoom, setHoveredRoom] = useState<any | null>(null);
  const [localSelectedRoom, setLocalSelectedRoom] = useState<any | null>(null);
  
  const [dxfEntities, setDxfEntities] = useState<any[]>([]);
  const [dxfBounds, setDxfBounds] = useState<{ cx: number; cy: number; scale: number } | null>(null);

  useEffect(() => {
    if (!drawing) {
      setDxfEntities([]);
      setDxfBounds(null);
      return;
    }
    
    try {
      let dxfText = "";
      if (drawing.startsWith("data:")) {
        const base64Part = drawing.split(",")[1];
        dxfText = atob(base64Part);
      } else if (drawing.startsWith("base64,")) {
        dxfText = atob(drawing.substring(7));
      } else {
        dxfText = drawing;
      }
      
      const parsed = parseDXF(dxfText);
      if (parsed.length > 0) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        parsed.forEach(ent => {
          if (ent.type === "LINE") {
            if (ent.x1 !== undefined && !isNaN(ent.x1)) {
              minX = Math.min(minX, ent.x1, ent.x2);
              maxX = Math.max(maxX, ent.x1, ent.x2);
              minY = Math.min(minY, ent.y1, ent.y2);
              maxY = Math.max(maxY, ent.y1, ent.y2);
            }
          } else if (ent.points && ent.points.length > 0) {
            ent.points.forEach((p: any) => {
              if (p.x !== undefined && !isNaN(p.x)) {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
              }
            });
          }
        });
        
        if (minX !== Infinity) {
          const w = maxX - minX;
          const h = maxY - minY;
          const cx = minX + w / 2;
          const cy = minY + h / 2;
          const diag = Math.sqrt(w * w + h * h);
          const scale = diag > 0 ? 100 / diag : 1.0;
          setDxfEntities(parsed);
          setDxfBounds({ cx, cy, scale });
        } else {
          setDxfEntities([]);
          setDxfBounds(null);
        }
      } else {
        setDxfEntities([]);
        setDxfBounds(null);
      }
    } catch (err) {
      console.error("Error parsing drawing prop in Walkthrough3D:", err);
      setDxfEntities([]);
      setDxfBounds(null);
    }
  }, [drawing]);

  // Fetch fire inventory for this floor level and building
  const floorInventory = useLiveQuery(
    () => db.fireInventory
      .where("building").equals(buildingName)
      .and((item) => item.floor === `Floor ${floorLevel}`)
      .toArray(),
    [buildingName, floorLevel]
  ) || [];

  // Track room materials and elements to update them dynamically
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const roomsGroupRef = useRef<THREE.Group | null>(null);
  const fireParticlesRef = useRef<THREE.Group | null>(null);
  const smokeParticlesRef = useRef<THREE.Group | null>(null);
  const occupantsGroupRef = useRef<THREE.Group | null>(null);
  const pathsGroupRef = useRef<THREE.Group | null>(null);

  // 1. Calculate room-level mathematical metrics
  const getRoomVulnerability = (r: Zone) => {
    const isHighRisk = ["Server", "Kitchen", "Storage", "Electrical"].includes(r.type);
    const riskMultiplier = isHighRisk ? 2.5 : 1.0;
    const exitDistance = Math.round(5 + (parseInt(r.zoneId.replace("zone-", "")) || 1) * 4);
    const equipCount = floorInventory.filter(item => item.zoneRoom === r.name).length || 1;

    // Room Score = (Occupancy * RiskMultiplier * L * ExitDistance) / Math.max(1, FireEquipmentCount)
    const baseScore = ((r.occupancy + 1) * riskMultiplier * floorLevel * (exitDistance / 5)) / Math.max(1, equipCount);
    const score = Math.min(100, Math.max(12, Math.round(baseScore * 1.5)));

    // Risk category
    let category: "SAFE" | "YELLOW" | "ORANGE" | "RED" = "SAFE";
    if (score > 75) category = "RED";
    else if (score > 50) category = "ORANGE";
    else if (score > 25) category = "YELLOW";

    const fireLoad = isHighRisk ? (r.type === "Server" ? 850 : 600) : 150;
    const evacTime = Math.round(10 + (exitDistance * 1.2) + (r.occupancy * 0.8));

    return {
      score,
      category,
      fireLoad,
      exitDistance,
      evacTime,
      equipCount
    };
  };

  const getRiskColorHex = (category: "SAFE" | "YELLOW" | "ORANGE" | "RED") => {
    if (category === "RED") return 0xef4444; // critical
    if (category === "ORANGE") return 0xf97316; // high
    if (category === "YELLOW") return 0xeab308; // moderate
    return 0x22c55e; // safe
  };

  // IoT Sensor state calculations matching simulation time
  const getSensorReadings = (r: Zone) => {
    const isHighRisk = ["Server", "Kitchen", "Storage", "Electrical"].includes(r.type);
    const baseTemp = isHighRisk ? 28 : 22;
    const baseSmoke = 0;
    const baseCO = 4;
    const baseAQI = 38;

    // Heat and smoke increase dynamically in fire-vulnerable areas
    const isFireOrigin = isHighRisk && r.name.toLowerCase().includes("server");
    const multiplier = isFireOrigin ? 1.5 : (isHighRisk ? 0.8 : 0.2);

    const temp = Math.round(baseTemp + (simulationTime * 0.8 * multiplier));
    const smoke = Math.round(baseSmoke + (simulationTime * 0.7 * multiplier));
    const co = Math.round(baseCO + (simulationTime * 1.2 * multiplier));
    const aqi = Math.round(baseAQI + (simulationTime * 2.5 * multiplier));
    const humidity = Math.max(15, Math.round(60 - (simulationTime * 0.3 * multiplier)));
    const lpg = isHighRisk && r.name.toLowerCase().includes("kitchen") ? Math.round(simulationTime * 0.5) : 0;
    const methane = isHighRisk && r.name.toLowerCase().includes("generator") ? Math.round(simulationTime * 0.4) : 0;

    return { temp, smoke, co, aqi, humidity, lpg, methane };
  };

  // Sync selected zone from props
  useEffect(() => {
    if (selectedZone) {
      const metrics = getRoomVulnerability(selectedZone);
      const sensors = getSensorReadings(selectedZone);
      setLocalSelectedRoom({ zone: selectedZone, metrics, sensors });
    } else {
      setLocalSelectedRoom(null);
    }
  }, [selectedZone, simulationTime, zones]);

  // Main Three.js Initialization & Render Loop
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight || 450;

    // Create scene, camera, renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 95, 110);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xaaccff, 0.8);
    dirLight.position.set(20, 80, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xffaa55, 0.2);
    dirLight2.position.set(-40, 30, -20);
    scene.add(dirLight2);

    // Floor Grid Helper (Digital Twin Tech Look)
    const gridHelper = new THREE.GridHelper(120, 40, 0x1f2937, 0x111827);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Group for Rooms
    const roomsGroup = new THREE.Group();
    roomsGroupRef.current = roomsGroup;
    scene.add(roomsGroup);

    // Group for Fire Particles
    const fireParticles = new THREE.Group();
    fireParticlesRef.current = fireParticles;
    scene.add(fireParticles);

    // Group for Smoke Particles
    const smokeParticles = new THREE.Group();
    smokeParticlesRef.current = smokeParticles;
    scene.add(smokeParticles);

    // Group for Moving Occupants
    const occupantsGroup = new THREE.Group();
    occupantsGroupRef.current = occupantsGroup;
    scene.add(occupantsGroup);

    // Group for Paths
    const pathsGroup = new THREE.Group();
    pathsGroupRef.current = pathsGroup;
    scene.add(pathsGroup);

    // OrbitControls Mouse/Drag Implementation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let theta = Math.PI / 4;
    let phi = Math.PI / 3;
    let radius = 130;

    const updateCamera = () => {
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      theta -= deltaX * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi - deltaY * 0.005));

      previousMousePosition = { x: e.clientX, y: e.clientY };
      updateCamera();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(40, Math.min(300, radius + e.deltaY * 0.1));
      updateCamera();
    };

    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("wheel", onWheel, { passive: false });

    // Handle clicks inside rooms via Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(roomsGroup.children, true);

      if (intersects.length > 0) {
        let clickedMesh = intersects[0].object;
        while (clickedMesh.parent && clickedMesh.parent !== roomsGroup) {
          clickedMesh = clickedMesh.parent;
        }
        
        const zoneData = clickedMesh.userData.zone;
        if (zoneData) {
          onZoneClick(zoneData);
        }
      }
    };

    renderer.domElement.addEventListener("click", onCanvasClick);

    // Render loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Procedural animations for fire/smoke pulsing
      if (fireParticles.children.length > 0) {
        fireParticles.children.forEach((p: any) => {
          p.scale.setScalar(p.userData.baseScale * (1 + 0.15 * Math.sin(Date.now() * 0.008 + p.position.x)));
        });
      }
      if (smokeParticles.children.length > 0) {
        smokeParticles.children.forEach((p: any) => {
          p.position.y += 0.03;
          if (p.position.y > 4.5) {
            p.position.y = 1.0;
          }
        });
      }

      // Animating occupants traveling along their paths
      if (occupantsGroup.children.length > 0 && simulationTime > 0) {
        occupantsGroup.children.forEach((occ: any) => {
          occ.userData.progress += 0.008;
          if (occ.userData.progress > 1.0) {
            occ.userData.progress = 0; // Loop or stand at exit
          }

          const pathPoints = occ.userData.pathPoints;
          if (pathPoints && pathPoints.length >= 2) {
            const numSegments = pathPoints.length - 1;
            const segmentProgress = occ.userData.progress * numSegments;
            const currentSegment = Math.floor(segmentProgress);
            const tSegment = segmentProgress - currentSegment;

            if (currentSegment < numSegments) {
              const pStart = pathPoints[currentSegment];
              const pEnd = pathPoints[currentSegment + 1];
              occ.position.lerpVectors(pStart, pEnd, tSegment);
            }
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("wheel", onWheel);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener("click", onCanvasClick);
      }
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Scene Elements based on Zones, Equipment, Sensors, Simulation Time
  useEffect(() => {
    const scene = sceneRef.current;
    const roomsGroup = roomsGroupRef.current;
    const fireParticles = fireParticlesRef.current;
    const smokeParticles = smokeParticlesRef.current;
    const occupantsGroup = occupantsGroupRef.current;
    const pathsGroup = pathsGroupRef.current;
    
    if (!scene || !roomsGroup || !fireParticles || !smokeParticles || !occupantsGroup || !pathsGroup) return;

    // 1. Clear old geometry
    while (roomsGroup.children.length > 0) {
      const child = roomsGroup.children[0];
      roomsGroup.remove(child);
    }
    while (fireParticles.children.length > 0) {
      fireParticles.remove(fireParticles.children[0]);
    }
    while (smokeParticles.children.length > 0) {
      smokeParticles.remove(smokeParticles.children[0]);
    }
    while (occupantsGroup.children.length > 0) {
      occupantsGroup.remove(occupantsGroup.children[0]);
    }
    while (pathsGroup.children.length > 0) {
      pathsGroup.remove(pathsGroup.children[0]);
    }

    // Centroid normalization offset
    const dx = 50;
    const dy = 50;

    // Render DXF layout lines
    const oldDxf = scene.getObjectByName("dxf_floorplan");
    if (oldDxf) {
      scene.remove(oldDxf);
    }
    if (dxfEntities.length > 0 && dxfBounds) {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x475569, // slate-600 for background wall layout lines
        transparent: true,
        opacity: 0.7
      });
      
      const dxfGroup = new THREE.Group();
      dxfGroup.name = "dxf_floorplan";
      
      dxfEntities.forEach(ent => {
        if (ent.type === "LINE") {
          const x1 = (ent.x1 - dxfBounds.cx) * dxfBounds.scale;
          const y1 = (ent.y1 - dxfBounds.cy) * dxfBounds.scale;
          const x2 = (ent.x2 - dxfBounds.cx) * dxfBounds.scale;
          const y2 = (ent.y2 - dxfBounds.cy) * dxfBounds.scale;
          
          const points = [
            new THREE.Vector3(x1, 0.1, y1),
            new THREE.Vector3(x2, 0.1, y2)
          ];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, lineMaterial);
          dxfGroup.add(line);
        } else if (ent.points && ent.points.length >= 2) {
          const points: THREE.Vector3[] = [];
          ent.points.forEach((p: any) => {
            if (p.x !== undefined && p.y !== undefined) {
              points.push(new THREE.Vector3(
                (p.x - dxfBounds.cx) * dxfBounds.scale,
                0.1,
                (p.y - dxfBounds.cy) * dxfBounds.scale
              ));
            }
          });
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, lineMaterial);
          dxfGroup.add(line);
        }
      });
      scene.add(dxfGroup);
    }

    // 2. Generate Interactive 3D Rooms & Walls (STEP 2, STEP 4)
    zones.forEach((r) => {
      const roomGroup = new THREE.Group();
      roomGroup.name = r.name;
      roomGroup.userData = { zone: r };

      // Map SVG percentage coord space (0 to 100) or DXF bounds to Three.js (-50 to 50)
      const width3D = dxfBounds ? r.w * dxfBounds.scale : r.w;
      const depth3D = dxfBounds ? r.h * dxfBounds.scale : r.h;
      const px = dxfBounds 
        ? (r.x + r.w / 2 - dxfBounds.cx) * dxfBounds.scale
        : r.x + r.w / 2 - dx;
      const pz = dxfBounds 
        ? (r.y + r.h / 2 - dxfBounds.cy) * dxfBounds.scale
        : r.y + r.h / 2 - dy;

      const roomMetrics = getRoomVulnerability(r);
      const isSelected = selectedZone?.id === r.id;

      // Room Floor Plate Mesh
      const floorGeo = new THREE.BoxGeometry(width3D - 0.5, 0.4, depth3D - 0.5);
      
      // Determine color opacity based on highlights filter
      let opacity = isSelected ? 0.8 : 0.45;
      if (highlightedElement) {
        let isMatch = false;
        if (highlightedElement === "stairs") isMatch = r.name.toLowerCase().includes("stair");
        else if (highlightedElement === "exits") isMatch = r.name.toLowerCase().includes("lobby") || r.name.toLowerCase().includes("entrance") || r.name.toLowerCase().includes("exit");
        else if (highlightedElement === "path") isMatch = r.name.toLowerCase().includes("corridor") || r.name.toLowerCase().includes("lobby");
        else if (highlightedElement === "safe") isMatch = r.name.toLowerCase().includes("stair") || r.name.toLowerCase().includes("exit");

        opacity = isMatch ? 0.85 : 0.05;
      }

      const floorMat = new THREE.MeshStandardMaterial({
        color: getRiskColorHex(roomMetrics.category),
        transparent: true,
        opacity,
        roughness: 0.6,
        metalness: 0.2
      });

      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set(px, 0.2, pz);
      floorMesh.receiveShadow = true;
      floorMesh.castShadow = true;
      roomGroup.add(floorMesh);

      // Room Walls Outline (Visual digital twin wireframe)
      const wallHeight = 4.0;
      const wallThickness = 0.4;
      const wallMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x60a5fa : 0x374151,
        transparent: true,
        opacity: opacity * 0.6,
        roughness: 0.8
      });

      // Left Wall
      const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth3D), wallMat);
      wallLeft.position.set(px - width3D / 2, wallHeight / 2, pz);
      roomGroup.add(wallLeft);

      // Right Wall
      const wallRight = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth3D), wallMat);
      wallRight.position.set(px + width3D / 2, wallHeight / 2, pz);
      roomGroup.add(wallRight);

      // Top Wall
      const wallTop = new THREE.Mesh(new THREE.BoxGeometry(width3D, wallHeight, wallThickness), wallMat);
      wallTop.position.set(px, wallHeight / 2, pz - depth3D / 2);
      roomGroup.add(wallTop);

      // Bottom Wall
      const wallBottom = new THREE.Mesh(new THREE.BoxGeometry(width3D, wallHeight, wallThickness), wallMat);
      wallBottom.position.set(px, wallHeight / 2, pz + depth3D / 2);
      roomGroup.add(wallBottom);

      // 3. Render 3D pulsing IoT Sensors (STEP 5)
      const sensorTypes = [
        { type: "Temp", color: 0xef4444 },   // red
        { type: "Smoke", color: 0x9ca3af },  // grey
        { type: "CO", color: 0x3b82f6 },     // blue
        { type: "AQI", color: 0x10b981 }     // green
      ];

      sensorTypes.forEach((s, idx) => {
        const offsetVal = (idx - 1.5) * 1.5;
        const sensorGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const sensorMat = new THREE.MeshBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: opacity
        });
        const sensorMesh = new THREE.Mesh(sensorGeo, sensorMat);
        sensorMesh.position.set(px + offsetVal, 4.0, pz);
        roomGroup.add(sensorMesh);
      });

      // 4. Render 3D Fire Safety Equipment markers (STEP 6)
      const roomInventory = floorInventory.filter(item => item.zoneRoom === r.name);
      roomInventory.forEach((item, idx) => {
        let eqColor = 0xffffff;
        let eqGeo: THREE.BufferGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);

        if (item.equipmentType === "Fire Extinguisher") {
          eqColor = 0xcc2222; // red cylinder
          eqGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
        } else if (item.equipmentType === "Smoke Detector") {
          eqColor = 0xeeeeee; // white dome
          eqGeo = new THREE.SphereGeometry(0.4, 8, 8);
        } else if (item.equipmentType === "Emergency Light") {
          eqColor = 0xeab308; // yellow bulbs
          eqGeo = new THREE.BoxGeometry(0.8, 0.3, 0.3);
        } else if (item.equipmentType === "Exit Board") {
          eqColor = 0x22c55e; // green exit board
          eqGeo = new THREE.BoxGeometry(1.2, 0.5, 0.1);
        }

        const equipMat = new THREE.MeshStandardMaterial({
          color: eqColor,
          roughness: 0.2,
          transparent: true,
          opacity: opacity
        });
        const equipMesh = new THREE.Mesh(eqGeo, equipMat);
        // Position equipment along walls
        const eqOffset = (idx - roomInventory.length / 2) * 1.8;
        equipMesh.position.set(px + eqOffset, 1.5, pz - depth3D / 2 + 1);
        roomGroup.add(equipMesh);
      });

      roomsGroup.add(roomGroup);

      // 5. Fire & Smoke dynamic spread simulations (STEP 8)
      if (simulationTime > 0) {
        const isHighRisk = ["Server", "Kitchen", "Electrical"].includes(r.type);
        if (isHighRisk) {
          // Fire Origin Points
          const severity = r.name.toLowerCase().includes("server") ? 1.0 : 0.55;
          const maxRadius = Math.max(2, (simulationTime / 120) * (width3D / 2) * severity);

          // Fire volume
          const fireGeo = new THREE.SphereGeometry(maxRadius, 16, 16);
          const fireMat = new THREE.MeshBasicMaterial({
            color: 0xff3700,
            transparent: true,
            opacity: 0.65 * (simulationTime / 120)
          });
          const fireMesh = new THREE.Mesh(fireGeo, fireMat);
          fireMesh.position.set(px, 1.0, pz);
          fireMesh.userData = { baseScale: 1.0 };
          fireParticles.add(fireMesh);

          // Smoke volume
          const smokeGeo = new THREE.SphereGeometry(maxRadius * 1.3, 16, 16);
          const smokeMat = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.5 * (simulationTime / 120)
          });
          const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
          smokeMesh.position.set(px, 2.5, pz);
          smokeParticles.add(smokeMesh);
        }
      }

      // 6. Draw safest Evacuation Path Lines (STEP 8)
      const px_start = px;
      const pz_start = pz;
      const px_mid = px;
      const pz_mid = dxfBounds ? (50 - dxfBounds.cy) * dxfBounds.scale : 50 - dy;
      const px_end = dxfBounds 
        ? (r.x < 50 ? 5 - dxfBounds.cx : 95 - dxfBounds.cx) * dxfBounds.scale
        : (r.x < 50 ? 5 - dx : 95 - dx);
      const pz_end = dxfBounds ? (50 - dxfBounds.cy) * dxfBounds.scale : 50 - dy;

      const pathPoints = [
        new THREE.Vector3(px_start, 0.4, pz_start),
        new THREE.Vector3(px_mid, 0.4, pz_mid),
        new THREE.Vector3(px_end, 0.4, pz_end)
      ];
      
      const pathCurve = new THREE.CatmullRomCurve3(pathPoints);
      const points = pathCurve.getPoints(50);
      const pathGeo = new THREE.BufferGeometry().setFromPoints(points);
      
      const pathMat = new THREE.LineBasicMaterial({
        color: 0x10b981, // green pathway
        linewidth: 2,
        transparent: true,
        opacity: simulationTime > 0 ? 0.8 : 0.2
      });
      const pathLine = new THREE.Line(pathGeo, pathMat);
      pathsGroup.add(pathLine);

      // 7. Evacuating Moving Occupants (STEP 8)
      if (simulationTime > 0 && r.occupancy > 0) {
        // Place occupants inside rooms
        const occGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const occMat = new THREE.MeshBasicMaterial({ color: 0xffa500 }); // orange spheres
        
        // Render up to 3 occupant avatars per room to avoid clutter
        const count = Math.min(3, r.occupancy);
        for (let o = 0; o < count; o++) {
          const occMesh = new THREE.Mesh(occGeo, occMat);
          occMesh.position.copy(pathPoints[0]);
          occMesh.userData = {
            progress: (o * 0.3) % 1.0,
            pathPoints: pathPoints
          };
          occupantsGroup.add(occMesh);
        }
      }
    });

    // 8. Render outer exits & perimeter blockages (STEP 8)
    const exits = [
      { 
        id: "ex-1", 
        px: dxfBounds ? (5 - dxfBounds.cx) * dxfBounds.scale : 5 - dx, 
        pz: dxfBounds ? (50 - dxfBounds.cy) * dxfBounds.scale : 50 - dy, 
        blocked: simulationTime >= 90 
      },
      { 
        id: "ex-2", 
        px: dxfBounds ? (95 - dxfBounds.cx) * dxfBounds.scale : 95 - dx, 
        pz: dxfBounds ? (50 - dxfBounds.cy) * dxfBounds.scale : 50 - dy, 
        blocked: false 
      }
    ];

    exits.forEach((ex) => {
      // Exit door geometry
      const doorGeo = new THREE.BoxGeometry(1.5, 3.5, 4.0);
      const doorMat = new THREE.MeshStandardMaterial({
        color: ex.blocked ? 0xef4444 : 0x10b981,
        transparent: true,
        opacity: 0.9
      });
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.position.set(ex.px, 1.75, ex.pz);
      roomsGroup.add(doorMesh);

      // If exit is blocked, render a glowing red flashing indicator
      if (ex.blocked) {
        const blockGeo = new THREE.BoxGeometry(3, 3, 3);
        const blockMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          wireframe: true
        });
        const blockMesh = new THREE.Mesh(blockGeo, blockMat);
        blockMesh.position.set(ex.px, 2.0, ex.pz);
        scene.add(blockMesh);

        // Keep reference to clean up later
        doorMesh.userData.barrier = blockMesh;
      }
    });

    scene.add(occupantsGroup);
    scene.add(pathsGroup);

    return () => {
      // Clean up temporary block meshes
      exits.forEach((ex) => {
        roomsGroup.children.forEach((c: any) => {
          if (c.userData.barrier) {
            scene.remove(c.userData.barrier);
          }
        });
      });
    };
  }, [zones, floorInventory, simulationTime, highlightedElement, selectedZone, dxfEntities, dxfBounds]);

  return (
    <div className="relative w-full h-full flex flex-col lg:grid lg:grid-cols-[1fr_320px] bg-slate-950 border border-border rounded-2xl overflow-hidden shadow-2xl">
      {/* 3D Canvas Mount */}
      <div className="relative flex-1 min-h-[400px]">
        <div ref={mountRef} className="w-full h-full" />
        
        {/* Help controls badge */}
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none bg-slate-900/80 backdrop-blur border border-slate-700/50 px-3 py-1.5 rounded-lg text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-md">
          <Info className="h-3.5 w-3.5 text-blue-500" />
          Drag to Orbit · Click Room to Inspect · Scroll to Zoom
        </div>

        {/* Live Simulation Alert */}
        {simulationTime > 0 && (
          <div className="absolute top-4 left-4 z-10 bg-red-950/80 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg backdrop-blur">
            <Flame className="h-4 w-4 animate-bounce" />
            <span>CRITICAL SIMULATION RUNNING: t = {simulationTime}s</span>
          </div>
        )}
      </div>

      {/* Selected Room Details Panel (STEP 9) */}
      <div className="border-t lg:border-t-0 lg:border-l border-border/60 bg-slate-900/60 backdrop-blur-xl p-5 flex flex-col justify-between overflow-y-auto max-h-[450px] lg:max-h-[600px]">
        {localSelectedRoom ? (
          <div className="space-y-4">
            <div className="border-b border-border/50 pb-2">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {localSelectedRoom.zone.type}
              </span>
              <h4 className="text-sm font-bold text-slate-100 mt-2">{localSelectedRoom.zone.name}</h4>
              <span className="text-[10px] text-slate-400">ID: {localSelectedRoom.zone.zoneId} · Area: {localSelectedRoom.zone.area} m²</span>
            </div>

            {/* Calculations & Vulnerability (STEP 3 & STEP 9) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-slate-950/85 border border-slate-800 rounded-lg text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Risk Index</span>
                <p className="text-base font-black text-slate-200 mt-1">{localSelectedRoom.metrics.score}%</p>
                <span className={`text-[8px] font-bold uppercase ${localSelectedRoom.metrics.category === "RED" ? "text-red-400" : localSelectedRoom.metrics.category === "ORANGE" ? "text-orange-400" : localSelectedRoom.metrics.category === "YELLOW" ? "text-yellow-400" : "text-green-400"}`}>
                  {localSelectedRoom.metrics.category}
                </span>
              </div>
              <div className="p-2.5 bg-slate-950/85 border border-slate-800 rounded-lg text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Fire Load</span>
                <p className="text-base font-black text-slate-200 mt-1">{localSelectedRoom.metrics.fireLoad}</p>
                <span className="text-[8px] text-slate-400">MJ/m²</span>
              </div>
            </div>

            {/* Occupancy details */}
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1"><Users className="h-3.5 w-3.5"/> Room Occupancy</span>
                <span className="font-bold text-slate-200">{localSelectedRoom.zone.occupancy} persons</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Vulnerable Persons</span>
                <span className="font-bold text-slate-200">{localSelectedRoom.zone.specialNeeds} persons</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Nearest Exit Dist</span>
                <span className="font-bold text-slate-200">{localSelectedRoom.metrics.exitDistance}m</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Est. Evac Time</span>
                <span className="font-bold text-slate-200">{localSelectedRoom.metrics.evacTime}s</span>
              </div>
            </div>

            {/* Live IoT Sensor Stats (STEP 5) */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live IoT Sensors</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-950/70 border border-slate-800/60 rounded flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1"><Thermometer className="h-3 w-3 text-red-500"/> Temp</span>
                  <span className={`font-mono font-bold ${localSelectedRoom.sensors.temp > 50 ? "text-red-400" : "text-slate-200"}`}>
                    {localSelectedRoom.sensors.temp}°C
                  </span>
                </div>
                <div className="p-2 bg-slate-950/70 border border-slate-800/60 rounded flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1"><Wind className="h-3 w-3 text-grey-400"/> Smoke</span>
                  <span className={`font-mono font-bold ${localSelectedRoom.sensors.smoke > 10 ? "text-red-400" : "text-slate-200"}`}>
                    {localSelectedRoom.sensors.smoke}%
                  </span>
                </div>
                <div className="p-2 bg-slate-950/70 border border-slate-800/60 rounded flex items-center justify-between">
                  <span className="text-slate-500">CO Gas</span>
                  <span className="font-mono font-bold text-slate-200">{localSelectedRoom.sensors.co} ppm</span>
                </div>
                <div className="p-2 bg-slate-950/70 border border-slate-800/60 rounded flex items-center justify-between">
                  <span className="text-slate-500">Air Quality</span>
                  <span className="font-mono font-bold text-slate-200">{localSelectedRoom.sensors.aqi} AQI</span>
                </div>
              </div>
            </div>

            {/* Fire safety equipment nearby */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Safety Equipment</h5>
              <div className="max-h-[120px] overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded bg-slate-950/30">
                {floorInventory.filter((item) => item.zoneRoom === localSelectedRoom.zone.name).length > 0 ? (
                  floorInventory.filter((item) => item.zoneRoom === localSelectedRoom.zone.name).map((item: any, idx: number) => (
                    <div key={idx} className="p-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1"><Lightbulb className="h-3 w-3 text-green-500"/> {item.equipmentType}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase font-bold">Qty {item.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-600">No equipment placed directly.</div>
                )}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="p-3 bg-blue-950/15 border border-blue-500/20 text-blue-400 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> AI Fire Mitigation</span>
              <p className="text-[10.5px] leading-relaxed">
                {localSelectedRoom.zone.type === "Server" 
                  ? "Install aerosol suppression and seal vertical duct lines to isolate server rack fires."
                  : localSelectedRoom.zone.type === "Kitchen"
                  ? "Verify auto-shutoff valve linkage is tied into gas feed line and local strobe horns."
                  : "Keep egress pathways free from filing cabinets and store combustibles inside fire closets."
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-xs text-slate-500 h-full py-10 space-y-3">
            <Eye className="h-8 w-8 text-slate-700" />
            <div>
              <p className="font-semibold text-slate-400">No Room Inspected</p>
              <p className="text-[10px] mt-1 max-w-[200px]">Click any room mesh on the 3D grid model to view index, load, live sensors, and equipment inventory.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
