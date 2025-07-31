import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Search, 
  Navigation, 
  MapPin, 
  Layers, 
  Car, 
  Walking, 
  Bike, 
  Bus, 
  Eye, 
  X, 
  Route,
  Traffic,
  Satellite,
  Map as MapIcon,
  Mountain,
  Building
} from 'lucide-react'

const GoogleMapWithFeatures = () => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const placesServiceRef = useRef(null)
  const streetViewRef = useRef(null)
  const trafficLayerRef = useRef(null)
  const transitLayerRef = useRef(null)
  const bicyclingLayerRef = useRef(null)
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [directionsPanel, setDirectionsPanel] = useState(false)
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [travelMode, setTravelMode] = useState('DRIVING')
  const [mapType, setMapType] = useState('roadmap')
  const [showTraffic, setShowTraffic] = useState(false)
  const [showTransit, setShowTransit] = useState(false)
  const [showBicycling, setShowBicycling] = useState(false)
  const [streetViewMode, setStreetViewMode] = useState(false)
  const [placesResults, setPlacesResults] = useState([])
  const [showPlaces, setShowPlaces] = useState(false)

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places,geometry,drawing&callback=initMap`
    script.async = true
    script.defer = true
    
    window.initMap = () => {
      setIsLoaded(true)
    }
    
    document.head.appendChild(script)
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
      delete window.initMap
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40.7128, lng: -74.0060 }, // New York City
      zoom: 13,
      mapTypeId: mapType,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      scaleControl: true,
    })

    mapInstanceRef.current = map
    directionsServiceRef.current = new window.google.maps.DirectionsService()
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      draggable: true,
      panel: document.getElementById('directions-panel')
    })
    directionsRendererRef.current.setMap(map)
    
    placesServiceRef.current = new window.google.maps.places.PlacesService(map)
    
    // Initialize Street View
    streetViewRef.current = map.getStreetView()
    
    // Initialize layers
    trafficLayerRef.current = new window.google.maps.TrafficLayer()
    transitLayerRef.current = new window.google.maps.TransitLayer()
    bicyclingLayerRef.current = new window.google.maps.BicyclingLayer()

    // Add click listener for Street View
    map.addListener('click', (event) => {
      if (streetViewMode) {
        const streetViewService = new window.google.maps.StreetViewService()
        streetViewService.getPanorama({
          location: event.latLng,
          radius: 50
        }, (data, status) => {
          if (status === 'OK') {
            streetViewRef.current.setPosition(event.latLng)
            streetViewRef.current.setVisible(true)
          }
        })
      }
    })

  }, [isLoaded, mapType])

  // Handle map type changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapType)
    }
  }, [mapType])

  // Handle traffic layer
  useEffect(() => {
    if (trafficLayerRef.current) {
      if (showTraffic) {
        trafficLayerRef.current.setMap(mapInstanceRef.current)
      } else {
        trafficLayerRef.current.setMap(null)
      }
    }
  }, [showTraffic])

  // Handle transit layer
  useEffect(() => {
    if (transitLayerRef.current) {
      if (showTransit) {
        transitLayerRef.current.setMap(mapInstanceRef.current)
      } else {
        transitLayerRef.current.setMap(null)
      }
    }
  }, [showTransit])

  // Handle bicycling layer
  useEffect(() => {
    if (bicyclingLayerRef.current) {
      if (showBicycling) {
        bicyclingLayerRef.current.setMap(mapInstanceRef.current)
      } else {
        bicyclingLayerRef.current.setMap(null)
      }
    }
  }, [showBicycling])

  const handleSearch = useCallback(() => {
    if (!searchQuery || !mapInstanceRef.current || !placesServiceRef.current) return

    const request = {
      query: searchQuery,
      fields: ['name', 'geometry', 'formatted_address', 'place_id']
    }

    placesServiceRef.current.textSearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const place = results[0]
        mapInstanceRef.current.setCenter(place.geometry.location)
        mapInstanceRef.current.setZoom(15)
        
        new window.google.maps.Marker({
          position: place.geometry.location,
          map: mapInstanceRef.current,
          title: place.name
        })
      }
    })
  }, [searchQuery])

  const handleDirections = useCallback(() => {
    if (!fromLocation || !toLocation || !directionsServiceRef.current) return

    const request = {
      origin: fromLocation,
      destination: toLocation,
      travelMode: window.google.maps.TravelMode[travelMode]
    }

    directionsServiceRef.current.route(request, (result, status) => {
      if (status === 'OK') {
        directionsRendererRef.current.setDirections(result)
      }
    })
  }, [fromLocation, toLocation, travelMode])

  const searchNearbyPlaces = useCallback((type) => {
    if (!mapInstanceRef.current || !placesServiceRef.current) return

    const request = {
      location: mapInstanceRef.current.getCenter(),
      radius: 5000,
      type: [type]
    }

    placesServiceRef.current.nearbySearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        setPlacesResults(results.slice(0, 10))
        setShowPlaces(true)
        
        // Add markers for places
        results.slice(0, 10).forEach(place => {
          new window.google.maps.Marker({
            position: place.geometry.location,
            map: mapInstanceRef.current,
            title: place.name,
            icon: {
              url: place.icon,
              scaledSize: new window.google.maps.Size(20, 20)
            }
          })
        })
      }
    })
  }, [])

  const clearDirections = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] })
    }
    setFromLocation('')
    setToLocation('')
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Google Maps...</p>
          <p className="text-sm text-red-500 mt-2">Note: Requires valid Google Maps API key</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapRef} className="h-full w-full" />
      
      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
        {/* Search */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleSearch}
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
              onClick={() => setMapType('roadmap')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'roadmap' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MapIcon size={16} />
              Road
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Satellite size={16} />
              Satellite
            </button>
            <button
              onClick={() => setMapType('hybrid')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                mapType === 'hybrid' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Layers size={16} />
              Hybrid
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
          </div>
        </div>

        {/* Layer Controls */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Layers</label>
          <div className="space-y-2">
            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm ${
                showTraffic ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Traffic size={16} />
              Traffic
            </button>
            <button
              onClick={() => setShowTransit(!showTransit)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm ${
                showTransit ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Bus size={16} />
              Transit
            </button>
            <button
              onClick={() => setShowBicycling(!showBicycling)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm ${
                showBicycling ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Bike size={16} />
              Bicycling
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
          
          <button
            onClick={() => setStreetViewMode(!streetViewMode)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-md ${
              streetViewMode ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Eye size={16} />
            Street View {streetViewMode && '(Click map)'}
          </button>
        </div>

        {/* Places Search */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Find Nearby</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => searchNearbyPlaces('restaurant')}
              className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm"
            >
              🍽️ Food
            </button>
            <button
              onClick={() => searchNearbyPlaces('gas_station')}
              className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
            >
              ⛽ Gas
            </button>
            <button
              onClick={() => searchNearbyPlaces('hospital')}
              className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
            >
              🏥 Medical
            </button>
            <button
              onClick={() => searchNearbyPlaces('lodging')}
              className="px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-sm"
            >
              🏨 Hotels
            </button>
          </div>
        </div>
      </div>

      {/* Directions Panel */}
      {directionsPanel && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Directions</h3>
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
              </button>
              <button
                onClick={() => setTravelMode('WALKING')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'WALKING' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <Walking size={16} />
              </button>
              <button
                onClick={() => setTravelMode('BICYCLING')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'BICYCLING' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <Bike size={16} />
              </button>
              <button
                onClick={() => setTravelMode('TRANSIT')}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm ${
                  travelMode === 'TRANSIT' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                <Bus size={16} />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDirections}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Get Directions
              </button>
              <button
                onClick={clearDirections}
                className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div id="directions-panel" className="mt-4 max-h-60 overflow-y-auto text-sm"></div>
        </div>
      )}

      {/* Places Results */}
      {showPlaces && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm max-h-60 overflow-y-auto z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Nearby Places</h3>
            <button
              onClick={() => setShowPlaces(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {placesResults.map((place, index) => (
              <div key={index} className="p-2 border border-gray-200 rounded-md">
                <div className="font-medium text-sm">{place.name}</div>
                <div className="text-xs text-gray-600">{place.vicinity}</div>
                <div className="text-xs text-yellow-600">
                  ⭐ {place.rating || 'No rating'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GoogleMapWithFeatures

