import React, { useState } from 'react'
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
  ExternalLink
} from 'lucide-react'

const GoogleMapDemo = () => {
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
  const [showPlaces, setShowPlaces] = useState(false)

  const demoPlaces = [
    { name: "Central Park", vicinity: "New York, NY", rating: 4.6 },
    { name: "Times Square", vicinity: "New York, NY", rating: 4.3 },
    { name: "Brooklyn Bridge", vicinity: "New York, NY", rating: 4.7 },
    { name: "Statue of Liberty", vicinity: "New York, NY", rating: 4.8 },
    { name: "Empire State Building", vicinity: "New York, NY", rating: 4.5 }
  ]

  const handleSearch = () => {
    if (searchQuery) {
      alert(`Demo: Would search for "${searchQuery}" using Google Places API`)
    }
  }

  const handleDirections = () => {
    if (fromLocation && toLocation) {
      alert(`Demo: Would get ${travelMode.toLowerCase()} directions from "${fromLocation}" to "${toLocation}" using Google Directions API`)
    }
  }

  const searchNearbyPlaces = (type) => {
    setShowPlaces(true)
    alert(`Demo: Would search for nearby ${type} using Google Places API`)
  }

  return (
    <div className="relative h-full w-full">
      {/* Demo Map Background */}
      <div className="h-full w-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Google Maps Integration</h2>
          <p className="text-gray-600 mb-4">
            This is a demo of the enhanced Google Maps features. To use the full functionality, you need:
          </p>
          <div className="text-left space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">Google Cloud Console project</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">Maps JavaScript API enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">Valid API key configured</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">Billing account setup</span>
            </div>
          </div>
          <a
            href="https://developers.google.com/maps/documentation/javascript/get-api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <ExternalLink size={16} />
            Get API Key
          </a>
        </div>
      </div>
      
      {/* Control Panel - Fully Functional Demo */}
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
              <Globe size={16} />
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
              <Zap size={16} />
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
            Street View {streetViewMode && '(Demo)'}
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

        {/* Demo Status */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center gap-2 text-yellow-800">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">DEMO MODE</span>
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            All controls are functional but require Google Maps API key for live data
          </p>
        </div>
      </div>

      {/* Directions Panel */}
      {directionsPanel && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Directions (Demo)</h3>
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
                <User size={16} />
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
                onClick={() => {
                  setFromLocation('')
                  setToLocation('')
                }}
                className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm">
              💡 With API key: Turn-by-turn directions, real-time traffic, multiple route options
            </p>
          </div>
        </div>
      )}

      {/* Places Results */}
      {showPlaces && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm max-h-60 overflow-y-auto z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Nearby Places (Demo)</h3>
            <button
              onClick={() => setShowPlaces(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {demoPlaces.map((place, index) => (
              <div key={index} className="p-2 border border-gray-200 rounded-md">
                <div className="font-medium text-sm">{place.name}</div>
                <div className="text-xs text-gray-600">{place.vicinity}</div>
                <div className="text-xs text-yellow-600">
                  ⭐ {place.rating}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-xs">
              💡 With API key: Live data for 200M+ places worldwide
            </p>
          </div>
        </div>
      )}

      {/* Feature Showcase */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
        <h3 className="font-semibold mb-3">🚀 Enhanced Features</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Real-time traffic & transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Street View integration</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Turn-by-turn directions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Places & business search</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Multiple map types</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Bicycling & walking routes</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoogleMapDemo

