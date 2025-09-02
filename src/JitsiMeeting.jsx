import { useEffect, useRef } from 'react';

// Embed the JWT directly in the code
const PERMANENT_JWT_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6InZwYWFzLW1hZ2ljLWNvb2tpZS1iOGJhYzczZWFiYzA0NTE4ODU0MjYwMWZmYmQ3ZWI3Yy9kN2Q5ZWUiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE3ODgzMzE2OTgsIm5iZlRpbWUiOjE3NTY3OTU2ODgsInJvb20iOiIqIiwic3ViIjoidnBhYXMtbWFnaWMtY29va2llLWI4YmFjNzNlYWJjMDQ1MTg4NTQyNjAxZmZiZDdlYjdjIiwiY29udGV4dCI6eyJ1c2VyIjp7Im1vZGVyYXRvciI6InRydWUiLCJpZCI6ImJkNDE2NjdlLTIwYzMtNDYyMS1hYzE1LTlkZDYxYTFkNDg3OSIsIm5hbWUiOiJBbmtpdCBBbmFuZCIsImVtYWlsIjoiYW5raXQuYW5hbmRAbGVuc2thcnQuY29tIn0sImZlYXR1cmVzIjp7ImxpdmVzdHJlYW1pbmciOiJmYWxzZSIsInJlY29yZGluZyI6InRydWUiLCJvdXRib3VuZC1jYWxsIjoiZmFsc2UiLCJzaXAtb3V0Ym91bmQtY2FsbCI6ImZhbHNlIiwidHJhbnNjcmlwdGlvbiI6ImZhbHNlIn19LCJpc3MiOiJjaGF0IiwiYXVkIjoiaml0c2kifQ.MqlyrnteF4jM9Jmn_mLW6jgbzwpNoGFq53YYCpbOCKiFl4WKk4D8masodsrWuy01Gov5Wz9AWAOrDCJt835cyYP_dQgR5M-F3useh4GcUxEkvQ3trMkp_PlZLs6XgzK-IuFxqdQ3wDH89VKxowl-RVR9ZVON-8leBmBLaDmep1-AutoFJuAsHIkB4rWeaY1yNXq6I7KoRZaCeeY7OQTIo9bAWtYJg-QQ6QMKSobqmCqrTHEM9gR69EwLERlJ72JKImzszOFyNLX5ZdaJm6acqdDpfTMPteLMtdARjlzclaEq9hZcBTj4fe-VTkEmTvI9Ozlx4Jom1hOzrlwJHG8EpQ";

const JitsiMeeting = ({ setJitsiApiRef, onRecordingStarted, onRecordingStopped }) => {
  const jitsiContainerRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const muteIntervalRef = useRef(null);

  const startPeriodicSync = () => {
    // Periodic sync logic
  };

  const stopMutingInterval = () => {
    if (muteIntervalRef.current) {
      clearInterval(muteIntervalRef.current);
      muteIntervalRef.current = null;
    }
  };

  const forceAudioMute = () => {
    // Audio mute logic
  };

  const initializeJitsi = () => {
    if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current) {
      console.warn('JitsiMeetExternalAPI script or container not ready.');
      return;
    }

    try {
      while (jitsiContainerRef.current.firstChild) {
        jitsiContainerRef.current.removeChild(jitsiContainerRef.current.firstChild);
      }

      const config = {
        roomName: 'vpaas-magic-cookie-b8bac73eabc045188542601ffbd7eb7c/property-approval-meeting',
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          prejoinPageEnabled: true,
          enableWelcomePage: false,
          enableClosePage: false,
          channelLastN: -1,
          enableDataChannels: true,
          enableP2P: true,
          p2p: { enabled: true },
          disableAP: false,
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
        jwt: PERMANENT_JWT_TOKEN,
      };

      const api = new window.JitsiMeetExternalAPI('8x8.vc', config);
      setJitsiApiRef.current = api;

      api.addEventListener('videoConferenceJoined', () => {
        startPeriodicSync();
      });

      // Listen for recording events and log timestamps
      api.addEventListener('recordingStarted', onRecordingStarted);
      api.addEventListener('recordingStopped', onRecordingStopped);
      api.addEventListener('recordingOn', onRecordingStarted);
      api.addEventListener('recordingOff', onRecordingStopped);

    } catch (error) {
      console.error('Error during Jitsi initialization:', error);
    }
  };

  const cleanupJitsi = () => {
    stopMutingInterval();
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (setJitsiApiRef.current) {
      try { setJitsiApiRef.current.dispose(); } catch (error) { console.error('Error disposing Jitsi API:', error); }
      setJitsiApiRef.current = null;
    }
  };

  useEffect(() => {
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
    return () => { cleanupJitsi(); };
  }, []);

  return <div ref={jitsiContainerRef} id="jitsi-container" className="w-full h-full flex-1 min-h-0" />;
};

export default JitsiMeeting;