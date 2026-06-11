'use client';

/* =====================================================================
   OGTHero.jsx — Next.js App Router client component
   npm i three gsap framer-motion        (three >= 0.152, for OutputPass)
   Framer Motion → UI reveals · GSAP → 3D choreography · Three.js → scene

   gamefi.org-grade choreography (11s loop):
   the OGT disc hovers TILTED above a glowing landing socket set into a
   quadtree field of randomized voxels → levels out while descending →
   DOCKS (pad bloom + squash + cube dip + camera kick on the same frame,
   a radial WAVE boils through the voxels — inner field, raised border
   and the flush perimeter band, breaking the cube's silhouette — then
   spring-settles) → docked: seam glow breathes around the pad, live
   tiles flicker → glow fades → disc lifts off and re-tilts. Rendered
   through ACESFilmic + UnrealBloom with RoomEnvironment reflections
   and real PCFSoft shadows. All randomness seeded (mulberry32).
   ===================================================================== */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { motion } from 'framer-motion';

/* ------------------------- 3D scene (vanilla) ------------------------- */
function mountScene(canvas) {
  const CYAN = 0x13f5ef, INK = 0x05080a;
  const HALF = 1.7, HOVER_H = 0.8, REST_H = 0.012;
  const PANEL = 1.32;                         // inner voxel field half-size
  const BORDER_IN = 1.34, BORDER_OUT = 1.56;  // raised voxel border ring
  const PERIM_IN = 1.58, PERIM_OUT = 1.7;     // flush band at the cube edge
  const LOGO_R = 0.58, PAD_R = LOGO_R + 0.1;  // landing socket radius
  const WAVE_SPEED = 1.8;                     // wavefront, world units / s
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* deterministic randomness — identical build every reload */
  const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rand = mulberry32(1337);

  /* ---------- renderer · tone mapping · post chain ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  /* solid background — matches CSS, no atmospheric gradients */
  const bgCv = document.createElement('canvas');
  bgCv.width = 1024; bgCv.height = 640;
  const bg = bgCv.getContext('2d');
  bg.fillStyle = '#e9fbfa'; bg.fillRect(0, 0, 1024, 640);
  const bgTex = new THREE.CanvasTexture(bgCv);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  /* low, close, monumental */
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  const CAM = new THREE.Vector3(0.6, 3.2, 7.0);
  camera.position.copy(CAM);
  const LOOK = new THREE.Vector3(0, 0.35, 0);

  /* threshold sits above the pale sky's luminance (~0.93 linear) so only
     genuinely hot emissive surfaces bloom, never the background */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- lighting rig ---------- */
  // No HemisphereLight — creates foggy ambient gradient
  const key = new THREE.DirectionalLight(0xfff2e2, 2.5);    // warm key, upper-left
  key.position.set(-4.5, 8.5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 26;
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfeef2, 0.5);   // dim cool fill, camera side
  fill.position.set(4, 3, 8);
  scene.add(fill);
  const rim = new THREE.PointLight(CYAN, 16, 30, 2);        // cyan rim, low-right
  rim.position.set(5.5, 0.8, 4.5);
  scene.add(rim);
  /* cyan under-chip point light — only ignites at impact */
  const underLight = new THREE.PointLight(CYAN, 0, 8, 2);
  underLight.position.set(0, HALF + 0.15, 0);
  scene.add(underLight);

  const rig = new THREE.Group();
  rig.rotation.z = 0.1;                        // top side tilted left
  scene.add(rig);
  const cubeG = new THREE.Group();
  cubeG.rotation.y = -0.62;                    // show top + two faces
  rig.add(cubeG);

  /* matte soot-black body — form drawn by light alone, no edge lines */
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d0f, roughness: 0.55, metalness: 0.25, envMapIntensity: 0,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2), cubeMat);
  cube.castShadow = cube.receiveShadow = true;
  cubeG.add(cube);

  /* the floor shadow lives in-scene now */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.ShadowMaterial({ opacity: 0.25 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -HALF - 0.001;
  ground.receiveShadow = true;
  cubeG.add(ground);

  /* ---------- voxel top surface ----------
     quadtree subdivision of the panel → mixed tile sizes; a voxelized
     border ring (zone 1) and a sparse flush perimeter band (zone 2)
     whose wave heights break the cube's silhouette on impact.          */
  const SHADES = [0x0a0d0f, 0x10151a, 0x141b1f, 0x0d1418]
    .map((h) => new THREE.Color(h).convertSRGBToLinear());
  const pickShade = () => {
    const r = rand();
    return SHADES[r < 0.55 ? 0 : r < 0.75 ? 1 : r < 0.88 ? 2 : 3];
  };

  const gen = []; // build-time descriptors; baked into typed arrays below
  const addVoxel = (x, z, sx, sz, rest, peak, zone) => {
    const d = Math.hypot(x, z);
    gen.push({
      x, z, sx, sz, d, rest, peak,
      tx: (rand() - 0.5) * 0.05, // subtle tilt ±~3°
      tz: (rand() - 0.5) * 0.05,
      delay: Math.max(0, (d - PAD_R) / WAVE_SPEED) + rand() * 0.08, // cleaner wavefront, less jitter
      live: zone < 2 && rand() < (zone === 0 ? 0.06 : 0.04),
      shade: pickShade(),
      fq: 1.6 + rand() * 2.6,
      ph: rand() * Math.PI * 2,
    });
  };

  const subdivide = (cx, cz, size, depth) => {
    const nearPad = Math.hypot(cx, cz) - size * 0.71 < PAD_R; // hug the socket with small tiles
    const stop = depth >= 2 ? 1 : depth === 0 ? 0.28 : 0.5;
    if (!(nearPad && depth < 2) && rand() < stop) {
      if (Math.hypot(cx, cz) < PAD_R + size * 0.6) return;    // carve the socket
      const g = size * (0.88 + rand() * 0.04);                // 8–12% groove gap
      addVoxel(cx, cz, g, g, 0.01 + rand() * 0.01, 0.05 + rand() * 0.07, 0);
      return;
    }
    const q = size / 4;
    subdivide(cx - q, cz - q, size / 2, depth + 1);
    subdivide(cx + q, cz - q, size / 2, depth + 1);
    subdivide(cx - q, cz + q, size / 2, depth + 1);
    subdivide(cx + q, cz + q, size / 2, depth + 1);
  };
  const BASE = 5, CELL = (PANEL * 2) / BASE;
  for (let i = 0; i < BASE; i++)
    for (let j = 0; j < BASE; j++)
      subdivide(-PANEL + CELL * (i + 0.5), -PANEL + CELL * (j + 0.5), CELL, 0);

  const fillStrip = (horizontal, fixed, from, to, width, zone) => {
    let p = from;
    while (to - p > 0.06) {
      const seg = Math.min(to - p, 0.14 + rand() * 0.3);
      const cx = horizontal ? p + seg / 2 : fixed;
      const cz = horizontal ? fixed : p + seg / 2;
      p += seg;
      if (zone === 2 && rand() < 0.42) continue;              // sparse silhouette band
      const g = 0.9 + rand() * 0.04;
      // All voxels (inner, border, perimeter) identical height
      const peak = 0.03 + rand() * 0.05;
      const rest = 0.01 + rand() * 0.01;
      addVoxel(cx, cz, (horizontal ? seg : width) * g, (horizontal ? width : seg) * g, rest, peak, zone);
    }
  };
  const BW = BORDER_OUT - BORDER_IN, BC = (BORDER_IN + BORDER_OUT) / 2;
  fillStrip(true, -BC, -BORDER_OUT, BORDER_OUT, BW, 1);
  fillStrip(true, BC, -BORDER_OUT, BORDER_OUT, BW, 1);
  fillStrip(false, -BC, -BORDER_IN, BORDER_IN, BW, 1);
  fillStrip(false, BC, -BORDER_IN, BORDER_IN, BW, 1);
  const PW = PERIM_OUT - PERIM_IN, PC = (PERIM_IN + PERIM_OUT) / 2;
  fillStrip(true, -PC, -PERIM_OUT, PERIM_OUT, PW, 2);
  fillStrip(true, PC, -PERIM_OUT, PERIM_OUT, PW, 2);
  fillStrip(false, -PC, -PERIM_IN, PERIM_IN, PW, 2);
  fillStrip(false, PC, -PERIM_IN, PERIM_IN, PW, 2);

  /* bake to typed arrays — dark instances first, live (emissive) last */
  gen.sort((a, b) => (a.live ? 1 : 0) - (b.live ? 1 : 0));
  const N = gen.length;
  const darkN = gen.filter((v) => !v.live).length, liveN = N - darkN;
  const vX = new Float32Array(N), vZ = new Float32Array(N);
  const vSX = new Float32Array(N), vSZ = new Float32Array(N);
  const vRest = new Float32Array(N), vPeak = new Float32Array(N);
  const vTx = new Float32Array(N), vTz = new Float32Array(N);
  const vDelay = new Float32Array(N), vDist = new Float32Array(N);
  const vFq = new Float32Array(N), vPh = new Float32Array(N);
  const vEnv = new Float32Array(N);
  gen.forEach((v, i) => {
    vX[i] = v.x; vZ[i] = v.z; vSX[i] = v.sx; vSZ[i] = v.sz;
    vRest[i] = v.rest; vPeak[i] = v.peak; vTx[i] = v.tx; vTz[i] = v.tz;
    vDelay[i] = v.delay; vDist[i] = v.d; vFq[i] = v.fq; vPh[i] = v.ph;
  });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // pivot at the base so height scaling grows upward

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.52, metalness: 0.22, envMapIntensity: 0,
  });
  const darkMesh = new THREE.InstancedMesh(boxGeo, darkMat, darkN);
  darkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  darkMesh.castShadow = darkMesh.receiveShadow = true;
  darkMesh.frustumCulled = false;
  for (let i = 0; i < darkN; i++) darkMesh.setColorAt(i, gen[i].shade);
  cubeG.add(darkMesh);

  /* live tiles: per-instance grayscale drives the cyan emissive */
  const liveMat = new THREE.MeshStandardMaterial({
    color: 0x0c1216, roughness: 0.45, metalness: 0.2,
    emissive: CYAN, emissiveIntensity: 1, envMapIntensity: 0,
  });
  liveMat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;');
  };
  const liveMesh = new THREE.InstancedMesh(boxGeo, liveMat, liveN);
  liveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  liveMesh.castShadow = liveMesh.receiveShadow = true;
  liveMesh.frustumCulled = false;
  const cTmp = new THREE.Color();
  for (let i = 0; i < liveN; i++) liveMesh.setColorAt(i, cTmp.setScalar(0));
  if (liveMesh.instanceColor) liveMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  cubeG.add(liveMesh);

  /* gutter floor — dark seam plane; a shader-driven radial emissive
     bleeds cyan through the grooves: a travelling wavefront on impact
     plus a pad-centred falloff glow while docked                       */
  let floorU = null;
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x05080a, roughness: 0.6, metalness: 0.1, envMapIntensity: 0,
  });
  floorMat.onBeforeCompile = (s) => {
    s.uniforms.uWaveR = { value: 0 };
    s.uniforms.uWaveI = { value: 0 };
    s.uniforms.uGlow = { value: 0 };
    floorU = s.uniforms;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPanel;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanel = position.xy;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec2 vPanel;\nuniform float uWaveR;\nuniform float uWaveI;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        'float pd = length(vPanel);',
        'float front = exp(-pow((pd - uWaveR) / 0.3, 2.0));',
        `float fall = exp(-max(pd - ${PAD_R.toFixed(3)}, 0.0) * 1.6);`,
        'totalEmissiveRadiance += vec3(0.0065, 0.913, 0.863) * (uWaveI * front + uGlow * fall);',
      ].join('\n'));
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(PANEL * 2, PANEL * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = HALF + 0.002;
  floor.receiveShadow = true;
  cubeG.add(floor);

  /* ---------- landing socket: recessed pad + emissive cyan rings ---------- */
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x07090b, roughness: 0.5, metalness: 0.3, envMapIntensity: 0,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R, 0.02, 48), padMat);
  pad.position.y = HALF - 0.002;
  pad.receiveShadow = true;
  cubeG.add(pad);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x041212, emissive: CYAN, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.1, envMapIntensity: 0,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PAD_R + 0.02, 0.013, 10, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = HALF + 0.022;
  cubeG.add(ring);
  const ring2Mat = new THREE.MeshStandardMaterial({
    color: 0x06090a, emissive: CYAN, emissiveIntensity: 0.1, roughness: 0.5, envMapIntensity: 0,
  });
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(PAD_R - 0.08, PAD_R - 0.05, 64), ring2Mat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = HALF + 0.01;
  cubeG.add(ring2);
  const padLight = new THREE.PointLight(CYAN, 0, 7, 2); // ignites at impact
  padLight.position.set(0, HALF + 0.35, 0);
  cubeG.add(padLight);

  /* ---------- shape helpers ---------- */
  const lensShape = (hw, hh) => {
    const s = new THREE.Shape();
    s.moveTo(0, -hh);
    s.quadraticCurveTo(hw * 2, 0, 0, hh);
    s.quadraticCurveTo(-hw * 2, 0, 0, -hh);
    return s;
  };
  const ringShape = (rOut, rIn) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    if (rIn > 0) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
      s.holes.push(hole);
    }
    return s;
  };
  const ellipseShape = (rx, ry) => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
    return s;
  };
  const extrude = (shape, depth, mat, z, bevel) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: !!bevel, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 48,
    });
    const m = new THREE.Mesh(g, mat); m.position.z = z; return m;
  };

  /* ---------- OGT disc, extruded 3D logo ----------
     proportions measured from logo.jpeg (R = 1):
     disc r=1.0 · ring 0.46→0.64 · lens hh=0.67 hw≈0.095 · ellipse 0.32×0.106 */
  const matCyan = new THREE.MeshStandardMaterial({
    color: CYAN, roughness: 0.32, metalness: 0.05,
    emissive: 0x07c9c4, emissiveIntensity: 0.55, envMapIntensity: 0,
  });
  /* faint cyan fresnel rim so the disc pops against the pale sky */
  matCyan.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      'float fres = pow(1.0 - saturate(dot(normalize(vViewPosition), normalize(normal))), 3.0);',
      'totalEmissiveRadiance += vec3(0.0065, 0.913, 0.863) * fres * 0.7;',
    ].join('\n'));
  };
  const matInk = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5, metalness: 0.2, envMapIntensity: 0 });
  const logo = new THREE.Group();
  const face = new THREE.Group();                       // shapes live in XY, extrude +z
  face.add(extrude(ringShape(1.0, 0), 0.10, matCyan, 0, true));      // cyan base disc
  face.add(extrude(ringShape(0.64, 0.46), 0.04, matInk, 0.10));      // black ring
  face.add(extrude(lensShape(0.135, 0.71), 0.04, matInk, 0.10));     // black gap lens
  face.add(extrude(lensShape(0.095, 0.67), 0.055, matCyan, 0.102));  // cyan lens
  face.add(extrude(ellipseShape(0.32, 0.106), 0.055, matInk, 0.104)); // black ellipse
  face.rotation.x = -Math.PI / 2;                       // lay flat, face up
  const SCALE = LOGO_R;
  face.scale.setScalar(SCALE);
  face.traverse((o) => { if (o.isMesh) o.castShadow = true; }); // real contact shadow
  logo.add(face);
  cubeG.add(logo);

  /* ---------- impact wave envelope ----------
     Smooth wave: fast rise (sin²), damped oscillating fall — travels like a ripple */
  const waveEnv = (lt) => {
    if (lt <= 0) return 0;
    // Rise: 0→1 in ~0.15s (sin² for smooth acceleration)
    if (lt < 0.15) return Math.sin((lt / 0.15) * Math.PI * 0.5) ** 2;
    // Fall: damped oscillation ~1.5s total
    const s = lt - 0.15;
    const oscillation = Math.cos(s * 6.5) * Math.exp(-s * 2.2);
    return Math.max(0, oscillation);
  };

  let waveAt = -1e9, kickAt = -1e9;
  const dummy = new THREE.Object3D();
  const updateVoxels = (t) => {
    const wt = t - waveAt;
    const waving = wt > 0 && wt < 3;
    for (let i = 0; i < N; i++) {
      let e = 0;
      if (waving) {
        const lt = wt - vDelay[i];
        e = waveEnv(lt); // single smooth wave, no echo
      }
      vEnv[i] = e;
      dummy.position.set(vX[i], HALF, vZ[i]);
      dummy.rotation.set(vTx[i] * e, 0, vTz[i] * e);
      dummy.scale.set(vSX[i], Math.max(0.006, vRest[i] + vPeak[i] * e), vSZ[i]);
      dummy.updateMatrix();
      if (i < darkN) darkMesh.setMatrixAt(i, dummy.matrix);
      else liveMesh.setMatrixAt(i - darkN, dummy.matrix);
    }
    darkMesh.instanceMatrix.needsUpdate = true;
    liveMesh.instanceMatrix.needsUpdate = true;
  };
  const updateLive = (t, gutter) => {
    for (let i = darkN; i < N; i++) {
      const idle = 0.22 + 0.18 * Math.sin(t * vFq[i] + vPh[i]);
      const docked = gutter * (0.7 + 0.35 * Math.sin(t * 2.5 + vPh[i])) *
        Math.exp(-Math.max(vDist[i] - PAD_R, 0) * 1.2);
      const g = Math.max(0, idle + docked + Math.max(0, vEnv[i]) * 2.6);
      liveMesh.setColorAt(i - darkN, cTmp.setScalar(g));
    }
    if (liveMesh.instanceColor) liveMesh.instanceColor.needsUpdate = true;
  };

  /* ---------- master timeline (11s loop) ---------- */
  const st = { h: HOVER_H, gutter: 0 };
  const clock = new THREE.Clock();
  const tl = gsap.timeline({ repeat: -1, defaults: { overwrite: 'auto' } });
  tl.to(st, { h: HOVER_H + 0.05, duration: 0.35, ease: 'sine.out' }, 0.55)       // anticipation rise
    .to(st, { h: REST_H, duration: 1.5, ease: 'power2.inOut' }, 0.9)             // descent → touchdown 2.4
    .call(() => { waveAt = kickAt = clock.elapsedTime; }, null, 2.4)             // wave + camera kick, same frame
    .to(logo.scale, { y: 0.92, x: 1.03, z: 1.03, duration: 0.1, ease: 'power2.out' }, 2.4) // squash…
    .to(logo.scale, { y: 1, x: 1, z: 1, duration: 0.55, ease: 'elastic.out(1,.45)' }, 2.5) // …and stretch
    .to(cubeG.position, { y: -0.04, duration: 0.1, ease: 'power2.out' }, 2.4)    // cube dips…
    .to(cubeG.position, { y: 0, duration: 1.0, ease: 'elastic.out(1,.35)' }, 2.5) // …and recovers
    .to(st, { gutter: 1, duration: 0.9, ease: 'sine.inOut' }, 4.2)               // docked seam glow (4.2–5.1)
    .to(st, { gutter: 0, duration: 0.7, ease: 'sine.inOut' }, 6.9)               // glow fade (6.9–7.6)
    .to(st, { h: REST_H + 0.02, duration: 0.15, ease: 'sine.inOut' }, 7.6)       // unstick
    .to(st, { h: HOVER_H, duration: 2.0, ease: 'power3.inOut' }, 7.6)            // lift off (7.6–9.6)
    .to({}, { duration: 1.4 }, 9.6);                                             // hold to 11.0 loop length
  if (prefersReduced) tl.pause(5.2); // static docked composition, pad lit

  /* layout + parallax — large screens: bigger box, pushed to the side,
     cropping slightly off the bottom-right edge                         */
  const layout = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (w > 1440) { rig.position.set(2.35, -0.6, 0); rig.scale.setScalar(1.2); }
    else if (w > 1024) { rig.position.set(2.0, -0.5, 0); rig.scale.setScalar(1.08); }
    else if (w > 640) { rig.position.set(0, -0.95, 0); rig.scale.setScalar(0.72); }
    else { rig.position.set(0, -1.1, 0); rig.scale.setScalar(0.55); }
  };
  addEventListener('resize', layout); layout();

  let mx = 0, my = 0, pxs = 0, pys = 0;
  const onMove = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
  addEventListener('pointermove', onMove);

  let raf;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // disc height + hover bob (bob fades near the surface)
    const air = THREE.MathUtils.clamp((st.h - REST_H) / (HOVER_H - REST_H), 0, 1);
    // tilt levels out in the last 30% of the descent (air 0.3 → 0)
    const tilt = THREE.MathUtils.smoothstep(air, 0, 0.3);
    logo.position.y = HALF + st.h + Math.sin(t * 1.5) * 0.06 * air;
    logo.rotation.x = (0.42 + Math.sin(t * 0.8) * 0.05) * tilt;   // ~24° toward camera
    logo.rotation.z = (0.16 + Math.cos(t * 0.7) * 0.05) * tilt;
    logo.rotation.y = Math.sin(t * 0.5) * 0.12 * tilt;

    updateVoxels(t);
    updateLive(t, st.gutter);

    // landing pad: breath + anticipation (tied to disc height) + impact
    // spike (caught by bloom) + docked glow
    const dtw = t - waveAt;
    const padI =
      0.25 + 0.1 * Math.sin(t * 1.1) +
      (1 - air) * (1 - air) * 0.85 +
      (dtw > 0 ? 3.2 * Math.exp(-dtw * 10) : 0) +
      st.gutter * (0.55 + 0.2 * Math.sin(t * 2.2));
    ringMat.emissiveIntensity = padI;
    ring2Mat.emissiveIntensity = 0.1 + padI * 0.3;
    padLight.intensity = padI * 2.4;
    // cyan under-chip light mirrors pad bloom curve
    underLight.intensity = padI * 1.2;

    // seam glow: expanding wavefront with distance falloff, then breathing
    if (floorU) {
      floorU.uWaveR.value = dtw > 0 ? PAD_R + dtw * WAVE_SPEED : 0;
      floorU.uWaveI.value = dtw > 0 ? 1.7 * Math.exp(-dtw * 1.15) : 0;
      floorU.uGlow.value = st.gutter * (0.8 + 0.3 * Math.sin(t * 2.3));
    }

    // camera: damped parallax + slow idle drift + damped impact kick
    const damp = 1 - Math.exp(-dt * 4);
    pxs += (mx * 0.5 - pxs) * damp;
    pys += (my * 0.35 - pys) * damp;
    let kick = 0;
    const kd = t - kickAt;
    if (kd > 0 && kd < 0.8) kick = Math.sin(kd * 26) * Math.exp(-kd * 7.5) * 0.05;
    camera.position.set(
      CAM.x + pxs + Math.sin(t * 0.10) * 0.05 + kick * 0.35,
      CAM.y - pys + Math.sin(t * 0.13 + 1.3) * 0.04 + kick,
      CAM.z
    );
    camera.lookAt(LOOK);

    composer.render();
  };
  frame();

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', layout);
    removeEventListener('pointermove', onMove);
    tl.kill();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    bgTex.dispose();
    envRT.dispose();
    if (composer.dispose) composer.dispose();
    renderer.dispose();
  };
}

/* ----------------------- Framer Motion variants ----------------------- */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } };
const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

const MiniLogo = () => (
  <svg viewBox="0 0 100 100" className="ogt-mini" aria-label="OGT logo">
    <circle cx="50" cy="50" r="48" fill="#13f5ef" />
    <circle cx="50" cy="50" r="31" fill="#06090a" />
    <circle cx="50" cy="50" r="22" fill="#13f5ef" />
    <path d="M50 15 Q63.5 50 50 85 Q36.5 50 50 15 Z" fill="#06090a" />
    <path d="M50 18 Q59.5 50 50 82 Q40.5 50 50 18 Z" fill="#13f5ef" />
    <ellipse cx="50" cy="50" rx="16" ry="5.4" fill="#06090a" />
  </svg>
);

export default function OGTHero() {
  const canvasRef = useRef(null);

  useEffect(() => mountScene(canvasRef.current), []);

  return (
    <div className="ogt-hero">
      <canvas ref={canvasRef} className="ogt-canvas" />

      <motion.div className="ogt-frame" variants={stagger} initial="hidden" animate="show">
        <motion.nav className="ogt-nav" variants={rise}>
          <div className="ogt-brand">
            <MiniLogo />
            <b>OGT<span>.ONE</span></b>
          </div>
          <div className="ogt-menu">
            <a href="#"><b>Launchpad</b><i>Invest with confidence</i></a>
            <a href="#"><b>Staking</b><i>Stake smart, earn more</i></a>
            <a href="#"><b>Game World</b><i>Find new items</i></a>
            <a href="#"><b>More</b><i>Submit your ecosystem</i></a>
          </div>
        </motion.nav>

        <section className="ogt-copy">
          <motion.h1 className="ogt-wordmark" variants={rise}>
            OGT<span className="ogt-dot" />
          </motion.h1>
          <motion.h2 variants={rise}>Web3 Launchpad</motion.h2>
          <motion.h3 variants={rise}>Game &bull; AI &bull; RWA</motion.h3>
          <motion.p variants={rise}>
            Get early access to innovative projects. Investing with confidence.
          </motion.p>
          <motion.div className="ogt-socials" variants={rise}>
            <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="ogt-pill" href="#">𝕏 1M</motion.a>
            <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="ogt-pill" href="#">TG 450K</motion.a>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
}
