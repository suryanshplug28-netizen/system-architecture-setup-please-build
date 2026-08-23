import React, { useState, useEffect, useRef } from 'react'
import {
  Navigation,
  Bus,
  Car,
  Zap,
  Activity,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Gauge,
  Sliders,
  Layers,
  ChevronRight,
  Users,
  Compass,
  Sparkles,
  Info,
  CheckCircle2,
  ExternalLink,
  Flame,
  BatteryCharging,
  CornerDownRight,
  Route as RouteIcon,
  Search,
  Eye,
  Settings,
  Radio,
  Share2
} from 'lucide-react'
import L from 'leaflet'

interface LocationNode {
  id: string
  name: string
  district: string
  lat: number
  lng: number
  category: 'transit_hub' | 'residential' | 'commercial' | 'industrial' | 'intercity'
  popular: boolean
}

interface VehicleState {
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

interface TripOption {
  id: string
  type: 'upsrtc_bus' | 'city_electric_bus' | 'cng_auto' | 'e_rickshaw' | 'shared_taxi'
  title: string
  subtitle: string
  operator: string
  distKm: number
  estimatedFareInr: number
  fareBreakdown: {
    base: number
    distanceCharge: number
    cgstUpgst: number
    total: number
  }
  durationMinutes: number
  etaDisplay: string
  crowdLevel: 'Low' | 'Medium' | 'High'
  crowdPercent: number
  confidenceTier: 'HIGH' | 'MED' | 'LOW'
  confidenceScore: number
  safeFallbackActive: boolean
  fallbackReason?: string
  ecoRating: string
  carbonKg: number
  frequencyMinutes: number
  nearbyVehicleCount: number
}

interface ComparisonResult {
  origin: LocationNode
  dest: LocationNode
  distKm: number
  isIntercity: boolean
  simulatedTrafficIndex: string
  options: TripOption[]
}

interface OperatorSummary {
  totalVehicles: number
  activeOnRoute: number
  delayedVehicles: number
  activePassengers: number
  fleetOccupancyAvg: number
  avgConfidence: number
  co2SavedKgToday: number
  totalTripsCompletedToday: number
}

interface DemandHotspot {
  name: string
  district: string
  demandLevel: string
  activeWaiters: number
  waitTimeMin: number
  primaryMode: string
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'commuter' | 'operator' | 'pipelines'>('commuter')
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [originId, setOriginId] = useState<string>('charbagh')
  const [destId, setDestId] = useState<string>('gomti_nagar')
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('all')
  const [simulateStaleGps, setSimulateStaleGps] = useState<boolean>(false)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [vehicles, setVehicles] = useState<VehicleState[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleState | null>(null)
  const [selectedOption, setSelectedOption] = useState<TripOption | null>(null)
  const [loadingTrip, setLoadingTrip] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Operator State
  const [operatorSummary, setOperatorSummary] = useState<OperatorSummary | null>(null)
  const [hotspots, setHotspots] = useState<DemandHotspot[]>([])
  const [operatorFilter, setOperatorFilter] = useState<'all' | 'delayed' | 'upsrtc' | 'electric' | 'auto'>('all')

  // RocketRide .pipe State
  const [activePipeId, setActivePipeId] = useState<'eta_prediction.pipe' | 'crowd_estimation.pipe' | 'anomaly_detection.pipe'>('eta_prediction.pipe')
  const [pipeTrace, setPipeTrace] = useState<any>(null)
  const [simulatingPipe, setSimulatingPipe] = useState<boolean>(false)
  const [anomalySimulation, setAnomalySimulation] = useState<boolean>(false)

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<{ [key: string]: L.Marker }>({})
  const routeLineRef = useRef<L.Polyline | null>(null)

  // Fetch initial locations & vehicles
  useEffect(() => {
    fetchLocations()
    fetchVehicles()
    fetchOperatorData()
    fetchPipeTrace('eta_prediction.pipe', false)

    const interval = setInterval(() => {
      fetchVehicles()
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  // Compare trip options whenever origin, dest, or fallback toggle changes
  useEffect(() => {
    if (originId && destId) {
      fetchTripComparison()
    }
  }, [originId, destId, simulateStaleGps])

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      // Centered on Uttar Pradesh (Lucknow-Kanpur Corridor)
      const map = L.map(mapContainerRef.current, {
        center: [26.8467, 80.9462], // Lucknow center
        zoom: 12,
        zoomControl: false
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapInstanceRef.current = map
    }

    return () => {
      // keep map instance alive during tab transitions
    }
  }, [])

  // Sync markers on map when vehicles or locations change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Add / Update Vehicle Markers
    vehicles.forEach(v => {
      const iconHtml = getVehicleMarkerHtml(v)
      const customIcon = L.divIcon({
        className: 'custom-vehicle-marker-wrapper',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      if (markersRef.current[v.id]) {
        markersRef.current[v.id].setLatLng([v.currentLat, v.currentLng])
        markersRef.current[v.id].setIcon(customIcon)
      } else {
        const marker = L.marker([v.currentLat, v.currentLng], { icon: customIcon }).addTo(map)
        marker.on('click', () => {
          setSelectedVehicle(v)
        })
        markersRef.current[v.id] = marker
      }
    })

    // Draw route line if comparison is loaded
    if (comparison && comparison.origin && comparison.dest) {
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current)
      }

      const p1 = [comparison.origin.lat, comparison.origin.lng] as [number, number]
      const p2 = [comparison.dest.lat, comparison.dest.lng] as [number, number]
      
      // Calculate realistic waypoint curve
      const midLat = (p1[0] + p2[0]) / 2 + 0.006
      const midLng = (p1[1] + p2[1]) / 2 - 0.005
      
      const poly = L.polyline([p1, [midLat, midLng], p2], {
        color: '#4F37FD',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8'
      }).addTo(map)

      routeLineRef.current = poly
    }
  }, [vehicles, comparison])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/transit/locations')
      const data = await res.json()
      if (data.success) {
        setLocations(data.locations)
      }
    } catch (err) {
      console.error('Failed to fetch locations', err)
    }
  }

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/transit/vehicles')
      const data = await res.json()
      if (data.success) {
        setVehicles(data.vehicles)
      }
    } catch (err) {
      console.error('Failed to fetch vehicles', err)
    }
  }

  const fetchTripComparison = async () => {
    setLoadingTrip(true)
    try {
      const res = await fetch('/api/transit/compare-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originId,
          destId,
          simulateStaleGps
        })
      })
      const data = await res.json()
      if (data.success) {
        setComparison(data.data)
        if (data.data.options.length > 0) {
          setSelectedOption(data.data.options[0])
        }
      }
    } catch (err) {
      console.error('Failed to compare options', err)
    } finally {
      setLoadingTrip(false)
    }
  }

  const fetchOperatorData = async () => {
    try {
      const res = await fetch('/api/operator/dashboard')
      const data = await res.json()
      if (data.success) {
        setOperatorSummary(data.summary)
        setHotspots(data.hotspots)
      }
    } catch (err) {
      console.error('Failed to fetch operator stats', err)
    }
  }

  const fetchPipeTrace = async (pipeId: string, anomaly: boolean) => {
    setSimulatingPipe(true)
    try {
      const res = await fetch('/api/pipelines/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: pipeId,
          simulateAnomaly: anomaly
        })
      })
      const data = await res.json()
      if (data.success) {
        setPipeTrace(data.trace)
      }
    } catch (err) {
      console.error('Failed to execute pipeline', err)
    } finally {
      setSimulatingPipe(false)
    }
  }

  const handleResolveAnomaly = async (vehicleId: string) => {
    try {
      const res = await fetch('/api/operator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          action: 'RESOLVE_ANOMALY'
        })
      })
      const data = await res.json()
      if (data.success) {
        fetchVehicles()
        fetchOperatorData()
      }
    } catch (err) {
      console.error('Action failed', err)
    }
  }

  const handleRecenterMap = (lat: number, lng: number, zoom = 14) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1 })
    }
  }

  const getVehicleMarkerHtml = (v: VehicleState) => {
    const isAnomaly = v.isAnomaly
    const color = isAnomaly
      ? '#F04438'
      : v.type === 'upsrtc_bus'
      ? '#D97706'
      : v.type === 'city_electric_bus'
      ? '#17B26A'
      : v.type === 'cng_auto'
      ? '#4F37FD'
      : v.type === 'e_rickshaw'
      ? '#0891B2'
      : '#475569'

    const label = v.type === 'upsrtc_bus' ? 'UPSRTC' : v.type === 'city_electric_bus' ? 'E-BUS' : v.type === 'cng_auto' ? 'AUTO' : v.type === 'e_rickshaw' ? 'TOTO' : 'CAB'

    return `
      <div style="position: relative; cursor: pointer;">
        ${isAnomaly ? '<div class="pulsing-ring" style="position: absolute; inset: -6px; border-radius: 9999px; background: rgba(240, 68, 56, 0.35);"></div>' : ''}
        <div style="background: ${color}; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 4px; border: 2px solid white; white-space: nowrap;">
          <span>${label}</span>
          <span style="font-size: 8px; opacity: 0.9;">${v.speedKmh}k</span>
        </div>
      </div>
    `
  }

  const filteredOptions = comparison?.options.filter(opt => {
    if (selectedVehicleType === 'all') return true
    return opt.type === selectedVehicleType
  }) || []

  const filteredVehiclesForOperator = vehicles.filter(v => {
    if (operatorFilter === 'all') return true
    if (operatorFilter === 'delayed') return v.status === 'delayed' || v.isAnomaly
    if (operatorFilter === 'upsrtc') return v.type === 'upsrtc_bus'
    if (operatorFilter === 'electric') return v.type === 'city_electric_bus' || v.type === 'e_rickshaw'
    if (operatorFilter === 'auto') return v.type === 'cng_auto'
    return true
  })

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col text-[#181D27]">
      {/* Top Brand & Mode Bar */}
      <header className="bg-white border-b border-[#E9EAEB] sticky top-0 z-40 px-4 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F37FD] text-white flex items-center justify-center shadow-md shadow-[#4F37FD]/20">
              <Navigation className="w-5 h-5 transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#181D27]">TRU-ROUTE</h1>
                <span className="bg-[#ECFDF3] text-[#067647] border border-[#ABEFC6] text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#17B26A] animate-pulse"></span>
                  UP Live Network
                </span>
                <span className="bg-[#EBEAFF] text-[#402DCE] text-xs font-semibold px-2 py-0.5 rounded-full">
                  RocketRide.AI .pipe
                </span>
              </div>
              <p className="text-xs text-[#535862]">
                Uttar Pradesh Mobility Intelligence • PostGIS Spatial Hub (Lucknow • Kanpur • Unnao)
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 bg-[#F5F5F5] p-1 rounded-xl border border-[#E9EAEB] self-start md:self-auto">
            <button
              onClick={() => setActiveTab('commuter')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'commuter'
                  ? 'bg-white text-[#4F37FD] shadow-sm border border-[#E9EAEB]'
                  : 'text-[#535862] hover:text-[#181D27]'
              }`}
            >
              <Users className="w-4 h-4" />
              Commuter App (Compare MVP)
            </button>

            <button
              onClick={() => setActiveTab('pipelines')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'pipelines'
                  ? 'bg-white text-[#4F37FD] shadow-sm border border-[#E9EAEB]'
                  : 'text-[#535862] hover:text-[#181D27]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#4F37FD]" />
              RocketRide .pipe Visual Studio
            </button>

            <button
              onClick={() => setActiveTab('operator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'operator'
                  ? 'bg-white text-[#4F37FD] shadow-sm border border-[#E9EAEB]'
                  : 'text-[#535862] hover:text-[#181D27]'
              }`}
            >
              <Gauge className="w-4 h-4" />
              Operator SaaS Dashboard
              {vehicles.filter(v => v.isAnomaly).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#F04438] animate-ping"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* TAB 1: COMMUTER MVP SCREEN */}
        {/* ========================================================================= */}
        {activeTab === 'commuter' && (
          <>
            {/* Left Control & Compare Panel */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Origin & Destination Search Card */}
              <div className="bg-white rounded-2xl p-5 border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-[#535862] uppercase tracking-wider flex items-center gap-1.5">
                    <RouteIcon className="w-4 h-4 text-[#4F37FD]" />
                    UP Corridor Trip Planner
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const temp = originId
                        setOriginId(destId)
                        setDestId(temp)
                      }}
                      className="p-1.5 text-xs text-[#535862] hover:text-[#4F37FD] bg-[#F5F5F5] rounded-lg border border-[#E9EAEB] transition-colors"
                      title="Swap Origin and Destination"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Origin */}
                  <div>
                    <label className="text-xs font-semibold text-[#414651] mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#17B26A]"></span>
                      Origin (Pickup Point)
                    </label>
                    <select
                      value={originId}
                      onChange={e => setOriginId(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-[#D5D7DA] rounded-xl px-3 py-2 text-sm text-[#181D27] font-medium focus:outline-none focus:border-[#4F37FD] focus:ring-2 focus:ring-[#4F37FD]/20"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.district})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="text-xs font-semibold text-[#414651] mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#F04438]"></span>
                      Destination (Drop Location)
                    </label>
                    <select
                      value={destId}
                      onChange={e => setDestId(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-[#D5D7DA] rounded-xl px-3 py-2 text-sm text-[#181D27] font-medium focus:outline-none focus:border-[#4F37FD] focus:ring-2 focus:ring-[#4F37FD]/20"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.district})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Trust & Safe Fallback Simulation Switch */}
                <div className="mt-4 pt-3 border-t border-[#E9EAEB] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#4F37FD]" />
                    <div>
                      <div className="text-xs font-semibold text-[#181D27]">Trust & Safe Fallback Layer</div>
                      <div className="text-[11px] text-[#535862]">Simulate GPS signal loss / jitter</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateStaleGps}
                      onChange={e => setSimulateStaleGps(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#E9EAEB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F04438]"></div>
                  </label>
                </div>
              </div>

              {/* Vehicle Type Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'All Modes', icon: Layers },
                  { id: 'e_rickshaw', label: 'E-Rickshaw (Toto)', icon: Zap },
                  { id: 'cng_auto', label: 'Auto (Vikram)', icon: Car },
                  { id: 'city_electric_bus', label: 'City E-Bus', icon: Bus },
                  { id: 'upsrtc_bus', label: 'UPSRTC Express', icon: Bus },
                  { id: 'shared_taxi', label: 'Shared Cab', icon: Car }
                ].map(pill => {
                  const IconComp = pill.icon
                  const active = selectedVehicleType === pill.id
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setSelectedVehicleType(pill.id)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#4F37FD] text-white shadow-sm'
                          : 'bg-white text-[#535862] border border-[#E9EAEB] hover:border-[#D5D7DA]'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      {pill.label}
                    </button>
                  )
                })}
              </div>

              {/* Trip Summary & Compare Options Header */}
              {comparison && (
                <div className="flex items-center justify-between px-1">
                  <div className="text-xs text-[#535862]">
                    Corridor Distance: <span className="font-semibold text-[#181D27]">{comparison.distKm} km</span> •{' '}
                    <span className="text-[#17B26A] font-medium">{comparison.options.length} options found</span>
                  </div>
                  <div className="text-[11px] bg-[#EBEAFF] text-[#402DCE] font-semibold px-2 py-0.5 rounded">
                    RocketRide AI Ready
                  </div>
                </div>
              )}

              {/* Fallback Warning Banner if Fallback is Active */}
              {simulateStaleGps && (
                <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-[#F04438] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-[#B42318]">Safe Fallback Window Activated</div>
                    <div className="text-[11px] text-[#B42318]/90 leading-relaxed">
                      RocketRide Sentinel detected degraded telemetry / telemetry conflict in the corridor. Precise ETAs have been stopped to prevent commuter misdirection; displaying verified historical arrival windows.
                    </div>
                  </div>
                </div>
              )}

              {/* Compare Options Cards List */}
              <div className="flex flex-col gap-3">
                {filteredOptions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-[#E9EAEB]">
                    <p className="text-sm text-[#535862]">No vehicle options match your current filter.</p>
                  </div>
                ) : (
                  filteredOptions.map(opt => {
                    const isSelected = selectedOption?.id === opt.id
                    const crowdBadgeClass =
                      opt.crowdLevel === 'Low'
                        ? 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]'
                        : opt.crowdLevel === 'Medium'
                        ? 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]'
                        : 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'

                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedOption(opt)}
                        className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4F37FD] ring-2 ring-[#4F37FD]/20 shadow-md'
                            : 'border-[#E9EAEB] hover:border-[#D5D7DA] shadow-sm'
                        }`}
                      >
                        {/* Top row: Title + Fare */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                                opt.type === 'upsrtc_bus'
                                  ? 'bg-[#D97706]'
                                  : opt.type === 'city_electric_bus'
                                  ? 'bg-[#17B26A]'
                                  : opt.type === 'cng_auto'
                                  ? 'bg-[#4F37FD]'
                                  : opt.type === 'e_rickshaw'
                                  ? 'bg-[#0891B2]'
                                  : 'bg-[#475569]'
                              }`}
                            >
                              {opt.type === 'upsrtc_bus' || opt.type === 'city_electric_bus' ? (
                                <Bus className="w-5 h-5" />
                              ) : opt.type === 'e_rickshaw' ? (
                                <Zap className="w-5 h-5" />
                              ) : (
                                <Car className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-[#181D27]">{opt.title}</h3>
                              <div className="text-xs text-[#535862]">{opt.operator}</div>
                            </div>
                          </div>

                          {/* Realistic Local Fare Output in Rupees */}
                          <div className="text-right">
                            <div className="text-lg font-extrabold text-[#181D27]">
                              ₹{opt.estimatedFareInr}
                            </div>
                            <div className="text-[10px] text-[#717680]">Govt Approved Fare</div>
                          </div>
                        </div>

                        {/* Middle row: ETA & Crowd percentage */}
                        <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-[#F5F5F5]">
                          {/* ETA Section */}
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#4F37FD]" />
                            <div>
                              <div className="text-[10px] text-[#717680]">ETA Prediction</div>
                              <div className="text-xs font-bold text-[#181D27]">{opt.etaDisplay}</div>
                            </div>
                          </div>

                          {/* Crowd Estimation Badge formatted Low/Medium/High with % */}
                          <div className="flex items-center gap-1.5 justify-end">
                            <Users className="w-4 h-4 text-[#535862]" />
                            <div className="text-right">
                              <div className="text-[10px] text-[#717680]">Crowd Occupancy</div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${crowdBadgeClass}`}
                              >
                                {opt.crowdLevel} ({opt.crowdPercent}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: RocketRide Confidence & Carbon / Frequency */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] bg-[#FAFAFA] rounded-lg px-2.5 py-1.5 border border-[#E9EAEB]">
                          <div className="flex items-center gap-1">
                            <span className="text-[#535862]">AI Confidence:</span>
                            <span
                              className={`font-semibold ${
                                opt.confidenceTier === 'HIGH'
                                  ? 'text-[#067647]'
                                  : opt.confidenceTier === 'MED'
                                  ? 'text-[#B54708]'
                                  : 'text-[#B42318]'
                              }`}
                            >
                              {opt.confidenceTier} ({opt.confidenceScore}%)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[#535862]">
                            <span>Freq: every {opt.frequencyMinutes}m</span>
                            <span>•</span>
                            <span className="text-[#17B26A] font-medium">{opt.ecoRating}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Map & Selected Details Panel */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Interactive UP Transit Map Card */}
              <div className="bg-white rounded-2xl border border-[#E9EAEB] overflow-hidden shadow-sm flex flex-col h-[480px]">
                {/* Map Control Bar */}
                <div className="px-4 py-3 bg-white border-b border-[#E9EAEB] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#4F37FD]" />
                    <span className="text-xs font-bold text-[#181D27]">
                      Live UP Vehicle Telemetry (Lucknow • Kanpur • Unnao)
                    </span>
                    <span className="text-[10px] bg-[#ECFDF3] text-[#067647] font-semibold px-2 py-0.5 rounded-full">
                      {vehicles.length} Active Fleets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRecenterMap(26.8467, 80.9462, 12)}
                      className="text-xs font-semibold text-[#4F37FD] hover:underline flex items-center gap-1"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Center Lucknow
                    </button>
                    <button
                      onClick={() => handleRecenterMap(26.4538, 80.3512, 12)}
                      className="text-xs font-semibold text-[#535862] hover:text-[#181D27]"
                    >
                      Kanpur
                    </button>
                  </div>
                </div>

                {/* Leaflet Map Canvas */}
                <div className="flex-1 w-full relative">
                  <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
                  
                  {/* Map Legend Overlay */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-[#E9EAEB] shadow-md z-[1000] text-[11px] flex flex-col gap-1">
                    <div className="font-bold text-[#181D27] mb-0.5">Live Fleets Legend</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
                      <span>UPSRTC Janrath Bus</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#17B26A]"></span>
                      <span>Lucknow City E-Bus (AC)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4F37FD]"></span>
                      <span>CNG Auto (Vikram)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0891B2]"></span>
                      <span>Toto E-Rickshaw</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Trip Option / Vehicle Telemetry Card */}
              {selectedOption && (
                <div className="bg-white rounded-2xl p-5 border border-[#E9EAEB] shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E9EAEB]">
                    <div>
                      <div className="text-xs font-semibold text-[#535862]">Selected Transit Route</div>
                      <h4 className="text-base font-bold text-[#181D27] flex items-center gap-2">
                        {comparison?.origin.name} <ArrowRight className="w-4 h-4 text-[#4F37FD]" />{' '}
                        {comparison?.dest.name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-[#717680]">Total Fare</div>
                      <div className="text-xl font-extrabold text-[#4F37FD]">
                        ₹{selectedOption.estimatedFareInr}
                      </div>
                    </div>
                  </div>

                  {/* Trip Details Grid */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E9EAEB]">
                      <div className="text-[11px] text-[#535862]">Corridor Mode</div>
                      <div className="text-xs font-bold text-[#181D27] mt-0.5">{selectedOption.title}</div>
                    </div>

                    <div className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E9EAEB]">
                      <div className="text-[11px] text-[#535862]">Arrival ETA</div>
                      <div className="text-xs font-bold text-[#181D27] mt-0.5">{selectedOption.etaDisplay}</div>
                    </div>

                    <div className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E9EAEB]">
                      <div className="text-[11px] text-[#535862]">Crowd Level</div>
                      <div className="text-xs font-bold text-[#181D27] mt-0.5">
                        {selectedOption.crowdLevel} ({selectedOption.crowdPercent}%)
                      </div>
                    </div>

                    <div className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E9EAEB]">
                      <div className="text-[11px] text-[#535862]">Carbon Saved</div>
                      <div className="text-xs font-bold text-[#17B26A] mt-0.5">
                        {selectedOption.carbonKg} kg CO₂
                      </div>
                    </div>
                  </div>

                  {/* Fare Breakdown Breakdown (UP Government Compliant) */}
                  <div className="mt-4 bg-[#F5F5F5] p-3.5 rounded-xl border border-[#E9EAEB] flex flex-wrap items-center justify-between text-xs gap-3">
                    <div>
                      <span className="text-[#535862]">Base Flagdown:</span>{' '}
                      <span className="font-semibold text-[#181D27]">₹{selectedOption.fareBreakdown.base}</span>
                    </div>
                    <div>
                      <span className="text-[#535862]">Distance Charge:</span>{' '}
                      <span className="font-semibold text-[#181D27]">₹{selectedOption.fareBreakdown.distanceCharge}</span>
                    </div>
                    <div>
                      <span className="text-[#535862]">GST (UP State):</span>{' '}
                      <span className="font-semibold text-[#181D27]">₹{selectedOption.fareBreakdown.cgstUpgst}</span>
                    </div>
                    <div className="text-[#067647] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      UPSRTC / LCTSL Fare Grid
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ROCKETRIDE .PIPE VISUAL STUDIO */}
        {/* ========================================================================= */}
        {activeTab === 'pipelines' && (
          <div className="lg:col-span-12 flex flex-col gap-6">
            {/* Top Pipeline Selector Banner */}
            <div className="bg-white rounded-2xl p-6 border border-[#E9EAEB] shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#EBEAFF] text-[#402DCE] font-mono text-xs font-bold px-2.5 py-1 rounded-md">
                      .pipe Engine v2.4
                    </span>
                    <h2 className="text-xl font-bold text-[#181D27]">RocketRide.AI Visual Pipelines</h2>
                  </div>
                  <p className="text-xs text-[#535862] mt-1">
                    Direct visual execution graphs for Uttar Pradesh transit telemetry, real-time deep learning inference, and safety fallback sentinels.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const nextAnomaly = !anomalySimulation
                      setAnomalySimulation(nextAnomaly)
                      fetchPipeTrace(activePipeId, nextAnomaly)
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      anomalySimulation
                        ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                        : 'bg-white border-[#E9EAEB] text-[#535862] hover:border-[#D5D7DA]'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {anomalySimulation ? 'Simulated Anomaly Active' : 'Inject Telemetry Conflict'}
                  </button>

                  <button
                    onClick={() => fetchPipeTrace(activePipeId, anomalySimulation)}
                    disabled={simulatingPipe}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#4F37FD] text-white hover:bg-[#4832E7] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${simulatingPipe ? 'animate-spin' : ''}`} />
                    Run .pipe Execution
                  </button>
                </div>
              </div>

              {/* Three Pipeline Selection Tabs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                {[
                  {
                    id: 'eta_prediction.pipe' as const,
                    name: 'eta_prediction.pipe',
                    title: 'Live ETA Predictor',
                    desc: 'GPS stream + historical Lucknow/Kanpur corridor congestion + weather deep inference',
                    icon: Clock,
                    color: 'text-[#4F37FD]',
                    tag: 'Inference Node'
                  },
                  {
                    id: 'crowd_estimation.pipe' as const,
                    name: 'crowd_estimation.pipe',
                    title: 'Dynamic Crowd Estimator',
                    desc: 'Automated passenger counts, axle weight telemetry, and dwell-time multipliers',
                    icon: Users,
                    color: 'text-[#17B26A]',
                    tag: 'Occupancy Flow'
                  },
                  {
                    id: 'anomaly_detection.pipe' as const,
                    name: 'anomaly_detection.pipe',
                    title: 'Safety & Anomaly Sentinel',
                    desc: 'Route deviations, GPS freeze flags, and automatic Trust Fallback triggers',
                    icon: ShieldCheck,
                    color: 'text-[#F79009]',
                    tag: 'Sentinel Gate'
                  }
                ].map(pipe => {
                  const IconComp = pipe.icon
                  const active = activePipeId === pipe.id
                  return (
                    <div
                      key={pipe.id}
                      onClick={() => {
                        setActivePipeId(pipe.id)
                        fetchPipeTrace(pipe.id, anomalySimulation)
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#F3F3FF] border-[#4F37FD] ring-2 ring-[#4F37FD]/20 shadow-sm'
                          : 'bg-[#FAFAFA] border-[#E9EAEB] hover:border-[#D5D7DA]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#181D27]">{pipe.name}</span>
                        <span className="text-[10px] font-semibold bg-white border border-[#E9EAEB] px-2 py-0.5 rounded-full text-[#535862]">
                          {pipe.tag}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-[#181D27] mt-1.5 flex items-center gap-1.5">
                        <IconComp className={`w-4 h-4 ${pipe.color}`} />
                        {pipe.title}
                      </div>
                      <p className="text-[11px] text-[#535862] mt-1 leading-snug">{pipe.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Visual Node Graph View */}
            {pipeTrace && (
              <div className="bg-white rounded-2xl p-6 border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E9EAEB]">
                  <div>
                    <span className="text-xs font-semibold text-[#535862]">Active Visual Execution Trace</span>
                    <h3 className="text-base font-bold text-[#181D27] font-mono">{pipeTrace.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-[#717680]">Execution Latency</div>
                      <div className="text-xs font-mono font-bold text-[#181D27]">{pipeTrace.latencyMs} ms</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        pipeTrace.status === 'SUCCESS'
                          ? 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]'
                          : pipeTrace.status === 'WARNING_FALLBACK'
                          ? 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'
                          : 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]'
                      }`}
                    >
                      {pipeTrace.status}
                    </span>
                  </div>
                </div>

                {/* Node Flow Nodes */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                  {pipeTrace.nodes.map((node: any, idx: number) => {
                    const isLast = idx === pipeTrace.nodes.length - 1
                    return (
                      <React.Fragment key={node.nodeId}>
                        <div className="flex-1 bg-[#FAFAFA] rounded-2xl p-4 border border-[#E9EAEB] shadow-sm flex flex-col justify-between relative group hover:border-[#4F37FD] transition-all">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono font-bold text-[#535862] uppercase">
                                {node.type}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  node.status === 'PASS'
                                    ? 'bg-[#ECFDF3] text-[#067647]'
                                    : node.status === 'FALLBACK'
                                    ? 'bg-[#FEF3F2] text-[#B42318]'
                                    : 'bg-[#FFFAEB] text-[#B54708]'
                                }`}
                              >
                                {node.status}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-[#181D27] mb-2">{node.title}</h4>

                            {/* Node Input and Output inspect */}
                            <div className="space-y-1.5 text-[11px] font-mono bg-white p-2 rounded-lg border border-[#E9EAEB]">
                              <div className="text-[#535862]">
                                <span className="text-[#4F37FD] font-semibold">in:</span>{' '}
                                {JSON.stringify(node.inputs).slice(0, 42)}...
                              </div>
                              <div className="text-[#535862]">
                                <span className="text-[#17B26A] font-semibold">out:</span>{' '}
                                {JSON.stringify(node.outputs).slice(0, 42)}...
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-[#E9EAEB] flex items-center justify-between text-[10px]">
                            <span className="text-[#717680]">Node Confidence</span>
                            <span className="font-bold text-[#181D27]">{node.confidence}%</span>
                          </div>
                        </div>

                        {!isLast && (
                          <div className="hidden lg:flex items-center justify-center text-[#A4A7AE]">
                            <ArrowRight className="w-5 h-5 text-[#4F37FD]" />
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Final Output Console */}
                <div className="mt-6 bg-[#181D27] rounded-xl p-4 text-white font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#373A41] mb-2">
                    <span className="text-[#94979C]">RocketRide Engine Consolidated Stream</span>
                    <span className="text-[#2CCD9A]">Status: Active</span>
                  </div>
                  <pre className="text-[#CECFD2] overflow-x-auto text-[11px]">
                    {JSON.stringify(pipeTrace.finalOutput, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: OPERATOR SAAS B2B DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'operator' && (
          <div className="lg:col-span-12 flex flex-col gap-6">
            {/* Operator KPI Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-[#535862]">
                  <span>Active Fleet Strength</span>
                  <Bus className="w-4 h-4 text-[#4F37FD]" />
                </div>
                <div className="text-2xl font-bold text-[#181D27] mt-2">
                  {operatorSummary?.totalVehicles || vehicles.length}
                </div>
                <div className="text-[11px] text-[#17B26A] mt-1 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {operatorSummary?.activeOnRoute || vehicles.filter(v => v.status === 'on_route').length} On Scheduled Route
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-[#535862]">
                  <span>Delayed / Anomalies</span>
                  <AlertTriangle className="w-4 h-4 text-[#F04438]" />
                </div>
                <div className="text-2xl font-bold text-[#F04438] mt-2">
                  {operatorSummary?.delayedVehicles || vehicles.filter(v => v.isAnomaly).length}
                </div>
                <div className="text-[11px] text-[#B42318] mt-1 font-medium">
                  Corridor Bottleneck Flagged
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-[#535862]">
                  <span>Active Commuter Demand</span>
                  <Users className="w-4 h-4 text-[#17B26A]" />
                </div>
                <div className="text-2xl font-bold text-[#181D27] mt-2">
                  {operatorSummary?.activePassengers || 215}
                </div>
                <div className="text-[11px] text-[#535862] mt-1">Avg Occupancy: 68%</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E9EAEB] shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-[#535862]">
                  <span>RocketRide AI Trust</span>
                  <ShieldCheck className="w-4 h-4 text-[#4F37FD]" />
                </div>
                <div className="text-2xl font-bold text-[#181D27] mt-2">
                  {operatorSummary?.avgConfidence || 94}%
                </div>
                <div className="text-[11px] text-[#17B26A] mt-1 font-medium">Telemetry Validated</div>
              </div>
            </div>

            {/* Demand Hotspots & Surge Analysis Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E9EAEB] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#181D27] flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#F79009]" />
                    Real-time Uttar Pradesh Commuter Demand Hotspots
                  </h3>
                  <p className="text-xs text-[#535862]">
                    High-volume transit nodes requiring dynamic vehicle dispatch & fleet rebalancing
                  </p>
                </div>
                <span className="text-[11px] bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89] px-2.5 py-1 rounded-full font-semibold">
                  Live PostGIS Spatial Feeds
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {hotspots.map((spot, i) => (
                  <div key={i} className="bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E9EAEB] flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#181D27]">{spot.name}</div>
                      <div className="text-[11px] text-[#535862]">{spot.district}</div>
                      <div className="mt-2 text-xs font-semibold text-[#D97706]">{spot.demandLevel}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#E9EAEB] text-[11px] text-[#535862]">
                      <div>Wait: ~{spot.waitTimeMin} mins</div>
                      <div className="text-[10px] text-[#717680] mt-0.5 truncate">{spot.primaryMode}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Vehicle Telemetry & Fleet Table */}
            <div className="bg-white rounded-2xl border border-[#E9EAEB] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#E9EAEB] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#181D27]">Real-time Fleet Operations & Delay Sentinel</h3>
                  <p className="text-xs text-[#535862]">
                    Monitor government (UPSRTC, LCTSL) and private fleets in Lucknow, Unnao & Kanpur
                  </p>
                </div>

                {/* Operator Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                    { id: 'all', label: 'All Fleets' },
                    { id: 'delayed', label: 'Delayed / Flagged' },
                    { id: 'upsrtc', label: 'UPSRTC' },
                    { id: 'electric', label: 'Electric EV / Toto' },
                    { id: 'auto', label: 'Vikram Tempo' }
                  ].map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setOperatorFilter(filter.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        operatorFilter === filter.id
                          ? 'bg-[#4F37FD] text-white'
                          : 'bg-[#F5F5F5] text-[#535862] hover:bg-[#E9EAEB]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] border-b border-[#E9EAEB] text-[#535862] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Vehicle / Reg</th>
                      <th className="py-3 px-4">Type & Operator</th>
                      <th className="py-3 px-4">Corridor Route</th>
                      <th className="py-3 px-4">Speed & GPS</th>
                      <th className="py-3 px-4">Crowd / Cap</th>
                      <th className="py-3 px-4">AI Trust Score</th>
                      <th className="py-3 px-4">Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9EAEB]">
                    {filteredVehiclesForOperator.map(v => (
                      <tr key={v.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 px-4 font-bold text-[#181D27]">
                          <div>{v.regNumber}</div>
                          <div className="text-[10px] text-[#717680] font-normal">Driver: {v.driverName}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#181D27]">{v.typeName}</div>
                          <div className="text-[10px] text-[#535862]">{v.operator}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-[#181D27]">{v.routeName}</div>
                          <div className="text-[10px] text-[#717680] font-mono">{v.routeCode}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#181D27]">{v.speedKmh} km/h</div>
                          <div className="text-[10px] text-[#717680]">Ping: {v.lastGpsPingAgoSec}s ago</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#181D27]">
                            {v.passengers} / {v.capacity} ({v.crowdPercent}%)
                          </div>
                          <div className="w-16 h-1.5 bg-[#E9EAEB] rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                v.crowdPercent > 80 ? 'bg-[#F04438]' : v.crowdPercent > 50 ? 'bg-[#F79009]' : 'bg-[#17B26A]'
                              }`}
                              style={{ width: `${v.crowdPercent}%` }}
                            ></div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              v.confidence === 'HIGH'
                                ? 'text-[#067647]'
                                : v.confidence === 'MED'
                                ? 'text-[#B54708]'
                                : 'text-[#B42318]'
                            }`}
                          >
                            {v.confidence} ({v.confidenceScore}%)
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {v.isAnomaly ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-[#B42318] font-bold">
                                ⚠ {v.anomalyReason || 'Delayed'}
                              </span>
                              <button
                                onClick={() => handleResolveAnomaly(v.id)}
                                className="px-2.5 py-1 bg-[#4F37FD] text-white rounded text-[10px] font-semibold hover:bg-[#4832E7] transition-all self-start"
                              >
                                Resolve & Reroute
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#067647] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              On Schedule
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E9EAEB] py-4 px-6 text-center text-xs text-[#535862] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <div>
            <strong>TRU-ROUTE</strong> — Uttar Pradesh Transit Intelligence Platform powered by <strong>RocketRide.AI</strong> & PostGIS
          </div>
          <div className="flex items-center gap-4 text-[#717680]">
            <span>Lucknow • Kanpur • Unnao</span>
            <span>•</span>
            <span>UPSRTC & LCTSL Integration</span>
            <span>•</span>
            <span>Zero-Fabrication Data Standard</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
