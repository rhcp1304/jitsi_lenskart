import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { MapPin, X, Youtube, List, Plus, Play, Trash2, Settings, Key, RefreshCw, Loader2, Users, Volume, VolumeX, Wifi, WifiOff } from 'lucide-react';
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
  const [isPlaylistSynced, setIsPlaylistSynced] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [syncStatus, setSyncStatus] = useState('disconnected');

  const jitsiContainerRef = useRef(null);
  const [jitsiApi, setJitsiApi] = useState(null);
  const syncIntervalRef = useRef(null);

  // Generate unique participant ID
  const generateParticipantId = () => {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  // Get playlist from localStorage
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

  // Broadcast playlist using multiple methods for reliability
  const broadcastPlaylistUpdate = (action, data) => {
    if (!jitsiApi) return;

    const message = {
      type: 'PLAYLIST_SYNC',
      action: action, // 'ADD', 'REMOVE', 'FULL_SYNC'
      data: data,
      participantId: participantId,
      timestamp: Date.now(),
    };

    try {
      // Method 1: Try data channels
      jitsiApi.executeCommand('sendEndpointTextMessage', '', JSON.stringify(message));
      console.log('Sent via data channel:', message);
    } catch (error) {
      console.log('Data channel failed, trying chat:', error);
    }

    try {
      // Method 2: Use chat as backup
      const chatMessage = `[PLAYLIST_SYNC] ${JSON.stringify(message)}`;
      jitsiApi.executeCommand('sendChatMessage', chatMessage);
      console.log('Sent via chat:', message);
    } catch (error) {
      console.log('Chat method also failed:', error);
    }

    // Method 3: Store locally for periodic sync
    storePlaylistLocally(action === 'FULL_SYNC' ? data : playlist);
    setSyncStatus('syncing');
  };

  // Handle incoming messages
  const handleIncomingMessage = (messageData) => {
    try {
      let message;

      // Handle both direct data channel and chat messages
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

      if (message.participantId === participantId) return; // Ignore own messages

      // Handle playlist updates
      if (message.type === 'PLAYLIST_SYNC') {
        console.log('Received playlist update:', message);

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
        }
        setIsPlaylistSynced(true);
        setSyncStatus('connected');
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  };

  // Periodic sync check
  const startPeriodicSync = () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncIntervalRef.current = setInterval(() => {
      if (jitsiApi && participantId) {
        // Request full sync from other participants
        broadcastPlaylistUpdate('REQUEST_SYNC', null);

        // Check local storage for updates from other tabs/windows
        const localData = getLocalPlaylist();
        if (localData && localData.participantId !== participantId) {
          const timeDiff = Date.now() - localData.timestamp;
          if (timeDiff < 30000) {
            // If updated within last 30 seconds
            setPlaylist(localData.playlist);
            setIsPlaylistSynced(true);
            setSyncStatus('connected');
          }
        }
      }
    }, 5000); // Check every 5 seconds
  };

  // Force mute audio for shared videos
  const forceAudioMute = () => {
    try {
      const sharedVideoIframes = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
      sharedVideoIframes.forEach(iframe => {
        if (!iframe.src.includes('mute=1')) {
          const currentSrc = iframe.src;
          iframe.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'mute=1&autoplay=1';
          console.log('Forced mute by modifying iframe src:', iframe.src);
        }
      });

      const allVideos = document.querySelectorAll('video, audio');
      allVideos.forEach(element => {
        if (!element.muted) {
          element.muted = true;
          element.volume = 0;
          console.log('Forced mute on video/audio element:', element);
        }
      });

      // CSS approach to hide audio controls and force mute
      const existingStyle = document.getElementById('video-mute-style');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'video-mute-style';
        style.textContent = `
          .shared-video-container iframe,
          .shared-video-container video,
          .shared-video-container audio {
            muted: true !important;
          }
          .ytp-volume-area,
          .ytp-mute-button,
          .ytp-volume-slider {
            display: none !important;
          }
          .shared-video-container {
            position: relative;
          }
          .shared-video-container::after {
            content: "🔇 MUTED";
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
          }
        `;
        document.head.appendChild(style);
      }

      setAudioMuted(true);
    } catch (error) {
      console.error('Error forcing audio mute:', error);
    }
  };

  const initializeJitsi = async () => {
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
    setSyncStatus('disconnected');

    try {
      // Clear container
      if (jitsiContainerRef.current) {
        while (jitsiContainerRef.current.firstChild) {
          jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
        }
      }

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

      // Generate participant ID
      const newParticipantId = generateParticipantId();
      setParticipantId(newParticipantId);

      // Event listeners
      api.addEventListener('videoConferenceJoined', (event) => {
        console.log('Joined conference:', event);
        setSyncStatus('connected');

        // Load existing data from localStorage
        const localData = getLocalPlaylist();
        if (localData && localData.playlist) {
          setPlaylist(localData.playlist);
          setIsPlaylistSynced(true);
        }

        // Start periodic sync
        setTimeout(() => {
          startPeriodicSync();
          // Request current data from other participants
          broadcastPlaylistUpdate('REQUEST_SYNC', null);
        }, 2000);
      });

      api.addEventListener('participantJoined', (event) => {
        console.log('Participant joined:', event);
        // Send current data to new participant
        setTimeout(() => {
          if (playlist.length > 0) {
            broadcastPlaylistUpdate('FULL_SYNC', playlist);
          }
        }, 1000);
      });

      // Listen for data channel messages
      api.addEventListener('endpointTextMessageReceived', (event) => {
        console.log('Received endpoint message:', event);
        handleIncomingMessage(event);
      });

      // Listen for chat messages as backup
      api.addEventListener('incomingMessage', (event) => {
        console.log('Received chat message:', event);
        if (event.message && (event.message.includes('[PLAYLIST_SYNC]'))) {
          handleIncomingMessage(event.message);
        }
      });

      // Shared video events
      api.addEventListener('sharedVideoStarted', (event) => {
        console.log('Shared video started:', event);
        // The MutationObserver handles the mute, but this is a backup trigger.
        forceAudioMute();
      });

      api.addEventListener('sharedVideoStopped', (event) => {
        console.log('Shared video stopped:', event);
        setAudioMuted(false);
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
      setSyncStatus('disconnected');
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanupJitsi = () => {
    console.log('=== cleanupJitsi called ===');

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

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
    setIsPlaylistSynced(false);
    setAudioMuted(false);
    setSyncStatus('disconnected');

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
  }, []);

  // Use a MutationObserver to ensure videos are muted as soon as they appear in the DOM
  useEffect(() => {
    if (!jitsiContainerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            // Check for iframes, specifically from youtube.com
            if (node.tagName === 'IFRAME' && node.src.includes('youtube.com')) {
              console.log('MutationObserver detected YouTube iframe. Forcing mute...');
              // Force mute the iframe and set its volume to 0
              node.muted = true;
              try {
                if (node.contentWindow) {
                  node.contentWindow.document.body.muted = true;
                  node.contentWindow.document.body.volume = 0;
                }
              } catch (e) {
                console.error('Could not access iframe content window for muting:', e);
              }
              setAudioMuted(true);
            }
          });
        }
      });
    });

    observer.observe(jitsiContainerRef.current, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, [jitsiContainerRef]);

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
        // Ensure the URL passed to Jitsi always has the mute parameter
        const fullUrl = `https://www.youtube.com/embed/${videoId}`;
        const mutedUrl = fullUrl + (fullUrl.includes('?') ? '&' : '?') + 'mute=1&autoplay=1';
        try {
          jitsiApi.executeCommand('startShareVideo', mutedUrl);
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

        const newVideo = {
          id: Date.now() + Math.random(), // Ensure unique ID
          url: videoUrl,
          videoId: videoId,
          title: videoTitle,
          addedAt: new Date().toLocaleString(),
          addedBy: participantId || 'Unknown',
        };

        setPlaylist((prev) => {
          const newPlaylist = [...prev, newVideo];
          storePlaylistLocally(newPlaylist);
          return newPlaylist;
        });
        setVideoUrl('');

        // Broadcast to all participants
        broadcastPlaylistUpdate('ADD', newVideo);
        setIsPlaylistSynced(true);
      } catch (error) {
      console.error('Error adding video to playlist:', error);
      const newVideo = {
        id: Date.now() + Math.random(),
        url: videoUrl,
        videoId: videoId,
        title: `Video ${playlist.length + 1}`,
        addedAt: new Date().toLocaleString(),
        addedBy: participantId || 'Unknown',
      };
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

  const shareFromPlaylist = (url) => {
    if (jitsiApi) {
      try {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          const fullUrl = `https://www.youtube.com/embed/${videoId}`;
          const mutedUrl = fullUrl + (fullUrl.includes('?') ? '&' : '?') + 'mute=1&autoplay=1';
          jitsiApi.executeCommand('startShareVideo', mutedUrl);
          setIsVideoSharing(true);
          setCurrentSharedVideo(url);
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

  const refreshJitsi = async () => {
    cleanupJitsi();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await initializeJitsi();
  };

  const toggleJwtModal = () => {
    setShowJwtModal(!showJwtModal);
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-white text-xl font-semibold">NSO Team Meeting</h1>
          <div className="flex items-center gap-3">
            {getSyncStatusIcon()}
            <span className="text-sm text-gray-300">
              {syncStatus === 'connected' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
            </span>
            {audioMuted && (
              <div className="flex items-center gap-1 text-red-400 text-sm">
                <VolumeX className="w-4 h-4" />
                <span>Muted</span>
              </div>
            )}
          </div>
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
                  {isLoadingVideoTitle ? 'Loading...' : 'Add to Team Playlist'}
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
            {isInitializing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            {isInitializing ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            onClick={togglePlaylist}
            variant={showPlaylist ? 'destructive' : 'default'}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            disabled={isInitializing}
          >
            <List className="w-4 h-4" />
            Videos ({playlist.length})
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
              display: isInitializing ? 'none' : 'block',
            }}
          />
        </div>

        {/* Team Playlist Panel */}
        {showPlaylist && (
          <div className="w-1/2 h-full bg-gray-800 border-l border-gray-600 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-lg font-semibold">Team Video Playlist</h2>
                  <div className="flex items-center gap-2 text-sm">
                    {getSyncStatusIcon()}
                    <span className="text-gray-300">
                      {syncStatus === 'connected' ? 'Live Sync' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                    </span>
                  </div>
                </div>
                {playlist.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No videos in team playlist</p>
                    <p className="text-sm">Add YouTube URLs to build your shared playlist</p>
                    <p className="text-xs mt-2 text-gray-500">All team members can see and manage this playlist</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlist.map((video) => (
                      <div key={video.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium text-sm leading-tight mb-1">{video.title}</h3>
                            <p className="text-gray-400 text-xs truncate">{video.url}</p>
                            <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                              <span>Added: {video.addedAt}</span>
                              {video.addedBy && <span>• By: {video.addedBy.substring(0, 20)}...</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-3 flex-shrink-0">
                            <Button
                              onClick={() => shareFromPlaylist(video.url)}
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isVideoSharing || isInitializing}
                              title="Share this video (auto-muted)"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => removeFromPlaylist(video.id)}
                              variant="destructive"
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              disabled={isInitializing}
                              title="Remove from team playlist"
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
              <Button onClick={toggleJwtModal} variant="ghost" size="sm" className="text-white hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">JWT Token (for premium features like recording)</label>
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
  );
}

export default App;