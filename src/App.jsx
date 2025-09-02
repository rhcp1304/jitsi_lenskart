import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  MapPin, X, Youtube, List, Plus, Play, Trash2, Loader2, Search, ChevronDown, AlertCircle,
  Clock, PauseCircle,
} from 'lucide-react';
import EnhancedFreeMap from './components/EnhancedFreeMap.jsx';
import './App.css';
import LenskartLogo from './logo.png';
import JitsiMeeting from './JitsiMeeting.jsx';

function App() {
  const [showMap, setShowMap] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoSharing, setIsVideoSharing] = useState(false);
  const [currentSharedVideo, setCurrentSharedVideo] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isLoadingVideoTitle, setIsLoadingVideoTitle] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timestamps, setTimestamps] = useState([]);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  const jitsiApiRef = useRef(null);

  const extractYouTubeVideoId = (url) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
        return urlObj.searchParams.get('v');
      }
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
      }
    } catch (e) {
      console.error('Invalid URL:', e);
    }
    return null;
  };

  const shareVideoDirectly = () => {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (videoId && jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('startShareVideo', videoUrl);
      setIsVideoSharing(true);
      setCurrentSharedVideo(videoUrl);
      setVideoUrl('');
    } else {
      setErrorMessage('Invalid YouTube URL or Jitsi API not ready.');
      setShowErrorModal(true);
    }
  };

  const stopVideoSharing = () => {
    if (jitsiApiRef.current && isVideoSharing) {
      jitsiApiRef.current.executeCommand('stopShareVideo');
      setIsVideoSharing(false);
      setCurrentSharedVideo('');
    }
  };

  const fetchVideoTitle = async (url) => {
    setIsLoadingVideoTitle(true);
    try {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch video title.');
      }
      const data = await response.json();
      if (data.title) {
        return data.title;
      }
      throw new Error('No title found.');
    } catch (e) {
      console.error('Error fetching video title:', e);
      return 'Unknown Title';
    } finally {
      setIsLoadingVideoTitle(false);
    }
  };

  const addToPlaylist = async () => {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      setErrorMessage('Please enter a valid YouTube URL.');
      setShowErrorModal(true);
      return;
    }

    const title = await fetchVideoTitle(videoUrl);
    setPlaylist((prev) => [...prev, {
      id: Date.now(),
      url: videoUrl,
      title: title,
    }]);
    setVideoUrl('');
  };

  const removeFromPlaylist = (id) => {
    setPlaylist((prev) => prev.filter(video => video.id !== id));
  };

  const handleShareVideo = (url) => {
    stopVideoSharing();
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('startShareVideo', url);
      setIsVideoSharing(true);
      setCurrentSharedVideo(url);
    }
  };

  const logTimestamp = (label) => {
    const now = new Date();
    setTimestamps((prev) => [...prev, {
      time: now.toLocaleTimeString(),
      label: label || 'Manual note'
    }]);
  };

  const handleRecordingStarted = () => {
    logTimestamp('Recording started');
  };

  const handleRecordingStopped = () => {
    logTimestamp('Recording stopped');
  };

  const toggleMap = () => {
    setShowMap(!showMap);
    if (showPlaylist) setShowPlaylist(false);
    if (showTimestamps) setShowTimestamps(false);
  };

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist);
    if (showMap) setShowMap(false);
    if (showTimestamps) setShowTimestamps(false);
  };

  const toggleTimestamps = () => {
    setShowTimestamps(!showTimestamps);
    if (showPlaylist) setShowPlaylist(false);
    if (showMap) setShowMap(false);
  };

  const handleDragStart = (e, video) => {
    setDraggedItem(video);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, targetVideo) => {
    if (!draggedItem) return;

    const newPlaylist = [...playlist];
    const draggedIndex = newPlaylist.findIndex(v => v.id === draggedItem.id);
    const targetIndex = newPlaylist.findIndex(v => v.id === targetVideo.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [removed] = newPlaylist.splice(draggedIndex, 1);
    newPlaylist.splice(targetIndex, 0, removed);
    setPlaylist(newPlaylist);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const filteredPlaylist = playlist.filter(video => video.title.toLowerCase().includes(''));

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 p-4 flex flex-col md:flex-row justify-between items-center flex-shrink-0 shadow-lg">
        <div className="flex items-center mb-4 md:mb-0">
          <img src={LenskartLogo} alt="Lenskart Logo" className="h-8 w-auto mr-4" />
          <h1 className="text-xl font-bold">Lenskart Meet</h1>
        </div>

        {/* Desktop Controls */}
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Paste YouTube URL..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 rounded-lg bg-gray-700 text-sm placeholder-gray-400 border border-gray-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
              onKeyPress={(e) => { if (e.key === 'Enter') shareVideoDirectly(); }}
            />
            <Button onClick={shareVideoDirectly} className="bg-blue-600 hover:bg-blue-700 transition-colors" disabled={!videoUrl.trim()}>
              Share
            </Button>
            <Button onClick={stopVideoSharing} className="bg-red-600 hover:bg-red-700 transition-colors">
              Stop
            </Button>
            <Button onClick={addToPlaylist} className="bg-green-600 hover:bg-green-700 text-white transition-colors" disabled={!videoUrl.trim() || isLoadingVideoTitle}>
              {isLoadingVideoTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button onClick={() => logTimestamp('Manual note')} variant="ghost" className="bg-yellow-600 hover:bg-yellow-700 text-white" title="Log Timestamp">
              <Clock className="w-4 h-4 mr-2" /> Note Time
            </Button>
            <Button onClick={togglePlaylist} variant="ghost" size="icon" className="text-gray-400 hover:bg-gray-700 hover:text-white" title={`Videos (${playlist.length})`}>
              {showPlaylist ? <ChevronDown className="w-5 h-5" /> : <List className="w-5 h-5" />}
            </Button>
            <Button onClick={toggleMap} variant="ghost" size="icon" className="text-red-500 hover:bg-gray-700 hover:text-red-400" title="Show Map">
              {showMap ? <X className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </Button>
            <Button onClick={toggleTimestamps} variant="ghost" size="icon" className="text-yellow-400 hover:bg-gray-700 hover:text-yellow-300" title="Show Timestamps">
              {showTimestamps ? <ChevronDown className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        {/* Jitsi Container using the new component */}
        <div className="w-full h-full bg-black flex flex-col min-h-0 relative">
          <JitsiMeeting
            setJitsiApiRef={jitsiApiRef}
            onRecordingStarted={handleRecordingStarted}
            onRecordingStopped={handleRecordingStopped}
          />
        </div>

        {/* Panels Container */}
        {(showPlaylist || showMap || showTimestamps) && (
          <div className="fixed bottom-0 left-0 right-0 h-2/3 md:h-full md:relative md:w-1/2 bg-gray-800 border-t md:border-l border-gray-700 shadow-xl flex flex-col z-20 transition-transform duration-300 ease-in-out">
            {/* Playlist Panel */}
            {showPlaylist && (
              <div className="flex flex-col h-full">
                <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
                  <h2 className="text-lg font-semibold">Video Playlist ({playlist.length})</h2>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search videos..."
                      className="pl-8 pr-4 py-1.5 rounded-lg bg-gray-700 text-sm placeholder-gray-400 w-48 border border-gray-600 focus:border-white focus:ring-1 focus:ring-white transition-colors"
                      // Add filter logic if needed
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <ul className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {filteredPlaylist.length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      <Youtube className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No videos in the playlist.</p>
                      <p className="text-sm">Paste a YouTube URL and click "+" to add one.</p>
                    </div>
                  ) : (
                    filteredPlaylist.map((video) => (
                      <li
                        key={video.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, video)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, video)}
                        onDragEnd={handleDragEnd}
                        className={`bg-gray-700/50 rounded-lg p-3 shadow-sm flex items-center space-x-3 cursor-grab ${draggedItem && draggedItem.id === video.id ? 'opacity-50' : ''}`}
                      >
                        <Play
                          className="w-6 h-6 text-green-500 cursor-pointer flex-shrink-0 hover:text-green-400 transition-colors"
                          onClick={() => handleShareVideo(video.url)}
                          title="Share this video"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{video.title}</p>
                          <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:underline truncate">{video.url}</a>
                        </div>
                        <Trash2
                          className="w-4 h-4 text-red-500 cursor-pointer flex-shrink-0 hover:text-red-400 transition-colors"
                          onClick={() => removeFromPlaylist(video.id)}
                          title="Remove from playlist"
                        />
                      </li>
                    ))
                  )}
                </ul>
                <div className="bg-gray-900 p-4 border-t border-gray-700 text-center flex-shrink-0">
                  <span className="text-sm text-gray-400">Drag and drop to reorder</span>
                </div>
              </div>
            )}

            {/* Map Panel */}
            {showMap && (
              <div className="flex flex-col h-full">
                <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
                  <h2 className="text-lg font-semibold">Map Services</h2>
                </div>
                <div className="flex-1 min-h-0">
                  <EnhancedFreeMap />
                </div>
              </div>
            )}

            {/* Timestamps Panel */}
            {showTimestamps && (
              <div className="flex flex-col h-full">
                <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
                  <h2 className="text-lg font-semibold">Meeting Timestamps ({timestamps.length})</h2>
                  <Button onClick={() => setTimestamps([])} variant="ghost" size="sm" className="text-red-500 hover:bg-gray-700 hover:text-red-400" title="Clear Timestamps">
                    Clear All
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {timestamps.length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No timestamps logged yet.</p>
                      <p className="text-sm">Click "Note Time" to add a timestamp.</p>
                    </div>
                  ) : (
                    timestamps.map((ts, index) => (
                      <div key={index} className="bg-gray-700/50 rounded-lg p-3 shadow-sm flex items-center justify-between">
                        <span className="font-mono text-sm">{ts.time}</span>
                        <span className="text-sm text-gray-300">{ts.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-gray-950/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
                <h2 className="text-white text-xl font-semibold">Error</h2>
              </div>
              <Button onClick={() => setShowErrorModal(false)} variant="ghost" size="icon" className="text-gray-400 hover:bg-gray-700">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {errorMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowErrorModal(false)} className="bg-red-600 hover:bg-red-700 text-white">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;