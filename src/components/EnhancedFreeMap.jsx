import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { 
  Search, 
  Navigation, 
  MapPin, 
  Layers, 
  Car, 
  User, 
  Bike, 
  Bus, 
  Eye, 
  X, 
  Route,
  Zap,
  Globe,
  Map as MapIcon,
  Mountain,
  Building,
  ExternalLink,
  Clock,
  MapPinIcon,
  ArrowRight
} from 'lucide-react'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom icons for different marker types
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

const startIcon = createCustomIcon('#22c55e') // Green
const endIcon = createCustomIcon('#ef4444')   // Red
const waypointIcon = createCustomIcon('#3b82f6') // Blue

// Component to handle routing and directions
function RoutingControl({ fromCoords, toCoords, travelMode, onRouteFound, onError }) {
  const map = useMap()
  
  useEffect(() => {
    if (!fromCoords || !toCoords) return

    const getRoute = async () => {
      try {
        // Try OpenRouteService first (with API key for better limits)
        const orsProfile = {
          'DRIVING': 'driving-car',
          'WALKING': 'foot-walking',
          'BICYCLING': 'cycling-regular',
          'TRANSIT': 'driving-car' // Fallback to driving for transit
        }[travelMode] || 'driving-car'

        // First try OSRM (free, no API key needed)
        const osrmProfile = {
          'DRIVING': 'car',
          'WALKING': 'foot',
          'BICYCLING': 'bike',
          'TRANSIT': 'car'
        }[travelMode] || 'car'

        const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson&steps=true`
        
        const response = await fetch(osrmUrl)
        const data = await response.json()
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0]
          const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]])
          
          // Extract turn-by-turn instructions
          const instructions = []
          if (route.legs && route.legs[0] && route.legs[0].steps) {
            route.legs[0].steps.forEach((step, index) => {
              if (step.maneuver && step.maneuver.instruction) {
                instructions.push({
                  instruction: step.maneuver.instruction,
                  distance: step.distance,
                  duration: step.duration,
                  type: step.maneuver.type
                })
              }
            })
          }
          
          onRouteFound({
            coordinates,
            distance: route.distance,
            duration: route.duration,
            instructions
          })
        } else {
          throw new Error('No route found')
        }
      } catch (error) {
        console.error('OSRM routing failed, trying OpenRouteService:', error)
        
        // Fallback to OpenRouteService (requires API key but has free tier)
        try {
          const orsUrl = `https://api.openrouteservice.org/v2/directions/${orsProfile}`
          const orsResponse = await fetch(orsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Note: For production, you'd need to get a free API key from openrouteservice.org
              // 'Authorization': 'YOUR_ORS_API_KEY'
            },
            body: JSON.stringify({
              coordinates: [[fromCoords[1], fromCoords[0]], [toCoords[1], toCoords[0]]],
              format: 'geojson',
              instructions: true
            })
          })
          
          if (!orsResponse.ok) {
            throw new Error('OpenRouteService API key required')
          }
          
          const orsData = await orsResponse.json()
          
          if (orsData.features && orsData.features.length > 0) {
            const feature = orsData.features[0]
            const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]])
            
            onRouteFound({
              coordinates,
              distance: feature.properties.summary.distance,
              duration: feature.properties.summary.duration,
              instructions: feature.properties.segments[0].steps.map(step => ({
                instruction: step.instruction,
                distance: step.distance,
                duration: step.duration,
                type: step.type
              }))
            })
          }
        } catch (orsError) {
          onError('Unable to calculate route. OSRM failed and OpenRouteService requires API key for full functionality.')
        }
      }
    }

    getRoute()
  }, [fromCoords, toCoords, travelMode, onRouteFound, onError])

  return null
}

// Geocoding component for address search
function GeocodingControl({ query, onLocationFound, onError }) {
  useEffect(() => {
    if (!query || query.length < 3) return

    const geocode = async () => {
      try {
        // Use Nominatim (free OpenStreetMap geocoding service)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        )
        const data = await response.json()
        
        if (data && data.length > 0) {
          const results = data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            type: item.type,
            importance: item.importance
          }))
          onLocationFound(results)
        } else {
          onError('No locations found')
        }
      } catch (error) {
        onError('Geocoding failed: ' + error.message)
      }
    }

    const timeoutId = setTimeout(geocode, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [query, onLocationFound, onError])

  return null
}

const EnhancedFreeMap = () => {
  const mapRef = useRef(null)
  
  // Search and location states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  
  // Routing states
  const [directionsPanel, setDirectionsPanel] = useState(false)
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [fromCoords, setFromCoords] = useState(null)
  const [toCoords, setToCoords] = useState(null)
  const [travelMode, setTravelMode] = useState('DRIVING')
  const [routeData, setRouteData] = useState(null)
  const [routeInstructions, setRouteInstructions] = useState([])
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [routeError, setRouteError] = useState('')
  
  // Map display states
  const [mapType, setMapType] = useState('openstreetmap')
  const [markers, setMarkers] = useState([])
  const [center, setCenter] = useState([40.7128, -74.0060]) // New York City
  const [zoom, setZoom] = useState(13)

  // Available map tile layers
  const mapLayers = {
    openstreetmap: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      name: 'Street Map'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      name: 'Satellite'
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
      name: 'Terrain'
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      name: 'Dark'
    }
  }

  // Handle search results
  const handleLocationFound = useCallback((results) => {
    setSearchResults(results)
    // Ensure search results are shown with a small delay to prevent flickering
    setTimeout(() => {
      setShowSearchResults(true)
    }, 100)
  }, [])

  const handleSearchError = useCallback((error) => {
    console.error('Search error:', error)
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

  // Handle search result selection
  const selectSearchResult = (result) => {
    console.log('🎯 Selecting location:', result.name, 'at', result.lat, result.lon)
    
    // Update map center and zoom
    setCenter([result.lat, result.lon])
    setZoom(15)
    
    // Add marker for selected location
    setMarkers([{
      id: Date.now(),
      position: [result.lat, result.lon],
      popup: result.name,
      icon: waypointIcon
    }])
    
    // Force map to update view if mapRef is available
    if (mapRef.current) {
      console.log('🗺️ Forcing map view update')
      mapRef.current.setView([result.lat, result.lon], 15)
    }
    
    // Clear search state
    setShowSearchResults(false)
    setSearchQuery('')
    setSearchResults([])
  }

  // Robust geocoding with multiple fallback services
  const geocodeLocation = async (location) => {
    const services = [
      // Primary: Nominatim (OpenStreetMap)
      {
        name: 'Nominatim',
        url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=3&addressdetails=1`,
        parse: (data) => {
          if (data && data.length > 0) {
            return data.map(item => ({
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              name: item.display_name,
              importance: parseFloat(item.importance || 0)
            })).sort((a, b) => b.importance - a.importance)
          }
          return null
        }
      },
      // Backup: Photon (Another OSM-based service)
      {
        name: 'Photon',
        url: `https://photon.komoot.io/api/?q=${encodeURIComponent(location)}&limit=3`,
        parse: (data) => {
          if (data && data.features && data.features.length > 0) {
            return data.features.map(feature => ({
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0],
              name: feature.properties.name || feature.properties.street || 'Unknown location',
              importance: 1
            }))
          }
          return null
        }
      },
      // Backup: MapBox Geocoding (free tier)
      {
        name: 'MapBox',
        url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw&limit=3`,
        parse: (data) => {
          if (data && data.features && data.features.length > 0) {
            return data.features.map(feature => ({
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0],
              name: feature.place_name,
              importance: feature.relevance || 1
            }))
          }
          return null
        }
      }
    ]

    let lastError = null
    
    for (const service of services) {
      try {
        console.log(`Trying geocoding with ${service.name}...`)
        
        const response = await fetch(service.url, {
          headers: {
            'User-Agent': 'Jitsi-Map-App/1.0'
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        const results = service.parse(data)
        
        if (results && results.length > 0) {
          console.log(`✅ ${service.name} found ${results.length} results`)
          return results
        }
        
        console.log(`❌ ${service.name} found no results`)
        
      } catch (error) {
        console.log(`❌ ${service.name} failed:`, error.message)
        lastError = error
        continue
      }
    }
    
    // If all services failed
    throw new Error(`All geocoding services failed. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  // Enhanced location search with better error handling
  const handleLocationSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      console.log(`🔍 Searching for: "${query}"`)
      const results = await geocodeLocation(query)
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} locations`)
        setSearchResults(results)
        setTimeout(() => {
          setShowSearchResults(true)
        }, 100)
      } else {
        console.log(`❌ No locations found for: "${query}"`)
        setSearchResults([])
        setShowSearchResults(false)
      }
      
    } catch (error) {
      console.error('❌ Search failed:', error.message)
      setSearchResults([])
      setShowSearchResults(false)
      
      // Show user-friendly error message
      alert(`Search failed: ${error.message}. Please try a different search term.`)
    }
  }

  // Geocode location for routing (single result)
  const geocodeLocationForRouting = async (location) => {
    try {
      const results = await geocodeLocation(location)
      if (results && results.length > 0) {
        return [results[0].lat, results[0].lon]
      }
      throw new Error('Location not found')
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`)
    }
  }

  // Handle route calculation
  const handleDirections = async () => {
    if (!fromLocation || !toLocation) {
      setRouteError('Please enter both from and to locations')
      return
    }

    setIsCalculatingRoute(true)
    setRouteError('')
    
    try {
      const fromCoordinates = await geocodeLocationForRouting(fromLocation)
      const toCoordinates = await geocodeLocationForRouting(toLocation)
      
      setFromCoords(fromCoordinates)
      setToCoords(toCoordinates)
      
      // Update markers
      setMarkers([
        {
          id: 'start',
          position: fromCoordinates,
          popup: `Start: ${fromLocation}`,
          icon: startIcon
        },
        {
          id: 'end',
          position: toCoordinates,
          popup: `End: ${toLocation}`,
          icon: endIcon
        }
      ])
      
      // Fit map to show both points
      const bounds = L.latLngBounds([fromCoordinates, toCoordinates])
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] })
      }
      
    } catch (error) {
      setRouteError(error.message)
      setIsCalculatingRoute(false)
    }
  }

  // Handle route found
  const handleRouteFound = useCallback((route) => {
    setRouteData(route)
    setRouteInstructions(route.instructions || [])
    setIsCalculatingRoute(false)
  }, [])

  // Handle route error
  const handleRouteError = useCallback((error) => {
    setRouteError(error)
    setIsCalculatingRoute(false)
  }, [])

  // Clear route and directions
  const clearDirections = () => {
    setFromLocation('')
    setToLocation('')
    setFromCoords(null)
    setToCoords(null)
    setRouteData(null)
    setRouteInstructions([])
    setRouteError('')
    setMarkers([])
  }

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Format distance
  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`
    }
    return `${Math.round(meters)} m`
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <MapContainer
        key={`${center[0]}-${center[1]}-${zoom}`}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution={mapLayers[mapType].attribution}
          url={mapLayers[mapType].url}
        />
        
        {/* Markers */}
        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            position={marker.position}
            icon={marker.icon || undefined}
          >
            <Popup>{marker.popup}</Popup>
          </Marker>
        ))}
        
        {/* Route Line */}
        {routeData && (
          <Polyline 
            positions={routeData.coordinates} 
            color="#2563eb" 
            weight={5}
            opacity={0.7}
          />
        )}
        
        {/* Geocoding Control */}
        <GeocodingControl
          query={searchQuery}
          onLocationFound={handleLocationFound}
          onError={handleSearchError}
        />
        
        {/* Routing Control */}
        {fromCoords && toCoords && (
          <RoutingControl
            fromCoords={fromCoords}
            toCoords={toCoords}
            travelMode={travelMode}
            onRouteFound={handleRouteFound}
            onError={handleRouteError}
          />
        )}
      </MapContainer>
      
      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm" style={{zIndex: 1000}}>
        {/* Search */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value
                setSearchQuery(value)
                
                // Debounced search - trigger search after user stops typing
                clearTimeout(window.searchTimeout)
                window.searchTimeout = setTimeout(() => {
                  handleLocationSearch(value)
                }, 500)
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={() => {
                if (searchQuery.trim()) {
                  // Trigger search when button is clicked
                  handleLocationSearch(searchQuery.trim())
                } else {
                  // Clear search if empty
                  setSearchQuery('')
                  setSearchResults([])
                  setShowSearchResults(false)
                }
              }}
              className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {/* Map Type Controls */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Map Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMapType('openstreetmap')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'openstreetmap' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MapIcon size={16} />
              Street
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Globe size={16} />
              Satellite
            </button>
            <button
              onClick={() => setMapType('terrain')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'terrain' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Mountain size={16} />
              Terrain
            </button>
            <button
              onClick={() => setMapType('dark')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'dark' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Layers size={16} />
              Dark
            </button>
          </div>
        </div>

        {/* Feature Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => setDirectionsPanel(!directionsPanel)}
            className="flex items-center gap-2 w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            <Navigation size={16} />
            Directions
          </button>
        </div>

        {/* Free Service Info */}
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 text-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs font-medium">100% FREE</span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Powered by OpenStreetMap & OSRM - No API costs ever!
          </p>
        </div>
      </div>

      {/* Search Results */}
      {showSearchResults && searchResults.length > 0 && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-h-60 overflow-y-auto" style={{zIndex: 1000}}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Search Results</h3>
            <button
              onClick={() => setShowSearchResults(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => selectSearchResult(result)}
                className="w-full text-left p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm">{result.name.split(',')[0]}</div>
                <div className="text-xs text-gray-600 truncate">{result.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Directions Panel */}
      {directionsPanel && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-96 max-h-80 overflow-y-auto" style={{zIndex: 1000}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Free Turn-by-Turn Directions</h3>
            <button
              onClick={() => setDirectionsPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="From..."
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="To..."
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setTravelMode('DRIVING')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'DRIVING' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <Car size={16} />
                Drive
              </button>
              <button
                onClick={() => setTravelMode('WALKING')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'WALKING' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <User size={16} />
                Walk
              </button>
              <button
                onClick={() => setTravelMode('BICYCLING')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'BICYCLING' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <Bike size={16} />
                Bike
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDirections}
                disabled={isCalculatingRoute}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isCalculatingRoute ? 'Calculating...' : 'Get Directions'}
              </button>
              <button
                onClick={clearDirections}
                className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
          
          {/* Route Summary */}
          {routeData && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <Route size={16} />
                <span className="font-medium">Route Summary</span>
              </div>
              <div className="text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{formatDuration(routeData.duration)}</span>
                  <span>•</span>
                  <span>{formatDistance(routeData.distance)}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Turn-by-Turn Instructions */}
          {routeInstructions.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Turn-by-Turn Directions</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {routeInstructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                    <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm">{instruction.instruction}</div>
                      {instruction.distance > 0 && (
                        <div className="text-xs text-gray-600">
                          {formatDistance(instruction.distance)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {routeError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800 text-sm">{routeError}</div>
            </div>
          )}
          
          {/* Free Service Info */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              ✅ <strong>Completely FREE</strong> routing powered by:
              <br />• OSRM (Open Source Routing Machine)
              <br />• OpenStreetMap data
              <br />• No API limits or costs
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedFreeMap

