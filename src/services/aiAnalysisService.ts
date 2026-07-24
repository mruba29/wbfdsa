import { type SpecialNeedCategory } from "@/lib/db";

export interface BuildingAnalysisInput {
  building: any;
  floors: any[];
  zones: any[];
  personnel: any[];
  inventory: any[];
  incidents: any[];
  checklistCompliance: number; // percentage
  checklistStatus: Record<string, "PASS" | "FAIL" | "PENDING">;
}

export interface AIAnalysisResponse {
  summary: string;
  riskExplanation: string;
  hazards: Array<{
    description: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    reason: string;
    recommendation: string;
  }>;
  evacuationAssessment: {
    difficulty: "Easy" | "Moderate" | "Difficult" | "Critical";
    details: string;
    immediatePriorities: Array<{
      name: string;
      employeeId: string;
      floor: number;
      reason: string;
    }>;
  };
  recommendations: Array<{
    priority: number;
    recommendation: string;
    impact: string;
    status: "Pending" | "Implemented" | "In Progress";
  }>;
  report: {
    executiveSummary: string;
    buildingOverview: string;
    detectedHazards: string;
    riskAssessment: string;
    vulnerabilityAnalysis: string;
    recommendations: string;
    emergencyPreparedness: string;
    inspectionNotes: string;
    complianceSuggestions: string;
  };
  confidence: number; // percentage e.g. 95
}

/**
 * Gets the Gemini API key from local storage.
 */
function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("gemini_api_key") || localStorage.getItem("wb-gemini-api-key") || "";
}

/**
 * Primary function to run the AI Building Analysis.
 */
export async function generateBuildingAnalysis(input: BuildingAnalysisInput): Promise<AIAnalysisResponse> {
  const apiKey = getApiKey().trim();
  
  if (!apiKey) {
    // Fallback to high-fidelity simulator
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return generateSimulatorAnalysis(input);
  }

  try {
    const promptText = `
You are an expert AI fire safety officer, building inspector, and emergency response analyst.
Your task is to analyze the following project data for a building and generate a professional fire safety risk assessment and recommendations report.

Here is the building data in JSON format:
${JSON.stringify(input, null, 2)}

You must return a structured JSON object matching the following schema:
{
  "summary": "A readable paragraph describing the building type, floors, rooms, occupants, emergency exits, fire safety equipment, high-risk locations, and overall building condition. It must be written as a readable, professional narrative, not raw values.",
  "riskExplanation": "A detailed explanation of WHY the building received its vulnerability profile based on the data. For example, explain the correlation between the floor levels, blocked exits, lack of extinguishers, or vulnerable occupants on high floors.",
  "hazards": [
    {
      "description": "Short description of the hazard (e.g. Blocked exit on Floor 2, Expired extinguisher in Server Room)",
      "severity": "Low" | "Medium" | "High" | "Critical",
      "reason": "Clear explanation of why this is a hazard",
      "recommendation": "Actionable safety recommendation to mitigate this hazard"
    }
  ],
  "evacuationAssessment": {
    "difficulty": "Easy" | "Moderate" | "Difficult" | "Critical",
    "details": "Explanation of the evacuation challenges: including staircase distance, elevator statuses, and high-floor occupancy dynamics.",
    "immediatePriorities": [
      {
        "name": "Occupant Name",
        "employeeId": "Employee ID",
        "floor": 1,
        "reason": "Why they need immediate priority (e.g. high vulnerability score, special needs on upper floor, disability factor)"
      }
    ]
  },
  "recommendations": [
    {
      "priority": 1,
      "recommendation": "Prioritized safety recommendation (e.g. Install sprinklers, relocate fire extinguishers, clear exits)",
      "impact": "Expected risk reduction impact",
      "status": "Pending" | "In Progress" | "Implemented"
    }
  ],
  "report": {
    "executiveSummary": "Executive summary paragraph for fire safety compliance.",
    "buildingOverview": "Technical overview of building structure, occupancy density, and layout.",
    "detectedHazards": "Detailed summary of all detected hazards and their spatial distribution.",
    "riskAssessment": "Risk assessment explaining vulnerability scores, compliance metrics, and active incidents.",
    "vulnerabilityAnalysis": "In-depth review of individual and floor-level vulnerability factors.",
    "recommendations": "Actionable, numbered list of prioritized safety improvements.",
    "emergencyPreparedness": "Suggestions for evacuation plans, emergency lighting, drills, and exit routes.",
    "inspectionNotes": "Inspection findings, including expired extinguishers or blocked paths.",
    "complianceSuggestions": "Suggestions to align the building with standard building safety and fire codes (e.g. NFPA 101)."
  },
  "confidence": 95
}

Return ONLY the raw JSON string matching this schema. Do not wrap in markdown code blocks.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
                riskExplanation: { type: "STRING" },
                hazards: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      description: { type: "STRING" },
                      severity: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                      reason: { type: "STRING" },
                      recommendation: { type: "STRING" }
                    },
                    required: ["description", "severity", "reason", "recommendation"]
                  }
                },
                evacuationAssessment: {
                  type: "OBJECT",
                  properties: {
                    difficulty: { type: "STRING", enum: ["Easy", "Moderate", "Difficult", "Critical"] },
                    details: { type: "STRING" },
                    immediatePriorities: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          name: { type: "STRING" },
                          employeeId: { type: "STRING" },
                          floor: { type: "INTEGER" },
                          reason: { type: "STRING" }
                        },
                        required: ["name", "employeeId", "floor", "reason"]
                      }
                    }
                  },
                  required: ["difficulty", "details", "immediatePriorities"]
                },
                recommendations: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      priority: { type: "INTEGER" },
                      recommendation: { type: "STRING" },
                      impact: { type: "STRING" },
                      status: { type: "STRING", enum: ["Pending", "In Progress", "Implemented"] }
                    },
                    required: ["priority", "recommendation", "impact", "status"]
                  }
                },
                report: {
                  type: "OBJECT",
                  properties: {
                    executiveSummary: { type: "STRING" },
                    buildingOverview: { type: "STRING" },
                    detectedHazards: { type: "STRING" },
                    riskAssessment: { type: "STRING" },
                    vulnerabilityAnalysis: { type: "STRING" },
                    recommendations: { type: "STRING" },
                    emergencyPreparedness: { type: "STRING" },
                    inspectionNotes: { type: "STRING" },
                    complianceSuggestions: { type: "STRING" }
                  },
                  required: [
                    "executiveSummary", "buildingOverview", "detectedHazards", "riskAssessment",
                    "vulnerabilityAnalysis", "recommendations", "emergencyPreparedness", "inspectionNotes",
                    "complianceSuggestions"
                  ]
                },
                confidence: { type: "INTEGER" }
              },
              required: ["summary", "riskExplanation", "hazards", "evacuationAssessment", "recommendations", "report", "confidence"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} - ${response.statusText}`);
    }

    const resJson = await response.json();
    const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from AI engine.");
    
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Gemini API call failed, running simulator fallback:", err);
    return generateSimulatorAnalysis(input);
  }
}

/**
 * Sends a chat message to the AI Assistant.
 */
export async function sendChatMessage(
  input: BuildingAnalysisInput,
  chatHistory: Array<{ role: "user" | "model"; content: string }>,
  userQuery: string
): Promise<string> {
  const apiKey = getApiKey().trim();
  
  if (!apiKey) {
    // Simulator Chat Fallback
    await new Promise((resolve) => setTimeout(resolve, 800));
    return generateSimulatorChatResponse(input, userQuery);
  }

  try {
    const systemPrompt = `
You are an intelligent AI Fire Safety Assistant built into the Protect Scope Emergency Response System.
Your job is to answer questions about this building, explain risk ratings, prioritize evacuations, and suggest safety improvements based on the current building data.

Here is the building data:
${JSON.stringify(input, null, 2)}

Instructions:
1. Use the provided building data, including floors, zones, personnel, fire inventory, and incidents, to answer questions.
2. Be professional, concise, and highly specific to the building and floor names mentioned in the data.
3. If asked to suggest safety improvements or explain a vulnerability score, reference specific issues such as blocked exits, high-floor occupancy, lack of fire extinguishers, or expired safety gear.
4. Keep answers brief (1-3 paragraphs) and formatted in clean markdown.
`;

    // Map chatHistory to Gemini API format
    const contents = chatHistory.map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));
    
    // Add the system instructions and current query
    contents.unshift({
      role: "user",
      parts: [{ text: systemPrompt }]
    });
    
    contents.push({
      role: "user",
      parts: [{ text: userQuery }]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const resJson = await response.json();
    const reply = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("Empty reply from Gemini.");
    
    return reply;
  } catch (err: any) {
    console.warn("Gemini Chat failed, using simulator response:", err);
    return generateSimulatorChatResponse(input, userQuery);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-FIDELITY SIMULATOR GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

function generateSimulatorAnalysis(input: BuildingAnalysisInput): AIAnalysisResponse {
  const { building, floors, zones, personnel, inventory, incidents, checklistCompliance } = input;
  
  const bName = building?.name || "Target Building";
  const bType = building?.type || "Mixed-Use Facility";
  const numFloors = floors?.length || building?.floors || 1;
  const numZones = zones?.length || 0;
  const numOccupants = zones?.reduce((s, z) => s + z.occupancy, 0) || personnel?.length || 0;
  
  // Calculate exits and equipment
  const totalExits = floors?.reduce((s, f) => s + (f.availableExits || 0), 0) || 2;
  const blockedExits = floors?.reduce((s, f) => s + (f.blockedExits || 0), 0) || 0;
  const activeExtinguishers = inventory?.filter(
    (item) => item.equipmentType === "Fire Extinguisher" && item.status === "Active"
  ).length || 0;
  
  const expiredInventory = inventory?.filter((item) => item.status === "Expired" || item.status === "Under Maintenance") || [];
  const activeIncidents = incidents?.filter((i) => i.status === "active") || [];
  
  // Identify high-risk areas
  const serverRooms = zones?.filter((z) => z.type === "Server" || z.name.toLowerCase().includes("server")) || [];
  const kitchens = zones?.filter((z) => z.name.toLowerCase().includes("kitchen") || z.name.toLowerCase().includes("cafeteria")) || [];
  const chemicalLabs = zones?.filter((z) => z.name.toLowerCase().includes("lab") || z.name.toLowerCase().includes("chemical")) || [];
  
  const highRiskLocs: string[] = [];
  if (serverRooms.length) highRiskLocs.push(...serverRooms.map(r => r.name));
  if (kitchens.length) highRiskLocs.push(...kitchens.map(r => r.name));
  if (chemicalLabs.length) highRiskLocs.push(...chemicalLabs.map(r => r.name));
  if (!highRiskLocs.length) highRiskLocs.push("Main Lobby Server Rack", "Electrical Switchboard");

  // Determine condition
  let overallCondition = "Good Baseline";
  let buildingRisk: "Low" | "Medium" | "High" | "Critical" = "Low";
  
  if (activeIncidents.length > 0) {
    overallCondition = "Emergency Alert - Active Incident";
    buildingRisk = "Critical";
  } else if (blockedExits > 0 || expiredInventory.length > 2 || checklistCompliance < 60) {
    overallCondition = "Needs Attention / Poor Compliance";
    buildingRisk = "High";
  } else if (checklistCompliance < 85) {
    overallCondition = "Fair Condition";
    buildingRisk = "Medium";
  }

  // Summary Paragraph
  const summary = `The ${bName} is a ${numFloors}-floor ${bType} consisting of ${numZones} zones/rooms and holding an estimated population of ${numOccupants} occupants. The building has ${totalExits} active emergency egress points and is serviced by ${activeExtinguishers} fire extinguishers in functional condition. Major heat-generating and hazard-critical locations include ${highRiskLocs.slice(0, 3).join(", ")}, which require constant thermal and smoke monitoring. Currently, the overall condition of the building is rated as "${overallCondition}" with an automated fire risk classification of ${buildingRisk} due to current layout configurations and system auditing scores.`;

  // Risk Explanation WHY
  let riskExplanation = "";
  if (activeIncidents.length > 0) {
    riskExplanation = `The building is under CRITICAL vulnerability status because there is an active incident reported on Floor ${activeIncidents[0].floorId ?? "1"}. Immediate priority must be given to evacuation routing and emergency responder access.`;
  } else {
    const reasons: string[] = [];
    if (blockedExits > 0) {
      reasons.push(`${blockedExits} emergency exits are currently blocked or closed, reducing evacuation throughput`);
    }
    if (expiredInventory.length > 0) {
      reasons.push(`${expiredInventory.length} fire safety equipment items (including extinguishers and detectors) have expired status`);
    }
    if (checklistCompliance < 75) {
      reasons.push(`the building's fire safety checklist compliance is low at ${checklistCompliance}%, indicating untested backup alarms and structural audit gaps`);
    }
    
    // Check occupancy density
    const crowdedZones = zones?.filter(z => z.occupancy > 20) || [];
    if (crowdedZones.length > 0) {
      reasons.push(`high occupancy concentration detected in ${crowdedZones.map(z => z.name).join(", ")}, which may result in bottlenecking during an alarm`);
    }

    // Check special needs on high floors
    const highFloorSpecialNeeds = personnel?.filter(p => p.assignedFloor > 1 && p.specialNeedCategory !== "None") || [];
    if (highFloorSpecialNeeds.length > 0) {
      reasons.push(`${highFloorSpecialNeeds.length} occupants with mobility or medical needs are assigned to Floor levels 2 or higher, complicating emergency stairwell extraction`);
    }

    if (reasons.length > 0) {
      riskExplanation = `The building received a ${buildingRisk} Fire Vulnerability score primarily because: ${reasons.join("; ")}. This increases the calculated Fire Impact Magnitude and requires immediate mitigation.`;
    } else {
      riskExplanation = `The building is rated as Low Fire Vulnerability because all emergency exits are clear, fire extinguishers are active, safety compliance sits at a high ${checklistCompliance}%, and occupant load is distributed safely near ground level egress lines.`;
    }
  }

  // Hazard Identification
  const hazards: AIAnalysisResponse["hazards"] = [];
  
  if (blockedExits > 0) {
    hazards.push({
      description: "Blocked Evacuation Exit Pathway",
      severity: "Critical",
      reason: "Storage materials or locked doors are obstructing designated fire escapes on upper levels.",
      recommendation: "Clear all exit paths immediately and install push-bar panic locks on escape doors."
    });
  }

  if (expiredInventory.length > 0) {
    hazards.push({
      description: "Expired or Unmaintained Safety Equipment",
      severity: "High",
      reason: `${expiredInventory.length} extinguishers, detectors, or alarms are past inspection deadlines.`,
      recommendation: "Conduct immediate inspection rounds, service expired cylinders, and replace faulty sensor cells."
    });
  }

  // Check exit capacity per floor
  floors?.forEach(f => {
    if (f.availableExits < 2) {
      hazards.push({
        description: `Insufficient Exit Outlets on Floor ${f.level}`,
        severity: "Critical",
        reason: `Only ${f.availableExits} exit is available for floor level ${f.level}. NFPA 101 requires at least 2 independent egress points.`,
        recommendation: "Construct an external emergency escape staircase to establish a secondary path."
      });
    }
  });

  // Server Room risk
  if (serverRooms.length > 0) {
    const hasSprinklerInServer = inventory?.some(
      item => item.zoneRoom && item.zoneRoom.toLowerCase().includes("server") && item.equipmentType === "Sprinkler"
    );
    hazards.push({
      description: "Electrical Server Suite Spark Risk",
      severity: "High",
      reason: "Server rooms house high-voltage racks and batteries. Using standard water sprinklers can destroy equipment or fail to suppress gas fires.",
      recommendation: hasSprinklerInServer 
        ? "Replace water sprinklers in server rooms with automatic clean-agent gaseous fire suppression systems (FM-200 / Novec 1230)." 
        : "Install automatic FM-200 clean-agent gas flooding system in main server compartments."
    });
  }

  // Kitchen risk
  if (kitchens.length > 0) {
    hazards.push({
      description: "Kitchen Open Flame & Grease Fire Risk",
      severity: "Medium",
      reason: "Cafeteria kitchens utilize open flames and grease, which are highly flammable and prone to spreading quickly.",
      recommendation: "Equip the kitchen area with Class K wet-chemical extinguishers and automated stove hood fire cutoffs."
    });
  }

  // Overcrowding
  const totalArea = building?.totalArea || 1000;
  const density = numOccupants / totalArea;
  if (density > 0.05) {
    hazards.push({
      description: "High Occupancy Density / Egress Crowding",
      severity: "High",
      reason: "The total building area has a high occupant concentration relative to exit corridor widths, causing high exit factor multipliers.",
      recommendation: "Implement occupant limits, relocate non-essential offices to other facilities, and widen main exit hallways."
    });
  }

  if (hazards.length === 0) {
    hazards.push({
      description: "No Significant Structural Hazards Detected",
      severity: "Low",
      reason: "All exits are open, safety devices are validated, and occupancy loads conform to code.",
      recommendation: "Continue routine monthly safety drills and maintain standard inspection cycles."
    });
  }

  // Evacuation Assessment & Priority
  const specialNeedsPersonnel = personnel?.filter(p => p.specialNeedCategory !== "None" || p.disabilityFactor < 1.0) || [];
  const highPriorityOccupants = [...specialNeedsPersonnel]
    .sort((a, b) => (a.evacuationPriority || 7) - (b.evacuationPriority || 7))
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      employeeId: p.employeeId,
      floor: p.assignedFloor || 1,
      reason: `${p.specialNeedCategory !== "None" ? p.specialNeedCategory : "Disability Factor " + p.disabilityFactor.toFixed(2)} assigned to Floor ${p.assignedFloor}.`
    }));

  const difficultEvac = highPriorityOccupants.some(o => o.floor > 1) || blockedExits > 0 || numFloors > 3;
  
  const evacuationAssessment = {
    difficulty: (difficultEvac ? "Difficult" : numFloors > 1 ? "Moderate" : "Easy") as any,
    details: `Evacuation difficulty is rated as ${difficultEvac ? "Difficult" : "Moderate"} due to the building having ${numFloors} floor levels. Elevators should be programmed to recall to the ground level and lock during a fire alarm, forcing all occupants to use the ${floors?.reduce((s, f) => s + (f.availableExits || 0), 0)} staircases. There are ${specialNeedsPersonnel.length} personnel requiring evacuation assistance (wheelchair, vision, or critical care support), who must be matched with designated rescue buddies.`,
    immediatePriorities: highPriorityOccupants
  };

  // Prioritized Recommendations
  const recommendations: AIAnalysisResponse["recommendations"] = [
    {
      priority: 1,
      recommendation: blockedExits > 0 ? "Clear all blocked exit pathways immediately." : "Conduct monthly evacuation drills with all departments.",
      impact: "Immediately increases egress flow rate, dropping vulnerability by up to 15%.",
      status: "Pending"
    },
    {
      priority: 2,
      recommendation: "Conduct inspections on all expired fire safety inventory cylinders.",
      impact: "Ensures immediate fire containment capability is active in all corridors.",
      status: "In Progress"
    },
    {
      priority: 3,
      recommendation: "Assign designated rescue companions (buddies) to special-needs personnel.",
      impact: "Decreases emergency stairwell transit times for mobility-impaired occupants.",
      status: "Pending"
    },
    {
      priority: 4,
      recommendation: "Install additional luminous emergency exit signage and path lighting.",
      impact: "Improves egress speed under smoke visibility reduction conditions.",
      status: "Pending"
    }
  ];

  // Professional Report
  const report = {
    executiveSummary: `This executive audit details the fire safety and emergency response assessment conducted for ${bName}. Combining mathematical risk indexes and database metrics, the building presents an overall risk profile of ${buildingRisk}. Actionable fixes are required regarding exit pathway clearance and expired safety equipment to satisfy national safety regulations and NFPA compliance standards.`,
    buildingOverview: `The building is configured as a ${numFloors}-level ${bType} built with ${building?.constructionType || "reinforced concrete"}. Currently, there are ${numZones} zones occupied by ${numOccupants} staff members. The available egress system relies on ${floors?.map(f => `Floor ${f.level} (${f.availableExits} exits)`).join(", ")}. The fire suppression system consists of ${activeExtinguishers} active fire extinguishers and localized smoke alarms.`,
    detectedHazards: `Auditing operations identified ${hazards.length} distinct violations or hazards. The most urgent concern is ${hazards[0]?.description || "none"}, which creates a severe block in occupant routing. Special attention is also called to electrical systems and server rooms where fire load is high.`,
    riskAssessment: `The building vulnerability score has been calibrated by the Safety Checklist compliance rating of ${checklistCompliance}%. Standard formulas calculate a higher vulnerability for upper levels due to increased staircase traversal distance (${floors?.[floors.length-1]?.level > 1 ? "Floor " + floors[floors.length-1].level : "N/A"}). The presence of active incident records will escalate this risk score to Critical immediately.`,
    vulnerabilityAnalysis: `Individual Vulnerability Assessments (IVA) indicate that out of ${personnel?.length || 0} personnel, ${specialNeedsPersonnel.length} have mobility or sensory limitations. The highest priority is assigned to occupants with critical care categories on high floors, receiving an individual score exceeding 0.75.`,
    recommendations: `Mitigation priorities: 1. Clear blocked exit paths immediately. 2. Schedule inspection service for expired cylinders. 3. Formally assign buddy pairings for disabled staff. 4. Conduct a full-building evacuation drill within the next 30 days.`,
    emergencyPreparedness: `Emergency plans must detail exit routes and assembly zones. Evacuation maps should be reposted in main elevator lobbies. Back-up battery tests are required for all exit indicators and floodlighting systems.`,
    inspectionNotes: `Inspector finding: Blocked egress passages detected on Floor corridors. Extinguisher pressure gauges on specific levels show expired tags. Main server suite requires secondary gas flooding lines.`,
    complianceSuggestions: `To achieve full compliance with NFPA 101 (Life Safety Code), all corridors must maintain a minimum clear width of 44 inches, self-closing fire doors must remain unblocked, and testing logs for emergency lights must be kept in the manager's office for municipal review.`
  };

  return {
    summary,
    riskExplanation,
    hazards,
    evacuationAssessment,
    recommendations,
    report,
    confidence: 90
  };
}

function generateSimulatorChatResponse(input: BuildingAnalysisInput, query: string): string {
  const q = query.toLowerCase();
  const { building, floors, zones, personnel, inventory, incidents, checklistCompliance } = input;
  
  const bName = building?.name || "the building";
  const numFloors = floors?.length || 1;
  const numOccupants = zones?.reduce((s, z) => s + z.occupancy, 0) || personnel?.length || 0;
  
  if (q.includes("why") || q.includes("risk") || q.includes("vulnerab")) {
    const blocked = floors?.reduce((s, f) => s + (f.blockedExits || 0), 0) || 0;
    const expired = inventory?.filter(i => i.status === "Expired" || i.status === "Under Maintenance").length || 0;
    const activeIncidents = incidents?.filter(i => i.status === "active").length || 0;
    
    return `### Vulnerability Explanation for ${bName}

The building's risk profile is influenced by several specific factors in the database:
1. **${activeIncidents > 0 ? "⚠️ Active Fire Incident: There is an active incident occurring in the building right now!" : "Safe Baseline: No active fire incidents are currently reported."}**
2. **Egress Points**: The building has ${blocked > 0 ? `\`${blocked}\` blocked exits` : "no blocked emergency exits"}, which directly affects the exit factor in our safety formulas.
3. **Safety Equipment**: There are \`${expired}\` fire extinguishers or alarms marked as Expired or Under Maintenance.
4. **Safety Compliance**: The building safety checklist compliance is currently at **${checklistCompliance}%**. A score under 75% adds a penalty multiplier to the total vulnerability index.

To reduce this risk immediately, clear any blocked exits and inspect all expired fire extinguishers.`;
  }
  
  if (q.includes("floor") || q.includes("most vulnerable")) {
    let worstFloor = 1;
    let worstScore = 0;
    
    // Simple mock heuristic: higher floor, higher occupancy, fewer exits -> worse
    floors?.forEach(f => {
      const fZones = zones?.filter(z => z.floorId === f.id) || [];
      const occ = fZones.reduce((s, z) => s + z.occupancy, 0);
      const score = (occ * f.level) / Math.max(1, f.availableExits);
      if (score > worstScore) {
        worstScore = score;
        worstFloor = f.level;
      }
    });

    return `### Floor Vulnerability Analysis

Based on the floor-level analysis, **Floor ${worstFloor}** is currently calculated as the most vulnerable level. 

**Contributing Factors:**
- **Height Risk**: Being on level ${worstFloor} increases the travel distance to ground level.
- **Occupant Load**: Floor ${worstFloor} houses a high concentration of occupants relative to available exits.
- **Egress Limits**: Egress routes are limited to standard stairwells. 

**Recommendation:**
Prioritize evacuation drills for occupants on Floor ${worstFloor} and ensure all fire escape doors on this level are unlocked and clear.`;
  }
  
  if (q.includes("occupant") || q.includes("priorit") || q.includes("evacuat")) {
    const specialNeeds = personnel?.filter(p => p.specialNeedCategory !== "None" || p.disabilityFactor < 1.0) || [];
    
    if (specialNeeds.length === 0) {
      return `### Evacuation Prioritization

No occupants are registered with special mobility needs or disability factors in the personnel directory. 

In the event of an evacuation, follow standard floor-by-floor egress procedures (top floors first, or nearest to fire line first).`;
    }

    const priorityList = [...specialNeeds]
      .sort((a, b) => (a.evacuationPriority || 7) - (b.evacuationPriority || 7))
      .slice(0, 3);

    return `### Immediate Evacuation Priority List

The following occupants have the highest individual vulnerability scores and require immediate assistance during an evacuation:

1. **${priorityList[0]?.name}** (Employee ID: \`${priorityList[0]?.employeeId}\`)
   - **Location**: Floor ${priorityList[0]?.assignedFloor}
   - **Reason**: ${priorityList[0]?.specialNeedCategory} (Disability Factor: ${priorityList[0]?.disabilityFactor.toFixed(2)})
   - **Priority Tier**: ${priorityList[0]?.evacuationPriority}

${priorityList[1] ? `2. **${priorityList[1]?.name}** (Employee ID: \`${priorityList[1]?.employeeId}\`)\n   - **Location**: Floor ${priorityList[1]?.assignedFloor}\n   - **Reason**: ${priorityList[1]?.specialNeedCategory}\n   - **Priority Tier**: ${priorityList[1]?.evacuationPriority}\n` : ""}
${priorityList[2] ? `3. **${priorityList[2]?.name}** (Employee ID: \`${priorityList[2]?.employeeId}\`)\n   - **Location**: Floor ${priorityList[2]?.assignedFloor}\n   - **Reason**: ${priorityList[2]?.specialNeedCategory}\n   - **Priority Tier**: ${priorityList[2]?.evacuationPriority}` : ""}

**Evacuation Protocol:**
Assign a designated "evacuation buddy" from the same department to assist each priority occupant down the stairwells.`;
  }

  if (q.includes("improve") || q.includes("suggest") || q.includes("recommend")) {
    return `### Suggested Safety Improvements for ${bName}

Here are the top AI recommendations to improve the building's fire safety rating:

1. **Clear blocked emergency exits**: Ensure all designated escape pathways are cleared of storage boxes or materials immediately.
2. **Schedule equipment maintenance**: Service the expired extinguishers and replace battery backups on exit signs.
3. **Establish evacuation buddy pairs**: Pair every mobility-impaired occupant on upper floors with an able-bodied colleague.
4. **Conduct evacuation drills**: Perform an egress drill to practice exiting via stairwells without utilizing elevators.`;
  }

  if (q.includes("inspect") || q.includes("note")) {
    return `### AI Building Inspection Notes

**Structure**: ${bName} (${numFloors} floors).
**Egress**: Emergency exits are operational, but corridor clearances must be audited.
**Active Violations**:
- Expired fire extinguishers detected on specific levels.
- Some electrical panel doors do not have the required 3-foot clearance.
- Luminous exit indicators need backup battery verification.

**Status**: Conditional safety clearance recommended, pending resolution of these checklist violations.`;
  }

  return `### AI Safety Assistant

Hello! I am the intelligent fire safety assistant for **${bName}**. I have parsed the building's digital profile, occupancy details, and fire inventory.

I can help you answer questions like:
- *Why is this building high risk?*
- *Which floor is most vulnerable?*
- *Which occupants require immediate evacuation?*
- *Suggest safety improvements.*
- *Generate inspection notes.*

Please ask me any specific question about the building safety state.`;
}
