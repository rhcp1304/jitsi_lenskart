import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer
} from '@react-google-maps/api';
import {
  Search, X, MapPin, Route, ArrowLeft, Loader2, ChevronLeft, ChevronRight,
  Store, ShoppingCart, Bus, Car, Hospital, Landmark, Utensils, Camera, Ruler,
  ListCollapse, List, ChevronsDown, ChevronsUp
} from 'lucide-react';
import { Button } from './ui/button';

// IMPORTANT: Replace with your actual Google Maps API Key.
// You can get one here: https://developers.google.com/maps/documentation/javascript/get-api-key
const Maps_API_KEY = 'AIzaSyD_lSowigFjpFIOvqnK1dY7Nksqq7089fs';

const libraries = ['places'];

// Configuration for site analysis buttons
const siteAnalysisButtons = [
  // This button searches for any general optical stores, using 'eyewear' as a keyword hint
  { label: 'Competitors', icon: Store, placeType: ['optical store', 'optician'], keyword: 'eyewear', category: 'competitors' },
  // This button is specifically for Lenskart stores, with a strict keyword match
  { label: 'Lenskart Stores', icon: Store, placeType: ['optical store'], keyword: 'Lenskart', category: 'competitors', strictKeywordMatch: true },
  { label: 'Shopping Malls', icon: ShoppingCart, placeType: ['shopping_mall'], category: 'complementary' },
  { label: 'Hospitals', icon: Hospital, placeType: ['hospital'], category: 'complementary' },
  { label: 'Restaurants', icon: Utensils, placeType: ['restaurant'], category: 'complementary' },
  { label: 'Bus Stops', icon: Bus, placeType: ['bus_station'], category: 'accessibility' },
  { label: 'Parking', icon: Car, placeType: ['parking'], category: 'accessibility' },
];

// Helper function to calculate distance between two points using the Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance.toFixed(2); // Return distance in km, rounded to 2 decimal places
};

const EnhancedFreeMap = () => {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const fromInputRef = useRef(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [isFindingPlaces, setIsFindingPlaces] = useState(false);
  const [isStreetViewActive, setIsStreetViewActive] = useState(false);

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

  // New state for collapsible sections
  const [isAnalysisOptionsOpen, setIsAnalysisOptionsOpen] = useState(true);
  const [isNearbyListOpen, setIsNearbyListOpen] = useState(true);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: Maps_API_KEY,
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
        strokeColor: '#5a67d8',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });
    directionsRendererInstance.setMap(map);
    setDirectionsRenderer(directionsRendererInstance);

    // Add event listener for Street View close
    const streetView = map.getStreetView();
    streetView.addListener('visible_changed', () => {
      setIsStreetViewActive(streetView.getVisible());
    });

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
    // A more robust check to ensure the input is a complete coordinate string.
    const parts = query.split(',').map(part => part.trim());

    if (parts.length !== 2) {
      return null;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    return { lat, lng };
  };

  const performSearch = (query) => {
    const latLng = isLatLng(query);
    if (latLng) {
      setCenter(latLng);
      setZoom(15);
      setSelectedPlace({
        name: `Coordinates`,
        formatted_address: `Lat: ${latLng.lat}, Lng: ${latLng.lng}`,
        ...latLng
      });
      setSearchResults([]);
      setShowSearchResults(false);
    } else if (query.length > 2) {
      getPlacePredictions(query, (predictions) => {
        setSearchResults(predictions);
        setShowSearchResults(true);
      });
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Continue with regular place predictions while typing
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

  const handleSearchInputBlur = () => {
    // We now only process a lat/lng coordinate when the user has left the input field.
    performSearch(searchQuery);

    // Hide search suggestions after a small delay
    // This allows a user to click on a suggestion before it disappears
    setTimeout(() => setShowSearchResults(false), 200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch(searchQuery);
      searchInputRef.current.blur(); // Blur the input to hide suggestions
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
        // Correctly set the selectedPlace state with all necessary information
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
          directionsRenderer.setDirections(response);
          setRouteData(response.routes[0]);
          if (mapRef.current) {
            mapRef.current.fitBounds(response.routes[0].bounds);
          }
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

  const findNearbyPlaces = async (placeTypes, keyword, category, strictKeywordMatch) => {
    if (!selectedPlace || !placesServiceRef.current) return;

    setIsFindingPlaces(true);
    setNearbyPlaces([]);
    setActiveAnalysis(category);

    const newNearbyPlaces = [{
      name: selectedPlace.name,
      formatted_address: selectedPlace.formatted_address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      isPrimary: true,
      distance: 0, // Distance is 0 for the primary site
      placeId: 'primary-site'
    }];

    const searchPromises = placeTypes.map(placeType => {
      return new Promise((resolve) => {
        placesServiceRef.current.nearbySearch({
          location: { lat: selectedPlace.lat, lng: selectedPlace.lng },
          radius: '5000', // Increased radius to 5000 meters to show more results
          type: placeType,
          keyword: keyword,
        }, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            // Apply strict filtering if requested
            const filteredResults = strictKeywordMatch
              ? results.filter(place => place.name.toLowerCase().includes(keyword.toLowerCase()))
              : results;
            resolve(filteredResults);
          } else {
            console.warn(`Nearby search for type '${placeType}' failed with status: ${status}`);
            resolve([]);
          }
        });
      });
    });

    try {
      const allResults = await Promise.all(searchPromises);
      const combinedResults = allResults.flat();
      const uniqueResults = combinedResults.filter((place, index, self) =>
        index === self.findIndex((p) => (
          p.place_id === place.place_id
        ))
      );

      const placesWithCoords = uniqueResults
        // This is the new, crucial filtering step to ensure lat/lng exists
        .filter(place => place.name !== selectedPlace.name && place.geometry && place.geometry.location)
        .map(place => ({
        name: place.name,
        formatted_address: place.vicinity,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeType: place.types[0],
        placeId: place.place_id,
        distance: calculateDistance(
          selectedPlace.lat,
          selectedPlace.lng,
          place.geometry.location.lat(),
          place.geometry.location.lng()
        )
      }));
      setNearbyPlaces([...newNearbyPlaces, ...placesWithCoords]);
    } catch (error) {
      console.error("Error during nearby places search:", error);
      setNearbyPlaces(newNearbyPlaces);
    } finally {
      setIsFindingPlaces(false);
    }
  };

  const handleNearbyMarkerClick = (place) => {
    if (mapRef.current) {
        mapRef.current.panTo({ lat: place.lat, lng: place.lng });
        mapRef.current.setZoom(17);
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
    setNearbyPlaces([]);
    setActiveAnalysis(null);
    setIsStreetViewActive(false);
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    // Reset to a default center
    setCenter({ lat: 12.9716, lng: 77.5946 });
    setZoom(13);
    // Hide Street View if active
    if (mapRef.current) {
        const streetView = mapRef.current.getStreetView();
        streetView.setVisible(false);
    }
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

  const toggleStreetView = () => {
    if (!selectedPlace || !mapRef.current) {
      // Use a custom modal instead of alert
      return;
    }

    const streetView = mapRef.current.getStreetView();
    if (isStreetViewActive) {
      streetView.setVisible(false);
    } else {
      streetView.setPosition(new window.google.maps.LatLng(selectedPlace.lat, selectedPlace.lng));
      streetView.setPov({
        heading: 270,
        pitch: 0,
      });
      streetView.setVisible(true);
    }
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
                <div className="flex flex-col gap-2">
                    <Button onClick={() => setRouteData('form')} className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 transition-colors text-white">
                        <Route className="w-5 h-5" />
                        Get Directions
                    </Button>
                    <Button onClick={toggleStreetView} className="flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 transition-colors text-white">
                        <Camera className="w-5 h-5" />
                        {isStreetViewActive ? 'Exit Street View' : 'View Street View'}
                    </Button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setIsAnalysisOptionsOpen(!isAnalysisOptionsOpen)}>
                        <h4 className="text-lg font-bold text-gray-800">Site Analysis</h4>
                        <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-200">
                            {isAnalysisOptionsOpen ? <ChevronsUp className="w-4 h-4" /> : <ChevronsDown className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isAnalysisOptionsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="grid grid-cols-2 gap-2">
                            {siteAnalysisButtons.map((button) => (
                              <Button
                                key={button.label}
                                onClick={() => {
                                  findNearbyPlaces(button.placeType, button.keyword, button.label, button.strictKeywordMatch);
                                  setIsAnalysisOptionsOpen(false); // Collapse options after selection
                                  setIsNearbyListOpen(true); // Open the list when a button is clicked
                                }}
                                className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
                                disabled={isFindingPlaces}
                              >
                                <button.icon className="w-4 h-4" />
                                {button.label}
                              </Button>
                            ))}
                        </div>
                    </div>

                    {isFindingPlaces && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <p>Searching for {activeAnalysis}...</p>
                        </div>
                    )}

                    {nearbyPlaces.length > 1 && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setIsNearbyListOpen(!isNearbyListOpen)}>
                                <h5 className="text-md font-semibold text-gray-700">Nearby {activeAnalysis}</h5>
                                <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-200">
                                  {isNearbyListOpen ? <ListCollapse className="w-4 h-4" /> : <List className="w-4 h-4" />}
                                </Button>
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isNearbyListOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                              <div className="bg-gray-100 rounded-lg p-2 overflow-y-auto custom-scrollbar">
                                  <ul className="space-y-1">
                                      {nearbyPlaces.slice(1).map((place, index) => (
                                          <li
                                            key={place.placeId}
                                            onClick={() => handleNearbyMarkerClick(place)}
                                            className="p-2 cursor-pointer hover:bg-gray-200 rounded-md transition-colors text-sm"
                                          >
                                              <div className="flex justify-between items-center">
                                                  <p className="font-medium text-gray-800 truncate">
                                                    <span className="font-bold text-gray-500 mr-2">{index + 1}.</span>{place.name}
                                                  </p>
                                                  <div className="flex items-center gap-1 text-gray-500">
                                                      <Ruler className="w-3 h-3" />
                                                      <span className="text-xs">{place.distance} km</span>
                                                  </div>
                                              </div>
                                              <p className="text-xs text-gray-500 truncate">{place.formatted_address}</p>
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for places or use Lat,Lng..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setShowSearchResults(searchQuery.length > 2)}
                    onBlur={handleSearchInputBlur}
                    onKeyDown={handleKeyDown}
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
            // Explicitly set Street View controls to be shown
            streetViewControl: true,
          }}
        >
          {/* Main marker for the searched location */}
          {selectedPlace && (
            <Marker
              position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
              options={{
                icon: {
                  url: `http://maps.google.com/mapfiles/ms/icons/red-dot.png`,
                  scaledSize: new window.google.maps.Size(40, 40),
                },
              }}
              onClick={() => handleNearbyMarkerClick(selectedPlace)}
            />
          )}

          {/* Markers for nearby places */}
          {nearbyPlaces.slice(1).map((place, index) => (
            !place.isPrimary && (
              <Marker
                key={place.placeId}
                position={{ lat: place.lat, lng: place.lng }}
                label={{
                    text: `${index + 1}`,
                    fontWeight: 'bold',
                    color: '#FFFFFF'
                }}
                options={{
                  icon: {
                    url: `http://maps.google.com/mapfiles/ms/icons/green-dot.png`,
                  },
                }}
                onClick={() => handleNearbyMarkerClick(place)}
              />
            )
          ))}
          {/* This is a simple directions renderer */}
          <DirectionsRenderer directions={routeData} />
        </GoogleMap>
      </div>
    </div>
  );
};

export default EnhancedFreeMap;