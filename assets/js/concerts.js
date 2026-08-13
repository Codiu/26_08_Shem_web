document.addEventListener('DOMContentLoaded', () => {
  const dataScript = document.getElementById('concerts-data');
  if (!dataScript) return;

  const albumsData = JSON.parse(dataScript.textContent);
  
  // Flatten all tracks for Radio Mode
  const allTracks = [];
  albumsData.forEach(album => {
    album.tracks.forEach(track => {
      allTracks.push({
        ...track,
        albumTitle: album.title
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

  let currentTrackIndex = -1;
  let isRadioMode = false;
  let currentPlaylist = []; // Array of tracks currently active
  let playlistIndex = 0;

  // Track row play buttons
  const trackPlayBtns = document.querySelectorAll('.track-play-btn');

  function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      vinylRecord.classList.add('spinning');
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      vinylRecord.classList.remove('spinning');
    }
  }

  function playTrack(track) {
    audio.src = track.file;
    audio.play().then(() => {
      updatePlayPauseUI(true);
      nowPlayingText.innerHTML = `<strong>${track.title}</strong><br><small>${track.albumTitle}</small>`;
      
      // Hide radio button, show playback controls
      mainControls.classList.add('hidden');
      playbackControls.classList.remove('hidden');

      // Highlight active track in the list
      document.querySelectorAll('.track-row.active').forEach(el => el.classList.remove('active'));
      const activeRow = document.querySelector(`.track-row[data-track-id="${track.id}"]`);
      if (activeRow) activeRow.classList.add('active');

    }).catch(err => {
      console.error("Playback failed", err);
    });
  }

  function playNextTrack() {
    if (isRadioMode) {
      playRandomTrack();
    } else {
      playlistIndex++;
      if (playlistIndex >= currentPlaylist.length) {
        playlistIndex = 0; // loop back
      }
      playTrack(currentPlaylist[playlistIndex]);
    }
  }

  function playPrevTrack() {
    if (isRadioMode) {
      playRandomTrack(); // prev on radio is just another random track
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
      audio.play();
      updatePlayPauseUI(true);
    } else {
      audio.pause();
      updatePlayPauseUI(false);
    }
  });

  btnNext.addEventListener('click', playNextTrack);
  btnPrev.addEventListener('click', playPrevTrack);

  audio.addEventListener('ended', playNextTrack);

  // Manual track selection
  trackPlayBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.track-row');
      const trackId = row.dataset.trackId;
      const albumCard = row.closest('.album-card');
      const albumId = albumCard.dataset.albumId;

      // Find album and track
      const album = albumsData.find(a => a.id === albumId);
      const track = album.tracks.find(t => t.id === trackId);
      
      // Setup manual playlist mode
      isRadioMode = false;
      currentPlaylist = album.tracks.map(t => ({...t, albumTitle: album.title}));
      playlistIndex = currentPlaylist.findIndex(t => t.id === trackId);

      playTrack(currentPlaylist[playlistIndex]);
    });
  });
});
