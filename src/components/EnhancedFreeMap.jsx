import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer
} from '@react-google-maps/api';
import { Search, X, MapPin, Route, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

const libraries = ['places'];

const EnhancedFreeMap = () => {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const fromInputRef = useRef(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [fromLocation, setFromLocation] = useState('');
  const [fromLocationSuggestions, setFromLocationSuggestions] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);

  const [routeData, setRouteData] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [highlightedStepIndex, setHighlightedStepIndex] = useState(null);

  const [center, setCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  const [zoom, setZoom] = useState(13);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyD_lSowigFjpFIOvqnK1dY7Nksqq7089fs',
    libraries,
  });

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const directionsServiceRef = useRef(null);

  useEffect(() => {
    if (isLoaded) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      directionsServiceRef.current = new window.google.maps.DirectionsService();
    }
  }, [isLoaded]);

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (window.google?.maps?.places?.PlacesService) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(map);
    }
    const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
      polylineOptions: {
        strokeColor: '#5a67d8', // Blue color for the main route
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });
    directionsRendererInstance.setMap(map);
    setDirectionsRenderer(directionsRendererInstance);
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
      { placeId, fields: ['geometry', 'name', 'formatted_address'] },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          callback(place);
        } else {
          callback(null);
        }
      }
    );
  }, []);

  // Function to check and parse if a string is a lat, lng coordinate
  const isLatLng = (query) => {
    const latLngRegex = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/;
    const match = query.match(latLngRegex);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    return { lat, lng };
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    const latLng = isLatLng(query);
    if (latLng) {
      // If the query is a valid lat/lng, navigate directly
      setCenter(latLng);
      setZoom(15);
      setSelectedPlace({
        name: `Lat: ${latLng.lat}, Lng: ${latLng.lng}`,
        formatted_address: `Coordinates: ${latLng.lat}, ${latLng.lng}`,
        ...latLng
      });
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Fallback to normal place search if not a lat/lng
    if (query.length > 2) {
      getPlacePredictions(query, (predictions) => {
        setSearchResults(predictions);
        setShowSearchResults(true);
      });
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleFromLocationChange = (e) => {
    const query = e.target.value;
    setFromLocation(query);
    if (query.length > 2) {
      getPlacePredictions(query, (predictions) => {
        setFromLocationSuggestions(predictions);
        setShowFromSuggestions(true);
      });
    } else {
      setFromLocationSuggestions([]);
      setShowFromSuggestions(false);
    }
  };

  const selectSearchResult = (placeId) => {
    getPlaceDetails(placeId, (place) => {
      if (place) {
        const location = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setCenter(location);
        setZoom(15);
        setSelectedPlace({
          name: place.name,
          formatted_address: place.formatted_address,
          ...location
        });
        clearSearchState();
      }
    });
  };

  const selectFromLocation = (description) => {
    setFromLocation(description);
    setFromLocationSuggestions([]);
    setShowFromSuggestions(false);
  };

  const handleDirections = async () => {
    if (!fromLocation || !selectedPlace || !directionsServiceRef.current) {
      setRouteError('Please enter a starting location.');
      return;
    }
    setIsCalculatingRoute(true);
    setRouteError('');

    try {
      const geocoder = new window.google.maps.Geocoder();
      const geocodePromise = (location) => {
        return new Promise((resolve, reject) => {
          geocoder.geocode({ address: location }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0].geometry.location);
            } else {
              reject(new Error(`Geocoding failed for "${location}": ${status}`));
            }
          });
        });
      };

      const origin = await geocodePromise(fromLocation);
      const destination = { lat: selectedPlace.lat, lng: selectedPlace.lng };

      directionsServiceRef.current.route({
        origin,
        destination,
        travelMode: 'DRIVING'
      }, (response, status) => {
        setIsCalculatingRoute(false);
        if (status === 'OK') {
          // Set the entire route to the DirectionsRenderer
          directionsRenderer.setDirections(response);
          setRouteData(response.routes[0]);
          // Automatically fit the map to the bounds of the calculated route
          if (mapRef.current) {
            mapRef.current.fitBounds(response.routes[0].bounds);
          }
          // The selected place is no longer needed to be rendered as a separate marker
          setSelectedPlace(null);
        } else {
          setRouteError('Unable to calculate route.');
          console.error('Directions request failed:', status);
        }
      });
    } catch (error) {
      setIsCalculatingRoute(false);
      setRouteError(error.message);
      console.error('Directions failed:', error);
    }
  };

  const clearAllState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedPlace(null);
    setFromLocation('');
    setFromLocationSuggestions([]);
    setShowFromSuggestions(false);
    setRouteData(null);
    setRouteError('');
    setHighlightedStepIndex(null);
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    // Reset to a default center
    setCenter({ lat: 12.9716, lng: 77.5946 });
    setZoom(13);
  };

  const clearSearchState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleStepClick = (step, index) => {
    setHighlightedStepIndex(index);

    if (mapRef.current) {
      const startLocation = step.start_location;
      mapRef.current.panTo({
        lat: startLocation.lat(),
        lng: startLocation.lng()
      });
      mapRef.current.setZoom(17);
    }
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  if (loadError) return <div className="text-center text-red-500 p-4">Error loading Google Maps</div>;
  if (!isLoaded) return (
    <div className="flex items-center justify-center h-full bg-white text-gray-800">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-800 mx-auto mb-4" />
        <p className="text-xl font-medium">Loading Map...</p>
        <p className="text-gray-500 text-sm mt-1">Please ensure you have a valid Google Maps API Key</p>
      </div>
    </div>
  );

  const getPanelContent = () => {
    // If a route has been calculated, show the route summary and navigation steps
    if (routeData && routeData !== 'form') {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <Button onClick={() => {
                        directionsRenderer.setDirections({ routes: [] });
                        setRouteData(null);
                        setSelectedPlace(null);
                    }} variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h3 className="text-xl font-bold text-gray-800 text-center flex-1">Your Route</h3>
                    <div className="w-5" />
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-500" />
                    <p className="text-sm text-gray-800 truncate">{routeData.legs[0].start_address}</p>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-gray-800 truncate">{routeData.legs[0].end_address}</p>
                </div>
                <div className="flex items-center justify-between mt-2 p-3 bg-gray-100 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Route className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-600">Distance:</span>
                    </div>
                    <span className="font-semibold text-gray-800">{routeData.legs[0].distance.text}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm text-gray-600">Duration:</span>
                    </div>
                    <span className="font-semibold text-gray-800">{routeData.legs[0].duration.text}</span>
                </div>

                {/* New section for detailed navigation steps */}
                <div className="mt-4">
                    <h4 className="text-lg font-bold text-gray-800 mb-2">Navigation Steps</h4>
                    <div className="bg-gray-100 rounded-lg p-4 custom-scrollbar max-h-96 overflow-y-auto">
                        <ol className="list-inside space-y-3">
                            {routeData.legs[0].steps.map((step, index) => (
                                <li key={index}
                                    onClick={() => handleStepClick(step, index)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                      highlightedStepIndex === index ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg">{index + 1}.</span>
                                        <div className="flex-1">
                                            <div
                                                dangerouslySetInnerHTML={{ __html: step.instructions }}
                                                className="text-sm"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">{step.distance.text}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </div>
        );
    }
    // If the user is in the directions form view
    if (routeData === 'form') {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <Button onClick={() => setRouteData(null)} variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h3 className="text-xl font-bold text-gray-800 text-center flex-1">Directions</h3>
                    <div className="w-5" />
                </div>
                <div className="relative">
                    <label className="text-sm text-gray-600 mb-1 block">Your Location</label>
                    <input
                      ref={fromInputRef}
                      type="text"
                      placeholder="Enter a starting point..."
                      value={fromLocation}
                      onChange={handleFromLocationChange}
                      onFocus={() => setShowFromSuggestions(fromLocation.length > 2)}
                      onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
                      className="w-full p-2 rounded-lg bg-white text-gray-800 placeholder-gray-400 border border-gray-300 focus:border-blue-500 focus:outline-none"
                    />
                    {showFromSuggestions && fromLocationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar">
                        {fromLocationSuggestions.map((result, index) => (
                          <div
                            key={result.place_id || index}
                            onMouseDown={() => selectFromLocation(result.description)}
                            className="p-3 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0 text-gray-800 text-sm"
                          >
                            {result.description}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
                <div className="relative">
                    <label className="text-sm text-gray-600 mb-1 block">Destination</label>
                    <input
                      type="text"
                      value={selectedPlace.formatted_address}
                      readOnly
                      className="w-full p-2 rounded-lg bg-gray-100 text-gray-500 border border-gray-300 focus:outline-none"
                    />
                </div>
                <Button onClick={handleDirections} disabled={isCalculatingRoute} className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 transition-colors text-white">
                    {isCalculatingRoute ? <Loader2 className="w-5 h-5 animate-spin" /> : <Route className="w-5 h-5" />}
                    {isCalculatingRoute ? 'Calculating...' : 'Calculate Route'}
                </Button>
                {routeError && (
                    <div className="mt-2 p-2 text-red-700 bg-red-100 border border-red-300 rounded-md text-sm">
                        {routeError}
                    </div>
                )}
            </div>
        );
    }
    // If a place is selected, show details and 'Get Directions' button
    if (selectedPlace) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <Button onClick={clearAllState} variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h3 className="text-xl font-bold text-gray-800 text-center flex-1">{selectedPlace.name}</h3>
                    <div className="w-5" />
                </div>
                <p className="text-sm text-gray-600">{selectedPlace.formatted_address}</p>
                <Button onClick={() => setRouteData('form')} className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 transition-colors text-white">
                    <Route className="w-5 h-5" />
                    Get Directions
                </Button>
            </div>
        );
    }
    // Default search view
    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for places or use Lat, Lng..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setShowSearchResults(searchQuery.length > 2)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    className="w-full pl-10 pr-10 py-2 rounded-full bg-white text-gray-800 placeholder-gray-400 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-lg"
                />
                {searchQuery && (
                    <Button onClick={clearSearchState} variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:bg-gray-100 rounded-full">
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {showSearchResults && searchResults.length > 0 && (
                <div className="mt-2 bg-white rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                    {searchResults.map((result, index) => (
                        <div
                            key={result.place_id || index}
                            onMouseDown={() => selectSearchResult(result.place_id)}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0"
                        >
                            <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 text-sm truncate">{result.structured_formatting.main_text}</h4>
                                <p className="text-xs text-gray-500 truncate">{result.structured_formatting.secondary_text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };


  return (
    <div className="relative w-full h-full bg-white">
      <div className={`absolute top-0 left-0 bottom-0 z-10 p-4 transition-all duration-300 ease-in-out bg-white overflow-y-auto custom-scrollbar shadow-lg ${isPanelOpen ? 'w-full md:w-96' : 'w-0'}`}>
        <div className={`${isPanelOpen ? 'block' : 'hidden'}`}>
          {getPanelContent()}
        </div>
      </div>

      {/* Toggle button for the side panel */}
      <Button
        onClick={togglePanel}
        className={`absolute top-4 z-20 transition-all duration-300 ease-in-out bg-white hover:bg-gray-100 text-gray-800 rounded-full p-2 shadow-lg ${isPanelOpen ? 'md:left-96 left-auto right-4' : 'left-4'}`}
      >
        {isPanelOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </Button>

      <div className={`w-full h-full transition-all duration-300 ease-in-out ${isPanelOpen ? 'md:pl-96' : ''}`}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={zoom}
          onLoad={handleMapLoad}
          options={{
            disableDefaultUI: false,
          }}
        >
          {selectedPlace && !routeData && (
            <Marker position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} />
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

export default EnhancedFreeMap;
