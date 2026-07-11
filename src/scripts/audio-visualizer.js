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
    let baseColors;
    let positions;
    let colors;
    let phases;
    let layerTypes;
    let seeds;
    let THREE;
    let palette;

    const loadThree = async () => {
      if (THREE) return;
      THREE = await import("three");
      palette = [
        new THREE.Color("#75d7ff"),
        new THREE.Color("#91f0cf"),
        new THREE.Color("#ff8fb7"),
        new THREE.Color("#ffd86e"),
        new THREE.Color("#f6fbff")
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
      return isMobile() ? 780 : 2300;
    };

    const createParticles = () => {
      particleCount = computeParticleCount();
      basePositions = new Float32Array(particleCount * 3);
      baseColors = new Float32Array(particleCount * 3);
      positions = new Float32Array(particleCount * 3);
      colors = new Float32Array(particleCount * 3);
      phases = new Float32Array(particleCount);
      layerTypes = new Uint8Array(particleCount);
      seeds = new Float32Array(particleCount);

      const width = isMobile() ? 11 : 17;
      const depth = isMobile() ? 6.4 : 8.2;

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const ratio = i / Math.max(1, particleCount - 1);
        const seed = Math.random();
        const phase = Math.random() * Math.PI * 2;
        const type = ratio < 0.28 ? 0 : ratio < 0.82 ? 1 : 2;
        const lane = (Math.random() - 0.5) * 2;
        const ribbon = Math.sin(i * 0.17) * 0.48;
        let x;
        let y;
        let z;
        let color;

        if (type === 0) {
          x = (Math.random() - 0.5) * width * 1.22;
          y = (Math.random() - 0.5) * (isMobile() ? 5.5 : 7.2);
          z = -1.8 - Math.random() * depth;
          color = palette[seed > 0.66 ? 0 : seed > 0.33 ? 1 : 4].clone().multiplyScalar(0.48 + seed * 0.22);
        } else if (type === 1) {
          x = (Math.random() - 0.5) * width;
          y = lane * 1.18 + ribbon * 0.58;
          z = (Math.random() - 0.5) * depth * 0.8;
          color = palette[i % 4].clone().lerp(palette[(i + 1) % 4], seed * 0.48);
        } else {
          const side = Math.random() > 0.5 ? 1 : -1;
          x = side * (1.2 + Math.random() * width * 0.38);
          y = (Math.random() - 0.5) * (isMobile() ? 3.2 : 4.4);
          z = (Math.random() - 0.5) * depth * 0.66;
          color = palette[seed > 0.42 ? 4 : 3].clone().lerp(palette[2], seed * 0.28);
        }

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        phases[i] = phase;
        layerTypes[i] = type;
        seeds[i] = seed;

        baseColors[i3] = color.r;
        baseColors[i3 + 1] = color.g;
        baseColors[i3 + 2] = color.b;
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
          size: isMobile() ? 0.048 : 0.062,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.78,
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
      const orbit = 0.22 + intensity * 0.42;
      const burst = beatPulse * (0.42 + bass * 0.36);
      const shimmer = treble * 0.8 + beatPulse * 0.3;

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const x = basePositions[i3];
        const y = basePositions[i3 + 1];
        const z = basePositions[i3 + 2];
        const phase = phases[i];
        const seed = seeds[i];
        const type = layerTypes[i];
        let nextX = x;
        let nextY = y;
        let nextZ = z;
        let light = sparkle * 0.18;

        if (type === 0) {
          const parallax = 0.12 + seed * 0.16;
          nextX = x + Math.sin(time * (0.08 + seed * 0.05) + phase) * parallax;
          nextY = y + Math.cos(time * 0.1 + phase) * parallax * 0.72;
          nextZ = z + Math.sin(time * 0.06 + x * 0.28) * 0.22;
          light = 0.04 + treble * 0.1 + beatPulse * 0.08;
        } else if (type === 1) {
          const drift = Math.sin(time * 0.38 + phase) * 0.12;
          const ripple = Math.sin(x * 1.45 + time * 1.12 + phase) * wave;
          const crossWave = Math.cos(z * 1.2 + time * 0.84 + phase) * (0.08 + mid * 0.28);
          const spiral = Math.cos(time * 0.24 + z + phase) * (0.08 + bass * 0.18 + beatPulse * 0.18);
          nextX = x * bloom + drift + crossWave;
          nextY = y + ripple + Math.sin(time * 0.72 + phase) * (0.07 + beatPulse * 0.16);
          nextZ = z + spiral + Math.cos(x + time * 0.5) * treble * 0.4;
          light = sparkle * 0.22 + beatPulse * 0.16;
        } else {
          const angle = Math.atan2(y, x) + time * (0.22 + seed * 0.12);
          const radius = Math.hypot(x, y) + burst * (1.2 + seed * 1.4);
          const lift = Math.sin(time * (1.6 + seed) + phase) * (0.12 + shimmer * 0.34);
          nextX = Math.cos(angle) * radius + Math.sin(time * 0.9 + phase) * orbit;
          nextY = Math.sin(angle) * radius * 0.62 + lift;
          nextZ = z + Math.cos(angle * 1.6 + time) * (0.16 + shimmer * 0.52);
          light = 0.26 + shimmer * 0.5 + beatPulse * 0.3;
        }

        positions[i3] = nextX;
        positions[i3 + 1] = nextY;
        positions[i3 + 2] = nextZ;

        colors[i3] = Math.min(1, baseColors[i3] + light * 0.34);
        colors[i3 + 1] = Math.min(1, baseColors[i3 + 1] + light * 0.26);
        colors[i3 + 2] = Math.min(1, baseColors[i3 + 2] + light * 0.42);
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      points.rotation.y = Math.sin(time * 0.12) * 0.09 + beatPulse * 0.018;
      points.rotation.z = Math.sin(time * 0.08) * 0.025 + bass * 0.012;
      points.material.opacity = 0.46 + intensity * 0.28 + beatPulse * 0.16;
      camera.position.y = Math.sin(time * 0.16) * 0.12 + beatPulse * 0.035;
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
