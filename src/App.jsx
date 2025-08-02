import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { MapPin, X, Youtube, List, Plus, Play, Pause, Trash2, Key, Loader2 } from 'lucide-react';
import EnhancedFreeMap from './components/EnhancedFreeMap.jsx';
import './App.css';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker for PDF.js - REQUIRED FOR PDF RENDERING
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [videoPlaybackState, setVideoPlaybackState] = useState(null);

  const jitsiContainerRef = useRef(null);
  const [jitsiApi, setJitsiApi] = useState(null);

  // Refs for drag and drop
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Helper function to format time in MM:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds === null) {
      return '00:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Generate unique participant ID
  const generateParticipantId = () => {
    let id = localStorage.getItem('jitsi_participant_id');
    if (!id) {
      id = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('jitsi_participant_id', id);
    }
    return id;
  };

  // Function to fetch YouTube video title using oEmbed API
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

  // Store playlist in localStorage with timestamp
  const storePlaylistLocally = (playlistData) => {
    const data = {
      playlist: playlistData,
      timestamp: Date.now(),
      participantId: participantId,
    };
    localStorage.setItem('jitsi_shared_playlist', JSON.stringify(data));
  };

  // Load playlist from local storage
  const loadPlaylistFromLocalStorage = useCallback(() => {
    const storedData = localStorage.getItem('jitsi_shared_playlist');
    if (storedData) {
      try {
        const { playlist, timestamp } = JSON.parse(storedData);
        // We can add logic to only load if it's recent
        if (playlist && Array.isArray(playlist)) {
          setPlaylist(playlist);
          console.log(`Loaded playlist from local storage (${playlist.length} items)`);
        }
      } catch (error) {
        console.error('Failed to parse playlist from local storage:', error);
        localStorage.removeItem('jitsi_shared_playlist');
      }
    }
  }, []);

  // Broadcast playlist using data channels
  const broadcastPlaylistUpdate = useCallback((action, data) => {
    if (!jitsiApi) return;

    const message = {
      type: 'PLAYLIST_SYNC',
      action: action, // 'ADD', 'REMOVE', 'FULL_SYNC', 'REORDER'
      data: data,
      participantId: participantId,
      timestamp: Date.now(),
    };

    try {
      // Use data channels only to avoid spamming the chat
      jitsiApi.executeCommand('sendEndpointTextMessage', '', JSON.stringify(message));
      console.log('Sent playlist update via data channel:', message);
    } catch (error) {
      console.error('Error sending playlist update via data channel:', error);
    }
  }, [jitsiApi, participantId]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((messageData) => {
    try {
      let message;
      if (messageData.data) {
        message = JSON.parse(messageData.data);
      } else {
        return;
      }

      if (!message.participantId || message.participantId === participantId) {
        console.log('Ignoring own message or message without participantId:', message);
        return; // Ignore own messages
      }

      // Handle playlist updates
      if (message.type === 'PLAYLIST_SYNC') {
        console.log('Received playlist update:', message);

        switch (message.action) {
          case 'ADD':
            setPlaylist((prev) => {
              const exists = prev.find((video) => video.url === message.data.url);
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
          case 'REORDER':
            setPlaylist(message.data);
            storePlaylistLocally(message.data);
            break;
        }
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }, [participantId, setPlaylist]);

  const initializeJitsi = useCallback(async () => {
    console.log('=== initializeJitsi called ===');

    if (isInitializing) {
      console.log('Already initializing Jitsi, skipping this call.');
      return;
    }

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

    setIsInitializing(true);

    try {
      // Clear container
      if (jitsiContainerRef.current) {
        while (jitsiContainerRef.current.firstChild) {
          jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
        }
      }

      // Load playlist from local storage on new meeting initialization
      loadPlaylistFromLocalStorage();

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
          // Enhanced configuration for better messaging
          channelLastN: -1,
          enableDataChannels: true,
          enableP2P: true,
          p2p: {
            enabled: true,
          },
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'closedcaptions',
            'desktop',
            'fullscreen',
            'fodeviceselection',
            'hangup',
            'profile',
            'chat',
            'recording',
            'livestreaming',
            'etherpad',
            'sharedvideo',
            'settings',
            'raisehand',
            'videoquality',
            'filmstrip',
            'invite',
            'feedback',
            'stats',
            'shortcuts',
            'tileview',
            'videobackgroundblur',
            'download',
            'help',
            'mute-everyone',
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

      // Generate or retrieve participant ID
      const newParticipantId = generateParticipantId();
      setParticipantId(newParticipantId);

      // Event listeners
      api.addEventListener('videoConferenceJoined', (event) => {
        console.log('Joined conference:', event);
      });

      api.addEventListener('participantJoined', (event) => {
        console.log('Participant joined:', event);
        // Send current data to new participant to sync the playlist
        setTimeout(() => {
          if (playlist.length > 0) {
            broadcastPlaylistUpdate('FULL_SYNC', playlist);
          }
        }, 1000);
      });

      // Listen for data channel messages
      api.addEventListener('endpointTextMessageReceived', (event) => {
        handleIncomingMessage(event);
      });

      // Listen for video playback state changes
      api.addEventListener('sharedVideo', (event) => {
        console.log('Shared video event received:', event);
        if (event.url) {
          setVideoPlaybackState({
            url: event.url,
            time: event.time,
            duration: event.duration,
            state: event.state,
          });
          setIsVideoSharing(true);
          setCurrentSharedVideo(event.url);
        } else {
          // If the URL is null, the video has stopped
          setVideoPlaybackState(null);
          setIsVideoSharing(false);
          setCurrentSharedVideo('');
        }
      });

      // Wait for API to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (api.isAudioMuted !== undefined && api.isVideoMuted !== undefined) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      setJitsiApi(api);
      setJitsiInitialized(true);
    } catch (error) {
      console.error('Error during Jitsi initialization:', error);
      setJitsiInitialized(false);
      setJitsiApi(null);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, jitsiInitialized, jitsiApi, jwtToken, playlist, broadcastPlaylistUpdate, handleIncomingMessage, loadPlaylistFromLocalStorage]);

  const cleanupJitsi = () => {
    console.log('=== cleanupJitsi called ===');

    if (jitsiApi) {
      try {
        jitsiApi.dispose();
      } catch (error) {
        console.error('Error disposing Jitsi API:', error);
      }
      setJitsiApi(null);
    }

    setJitsiInitialized(false);
    setIsVideoSharing(false);
    setCurrentSharedVideo('');
    setParticipantId('');

    if (jitsiContainerRef.current) {
      while (jitsiContainerRef.current.firstChild) {
        jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
      }
    }
  };

  useEffect(() => {
    const jitsiScriptUrl = 'https://8x8.vc/vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/external_api.js';
    const existingScript = document.querySelector(`script[src="${jitsiScriptUrl}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = jitsiScriptUrl;
      script.async = true;
      script.onload = () => {
        initializeJitsi();
      };
      script.onerror = () => {
        console.error('Failed to load Jitsi External API script.');
      };
      document.head.appendChild(script);

      return () => {
        cleanupJitsi();
      };
    } else {
      initializeJitsi();
      return () => {
        cleanupJitsi();
      };
    }
  }, [initializeJitsi]);

  const toggleMap = () => {
    setShowMap(!showMap);
    if (showPlaylist) {
      setShowPlaylist(false);
    }
  };

  const shareVideoDirectly = async () => {
    if (jitsiApi && videoUrl) {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (videoId) {
        try {
          jitsiApi.executeCommand('startShareVideo', videoUrl);
          setIsVideoSharing(true);
          setCurrentSharedVideo(videoUrl);
          setVideoUrl('');
        } catch (error) {
          console.error('Error sharing video:', error);
          alert('Failed to share video. Please make sure you have joined the meeting.');
        }
      } else {
        alert('Please enter a valid YouTube URL');
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
      } catch (error) {
        console.error('Error stopping video:', error);
      }
    }
  };

  const playOrPauseVideo = (action) => {
    if (jitsiApi) {
      jitsiApi.executeCommand('toggleShareVideo', action);
    }
  };

  const addToPlaylist = async () => {
    if (videoUrl && extractYouTubeVideoId(videoUrl)) {
      setIsLoadingVideoTitle(true);
      const videoId = extractYouTubeVideoId(videoUrl);

      try {
        const videoTitle = await fetchYouTubeVideoTitle(videoUrl);
        const newVideo = {
          id: Date.now() + Math.random(), // Ensure unique ID
          url: videoUrl,
          videoId: videoId,
          title: videoTitle,
        };

        setPlaylist((prev) => {
          const newPlaylist = [...prev, newVideo];
          storePlaylistLocally(newPlaylist);
          broadcastPlaylistUpdate('ADD', newVideo); // Broadcast after local state update
          return newPlaylist;
        });
        setVideoUrl('');
      } catch (error) {
        console.error('Error adding video to playlist:', error);
        const newVideo = {
          id: Date.now() + Math.random(),
          url: videoUrl,
          videoId: videoId,
          title: `Video ${playlist.length + 1}`,
        };
        setPlaylist((prev) => {
          const newPlaylist = [...prev, newVideo];
          storePlaylistLocally(newPlaylist);
          broadcastPlaylistUpdate('ADD', newVideo);
          return newPlaylist;
        });
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
      broadcastPlaylistUpdate('REMOVE', { id }); // Broadcast after local state update
      return newPlaylist;
    });
  };

  const shareFromPlaylist = (url) => {
    if (jitsiApi) {
      try {
        if (url === currentSharedVideo) {
          stopVideoSharing();
        } else {
          jitsiApi.executeCommand('startShareVideo', url);
          setIsVideoSharing(true);
          setCurrentSharedVideo(url);
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
    if (showMap) {
      setShowMap(false);
    }
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
    await initializeJitsi();
  };

  const toggleJwtModal = () => {
    setShowJwtModal(!showJwtModal);
  };

  // Handle drag and drop for playlist reordering
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const newPlaylist = [...playlist];
    const draggedItem = newPlaylist.splice(dragItem.current, 1)[0];
    newPlaylist.splice(dragOverItem.current, 0, draggedItem);
    setPlaylist(newPlaylist);
    storePlaylistLocally(newPlaylist);
    broadcastPlaylistUpdate('REORDER', newPlaylist);
  };

  const filteredPlaylist = playlist.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentVideoFromPlaylist = playlist.find(video => video.url === currentSharedVideo);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-white text-xl font-semibold">Lenskart Video Conference</h1>
        </div>
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
                  shareVideoDirectly();
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
                  {isLoadingVideoTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
            onClick={togglePlaylist}
            variant={showPlaylist ? 'destructive' : 'default'}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            disabled={isInitializing}
          >
            <List className="w-4 h-4" />
            Playlist ({playlist.length})
          </Button>
          <Button
            onClick={toggleMap}
            variant={showMap ? 'destructive' : 'default'}
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
        <div className={`${showMap || showPlaylist ? 'w-1/2' : 'w-full'} h-full bg-black flex flex-col min-h-0 relative`}>
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

          {videoPlaybackState && videoPlaybackState.url && (
            <div className="absolute bottom-4 left-4 right-4 bg-gray-800 bg-opacity-75 p-3 rounded-lg flex items-center space-x-3">
              <div className="flex-grow">
                <div className="flex items-center justify-between text-sm text-white mb-1">
                  <span className="font-semibold">{currentVideoFromPlaylist?.title || 'Shared Video'}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">{formatTime(videoPlaybackState.time)}</span>
                    <div className="w-40 h-1 rounded-full bg-gray-600 overflow-hidden">
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(videoPlaybackState.time / videoPlaybackState.duration) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{formatTime(videoPlaybackState.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Playlist Panel */}
        {showPlaylist && (
          <div className="w-1/2 h-full bg-gray-800 border-l border-gray-600 flex flex-col min-h-0">
            <div className="p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white text-lg font-semibold">Playlist</h2>
              </div>
              <input
                type="text"
                placeholder="Search videos by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredPlaylist.length === 0 && playlist.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No videos in playlist</p>
                  <p className="text-sm">Add YouTube URLs to build your shared playlist</p>
                </div>
              ) : filteredPlaylist.length === 0 && playlist.length > 0 ? (
                <div className="text-gray-400 text-center py-8">
                  <p>No videos found for your search query.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredPlaylist.map((video, index) => (
                    <div
                      key={video.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="bg-gray-700 rounded-lg p-3 cursor-grab hover:bg-gray-600 transition-colors"
                      style={{
                        ...(index === dragOverItem.current && {
                          border: '2px solid #6366f1',
                          transform: 'scale(1.02)',
                        }),
                        ...(index === dragItem.current && {
                          opacity: 0.5,
                        }),
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm leading-tight mb-1">{video.title}</h3>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => shareFromPlaylist(video.url)}
                            variant="ghost"
                            size="sm"
                            title={video.url === currentSharedVideo ? "Stop this video" : "Share this video now"}
                            disabled={isInitializing}
                          >
                            {video.url === currentSharedVideo ? (
                              <Pause className="w-4 h-4 text-red-400" />
                            ) : (
                              <Play className="w-4 h-4 text-green-400" />
                            )}
                          </Button>
                          <Button
                            onClick={() => removeFromPlaylist(video.id)}
                            variant="ghost"
                            size="sm"
                            title="Remove from playlist"
                            disabled={isInitializing}
                          >
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
          <div className="w-1/2 h-full bg-gray-900 border-l border-gray-600 flex flex-col min-h-0">
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

#hehe