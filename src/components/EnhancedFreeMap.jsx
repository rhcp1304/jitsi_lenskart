import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer
} from '@react-google-maps/api';
import { Search, ChevronUp, ChevronLeft } from 'lucide-react'; // Added ChevronLeft

const libraries = ['places'];

const EnhancedFreeMap = () => {
  const mapRef = useRef(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [center, setCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  const [zoom, setZoom] = useState(13);

  const [fromLocation, setFromLocation] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [routeError, setRouteError] = useState('');

  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [showDirectionsForm, setShowDirectionsForm] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyD_lSowigFjpFIOvqnK1dY7Nksqq7089fs',
    libraries,
  });

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);

  useEffect(() => {
    if (isLoaded) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (window.google?.maps?.places?.PlacesService) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(map);
    }
  }, []);

  const getPlacePredictions = useCallback((query, callback) => {
    if (!query || !autocompleteServiceRef.current) {
      callback([]);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'in' } },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          callback(predictions);
        } else {
          callback([]);
        }
      }
    );
  }, []);

  const getPlaceDetails = useCallback((placeId, callback) => {
    if (!placeId || !placesServiceRef.current) {
      callback(null);
      return;
    }
    placesServiceRef.current.getDetails(
      { placeId },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          callback(place);
        } else {
          callback(null);
        }
      }
    );
  }, []);

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    getPlacePredictions(query, (predictions) => {
      setSearchResults(predictions);
      setShowSearchResults(!!predictions.length);
    });
  };

  const selectSearchResult = (placeId) => {
    getPlaceDetails(placeId, (place) => {
      if (place) {
        const location = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setCenter(location);
        setZoom(15);
        setSelectedPlace({ name: place.formatted_address, ...location });
      }
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
    });
  };

  const handleDirections = async () => {
    if (!fromLocation || !selectedPlace) {
      setRouteError('Please enter a starting location.');
      return;
    }
    setRouteError('');
    try {
      const geocoder = new window.google.maps.Geocoder();
      const geocodePromise = (location) => {
        return new Promise((resolve, reject) => {
          geocoder.geocode({ address: location }, (results, status) => {
            if (status === 'OK') {
              resolve(results[0].geometry.location);
            } else {
              reject(new Error(`Geocoding failed for ${location}: ${status}`));
            }
          });
        });
      };

      const origin = await geocodePromise(fromLocation);
      const destination = { lat: selectedPlace.lat, lng: selectedPlace.lng };

      const directionsService = new window.google.maps.DirectionsService();

      const directionsRendererInstance = new window.google.maps.DirectionsRenderer();
      setDirectionsRenderer(directionsRendererInstance);

      directionsService.route({
        origin,
        destination,
        travelMode: 'DRIVING'
      }, (response, status) => {
        if (status === 'OK') {
          directionsRendererInstance.setDirections(response);
          setRouteData(response.routes[0]);
        } else {
          setRouteError('Unable to calculate route.');
        }
      });
    } catch (error) {
      setRouteError(error.message);
    }
  };

  const clearState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedPlace(null);
    setFromLocation('');
    setRouteData(null);
    setRouteError('');
    setShowDirectionsForm(false);
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    setCenter({ lat: 12.9716, lng: 77.5946 });
    setZoom(13);
  };

  if (loadError) return <div>Error loading Google Maps</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="relative w-screen h-screen">

      {isPanelVisible && (
        <div className="absolute top-4 left-4 z-10 p-4 bg-white shadow-md rounded-md flex flex-col gap-2 w-80">

          <div className="flex justify-between items-center pb-2 border-b border-gray-300">
            {selectedPlace && (
              <button onClick={clearState} className="p-1 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-200" title="Back to search">
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="font-semibold text-lg flex-1 text-center">Map Navigation</h2>
            <button
              onClick={() => setIsPanelVisible(false)}
              className="p-1 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-200"
              title="Minimize Panel"
            >
              <ChevronUp size={20} />
            </button>
          </div>

          {/* Main search view */}
          {!selectedPlace && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              />
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      onMouseDown={() => selectSearchResult(result.place_id)}
                      className="p-2 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
                    >
                      {result.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Directions and details view */}
          {selectedPlace && (
            <>
              <div className="mt-2 p-2 bg-gray-100 rounded-md">
                <h3 className="font-semibold">{selectedPlace.name}</h3>
                <p className="text-sm text-gray-600">Lat: {selectedPlace.lat.toFixed(4)}, Lng: {selectedPlace.lng.toFixed(4)}</p>
              </div>

              {!showDirectionsForm && (
                <button
                  onClick={() => setShowDirectionsForm(true)}
                  className="p-2 bg-blue-500 text-white rounded-md mt-2"
                >
                  Get Directions
                </button>
              )}

              {showDirectionsForm && (
                <>
                  <h3 className="mt-4 font-semibold">From:</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Your location"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleDirections} className="flex-1 p-2 bg-blue-500 text-white rounded-md">
                      Go
                    </button>
                    <button onClick={clearState} className="flex-1 p-2 bg-gray-500 text-white rounded-md">
                      Clear
                    </button>
                  </div>
                </>
              )}

              {routeError && (
                <div className="mt-2 p-2 text-red-700 bg-red-100 border border-red-200 rounded-md">
                  {routeError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isPanelVisible && (
        <button
          onClick={() => setIsPanelVisible(true)}
          className="absolute top-4 left-4 z-10 p-3 bg-white shadow-md rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
          title="Expand Search Panel"
        >
          <Search size={24} />
        </button>
      )}

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        onLoad={handleMapLoad}
        options={{ disableDefaultUI: false }}
      >
        {selectedPlace && (
          <Marker position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} />
        )}
        {directionsRenderer && (
          <DirectionsRenderer directions={directionsRenderer.getDirections()} />
        )}
      </GoogleMap>
    </div>
  );
};

export default EnhancedFreeMap;