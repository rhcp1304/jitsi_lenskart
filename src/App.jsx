import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { MapPin, X, Youtube, List, Plus, Play, Trash2, Settings, Key, RefreshCw, Loader2 } from 'lucide-react'
import EnhancedFreeMap from './components/EnhancedFreeMap.jsx'
import './App.css'

function App() {
  const [showMap, setShowMap] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [isVideoSharing, setIsVideoSharing] = useState(false)
  const [currentSharedVideo, setCurrentSharedVideo] = useState('')
  const [playlist, setPlaylist] = useState([])
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [jwtToken, setJwtToken] = useState('')
  const [showJwtModal, setShowJwtModal] = useState(false)
  const [jitsiInitialized, setJitsiInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isLoadingVideoTitle, setIsLoadingVideoTitle] = useState(false)
  const jitsiContainerRef = useRef(null)
  const [jitsiApi, setJitsiApi] = useState(null)

  // Function to fetch YouTube video title using oEmbed API
  const fetchYouTubeVideoTitle = async (videoUrl) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`)
      if (response.ok) {
        const data = await response.json()
        return data.title || 'Unknown Video'
      }
    } catch (error) {
      console.error('Error fetching video title:', error)
    }
    return 'Unknown Video'
  }

  const initializeJitsi = async () => {
    console.log('=== initializeJitsi called ===');
    console.log(`State at call: isInitializing=${isInitializing}, jitsiInitialized=${jitsiInitialized}, jitsiApi=${!!jitsiApi}`);

    // Prevent re-initialization if already initializing or already fully initialized
    if (isInitializing) {
      console.log('Already initializing Jitsi, skipping this call.');
      return;
    }
    // Only skip if Jitsi is fully initialized AND we have an API instance.
    // If jitsiInitialized is true but jitsiApi is null (e.g., after an error), we want to try again.
    if (jitsiInitialized && jitsiApi) {
        console.log('Jitsi is already initialized and API exists, skipping re-initialization.');
        return;
    }

    if (!window.JitsiMeetExternalAPI) {
      console.warn('JitsiMeetExternalAPI script not yet loaded. Cannot initialize.');
      return;
    }

    if (!jitsiContainerRef.current) {
      console.error('Jitsi container ref is not available. Cannot initialize.');
      return;
    }

    setIsInitializing(true); // Set initializing flag early
    console.log('isInitializing set to true.');

    try {
      // **CRITICAL: Aggressively clear the container before creating a new instance**
      // This loop reliably removes all children, preventing old Jitsi instances from lingering.
      if (jitsiContainerRef.current) {
        console.log('Clearing jitsiContainerRef. Children before clearing:', jitsiContainerRef.current.children.length);
        while (jitsiContainerRef.current.firstChild) {
          jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
        }
        console.log('Children after explicit clearing:', jitsiContainerRef.current.children.length);
      }

      // Give the DOM a moment to process the removal before a new iframe is inserted
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('After clearing and delay, container children before new API:', jitsiContainerRef.current.children.length);

      const config = {
        roomName: "vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/SampleAppRoutineSleepsWorkReportedly",
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: true,
          enableWelcomePage: false,
          enableClosePage: false,
          // Enhanced shared video configuration
          sharedVideoService: {
            disabled: false,
            hideControls: false, // Show controls including seek bar
            muteAudio: true, // Permanently mute shared videos
          }
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
        }
      }

      if (jwtToken && jwtToken.trim() && jwtToken.trim().length > 10) {
        config.jwt = jwtToken.trim();
        console.log('Initializing Jitsi with JWT token.');
      } else {
        console.log('Initializing Jitsi without JWT.');
      }

      const api = new window.JitsiMeetExternalAPI("8x8.vc", config);
      console.log('JitsiMeetExternalAPI instance created.');

      // Add comprehensive event listeners
      api.addEventListener('readyToClose', () => {
        console.log('Jitsi event: readyToClose');
      })

      api.addEventListener('videoConferenceJoined', (event) => {
        console.log('Jitsi event: Video conference joined:', event);
      })

      api.addEventListener('videoConferenceLeft', (event) => {
        console.log('Jitsi event: Video conference left:', event);
      })

      api.addEventListener('participantJoined', (event) => {
        console.log('Jitsi event: Participant joined:', event);
      })

      api.addEventListener('participantLeft', (event) => {
        console.log('Jitsi event: Participant left:', event);
      })

      // Wait for API to be ready by checking for a reliable method
      await new Promise(resolve => {
        const checkReady = () => {
          if (api.isAudioMuted !== undefined && api.isVideoMuted !== undefined) {
            console.log('Jitsi API reported ready.');
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        }
        checkReady();
      });

      setJitsiApi(api);
      setJitsiInitialized(true);
      console.log('Jitsi state updated: jitsiApi set, jitsiInitialized true.');
      console.log('Jitsi initialized successfully.');

    } catch (error) {
      console.error('Error during Jitsi initialization:', error);
      setJitsiInitialized(false);
      setJitsiApi(null);
    } finally {
      setIsInitializing(false);
      console.log('isInitializing set to false. === initializeJitsi finished ===');
    }
  }

  const cleanupJitsi = () => {
    console.log('=== cleanupJitsi called ===');
    console.log(`State at call: jitsiApi=${!!jitsiApi}, jitsiInitialized=${jitsiInitialized}`);

    if (jitsiApi) {
      try {
        jitsiApi.dispose();
        console.log('Jitsi API dispose() called.');
      } catch (error) {
        console.error('Error disposing Jitsi API:', error);
      }
      setJitsiApi(null); // Clear the API state immediately
      console.log('jitsiApi state set to null.');
    } else {
        console.log('No Jitsi API instance to dispose.');
    }
    setJitsiInitialized(false); // Reset initialization state
    setIsVideoSharing(false);
    setCurrentSharedVideo('');

    // Ensure the container is truly empty after disposal
    if (jitsiContainerRef.current) {
      console.log('Clearing jitsiContainerRef in cleanup. Children before clearing:', jitsiContainerRef.current.children.length);
      while (jitsiContainerRef.current.firstChild) {
        jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
      }
      console.log('Children after explicit clearing in cleanup:', jitsiContainerRef.current.children.length);
    }
    console.log('=== cleanupJitsi finished ===');
  }

  useEffect(() => {
    const jitsiScriptUrl = 'https://8x8.vc/vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/external_api.js';
    console.log('useEffect triggered.');

    // Check if the script is already loaded to prevent redundant appends
    const existingScript = document.querySelector(`script[src="${jitsiScriptUrl}"]`);

    if (!existingScript) {
      console.log('Jitsi External API script not found, appending new script.');
      const script = document.createElement('script');
      script.src = jitsiScriptUrl;
      script.async = true;
      script.onload = () => {
        console.log('Jitsi External API script loaded via new append. Initializing...');
        initializeJitsi();
      };
      script.onerror = () => {
        console.error('Failed to load Jitsi External API script via new append.');
      };
      document.head.appendChild(script);

      // Cleanup function for useEffect: only disposes Jitsi, does NOT remove the script from DOM.
      // This is crucial for React Strict Mode's double render behavior.
      return () => {
        console.log('useEffect cleanup: Disposing Jitsi (script remains in DOM).');
        cleanupJitsi();
        // The script is intentionally NOT removed here. It stays in the head.
        // It will only be removed if the component unmounts entirely (e.g., navigating to another page).
      };
    } else {
      console.log('Jitsi External API script already present. Attempting initialization directly.');
      initializeJitsi();
      // Provide a cleanup function even if script wasn't newly added, in case of component unmount
      return () => {
        console.log('useEffect cleanup: Disposing Jitsi (script was pre-existing).');
        cleanupJitsi();
      };
    }
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount


  const toggleMap = () => {
    console.log(`Toggling Map: From ${showMap} to ${!showMap}`);
    setShowMap(!showMap)
    if (showPlaylist) {
      setShowPlaylist(false)
    }
  }

  const shareVideoDirectly = async () => {
    if (jitsiApi && videoUrl) {
      const videoId = extractYouTubeVideoId(videoUrl)
      if (videoId) {
        const fullUrl = `https://www.youtube.com/watch?v=${videoId}`
        try {
          // Start sharing with enhanced configuration
          jitsiApi.executeCommand('startShareVideo', fullUrl)

          // Additional configuration for permanent muting and seek bar visibility
          setTimeout(() => {
            if (jitsiApi) {
              // Ensure the shared video is muted
              jitsiApi.executeCommand('muteSharedVideo', true)
            }
          }, 1000)

          setIsVideoSharing(true)
          setCurrentSharedVideo(videoUrl)
          setVideoUrl('')
          console.log('Video sharing started with enhanced config:', fullUrl)
        } catch (error) {
          console.error('Error sharing video:', error)
          alert('Failed to share video. Please make sure you have joined the meeting.')
        }
      } else {
        alert('Please enter a valid YouTube URL')
      }
    } else if (!jitsiApi) {
      alert('Please wait for the meeting to load and join first')
    } else {
      alert('Please enter a YouTube URL')
    }
  }

  const stopVideoSharing = () => {
    if (jitsiApi && isVideoSharing) {
      try {
        jitsiApi.executeCommand('stopShareVideo')
        setIsVideoSharing(false)
        setCurrentSharedVideo('')
        console.log('Video sharing stopped')
      } catch (error) {
        console.error('Error stopping video:', error)
      }
    }
  }

  const addToPlaylist = async () => {
    if (videoUrl && extractYouTubeVideoId(videoUrl)) {
      setIsLoadingVideoTitle(true)
      const videoId = extractYouTubeVideoId(videoUrl)

      try {
        // Fetch the actual video title
        const videoTitle = await fetchYouTubeVideoTitle(videoUrl)

        const newVideo = {
          id: Date.now(),
          url: videoUrl,
          videoId: videoId,
          title: videoTitle,
          addedAt: new Date().toLocaleString()
        }
        setPlaylist([...playlist, newVideo])
        setVideoUrl('')
        console.log('Added video to playlist with title:', videoTitle)
      } catch (error) {
        console.error('Error adding video to playlist:', error)
        // Fallback to generic title if API fails
        const newVideo = {
          id: Date.now(),
          url: videoUrl,
          videoId: videoId,
          title: `Video ${playlist.length + 1}`,
          addedAt: new Date().toLocaleString()
        }
        setPlaylist([...playlist, newVideo])
        setVideoUrl('')
      } finally {
        setIsLoadingVideoTitle(false)
      }
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const removeFromPlaylist = (id) => {
    setPlaylist(playlist.filter(video => video.id !== id))
  }

  const shareFromPlaylist = (url) => {
    if (jitsiApi) {
      try {
        // Share video with enhanced configuration
        jitsiApi.executeCommand('startShareVideo', url)

        // Additional configuration for permanent muting and seek bar visibility
        setTimeout(() => {
          if (jitsiApi) {
            // Ensure the shared video is muted
            jitsiApi.executeCommand('muteSharedVideo', true)
          }
        }, 1000)

        setIsVideoSharing(true)
        setCurrentSharedVideo(url)
        console.log('Video from playlist shared with enhanced config:', url)
      } catch (error) {
        console.error('Error sharing video from playlist:', error)
        alert('Failed to share video. Please make sure you have joined the meeting.')
      }
    } else {
      alert('Please wait for the meeting to load and join first')
    }
  }

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist)
    if (showMap) {
      setShowMap(false)
    }
  }

  const extractYouTubeVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const handleJwtSubmit = async () => {
    console.log('handleJwtSubmit called. Applying JWT.');
    setShowJwtModal(false);

    // Clean up current instance first
    cleanupJitsi();

    // Wait for cleanup to complete before re-initializing
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Delay after cleanup for JWT applied.');

    // Re-initialize with new JWT
    await initializeJitsi();
    console.log('JWT submission and re-initialization sequence complete.');
  }

  const refreshJitsi = async () => {
    console.log('Refreshing Jitsi...');
    cleanupJitsi(); // Dispose current Jitsi instance

    // Wait for cleanup to fully process (e.g., iframe removal)
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Delay after cleanup for Refresh applied.');

    // Re-initialize Jitsi
    await initializeJitsi();
    console.log('Refresh sequence complete.');
  }

  const toggleJwtModal = () => {
    setShowJwtModal(!showJwtModal)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center flex-shrink-0">
        <h1 className="text-white text-xl font-semibold">Video Conference</h1>
        <div className="flex gap-2 items-center">
          {/* Direct Video Share Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Paste YouTube URL to share..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="px-3 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none w-64"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  shareVideoDirectly()
                }
              }}
              disabled={isVideoSharing || isInitializing || isLoadingVideoTitle}
            />
            {!isVideoSharing ? (
              <>
                <Button
                  onClick={shareVideoDirectly}
                  variant="default"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  disabled={!videoUrl.trim() || isInitializing || isLoadingVideoTitle}
                >
                  <Youtube className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  onClick={addToPlaylist}
                  variant="default"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  disabled={!videoUrl.trim() || isInitializing || isLoadingVideoTitle}
                >
                  {isLoadingVideoTitle ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isLoadingVideoTitle ? 'Loading...' : 'Add to Playlist'}
                </Button>
              </>
            ) : (
              <Button
                onClick={stopVideoSharing}
                variant="destructive"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                disabled={isInitializing}
              >
                <X className="w-4 h-4" />
                Stop Video
              </Button>
            )}
          </div>
          <Button
            onClick={toggleJwtModal}
            variant="default"
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            title="Configure JWT for premium features"
            disabled={isInitializing}
          >
            <Key className="w-4 h-4" />
            JWT
          </Button>
          <Button
            onClick={refreshJitsi}
            variant="default"
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700"
            title="Refresh Jitsi meeting if issues occur"
            disabled={isInitializing}
          >
            {isInitializing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            {isInitializing ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            onClick={togglePlaylist}
            variant={showPlaylist ? "destructive" : "default"}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            disabled={isInitializing}
          >
            <List className="w-4 h-4" />
            Playlist ({playlist.length})
          </Button>
          <Button
            onClick={toggleMap}
            variant={showMap ? "destructive" : "default"}
            className="flex items-center gap-2"
            disabled={isInitializing}
          >
            {showMap ? (
              <>
                <X className="w-4 h-4" />
                Close Map
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                Show Map
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Jitsi Container */}
        <div className={`${showMap || showPlaylist ? 'w-1/2' : 'w-full'} h-full bg-black flex flex-col min-h-0`}>
          {isInitializing && (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
                <p className="text-white text-lg">Initializing meeting...</p>
                <p className="text-gray-400 text-sm">Please wait while we set up your conference</p>
              </div>
            </div>
          )}
          <div
            ref={jitsiContainerRef}
            id="jitsi-container"
            className="w-full h-full flex-1 min-h-0"
            style={{
              minHeight: '400px',
              display: isInitializing ? 'none' : 'block' // Hide container while initializing
            }}
          />
        </div>

        {/* Playlist Panel */}
        {showPlaylist && (
          <div className="w-1/2 h-full bg-gray-800 border-l border-gray-600 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-white text-lg font-semibold mb-4">Video Playlist</h2>
                {playlist.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No videos in playlist</p>
                    <p className="text-sm">Add YouTube URLs to build your playlist</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlist.map((video) => (
                      <div key={video.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium text-sm leading-tight mb-1">{video.title}</h3>
                            <p className="text-gray-400 text-xs truncate">{video.url}</p>
                            <p className="text-gray-500 text-xs">Added: {video.addedAt}</p>
                          </div>
                          <div className="flex gap-2 ml-3 flex-shrink-0">
                            <Button
                              onClick={() => shareFromPlaylist(video.url)}
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isVideoSharing || isInitializing}
                              title="Share this video (muted with visible seek bar)"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => removeFromPlaylist(video.id)}
                              variant="destructive"
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              disabled={isInitializing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        {showMap && !showPlaylist && (
          <div className="w-1/2 h-full bg-white flex flex-col min-h-0">
            <div className="h-full flex-1 min-h-0">
              <EnhancedFreeMap />
            </div>
          </div>
        )}
      </div>

      {/* JWT Modal */}
      {showJwtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-90vw">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5" />
                JWT Configuration
              </h2>
              <Button
                onClick={toggleJwtModal}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  JWT Token (for premium features like recording)
                </label>
                <textarea
                  value={jwtToken}
                  onChange={(e) => setJwtToken(e.target.value)}
                  placeholder="Paste your JWT token here..."
                  className="w-full px-3 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={4}
                />
              </div>
              <div className="text-gray-400 text-xs">
                <p>• JWT enables premium features like recording, live streaming, and outbound calls</p>
                <p>• Get your JWT from your Jitsi as a Service dashboard</p>
                <p>• Leave empty to use basic features only</p>
                <p>• Meeting will restart when JWT is applied</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={toggleJwtModal}
                  variant="outline"
                  className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleJwtSubmit}
                  variant="default"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isInitializing}
                >
                  {isInitializing ? 'Applying...' : 'Apply JWT'}
                </Button>
              </div>
              {jwtToken && jwtToken.trim().length > 10 && (
                <div className="text-green-400 text-sm flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  JWT configured - premium features will be enabled
                </div>
              )}
              {jwtToken && jwtToken.trim().length > 0 && jwtToken.trim().length <= 10 && (
                <div className="text-yellow-400 text-sm flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  JWT too short - please enter a valid token
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
