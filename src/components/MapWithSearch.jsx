import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-control-geocoder'

// Component to add geocoder to the map
function GeocoderControl() {
  const map = useMap()
  
  useEffect(() => {
    const geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: 'Search for places...',
      errorMessage: 'Nothing found.',
      showResultIcons: true,
      suggestMinLength: 3,
      suggestTimeout: 250,
      queryMinLength: 1
    })
    .on('markgeocode', function(e) {
      const latlng = e.geocode.center
      const name = e.geocode.name
      
      // Clear existing markers
      map.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer)
        }
      })
      
      // Add new marker
      L.marker(latlng)
        .addTo(map)
        .bindPopup(name)
        .openPopup()
      
      // Pan to location
      map.setView(latlng, 15)
    })
    .addTo(map)

    return () => {
      map.removeControl(geocoder)
    }
  }, [map])

  return null
}

function MapWithSearch() {
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeocoderControl />
    </MapContainer>
  )
}

export default MapWithSearch

