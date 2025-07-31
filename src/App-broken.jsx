import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { MapPin, X, Youtube, Search, List, Plus, Play, Trash2 } from 'lucide-react'
import YouTubeSearch from './components/YouTubeSearch.jsx'
import MapWithSearch from './components/MapWithSearch.jsx'
import 'leaflet/dist/leaflet.css'
import 'leaflet-control-geocoder/dist/Control.Geocoder.css'
import 'leaflet-control-geocoder'
import L from 'leaflet'
import './App.css'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function App() {
  const [showMap, setShowMap] = useState(false)
  const [showYouTubeSearch, setShowYouTubeSearch] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [isVideoSharing, setIsVideoSharing] = useState(false)
  const [currentSharedVideo, setCurrentSharedVideo] = useState('')
  const [playlist, setPlaylist] = useState([])
  const [showPlaylist, setShowPlaylist] = useState(false)
  const jitsiContainerRef = useRef(null)
  const [jitsiApi, setJitsiApi] = useState(null)

  useEffect(() => {
    // Load Jitsi Meet External API script
    const script = document.createElement('script')
    script.src = 'https://8x8.vc/vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/external_api.js'
    script.async = true
    script.onload = () => {
      // Initialize Jitsi Meet API
      if (window.JitsiMeetExternalAPI && jitsiContainerRef.current) {
        const api = new window.JitsiMeetExternalAPI("8x8.vc", {
          roomName: "vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/SampleAppRoutineSleepsWorkReportedly",
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: true,
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
          }
        })
        setJitsiApi(api)
      }
    }
    document.head.appendChild(script)

    return () => {
      if (jitsiApi) {
        jitsiApi.dispose()
      }
    }
  }, [])

  const toggleMap = () => {
    setShowMap(!showMap)
  }

  const toggleYouTubeSearch = () => {
    setShowYouTubeSearch(!showYouTubeSearch)
  }

  const handleVideoSelect = (video) => {
    setSelectedVideo(video)
    // You can integrate this with Jitsi's shared video feature
    if (jitsiApi) {
      // Example: Share video in Jitsi conference
      console.log('Sharing video in conference:', video.snippet.title)
      // jitsiApi.executeCommand('startShareVideo', `https://www.youtube.com/watch?v=${video.id.videoId}`)
    }
  }

  const shareVideoDirectly = () => {
    if (jitsiApi && videoUrl) {
      // Extract video ID from YouTube URL
      const videoId = extractYouTubeVideoId(videoUrl)
      if (videoId) {
        const fullUrl = `https://www.youtube.com/watch?v=${videoId}`
        jitsiApi.executeCommand('startShareVideo', fullUrl)
        setIsVideoSharing(true)
        setCurrentSharedVideo(videoUrl)
        setVideoUrl('') // Clear the input
      } else {
        alert('Please enter a valid YouTube URL')
      }
    } else if (!jitsiApi) {
      alert('Please join the meeting first')
    } else {
      alert('Please enter a YouTube URL')
    }
  }

  const stopVideoSharing = () => {
    if (jitsiApi && isVideoSharing) {
      jitsiApi.executeCommand('stopShareVideo')
      setIsVideoSharing(false)
      setCurrentSharedVideo('')
    }
  }

  const addToPlaylist = () => {
    if (videoUrl && extractYouTubeVideoId(videoUrl)) {
      const videoId = extractYouTubeVideoId(videoUrl)
      const newVideo = {
        id: Date.now(),
        url: videoUrl,
        videoId: videoId,
        title: `Video ${playlist.length + 1}`,
        addedAt: new Date().toLocaleString()
      }
      setPlaylist([...playlist, newVideo])
      setVideoUrl('')
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const removeFromPlaylist = (id) => {
    setPlaylist(playlist.filter(video => video.id !== id))
  }

  const shareFromPlaylist = (url) => {
    if (jitsiApi) {
      jitsiApi.executeCommand('startShareVideo', url)
      setIsVideoSharing(true)
      setCurrentSharedVideo(url)
    }
  }

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist)
  }

  const extractYouTubeVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
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
              disabled={isVideoSharing}
            />
            {!isVideoSharing ? (
              <>
                <Button
                  onClick={shareVideoDirectly}
                  variant="default"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  disabled={!videoUrl.trim()}
                >
                  <Youtube className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  onClick={addToPlaylist}
                  variant="default"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  disabled={!videoUrl.trim()}
                >
                  <Plus className="w-4 h-4" />
                  Add to Playlist
                </Button>
              </>
            ) : (
              <Button
                onClick={stopVideoSharing}
                variant="destructive"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
              >
                <X className="w-4 h-4" />
                Stop Video
              </Button>
            )}
          </div>
          <Button
            onClick={togglePlaylist}
            variant={showPlaylist ? "destructive" : "default"}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <List className="w-4 h-4" />
            Playlist ({playlist.length})
          </Button>
          <Button
            onClick={toggleMap}
            variant={showMap ? "destructive" : "default"}
            className="flex items-center gap-2"
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
      <div className="flex-1 flex">
        {/* Jitsi Container */}
        <div className={showMap || showPlaylist ? 'w-1/2 h-full bg-black' : 'w-full h-full bg-black'}>
          <div
            ref={jitsiContainerRef}
            id="jitsi-container"
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Playlist Panel */}
        {showPlaylist && (
          <div className="w-1/2 h-full bg-gray-800 border-l border-gray-600 overflow-y-auto">
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
                        <div className="flex-1">
                          <h3 className="text-white font-medium">{video.title}</h3>
                          <p className="text-gray-400 text-sm truncate">{video.url}</p>
                          <p className="text-gray-500 text-xs">Added: {video.addedAt}</p>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <Button
                            onClick={() => shareFromPlaylist(video.url)}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={isVideoSharing}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => removeFromPlaylist(video.id)}
                            variant="destructive"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700"
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
        )}

        {/* Map Container */}
        {showMap && !showPlaylist && (
          <div className="w-1/2 h-full bg-white">
            <div className="h-full">
              <MapWithSearch />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

