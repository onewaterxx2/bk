const STORAGE_KEY = "jiangshui-visualizer";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!window.__jiangshuiAudioVisualizer) {
  window.__jiangshuiAudioVisualizer = true;

  const container = document.querySelector("[data-audio-visualizer]");
  const toggle = document.querySelector("[data-visualizer-toggle]");
  const audio = document.querySelector("[data-site-audio]");

  if (container && toggle && audio) {
    const saved = localStorage.getItem(STORAGE_KEY);
    let enabled = saved ? saved === "on" : !reducedMotion.matches;
    let renderer;
    let scene;
    let camera;
    let points;
    let geometry;
    let animationFrame = 0;
    let audioContext;
    let analyser;
    let frequencyData;
    let mediaSource;
    let lastFrameTime = 0;
    let visualTime = 0;
    let lastAudioTime = 0;
    let lastAudioSource = "";
    let intensity = 0;
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let beatPulse = 0;
    let particleCount = 0;
    let basePositions;
    let positions;
    let colors;
    let phases;
    let THREE;
    let palette;

    const loadThree = async () => {
      if (THREE) return;
      THREE = await import("three");
      palette = [
        new THREE.Color("#f08caf"),
        new THREE.Color("#6574ff"),
        new THREE.Color("#79c9b7"),
        new THREE.Color("#ffd86e"),
        new THREE.Color("#ffffff")
      ];
    };

    const setState = () => {
      container.dataset.enabled = enabled ? "true" : "false";
      toggle.dataset.enabled = enabled ? "true" : "false";
      toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    };

    const isMobile = () => window.innerWidth < 720;

    const computeParticleCount = () => {
      if (reducedMotion.matches) return 0;
      return isMobile() ? 520 : 1600;
    };

    const createParticles = () => {
      particleCount = computeParticleCount();
      basePositions = new Float32Array(particleCount * 3);
      positions = new Float32Array(particleCount * 3);
      colors = new Float32Array(particleCount * 3);
      phases = new Float32Array(particleCount);

      const width = isMobile() ? 10 : 15;
      const depth = isMobile() ? 4.8 : 6.2;

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const lane = (Math.random() - 0.5) * 2;
        const ribbon = Math.sin(i * 0.19) * 0.45;
        const x = (Math.random() - 0.5) * width;
        const y = lane * 1.15 + ribbon * 0.52;
        const z = (Math.random() - 0.5) * depth;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        phases[i] = Math.random() * Math.PI * 2;

        const color = palette[i % palette.length].clone().lerp(palette[(i + 1) % palette.length], Math.random() * 0.45);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      geometry?.dispose();
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));

      points?.material?.dispose();
      points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: isMobile() ? 0.055 : 0.07,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexColors: true
        })
      );
      scene.clear();
      scene.add(points);
    };

    const setupScene = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 0, isMobile() ? 8.6 : 9.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      createParticles();
    };

    const setupAudio = async () => {
      if (analyser || !enabled) return;
      const AudioCtor = window.AudioContext || window["webkitAudioContext"];
      if (!AudioCtor) return;

      audioContext = audioContext || new AudioCtor();
      if (!mediaSource) {
        mediaSource = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.68;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        mediaSource.connect(analyser);
        analyser.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") await audioContext.resume();
    };

    const average = (from, to) => {
      if (!frequencyData) return 0;
      let total = 0;
      let count = 0;
      for (let i = from; i < to && i < frequencyData.length; i += 1) {
        total += frequencyData[i];
        count += 1;
      }
      return count ? total / count / 255 : 0;
    };

    const getAudioSource = () => audio.currentSrc || audio.src || "";

    const resetAudioMotion = (resetClock = false) => {
      bass = 0;
      mid = 0;
      treble = 0;
      intensity = 0;
      beatPulse = 0;
      lastFrameTime = 0;
      lastAudioTime = audio.currentTime || 0;
      lastAudioSource = getAudioSource();
      if (resetClock) visualTime = 0;
    };

    const sampleAudio = () => {
      if (analyser && frequencyData && !audio.paused) {
        const audioTime = audio.currentTime || 0;
        const audioSource = getAudioSource();
        if (audioSource && audioSource !== lastAudioSource) resetAudioMotion(true);
        if (audioTime + 0.2 < lastAudioTime) resetAudioMotion(true);
        lastAudioTime = audioTime;
        lastAudioSource = audioSource;

        analyser.getByteFrequencyData(frequencyData);
        const rawBass = average(1, 16);
        const rawMid = average(16, 74);
        const rawTreble = average(74, 180);
        const bassHit = Math.max(0, rawBass - bass);

        bass = bass * 0.78 + rawBass * 0.22;
        mid = mid * 0.82 + rawMid * 0.18;
        treble = treble * 0.86 + rawTreble * 0.14;
        beatPulse = Math.max(beatPulse * 0.88, Math.min(1, bassHit * 3.2));
        intensity = Math.min(1, bass * 0.62 + mid * 0.28 + treble * 0.22);
      } else {
        bass *= 0.9;
        mid *= 0.9;
        treble *= 0.9;
        intensity *= 0.9;
        beatPulse *= 0.86;
      }
    };

    const animate = (timeMs = 0) => {
      if (!enabled || document.hidden || !renderer || !points) {
        animationFrame = 0;
        return;
      }

      const frameSeconds = lastFrameTime ? Math.min(0.05, Math.max(0, (timeMs - lastFrameTime) * 0.001)) : 1 / 60;
      lastFrameTime = timeMs;
      visualTime += frameSeconds;
      const time = visualTime;
      sampleAudio();

      const wave = 0.18 + mid * 1.05;
      const bloom = 1 + bass * 0.22 + beatPulse * 0.16;
      const sparkle = 0.16 + treble * 0.78;

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const x = basePositions[i3];
        const y = basePositions[i3 + 1];
        const z = basePositions[i3 + 2];
        const phase = phases[i];
        const drift = Math.sin(time * 0.38 + phase) * 0.12;
        const ripple = Math.sin(x * 1.45 + time * 1.12 + phase) * wave;
        const spiral = Math.cos(time * 0.24 + z + phase) * (0.08 + bass * 0.18 + beatPulse * 0.18);

        positions[i3] = x * bloom + drift;
        positions[i3 + 1] = y + ripple + Math.sin(time * 0.72 + phase) * (0.07 + beatPulse * 0.16);
        positions[i3 + 2] = z + spiral + Math.cos(x + time * 0.5) * treble * 0.4;

        const color = palette[i % palette.length];
        colors[i3] = Math.min(1, color.r + sparkle * 0.22);
        colors[i3 + 1] = Math.min(1, color.g + sparkle * 0.18);
        colors[i3 + 2] = Math.min(1, color.b + sparkle * 0.28);
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      points.rotation.y = Math.sin(time * 0.12) * 0.09;
      points.rotation.z = Math.sin(time * 0.08) * 0.025;
      points.material.opacity = 0.42 + intensity * 0.32 + beatPulse * 0.12;
      camera.position.y = Math.sin(time * 0.16) * 0.12;
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const start = async () => {
      if (!enabled || reducedMotion.matches) {
        setState();
        return;
      }
      await loadThree();
      if (!renderer) setupScene();
      if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
      setState();
    };

    const stop = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameTime = 0;
      setState();
    };

    const resize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = isMobile() ? 8.6 : 9.2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(window.innerWidth, window.innerHeight);
      const nextCount = computeParticleCount();
      if (nextCount !== particleCount) createParticles();
    };

    toggle.addEventListener("click", async () => {
      enabled = !enabled;
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
      if (enabled) {
        await setupAudio();
        await start();
      } else {
        stop();
      }
    });

    audio.addEventListener("play", async () => {
      if (!enabled) return;
      if (audio.currentTime < 0.25) resetAudioMotion(true);
      await setupAudio();
      await start();
    });

    audio.addEventListener("pause", () => {
      start();
    });

    audio.addEventListener("seeked", () => {
      resetAudioMotion(audio.currentTime < 0.5);
    });

    audio.addEventListener("loadstart", () => {
      resetAudioMotion(true);
    });

    audio.addEventListener("loadedmetadata", () => {
      resetAudioMotion(audio.currentTime < 0.5);
    });

    audio.addEventListener("ended", () => {
      resetAudioMotion(true);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    window.addEventListener("resize", resize, { passive: true });

    new ResizeObserver(resize).observe(document.documentElement);

    setState();
    start();
  }
}
