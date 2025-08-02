import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  MapPin, X, Youtube, List, Plus, Play, Trash2, Settings, Key, Loader2, Users, Volume,
  VolumeX, Wifi, WifiOff, Search
} from 'lucide-react';
import EnhancedFreeMap from './components/EnhancedFreeMap.jsx';
import './App.css';

function App() {
  const [showMap, setShowMap] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoSharing, setIsVideoSharing] = useState(false);
  const [currentSharedVideo, setCurrentSharedVideo] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [jwtToken, setJwtToken] = useState('');
  const [showJwtModal, setShowJwtModal] = useState(false);
  const [jitsiInitialized, setJitsiInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingVideoTitle, setIsLoadingVideoTitle] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [isPlaylistSynced, setIsPlaylistSynced] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [syncStatus, setSyncStatus] = useState('disconnected');
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);

  const jitsiContainerRef = useRef(null);
  const [jitsiApi, setJitsiApi] = useState(null);
  const syncIntervalRef = useRef(null);
  const muteIntervalRef = useRef(null);

  const generateParticipantId = () => {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchYouTubeVideoTitle = async (videoUrl) => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
      if (response.ok) {
        const data = await response.json();
        return data.title || 'Unknown Video';
      }
    } catch (error) {
      console.error('Error fetching video title:', error);
    }
    return 'Unknown Video';
  };

  const storePlaylistLocally = (playlistData) => {
    const data = {
      playlist: playlistData,
      timestamp: Date.now(),
      participantId: participantId,
    };
    localStorage.setItem('jitsi_shared_playlist', JSON.stringify(data));
  };

  const getLocalPlaylist = () => {
    try {
      const data = localStorage.getItem('jitsi_shared_playlist');
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading local playlist:', error);
    }
    return null;
  };

  const broadcastPlaylistUpdate = (action, data) => {
    if (!jitsiApi) return;
    const message = {
      type: 'PLAYLIST_SYNC',
      action: action,
      data: data,
      participantId: participantId,
      timestamp: Date.now(),
    };
    try {
      jitsiApi.executeCommand('sendEndpointTextMessage', '', JSON.stringify(message));
    } catch (error) {
      console.log('Data channel failed, trying chat:', error);
    }
    try {
      const chatMessage = `[PLAYLIST_SYNC] ${JSON.stringify(message)}`;
      jitsiApi.executeCommand('sendChatMessage', chatMessage);
    } catch (error) {
      console.log('Chat method also failed:', error);
    }
    storePlaylistLocally(action === 'FULL_SYNC' ? data : playlist);
    setSyncStatus('syncing');
  };

  const handleIncomingMessage = (messageData) => {
    try {
      let message;
      if (typeof messageData === 'string') {
        if (messageData.startsWith('[PLAYLIST_SYNC]')) {
          message = JSON.parse(messageData.replace('[PLAYLIST_SYNC]', '').trim());
        } else {
          message = JSON.parse(messageData);
        }
      } else if (messageData.data) {
        if (messageData.data.startsWith('[PLAYLIST_SYNC]')) {
          message = JSON.parse(messageData.data.replace('[PLAYLIST_SYNC]', '').trim());
        } else {
          message = JSON.parse(messageData.data);
        }
      } else {
        return;
      }
      if (message.participantId === participantId) return;

      if (message.type === 'PLAYLIST_SYNC') {
        switch (message.action) {
          case 'ADD':
            setPlaylist((prev) => {
              const exists = prev.find((video) => video.id === message.data.id);
              if (!exists) {
                const newPlaylist = [...prev, message.data];
                storePlaylistLocally(newPlaylist);
                return newPlaylist;
              }
              return prev;
            });
            break;
          case 'REMOVE':
            setPlaylist((prev) => {
              const newPlaylist = prev.filter((video) => video.id !== message.data.id);
              storePlaylistLocally(newPlaylist);
              return newPlaylist;
            });
            break;
          case 'FULL_SYNC':
            setPlaylist(message.data);
            storePlaylistLocally(message.data);
            break;
          case 'REORDER':
            setPlaylist(message.data);
            storePlaylistLocally(message.data);
            break;
        }
        setIsPlaylistSynced(true);
        setSyncStatus('connected');
      }

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  };

  const startPeriodicSync = () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    syncIntervalRef.current = setInterval(() => {
      if (jitsiApi && participantId) {
        broadcastPlaylistUpdate('REQUEST_SYNC', null);
        const localData = getLocalPlaylist();
        if (localData && localData.participantId !== participantId) {
          const timeDiff = Date.now() - localData.timestamp;
          if (timeDiff < 30000) {
            setPlaylist(localData.playlist);
            setIsPlaylistSynced(true);
            setSyncStatus('connected');
          }
        }
      }
    }, 5000);
  };

  const muteJitsiSharedVideo = () => {
    try {
      const jitsiVideoContainer = jitsiContainerRef.current;
      if (!jitsiVideoContainer) return;
      const videoIframes = jitsiVideoContainer.querySelectorAll('iframe');
      videoIframes.forEach(iframe => {
        if (iframe.src.includes('youtube.com')) {
          iframe.muted = true;
          iframe.volume = 0;
          const message = JSON.stringify({ event: 'command', func: 'setVolume', args: [0] });
          iframe.contentWindow.postMessage(message, '*');
          const messageMute = JSON.stringify({ event: 'command', func: 'mute' });
          iframe.contentWindow.postMessage(messageMute, '*');
          setAudioMuted(true);
        }
      });
      const allVideos = jitsiVideoContainer.querySelectorAll('video');
      allVideos.forEach(element => {
        if (!element.muted) {
          element.muted = true;
          element.volume = 0;
        }
      });
    } catch (error) {
      console.error('Error muting shared video:', error);
    }
  };

  const stopMutingInterval = () => {
    if (muteIntervalRef.current) {
      clearInterval(muteIntervalRef.current);
      muteIntervalRef.current = null;
    }
  };

  const forceAudioMute = () => {
    stopMutingInterval();
    muteJitsiSharedVideo();
    muteIntervalRef.current = setInterval(muteJitsiSharedVideo, 500);
    setAudioMuted(true);
  };

  const initializeJitsi = async () => {
    if (isInitializing || (jitsiInitialized && jitsiApi)) return;
    if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current) {
      console.warn('JitsiMeetExternalAPI script or container not ready.');
      return;
    }
    setIsInitializing(true);
    setSyncStatus('disconnected');

    try {
      if (jitsiContainerRef.current) {
        while (jitsiContainerRef.current.firstChild) {
          jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
        }
      }
      setPlaylist([]);
      localStorage.removeItem('jitsi_shared_playlist');
      await new Promise((resolve) => setTimeout(resolve, 200));

      const config = {
        roomName: 'vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/SampleAppRoutineSleepsWorkReportedly',
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: true,
          enableWelcomePage: false,
          enableClosePage: false,
          channelLastN: -1,
          enableDataChannels: true,
          enableP2P: true,
          p2p: { enabled: true },
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen', 'fodeviceselection',
            'hangup', 'profile', 'chat', 'recording', 'livestreaming', 'etherpad', 'sharedvideo',
            'settings', 'raisehand', 'videoquality', 'filmstrip', 'invite', 'feedback', 'stats',
            'shortcuts', 'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security',
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
        },
      };

      if (jwtToken && jwtToken.trim() && jwtToken.trim().length > 10) {
        config.jwt = jwtToken.trim();
      }

      const api = new window.JitsiMeetExternalAPI('8x8.vc', config);
      const newParticipantId = generateParticipantId();
      setParticipantId(newParticipantId);

      api.addEventListener('videoConferenceJoined', (event) => {
        setSyncStatus('connected');
        setTimeout(() => {
          startPeriodicSync();
          broadcastPlaylistUpdate('FULL_SYNC', playlist);
        }, 2000);
      });

      api.addEventListener('participantJoined', (event) => {
        setTimeout(() => {
          if (playlist.length > 0) {
            broadcastPlaylistUpdate('FULL_SYNC', playlist);
          }
        }, 1000);
      });

      api.addEventListener('endpointTextMessageReceived', (event) => handleIncomingMessage(event));
      api.addEventListener('incomingMessage', (event) => {
        if (event.message && event.message.includes('[PLAYLIST_SYNC]')) {
          handleIncomingMessage(event.message);
        }
      });
      api.addEventListener('sharedVideoStarted', (event) => {
        setIsVideoSharing(true);
        setCurrentSharedVideo(event.url);
        forceAudioMute();
      });
      api.addEventListener('sharedVideoStopped', (event) => {
        setIsVideoSharing(false);
        setCurrentSharedVideo('');
        stopMutingInterval();
        setAudioMuted(false);
      });

      await new Promise((resolve) => {
        const checkReady = () => {
          if (api.isAudioMuted !== undefined) resolve();
          else setTimeout(checkReady, 100);
        };
        checkReady();
      });

      setJitsiApi(api);
      setJitsiInitialized(true);
    } catch (error) {
      console.error('Error during Jitsi initialization:', error);
      setJitsiInitialized(false);
      setJitsiApi(null);
      setSyncStatus('disconnected');
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanupJitsi = () => {
    stopMutingInterval();
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (jitsiApi) {
      try { jitsiApi.dispose(); } catch (error) { console.error('Error disposing Jitsi API:', error); }
      setJitsiApi(null);
    }
    setJitsiInitialized(false);
    setIsVideoSharing(false);
    setCurrentSharedVideo('');
    setParticipantId('');
    setIsPlaylistSynced(false);
    setAudioMuted(false);
    setSyncStatus('disconnected');
    setPlaylist([]);
    localStorage.removeItem('jitsi_shared_playlist');
    if (jitsiContainerRef.current) {
      while (jitsiContainerRef.current.firstChild) {
        jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
      }
    }
  };

  const initializeJitsiOnLoad = () => {
    const jitsiScriptUrl = 'https://8x8.vc/vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/external_api.js';
    const existingScript = document.querySelector(`script[src="${jitsiScriptUrl}"]`);
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = jitsiScriptUrl;
      script.async = true;
      script.onload = initializeJitsi;
      script.onerror = () => console.error('Failed to load Jitsi External API script.');
      document.head.appendChild(script);
    } else {
      initializeJitsi();
    }
  };

  useEffect(() => {
    initializeJitsiOnLoad();
    return () => { cleanupJitsi(); };
  }, []);

  useEffect(() => {
    if (!jitsiContainerRef.current) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe'))) {
              forceAudioMute();
            }
          });
        }
      });
    });
    observer.observe(jitsiContainerRef.current, { childList: true, subtree: true });
    return () => { observer.disconnect(); };
  }, [jitsiContainerRef]);

  const toggleMap = () => {
    setShowMap(!showMap);
    if (showPlaylist) setShowPlaylist(false);
  };
  const shareVideoDirectly = () => {
    if (jitsiApi && videoUrl) {
      try {
        if (isVideoSharing) stopVideoSharing();
        jitsiApi.executeCommand('startShareVideo', videoUrl);
        setIsVideoSharing(true);
        setCurrentSharedVideo(videoUrl);
        setVideoUrl('');
        forceAudioMute();
      } catch (error) {
        console.error('Error sharing video:', error);
        alert('Failed to share video. Please make sure you have joined the meeting.');
      }
    } else if (!jitsiApi) {
      alert('Please wait for the meeting to load and join first');
    } else {
      alert('Please enter a YouTube URL');
    }
  };

  const stopVideoSharing = () => {
    if (jitsiApi && isVideoSharing) {
      try {
        jitsiApi.executeCommand('stopShareVideo');
        setIsVideoSharing(false);
        setCurrentSharedVideo('');
        stopMutingInterval();
        setAudioMuted(false);
      } catch (error) {
        console.error('Error stopping video:', error);
      }
    }
  };

  const addToPlaylist = async () => {
    if (videoUrl && extractYouTubeVideoId(videoUrl)) {
      setIsLoadingVideoTitle(true);
      const videoId = extractYouTubeVideoId(videoUrl);
      try {
        const videoTitle = await fetchYouTubeVideoTitle(videoUrl);
        const newVideo = { id: Date.now() + Math.random(), url: videoUrl, videoId: videoId, title: videoTitle, };
        setPlaylist((prev) => {
          const newPlaylist = [...prev, newVideo];
          storePlaylistLocally(newPlaylist);
          return newPlaylist;
        });
        setVideoUrl('');
        broadcastPlaylistUpdate('ADD', newVideo);
        setIsPlaylistSynced(true);
      } catch (error) {
        console.error('Error adding video to playlist:', error);
        const newVideo = { id: Date.now() + Math.random(), url: videoUrl, videoId: videoId, title: `Video ${playlist.length + 1}`, };
        setPlaylist((prev) => {
          const newPlaylist = [...prev, newVideo];
          storePlaylistLocally(newPlaylist);
          return newPlaylist;
        });
        broadcastPlaylistUpdate('ADD', newVideo);
        setVideoUrl('');
      } finally {
        setIsLoadingVideoTitle(false);
      }
    } else {
      alert('Please enter a valid YouTube URL');
    }
  };

  const removeFromPlaylist = (id) => {
    setPlaylist((prev) => {
      const newPlaylist = prev.filter((video) => video.id !== id);
      storePlaylistLocally(newPlaylist);
      return newPlaylist;
    });
    broadcastPlaylistUpdate('REMOVE', { id });
  };
  const handleShareVideo = (url) => {
    if (jitsiApi) {
      try {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          if (isVideoSharing) stopVideoSharing();
          jitsiApi.executeCommand('startShareVideo', url);
          setIsVideoSharing(true);
          setCurrentSharedVideo(url);
          forceAudioMute();
        } else {
          alert('Could not extract video ID from URL');
        }
      } catch (error) {
        console.error('Error sharing video from playlist:', error);
        alert('Failed to share video. Please make sure you have joined the meeting.');
      }
    } else {
      alert('Please wait for the meeting to load and join first');
    }
  };

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist);
    if (showMap) setShowMap(false);
  };

  const extractYouTubeVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handleJwtSubmit = async () => {
    setShowJwtModal(false);
    cleanupJitsi();
    await new Promise((resolve) => setTimeout(resolve, 500));
    initializeJitsi();
  };

  const toggleJwtModal = () => setShowJwtModal(!showJwtModal);

  const handleDragStart = (e, video) => {
    setDraggedItem(video);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, targetVideo) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetVideo.id) return;
    const oldIndex = playlist.findIndex(item => item.id === draggedItem.id);
    const newIndex = playlist.findIndex(item => item.id === targetVideo.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newPlaylist = [...playlist];
    newPlaylist.splice(oldIndex, 1);
    newPlaylist.splice(newIndex, 0, draggedItem);
    setPlaylist(newPlaylist);
    storePlaylistLocally(newPlaylist);
    broadcastPlaylistUpdate('REORDER', newPlaylist);
    setDraggedItem(null);
  };
  const handleDragEnd = () => setDraggedItem(null);
  const filteredPlaylist = playlist.filter(video => video.title.toLowerCase().includes(searchTerm.toLowerCase()));


  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex flex-col md:flex-row justify-between items-center flex-shrink-0">
        {/* Title */}
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <h1 className="text-white text-xl font-semibold">Lenskart Video Conference</h1>
        </div>

        {/* Main Controls */}
        <div className="flex flex-col md:flex-row flex-wrap gap-2 items-center md:items-stretch w-full md:w-auto">
          {/* Direct Video Share Input and Buttons */}
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
            <input
              type="text"
              placeholder="Paste YouTube URL to share..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full md:w-64 px-3 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none"
              onKeyPress={(e) => { if (e.key === 'Enter') shareVideoDirectly(); }}
              disabled={isInitializing || isLoadingVideoTitle}
            />
            {!isVideoSharing ? (
              <>
                <Button onClick={shareVideoDirectly} variant="default" className="w-full md:w-auto flex items-center gap-2 bg-green-600 hover:bg-green-700" disabled={!videoUrl.trim() || isInitializing || isLoadingVideoTitle}>
                  <Youtube className="w-4 h-4" />
                  Share
                </Button>
                <Button onClick={addToPlaylist} variant="default" className="w-full md:w-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700" disabled={!videoUrl.trim() || isInitializing || isLoadingVideoTitle}>
                  {isLoadingVideoTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isLoadingVideoTitle ? 'Loading...' : 'Add to Playlist'}
                </Button>
              </>
            ) : (
              <Button onClick={stopVideoSharing} variant="destructive" className="w-full md:w-auto flex items-center gap-2 bg-red-600 hover:bg-red-700" disabled={isInitializing}>
                <X className="w-4 h-4" />
                Stop Video
              </Button>
            )}
          </div>

          {/* Other Buttons */}
          <div className="flex flex-wrap gap-2 mt-2 md:mt-0 w-full md:w-auto justify-center md:justify-start">

            <Button onClick={toggleJwtModal} variant="default" className="flex-1 md:flex-auto flex items-center gap-2 bg-orange-600 hover:bg-orange-700" title="Configure JWT for premium features" disabled={isInitializing}>
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">JWT</span>
            </Button>
            <Button onClick={togglePlaylist} variant={showPlaylist ? 'destructive' : 'default'} className="flex-1 md:flex-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-700" disabled={isInitializing}>
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Videos ({playlist.length})</span>
            </Button>
            <Button onClick={toggleMap} variant={showMap ? 'destructive' : 'default'} className="flex-1 md:flex-auto flex items-center gap-2" disabled={isInitializing}>
              {showMap ? (
                <>
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Close Map</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">Show Map</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Jitsi Container */}
        <div className={`${showMap || showPlaylist ? 'w-full md:w-1/2' : 'w-full'} h-full bg-black flex flex-col min-h-0 relative`}>
          {isInitializing && (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
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
              display: isInitializing ? 'none' : 'block',
            }}
          />
        </div>

        {/* Team Playlist Panel */}
        {showPlaylist && (
          <div className="w-full md:w-1/2 h-full bg-gray-800 border-l border-gray-600 flex flex-col min-h-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-semibold">Video Playlist</h2>
              </div>
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredPlaylist.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No videos found</p>
                  <p className="text-sm">Add YouTube URLs or try a different search term.</p>
                </div>
              ) : (
                <div className="space-y-3 p-4 pt-0">
                  {filteredPlaylist.map((video) => (
                    <div
                      key={video.id}
                      className={`bg-gray-700 rounded-lg p-3 cursor-move ${draggedItem?.id === video.id ? 'opacity-50 border-2 border-blue-500' : ''} ${currentSharedVideo === video.url ? 'border-2 border-green-500' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, video)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, video)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm leading-tight">{video.title}</h3>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                          {currentSharedVideo === video.url ? (
                            <Button onClick={stopVideoSharing} variant="ghost" size="sm" title="Stop this video" disabled={isInitializing}>
                              <X className="w-4 h-4 text-red-400" />
                            </Button>
                          ) : (
                            <Button onClick={() => handleShareVideo(video.url)} variant="ghost" size="sm" title="Play this video now" disabled={isInitializing}>
                              <Play className="w-4 h-4 text-green-400" />
                            </Button>
                          )}
                          <Button onClick={() => removeFromPlaylist(video.id)} variant="ghost" size="sm" title="Remove from playlist" disabled={isInitializing}>
                            <Trash2 className="w-4 h-4 text-red-400" />
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

        {/* Enhanced Free Map Panel */}
        {showMap && (
          <div className="w-full md:w-1/2 h-full bg-gray-900 border-l border-gray-600 flex flex-col min-h-0">
            <EnhancedFreeMap />
          </div>
        )}
      </div>

      {/* JWT Modal */}
      {showJwtModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-xl font-semibold">Enter JWT Token</h2>
              <Button onClick={toggleJwtModal} variant="ghost" size="sm">
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Enter your Jitsi as a Service (JaaS) JSON Web Token to access premium features.
            </p>
            <input
              type="password"
              placeholder="Paste your JWT token here..."
              value={jwtToken}
              onChange={(e) => setJwtToken(e.target.value)}
              className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            />
            <div className="mt-4 flex justify-end">
              <Button onClick={handleJwtSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                Apply JWT and Refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;