import express from 'express'
import cors from 'cors'

export const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors())
app.use(express.json())

// --- Uttar Pradesh Geography Nodes (PostGIS-like spatial graph) ---
export interface LocationNode {
  id: string
  name: string
  district: string
  lat: number
  lng: number
  category: 'transit_hub' | 'residential' | 'commercial' | 'industrial' | 'intercity'
  popular: boolean
}

export const UP_LOCATIONS: LocationNode[] = [
  { id: 'charbagh', name: 'Charbagh Railway Station', district: 'Lucknow', lat: 26.8306, lng: 80.9209, category: 'transit_hub', popular: true },
  { id: 'hazratganj', name: 'Hazratganj Main Chauraha', district: 'Lucknow', lat: 26.8524, lng: 80.9452, category: 'commercial', popular: true },
  { id: 'gomti_nagar', name: 'Gomti Nagar (Patrakarpuram)', district: 'Lucknow', lat: 26.8587, lng: 80.9984, category: 'residential', popular: true },
  { id: 'polytechnic', name: 'Polytechnic Chauraha', district: 'Lucknow', lat: 26.8742, lng: 80.9961, category: 'transit_hub', popular: true },
  { id: 'transport_nagar', name: 'Transport Nagar Depot', district: 'Lucknow', lat: 26.7785, lng: 80.8924, category: 'industrial', popular: true },
  { id: 'alambagh', name: 'Alambagh Bus Terminal', district: 'Lucknow', lat: 26.8123, lng: 80.9025, category: 'transit_hub', popular: true },
  { id: 'munshi_pulia', name: 'Munshi Pulia Metro Hub', district: 'Lucknow', lat: 26.8914, lng: 80.9856, category: 'transit_hub', popular: false },
  { id: 'bbd_university', name: 'BBD University (Faizabad Rd)', district: 'Lucknow', lat: 26.8906, lng: 81.0583, category: 'commercial', popular: false },
  { id: 'unnao_bypass', name: 'Unnao Bypass Junction', district: 'Unnao', lat: 26.5456, lng: 80.4900, category: 'intercity', popular: true },
  { id: 'kanpur_central', name: 'Kanpur Central Station', district: 'Kanpur', lat: 26.4538, lng: 80.3512, category: 'transit_hub', popular: true },
  { id: 'ganga_barrage', name: 'Ganga Barrage (Kanpur)', district: 'Kanpur', lat: 26.4983, lng: 80.3341, category: 'commercial', popular: false },
  { id: 'rawatpur', name: 'Rawatpur Cross (Kanpur)', district: 'Kanpur', lat: 26.4764, lng: 80.3012, category: 'transit_hub', popular: false },
]

// --- Real-time Vehicles (UPSRTC, City Electric, Autos, E-Rickshaws) ---
export interface VehicleState {
  id: string
  regNumber: string
  type: 'upsrtc_bus' | 'city_electric_bus' | 'cng_auto' | 'e_rickshaw' | 'shared_taxi'
  typeName: string
  operator: string
  driverName: string
  routeCode: string
  routeName: string
  currentLat: number
  currentLng: number
  bearing: number
  speedKmh: number
  fareBase: number
  farePerKm: number
  crowdLevel: 'Low' | 'Medium' | 'High'
  crowdPercent: number
  capacity: number
  passengers: number
  confidence: 'HIGH' | 'MED' | 'LOW'
  confidenceScore: number
  isAnomaly: boolean
  anomalyReason?: string
  lastGpsPingAgoSec: number
  batteryOrFuel: number
  batteryType: 'battery' | 'cng' | 'diesel'
  status: 'on_route' | 'delayed' | 'halted' | 'refueling'
}

let activeVehicles: VehicleState[] = [
  {
    id: 'veh_01',
    regNumber: 'UP 32 CZ 8901',
    type: 'upsrtc_bus',
    typeName: 'UPSRTC Janrath AC',
    operator: 'Uttar Pradesh State Road Transport Corp',
    driverName: 'Rameshwar Yadav',
    routeCode: 'UP-LKO-KNP-01',
    routeName: 'Alambagh Terminal ⇄ Kanpur Central',
    currentLat: 26.6854,
    currentLng: 80.6841,
    bearing: 235,
    speedKmh: 58,
    fareBase: 45,
    farePerKm: 1.4,
    crowdLevel: 'Medium',
    crowdPercent: 64,
    capacity: 48,
    passengers: 31,
    confidence: 'HIGH',
    confidenceScore: 96,
    isAnomaly: false,
    lastGpsPingAgoSec: 3,
    batteryOrFuel: 82,
    batteryType: 'diesel',
    status: 'on_route'
  },
  {
    id: 'veh_02',
    regNumber: 'UP 32 EV 4102',
    type: 'city_electric_bus',
    typeName: 'Lucknow City E-Bus (AC)',
    operator: 'Lucknow City Transport Services (LCTSL)',
    driverName: 'Sanjay Awasthi',
    routeCode: 'LKO-E-104',
    routeName: 'Charbagh ⇄ Gomti Nagar Patrakarpuram',
    currentLat: 26.8452,
    currentLng: 80.9582,
    bearing: 65,
    speedKmh: 34,
    fareBase: 15,
    farePerKm: 1.8,
    crowdLevel: 'High',
    crowdPercent: 88,
    capacity: 35,
    passengers: 31,
    confidence: 'HIGH',
    confidenceScore: 92,
    isAnomaly: false,
    lastGpsPingAgoSec: 2,
    batteryOrFuel: 74,
    batteryType: 'battery',
    status: 'on_route'
  },
  {
    id: 'veh_03',
    regNumber: 'UP 32 T 9924',
    type: 'cng_auto',
    typeName: 'Vikram Tempo (CNG 6-Seater)',
    operator: 'Lucknow Auto Drivers Union',
    driverName: 'Mohd. Imran',
    routeCode: 'TMP-LKO-22',
    routeName: 'Hazratganj ⇄ Polytechnic Chauraha',
    currentLat: 26.8623,
    currentLng: 80.9712,
    bearing: 45,
    speedKmh: 28,
    fareBase: 10,
    farePerKm: 2.2,
    crowdLevel: 'High',
    crowdPercent: 95,
    capacity: 6,
    passengers: 6,
    confidence: 'HIGH',
    confidenceScore: 94,
    isAnomaly: false,
    lastGpsPingAgoSec: 5,
    batteryOrFuel: 68,
    batteryType: 'cng',
    status: 'on_route'
  },
  {
    id: 'veh_04',
    regNumber: 'UP 32 ER 3319',
    type: 'e_rickshaw',
    typeName: 'Smart Toto E-Rickshaw',
    operator: 'Green Mile UP Mobility',
    driverName: 'Dharmendra Kumar',
    routeCode: 'LAST-MILE-09',
    routeName: 'Gomti Nagar Metro ⇄ Mithaiwala Chauraha',
    currentLat: 26.8592,
    currentLng: 80.9995,
    bearing: 110,
    speedKmh: 18,
    fareBase: 10,
    farePerKm: 3.0,
    crowdLevel: 'Low',
    crowdPercent: 25,
    capacity: 4,
    passengers: 1,
    confidence: 'HIGH',
    confidenceScore: 89,
    isAnomaly: false,
    lastGpsPingAgoSec: 4,
    batteryOrFuel: 55,
    batteryType: 'battery',
    status: 'on_route'
  },
  {
    id: 'veh_05',
    regNumber: 'UP 32 BT 5521',
    type: 'upsrtc_bus',
    typeName: 'UPSRTC Ordinary (Gramin Seva)',
    operator: 'UPSRTC Lucknow Region',
    driverName: 'Harish Chandra',
    routeCode: 'UP-TPN-UNN-04',
    routeName: 'Transport Nagar ⇄ Unnao Bypass',
    currentLat: 26.7410,
    currentLng: 80.8120,
    bearing: 220,
    speedKmh: 12,
    fareBase: 25,
    farePerKm: 1.1,
    crowdLevel: 'High',
    crowdPercent: 91,
    capacity: 52,
    passengers: 48,
    confidence: 'MED',
    confidenceScore: 68,
    isAnomaly: true,
    anomalyReason: 'Unscheduled dwell > 8 mins near Kanpur Road Toll Plaza (Traffic bottleneck)',
    lastGpsPingAgoSec: 42,
    batteryOrFuel: 42,
    batteryType: 'diesel',
    status: 'delayed'
  },
  {
    id: 'veh_06',
    regNumber: 'UP 78 BT 7188',
    type: 'city_electric_bus',
    typeName: 'Kanpur Metro Feeder E-Bus',
    operator: 'Kanpur City Transport Services Ltd',
    driverName: 'Vikas Mishra',
    routeCode: 'KNP-F-02',
    routeName: 'Kanpur Central ⇄ Rawatpur Cross',
    currentLat: 26.4621,
    currentLng: 80.3245,
    bearing: 310,
    speedKmh: 31,
    fareBase: 15,
    farePerKm: 1.6,
    crowdLevel: 'Medium',
    crowdPercent: 58,
    capacity: 32,
    passengers: 19,
    confidence: 'HIGH',
    confidenceScore: 95,
    isAnomaly: false,
    lastGpsPingAgoSec: 2,
    batteryOrFuel: 88,
    batteryType: 'battery',
    status: 'on_route'
  },
  {
    id: 'veh_07',
    regNumber: 'UP 32 ST 2020',
    type: 'shared_taxi',
    typeName: 'Express Shared Cab (Maruti Ertiga)',
    operator: 'Awadh Express Mobility',
    driverName: 'Akash Dixit',
    routeCode: 'LKO-EXP-KNP',
    routeName: 'Charbagh ⇄ Kanpur Mall Road (Fast Corridor)',
    currentLat: 26.7912,
    currentLng: 80.8412,
    bearing: 240,
    speedKmh: 72,
    fareBase: 90,
    farePerKm: 3.5,
    crowdLevel: 'Low',
    crowdPercent: 33,
    capacity: 6,
    passengers: 2,
    confidence: 'HIGH',
    confidenceScore: 98,
    isAnomaly: false,
    lastGpsPingAgoSec: 1,
    batteryOrFuel: 80,
    batteryType: 'cng',
    status: 'on_route'
  },
  {
    id: 'veh_08',
    regNumber: 'UP 32 ER 9011',
    type: 'e_rickshaw',
    typeName: 'Charbagh Metro Toto Feeder',
    operator: 'Green Mile UP Mobility',
    driverName: 'Suraj Sonkar',
    routeCode: 'CHB-FEED-01',
    routeName: 'Charbagh Station ⇄ Alambagh Market',
    currentLat: 26.8210,
    currentLng: 80.9115,
    bearing: 195,
    speedKmh: 14,
    fareBase: 10,
    farePerKm: 3.0,
    crowdLevel: 'Medium',
    crowdPercent: 50,
    capacity: 4,
    passengers: 2,
    confidence: 'HIGH',
    confidenceScore: 91,
    isAnomaly: false,
    lastGpsPingAgoSec: 3,
    batteryOrFuel: 62,
    batteryType: 'battery',
    status: 'on_route'
  }
]

// Simulate dynamic vehicle movement along UP roads every 3 seconds
setInterval(() => {
  activeVehicles = activeVehicles.map(v => {
    // Slight jitter to simulate real road movement
    const latDelta = (Math.random() - 0.48) * 0.0008
    const lngDelta = (Math.random() - 0.48) * 0.0008
    let nextLat = v.currentLat + latDelta
    let nextLng = v.currentLng + lngDelta
    
    // Bounds check to keep within UP corridor
    if (nextLat < 26.3 || nextLat > 27.1) nextLat = 26.85
    if (nextLng < 80.1 || nextLng > 81.2) nextLng = 80.95

    const ping = Math.max(1, Math.floor(Math.random() * 6))
    return {
      ...v,
      currentLat: Number(nextLat.toFixed(6)),
      currentLng: Number(nextLng.toFixed(6)),
      lastGpsPingAgoSec: ping
    }
  })
}, 3000)

// Helper: compute Haversine distance in KM
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

// --- RocketRide.AI Visual Pipelines Specs ---
export interface RocketRidePipelineRun {
  pipelineId: 'eta_prediction.pipe' | 'crowd_estimation.pipe' | 'anomaly_detection.pipe'
  name: string
  status: 'SUCCESS' | 'WARNING_FALLBACK' | 'ANOMALY_TRIGGERED'
  latencyMs: number
  timestamp: string
  nodes: {
    nodeId: string
    title: string
    type: 'ingest' | 'spatial_transform' | 'model_inference' | 'safety_gate' | 'output'
    inputs: Record<string, any>
    outputs: Record<string, any>
    confidence: number
    status: 'PASS' | 'FALLBACK' | 'FLAG'
  }[]
  finalOutput: Record<string, any>
}

// RocketRide.AI Engine: Calculate multi-modal comparison with .pipe processing
function runRocketRideTripEngine(
  origin: LocationNode,
  dest: LocationNode,
  simulateStaleGps: boolean = false
) {
  const distKm = Math.max(1.2, haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng))
  const isIntercity = distKm > 25

  // Vehicle option archetypes for UP
  const optionsConfig = [
    {
      id: 'opt_erickshaw',
      type: 'e_rickshaw',
      title: 'Smart Toto E-Rickshaw',
      subtitle: 'Ideal for 1-5km short hops in Gomti Nagar/Hazratganj',
      avgSpeedKmh: 18,
      baseFare: 10,
      perKm: 3.0,
      minFare: 10,
      maxFare: 40,
      crowdSeed: { level: 'Low', pct: 28 },
      available: distKm <= 8,
      operator: 'Green Mile UP Mobility',
      ecoRating: 'Zero Emissions',
      carbonKg: 0,
      trustScore: simulateStaleGps ? 45 : 94
    },
    {
      id: 'opt_cng_auto',
      type: 'cng_auto',
      title: 'Vikram Tempo / CNG Auto',
      subtitle: 'Direct corridor shuttle, shared or private hire',
      avgSpeedKmh: 28,
      baseFare: 15,
      perKm: 2.2,
      minFare: 20,
      maxFare: 75,
      crowdSeed: { level: 'Medium', pct: 65 },
      available: distKm <= 20,
      operator: 'Lucknow-Kanpur Auto Union',
      ecoRating: 'Clean CNG',
      carbonKg: Number((distKm * 0.045).toFixed(2)),
      trustScore: simulateStaleGps ? 52 : 91
    },
    {
      id: 'opt_ebus',
      type: 'city_electric_bus',
      title: 'Lucknow City E-Bus (AC)',
      subtitle: 'Air-conditioned city feeder, dedicated green lane',
      avgSpeedKmh: 24,
      baseFare: 15,
      perKm: 1.8,
      minFare: 15,
      maxFare: 55,
      crowdSeed: { level: 'High', pct: 84 },
      available: distKm <= 35,
      operator: 'LCTSL Govt of UP',
      ecoRating: 'Electric Grid',
      carbonKg: Number((distKm * 0.015).toFixed(2)),
      trustScore: simulateStaleGps ? 42 : 97
    },
    {
      id: 'opt_upsrtc',
      type: 'upsrtc_bus',
      title: 'UPSRTC Janrath AC / Express',
      subtitle: 'Highway corridor express linking LKO ⇄ Unnao ⇄ Kanpur',
      avgSpeedKmh: 52,
      baseFare: 40,
      perKm: 1.3,
      minFare: 35,
      maxFare: 140,
      crowdSeed: { level: 'Medium', pct: 60 },
      available: true,
      operator: 'UPSRTC Transport Corp',
      ecoRating: 'Euro VI Diesel',
      carbonKg: Number((distKm * 0.038).toFixed(2)),
      trustScore: simulateStaleGps ? 40 : 96
    },
    {
      id: 'opt_shared_cab',
      type: 'shared_taxi',
      title: 'Awadh Shared Express Cab',
      subtitle: 'Point-to-point fast carpool via Shaheed Path / NH27',
      avgSpeedKmh: 62,
      baseFare: 70,
      perKm: 3.5,
      minFare: 80,
      maxFare: 280,
      crowdSeed: { level: 'Low', pct: 35 },
      available: true,
      operator: 'Awadh Express Mobility',
      ecoRating: 'Hybrid CNG',
      carbonKg: Number((distKm * 0.065).toFixed(2)),
      trustScore: simulateStaleGps ? 48 : 98
    }
  ]

  const evaluatedOptions = optionsConfig
    .filter(opt => opt.available)
    .map(opt => {
      // RocketRide Fare calculation
      const calculatedFare = Math.max(opt.minFare, Math.min(opt.maxFare, Math.round(opt.baseFare + distKm * opt.perKm)))
      
      // RocketRide ETA Calculation
      const baseDurationMin = Math.round((distKm / opt.avgSpeedKmh) * 60) + 4 // 4 min buffer for signals
      
      // RocketRide Trust & Safety Fallback Logic
      const isHighConfidence = !simulateStaleGps && opt.trustScore >= 80
      const isMedConfidence = !simulateStaleGps && opt.trustScore >= 60 && opt.trustScore < 80
      
      const confidenceTier: 'HIGH' | 'MED' | 'LOW' = simulateStaleGps 
        ? 'LOW' 
        : isHighConfidence ? 'HIGH' : isMedConfidence ? 'MED' : 'LOW'
      
      const confidenceScore = simulateStaleGps ? Math.floor(35 + Math.random() * 15) : opt.trustScore

      // If confidence is LOW or stale GPS simulated -> Fail safely! Stop precise ETA, give safe fallback window
      const safeFallbackActive = confidenceTier === 'LOW'
      const etaDisplay = safeFallbackActive
        ? `~${Math.max(10, baseDurationMin - 5)} - ${baseDurationMin + 15} mins (Estimated Window)`
        : `${baseDurationMin} mins`
      
      const fallbackReason = safeFallbackActive
        ? 'GPS telemetry degraded / high corridor jitter. Displaying safe historical buffer window.'
        : undefined

      return {
        id: opt.id,
        type: opt.type,
        title: opt.title,
        subtitle: opt.subtitle,
        operator: opt.operator,
        distKm,
        estimatedFareInr: calculatedFare,
        fareBreakdown: {
          base: opt.baseFare,
          distanceCharge: Math.round(distKm * opt.perKm),
          cgstUpgst: Math.round(calculatedFare * 0.05),
          total: calculatedFare
        },
        durationMinutes: baseDurationMin,
        etaDisplay,
        crowdLevel: opt.crowdSeed.level as 'Low' | 'Medium' | 'High',
        crowdPercent: opt.crowdSeed.pct,
        confidenceTier,
        confidenceScore,
        safeFallbackActive,
        fallbackReason,
        ecoRating: opt.ecoRating,
        carbonKg: opt.carbonKg,
        frequencyMinutes: opt.type === 'e_rickshaw' ? 3 : opt.type === 'cng_auto' ? 5 : opt.type === 'city_electric_bus' ? 8 : 15,
        nearbyVehicleCount: Math.floor(Math.random() * 4) + 2
      }
    })

  return {
    origin,
    dest,
    distKm,
    isIntercity,
    simulatedTrafficIndex: 'Moderate (Kanpur Rd / Hazratganj signals active)',
    options: evaluatedOptions
  }
}

// --- API Endpoints ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'TRU-ROUTE UP Mobility Intelligence', time: new Date().toISOString() })
})

// Get UP Locations
app.get('/api/transit/locations', (_req, res) => {
  res.json({ success: true, count: UP_LOCATIONS.length, locations: UP_LOCATIONS })
})

// Get Live Vehicles for Map & Fleet Tracking
app.get('/api/transit/vehicles', (req, res) => {
  const typeFilter = req.query.type as string | undefined
  let list = activeVehicles
  if (typeFilter && typeFilter !== 'all') {
    list = list.filter(v => v.type === typeFilter)
  }
  res.json({ success: true, count: list.length, vehicles: list })
})

// Compare Options: Origin to Destination Multi-Modal Routing
app.post('/api/transit/compare-options', (req, res) => {
  try {
    const { originId, destId, simulateStaleGps } = req.body
    const origin = UP_LOCATIONS.find(l => l.id === originId) || UP_LOCATIONS[0] // Charbagh
    const dest = UP_LOCATIONS.find(l => l.id === destId) || UP_LOCATIONS[2] // Gomti Nagar

    const result = runRocketRideTripEngine(origin, dest, Boolean(simulateStaleGps))
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to compare options' })
  }
})

// RocketRide .pipe Visual Pipeline Executions
app.get('/api/pipelines/specs', (_req, res) => {
  const pipelines = [
    {
      id: 'eta_prediction.pipe',
      name: 'RocketRide ETA Predictor (Live GPS + Traffic Flow)',
      version: 'v2.4.1',
      description: 'Ingests live vehicle telemetry, aligns to PostGIS UP corridor graph, extracts signal delays, and predicts travel duration with confidence bounds.',
      inputs: ['gps_stream', 'osm_up_network', 'live_congestion_feed', 'weather_telemetry'],
      activeNodes: 5,
      accuracy: '98.2%',
      latencyMs: 14
    },
    {
      id: 'crowd_estimation.pipe',
      name: 'RocketRide Dynamic Crowd & Capacity Estimator',
      version: 'v1.9.0',
      description: 'Calculates vehicle occupancy % and crowd tier (Low, Medium, High) using automatic ticketing pings, dwell times, and corridor rush multipliers.',
      inputs: ['fare_validator_pings', 'vehicle_axle_weight', 'station_crowd_sensors'],
      activeNodes: 4,
      accuracy: '94.6%',
      latencyMs: 9
    },
    {
      id: 'anomaly_detection.pipe',
      name: 'RocketRide Safety & Anomaly Sentinel',
      version: 'v3.1.0',
      description: 'Flags unusual halts, severe route deviations, telemetry conflicts, and triggers the Safe Fallback Layer when confidence degrades.',
      inputs: ['planned_route_polyline', 'actual_gps_trajectory', 'dwell_timer'],
      activeNodes: 6,
      accuracy: '99.1%',
      latencyMs: 11
    }
  ]
  res.json({ success: true, pipelines })
})

// Run a specific pipeline simulation trace
app.post('/api/pipelines/execute', (req, res) => {
  const { pipelineId, vehicleId, simulateAnomaly } = req.body
  const targetVeh = activeVehicles.find(v => v.id === vehicleId) || activeVehicles[0]

  if (pipelineId === 'anomaly_detection.pipe' || simulateAnomaly) {
    const trace: RocketRidePipelineRun = {
      pipelineId: 'anomaly_detection.pipe',
      name: 'RocketRide Safety & Anomaly Sentinel',
      status: simulateAnomaly ? 'WARNING_FALLBACK' : 'SUCCESS',
      latencyMs: 12,
      timestamp: new Date().toISOString(),
      nodes: [
        {
          nodeId: 'node_ingest_01',
          title: 'PostGIS GPS Telemetry Ingest',
          type: 'ingest',
          inputs: { vehicleId: targetVeh.id, coords: [targetVeh.currentLat, targetVeh.currentLng] },
          outputs: { validCoords: true, signalAgeSec: targetVeh.lastGpsPingAgoSec },
          confidence: simulateAnomaly ? 44 : 98,
          status: simulateAnomaly ? 'FLAG' : 'PASS'
        },
        {
          nodeId: 'node_spatial_02',
          title: 'Polyline Deviation & Corridor Buffer',
          type: 'spatial_transform',
          inputs: { plannedPolyline: targetVeh.routeCode, toleranceMeters: 50 },
          outputs: { deviationMeters: simulateAnomaly ? 240 : 12, onSegment: !simulateAnomaly },
          confidence: simulateAnomaly ? 51 : 96,
          status: simulateAnomaly ? 'FLAG' : 'PASS'
        },
        {
          nodeId: 'node_safety_03',
          title: 'Confidence Scoring & Safe Fallback Gate',
          type: 'safety_gate',
          inputs: { thresholdMin: 70, calculatedTrust: simulateAnomaly ? 45 : 94 },
          outputs: {
            fallbackTriggered: simulateAnomaly,
            action: simulateAnomaly ? 'STOP_PRECISE_ETA_ACTIVATE_FALLBACK_WINDOW' : 'EMIT_PRECISE_ETA'
          },
          confidence: simulateAnomaly ? 42 : 95,
          status: simulateAnomaly ? 'FALLBACK' : 'PASS'
        }
      ],
      finalOutput: {
        isAnomaly: simulateAnomaly,
        anomalyCode: simulateAnomaly ? 'ANOMALY_CORRIDOR_DEVIATION_STALE_SIGNAL' : 'NORMAL_TELEMETRY',
        safeFallbackActive: simulateAnomaly,
        recommendedAction: simulateAnomaly ? 'Alert Operator & Show Commuter Fallback Window' : 'Normal Stream'
      }
    }
    return res.json({ success: true, trace })
  }

  // Default ETA pipe trace
  const trace: RocketRidePipelineRun = {
    pipelineId: 'eta_prediction.pipe',
    name: 'RocketRide ETA Predictor',
    status: 'SUCCESS',
    latencyMs: 15,
    timestamp: new Date().toISOString(),
    nodes: [
      {
        nodeId: 'node_ingest_01',
        title: 'Live GPS & Route Graph Query',
        type: 'ingest',
        inputs: { origin: 'Charbagh', destination: 'Gomti Nagar', network: 'UP_State_Corridor_V3' },
        outputs: { segmentsCount: 14, totalDistanceKm: 12.4 },
        confidence: 99,
        status: 'PASS'
      },
      {
        nodeId: 'node_traffic_02',
        title: 'Historical & Realtime Congestion Fusion',
        type: 'spatial_transform',
        inputs: { timeSlot: 'Evening Peak (18:30)', corridor: 'Hazratganj Main' },
        outputs: { congestionMultiplier: 1.32, avgSpeedKmh: 24.5 },
        confidence: 96,
        status: 'PASS'
      },
      {
        nodeId: 'node_ml_03',
        title: 'RocketRide DeepETA Neural Inference',
        type: 'model_inference',
        inputs: { model: 'RocketRide-UP-Transit-v2', weights: 'LKO_KNP_Trained' },
        outputs: { predictedDurationSec: 1560, rawEtaMins: 26 },
        confidence: 97,
        status: 'PASS'
      },
      {
        nodeId: 'node_trust_04',
        title: 'Trust & Confidence Evaluator',
        type: 'safety_gate',
        inputs: { varianceSigma: 1.4, dataFreshnessSec: 2 },
        outputs: { tier: 'HIGH', confidencePercent: 97.4, passSafeGate: true },
        confidence: 98,
        status: 'PASS'
      }
    ],
    finalOutput: {
      etaMinutes: 26,
      confidenceTier: 'HIGH',
      confidenceScore: 97,
      safeFallbackActive: false
    }
  }
  res.json({ success: true, trace })
})

// Operator SaaS Dashboard API
app.get('/api/operator/dashboard', (_req, res) => {
  const totalVehicles = activeVehicles.length
  const delayedVehicles = activeVehicles.filter(v => v.status === 'delayed' || v.isAnomaly).length
  const activePassengers = activeVehicles.reduce((acc, v) => acc + v.passengers, 0)
  const avgConfidence = Math.round(activeVehicles.reduce((acc, v) => acc + v.confidenceScore, 0) / totalVehicles)

  const demandHotspots = [
    { name: 'Charbagh Railway Hub', district: 'Lucknow', demandLevel: 'Surge (94%)', activeWaiters: 142, waitTimeMin: 4, primaryMode: 'E-Rickshaw / E-Bus' },
    { name: 'Polytechnic Chauraha', district: 'Lucknow', demandLevel: 'High (82%)', activeWaiters: 89, waitTimeMin: 6, primaryMode: 'Vikram Tempo Auto' },
    { name: 'Transport Nagar Depot', district: 'Lucknow', demandLevel: 'Moderate (65%)', activeWaiters: 45, waitTimeMin: 8, primaryMode: 'UPSRTC Bus' },
    { name: 'Kanpur Central Station', district: 'Kanpur', demandLevel: 'Surge (96%)', activeWaiters: 180, waitTimeMin: 5, primaryMode: 'Janrath Bus / Metro Feeder' },
    { name: 'Unnao Toll Bypass', district: 'Unnao', demandLevel: 'Normal (48%)', activeWaiters: 24, waitTimeMin: 12, primaryMode: 'Intercity UPSRTC' }
  ]

  res.json({
    success: true,
    summary: {
      totalVehicles,
      activeOnRoute: activeVehicles.filter(v => v.status === 'on_route').length,
      delayedVehicles,
      activePassengers,
      fleetOccupancyAvg: 68,
      avgConfidence,
      co2SavedKgToday: 1840,
      totalTripsCompletedToday: 1420
    },
    hotspots: demandHotspots,
    vehicles: activeVehicles
  })
})

// Operator action: Dispatch or resolve an anomaly
app.post('/api/operator/action', (req, res) => {
  const { vehicleId, action } = req.body
  const veh = activeVehicles.find(v => v.id === vehicleId)
  if (!veh) return res.status(404).json({ error: 'Vehicle not found' })

  if (action === 'RESOLVE_ANOMALY') {
    veh.isAnomaly = false
    veh.anomalyReason = undefined
    veh.status = 'on_route'
    veh.confidence = 'HIGH'
    veh.confidenceScore = 95
  } else if (action === 'DISPATCH_BACKUP') {
    veh.status = 'on_route'
    veh.confidence = 'MED'
    veh.confidenceScore = 80
  }

  res.json({ success: true, updatedVehicle: veh })
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server]', err)
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' })
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`TRU-ROUTE Mobility Backend running on :${PORT}`))
}

export default app
