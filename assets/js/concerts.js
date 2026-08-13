document.addEventListener('DOMContentLoaded', () => {
  const dataScript = document.getElementById('concerts-data');
  if (!dataScript) return;

  const albumsData = JSON.parse(dataScript.textContent);
  
  // Resolve dynamic base URL for GitHub Pages
  const basePath = window.location.pathname.includes('/26_08_Shem_web') ? '/26_08_Shem_web' : '';
  
  function getFullAudioUrl(fileUrl) {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
    const cleanPath = fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl;
    return basePath + cleanPath;
  }

  // Flatten all tracks for Radio Mode with album tracking
  const allTracks = [];
  albumsData.forEach(album => {
    const total = album.tracks.length;
    album.tracks.forEach((track, idx) => {
      allTracks.push({
        ...track,
        albumTitle: album.title,
        trackIndex: idx,
        totalTracks: total
      });
    });
  });

  const audio = document.getElementById('mainAudio');
  const btnRadio = document.getElementById('btnRadio');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  
  const playbackControls = document.getElementById('playbackControls');
  const mainControls = document.querySelector('.main-controls');
  const nowPlayingText = document.getElementById('nowPlayingText');
  const vinylRecord = document.getElementById('vinylRecord');
  const tonearm = document.getElementById('tonearm');

  let isRadioMode = false;
  let currentPlaylist = [];
  let playlistIndex = 0;
  let activeTrack = null;

  // Calculate needle angle on the vinyl record
  // Rest position: -33deg
  // Track 1 (outer edge): -19deg
  // Last track end (near center label): +11deg
  function getTonearmAngle(track, progress = 0) {
    if (!track) return -33;
    const total = track.totalTracks || 1;
    const idx = track.trackIndex !== undefined ? track.trackIndex : 0;
    const slice = 1 / total;
    const ratio = Math.min(1, Math.max(0, (idx + progress) * slice));
    return -19 + (ratio * 30);
  }

  function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      vinylRecord.classList.add('spinning');
      const progress = (audio.duration && !isNaN(audio.duration)) ? (audio.currentTime / audio.duration) : 0;
      const angle = getTonearmAngle(activeTrack, progress);
      if (tonearm) {
        tonearm.style.setProperty('--arm-angle', `${angle.toFixed(2)}deg`);
      }
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      vinylRecord.classList.remove('spinning');
      if (tonearm) {
        tonearm.style.setProperty('--arm-angle', '-33deg');
      }
    }
  }

  function playTrack(track) {
    if (!track) return;
    
    activeTrack = track;
    const fullUrl = getFullAudioUrl(track.file);
    audio.src = fullUrl;
    
    const trackNum = (track.trackIndex !== undefined) ? (track.trackIndex + 1) : '';
    const trackPrefix = trackNum ? `${trackNum}. ` : '';
    nowPlayingText.innerHTML = `<strong>${trackPrefix}${track.title}</strong><br><small>${track.albumTitle}</small>`;
    mainControls.classList.add('hidden');
    playbackControls.classList.remove('hidden');

    // Highlight active track in the list
    document.querySelectorAll('.track-row.active').forEach(el => el.classList.remove('active'));
    const activeRow = document.querySelector(`.track-row[data-track-id="${track.id}"]`);
    if (activeRow) activeRow.classList.add('active');

    audio.play().then(() => {
      updatePlayPauseUI(true);
    }).catch(err => {
      console.error("Audio playback error:", err, "URL attempted:", fullUrl);
      updatePlayPauseUI(false);
    });
  }

  function playNextTrack() {
    if (isRadioMode) {
      playRandomTrack();
    } else {
      playlistIndex++;
      if (playlistIndex >= currentPlaylist.length) {
        playlistIndex = 0;
      }
      playTrack(currentPlaylist[playlistIndex]);
    }
  }

  function playPrevTrack() {
    if (isRadioMode) {
      playRandomTrack();
    } else {
      playlistIndex--;
      if (playlistIndex < 0) {
        playlistIndex = currentPlaylist.length - 1;
      }
      playTrack(currentPlaylist[playlistIndex]);
    }
  }

  function playRandomTrack() {
    isRadioMode = true;
    const randomIndex = Math.floor(Math.random() * allTracks.length);
    playTrack(allTracks[randomIndex]);
  }

  // Event Listeners
  btnRadio.addEventListener('click', () => {
    playRandomTrack();
  });

  btnPlayPause.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => updatePlayPauseUI(true)).catch(console.error);
    } else {
      audio.pause();
      updatePlayPauseUI(false);
    }
  });

  btnNext.addEventListener('click', playNextTrack);
  btnPrev.addEventListener('click', playPrevTrack);

  audio.addEventListener('ended', playNextTrack);

  // Smoothly move tonearm inward as the track plays
  audio.addEventListener('timeupdate', () => {
    if (!audio.paused && activeTrack && tonearm) {
      const progress = (audio.duration && !isNaN(audio.duration)) ? (audio.currentTime / audio.duration) : 0;
      const angle = getTonearmAngle(activeTrack, progress);
      tonearm.style.setProperty('--arm-angle', `${angle.toFixed(2)}deg`);
    }
  });

  // Click on track row to play
  document.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Ignore click if download button was clicked
      if (e.target.closest('.track-download-btn')) return;

      const trackId = row.dataset.trackId;
      const albumCard = row.closest('.album-card');
      const albumId = albumCard ? albumCard.dataset.albumId : null;

      if (!albumId) return;

      const album = albumsData.find(a => a.id === albumId);
      if (!album) return;

      isRadioMode = false;
      const total = album.tracks.length;
      currentPlaylist = album.tracks.map((t, idx) => ({
        ...t,
        albumTitle: album.title,
        trackIndex: idx,
        totalTracks: total
      }));
      playlistIndex = currentPlaylist.findIndex(t => t.id === trackId);

      if (playlistIndex !== -1) {
        playTrack(currentPlaylist[playlistIndex]);
      }
    });
  });
});
