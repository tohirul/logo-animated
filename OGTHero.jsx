'use client';

/* =====================================================================
   OGTHero.jsx — Next.js App Router client component
   npm i three gsap framer-motion
   Framer Motion → UI reveals · GSAP → 3D choreography · Three.js → scene
   Drop into app/components/ and render <OGTHero /> on your page.
   ===================================================================== */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { motion } from 'framer-motion';

/* ------------------------- 3D scene (vanilla) ------------------------- */
function mountScene(canvas) {
  const CYAN = 0x13f5ef, INK = 0x05080a, CUBE_COL = 0x0b0e10;
  const HALF = 1.7, HOVER_H = 1.9, REST_H = 0.10;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 3.0, 9.4);
  const LOOK = new THREE.Vector3(0, 0.8, 0);

  scene.add(new THREE.HemisphereLight(0xeffffe, 0x0a1212, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(-5, 8, 5); scene.add(key);
  const rim = new THREE.PointLight(CYAN, 0.8, 30); rim.position.set(6, 2.5, 5); scene.add(rim);
  const under = new THREE.PointLight(CYAN, 0, 8); scene.add(under);

  const rig = new THREE.Group();
  rig.rotation.z = 0.16;                       // top side tilted left
  scene.add(rig);
  const cubeG = new THREE.Group();
  cubeG.rotation.y = -0.62;
  rig.add(cubeG);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2),
    new THREE.MeshStandardMaterial({ color: CUBE_COL, roughness: 0.42, metalness: 0.18 })
  );
  cubeG.add(cube);
  cubeG.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: 0x223234, transparent: true, opacity: 0.55 })
  ));

  /* OGT logo as extruded 3D layers — proportions measured from logo.jpeg */
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
  const matCyan = new THREE.MeshStandardMaterial({ color: CYAN, roughness: 0.32, metalness: 0.05, emissive: 0x07c9c4, emissiveIntensity: 0.45 });
  const matInk = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5, metalness: 0.2 });
  const extrude = (shape, depth, mat, z, bevel) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: !!bevel, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 48,
    });
    const m = new THREE.Mesh(g, mat); m.position.z = z; return m;
  };
  const logo = new THREE.Group();
  const face = new THREE.Group();
  face.add(extrude(ringShape(1.0, 0), 0.10, matCyan, 0, true));
  face.add(extrude(ringShape(0.64, 0.46), 0.04, matInk, 0.10));
  face.add(extrude(lensShape(0.135, 0.71), 0.04, matInk, 0.10));
  face.add(extrude(lensShape(0.095, 0.67), 0.055, matCyan, 0.102));
  face.add(extrude(ellipseShape(0.32, 0.106), 0.055, matInk, 0.104));
  face.rotation.x = -Math.PI / 2;
  const SCALE = 0.92;
  face.scale.setScalar(SCALE);
  logo.add(face);
  cubeG.add(logo);

  /* contact shadow */
  const shCv = document.createElement('canvas'); shCv.width = shCv.height = 128;
  const sg = shCv.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,8,8,.85)'); grad.addColorStop(1, 'rgba(0,8,8,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCv), transparent: true, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2; contact.position.y = HALF + 0.012;
  cubeG.add(contact);

  /* erosion voxels */
  const VN = 15, CELL = 0.205;
  const vox = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.94, 1, CELL * 0.94),
    new THREE.MeshStandardMaterial({ color: 0x0d1214, roughness: 0.5, metalness: 0.15 }),
    VN * VN
  );
  vox.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cubeG.add(vox);
  const vdat = [];
  for (let i = 0; i < VN; i++) for (let j = 0; j < VN; j++) {
    const x = (i - (VN - 1) / 2) * CELL, z = (j - (VN - 1) / 2) * CELL;
    const d = Math.hypot(x, z);
    vdat.push({ x, z, h: 0.10 + Math.random() * 0.58, fall: Math.max(0, 1 - d / 1.55), ph: Math.random() * Math.PI * 2 });
  }
  const dummy = new THREE.Object3D();
  const updateVoxels = (t, e) => {
    for (let k = 0; k < vdat.length; k++) {
      const v = vdat[k];
      const h = Math.max(0.0001, e * v.h * v.fall * (1 + Math.sin(t * 2.6 + v.ph) * 0.14 * e));
      dummy.position.set(v.x, HALF + h / 2 - 0.002, v.z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.y = e * Math.sin(v.ph) * 0.12;
      dummy.updateMatrix();
      vox.setMatrixAt(k, dummy.matrix);
    }
    vox.instanceMatrix.needsUpdate = true;
    vox.visible = e > 0.003;
  };
  updateVoxels(0, 0);

  /* circuit lines with flowing juice */
  const lineFrag = `
    uniform float uTime, uProg;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main(){
      if(vUv.x > uProg) discard;
      float flow = pow(smoothstep(.25,0.,abs(fract(vUv.x*2.2 - uTime*.65)-.5)-.06), 2.);
      float head = smoothstep(.12,0.,uProg - vUv.x);
      vec3 col = uColor * (.45 + flow*1.5 + head*1.6);
      gl_FragColor = vec4(col, 1.);
    }`;
  const lineVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

  const snap8 = (a) => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  const makePath = () => {
    const pts = [];
    const a0 = Math.random() * Math.PI * 2;
    let x = Math.cos(a0) * 0.55, z = Math.sin(a0) * 0.55;
    pts.push(new THREE.Vector3(x * 0.3, HALF, z * 0.3));
    pts.push(new THREE.Vector3(x, HALF, z));
    let ang = snap8(a0);
    const segs = 2 + ((Math.random() * 3) | 0);
    let escaped = null;
    for (let s = 0; s < segs && !escaped; s++) {
      const len = 0.5 + Math.random() * 1.0;
      let nx = x + Math.cos(ang) * len, nz = z + Math.sin(ang) * len;
      if (Math.abs(nx) > HALF || Math.abs(nz) > HALF) {
        const tx = Math.abs(nx) > HALF ? (HALF * Math.sign(nx) - x) / (nx - x) : 1;
        const tz = Math.abs(nz) > HALF ? (HALF * Math.sign(nz) - z) / (nz - z) : 1;
        const tt = Math.min(tx, tz);
        nx = x + (nx - x) * tt; nz = z + (nz - z) * tt;
        escaped = tx < tz ? { axis: 'x' } : { axis: 'z' };
      }
      pts.push(new THREE.Vector3(nx, HALF, nz));
      x = nx; z = nz;
      ang = snap8(ang + (Math.random() < 0.5 ? -1 : 1) * Math.PI / 4);
    }
    if (escaped) {
      const drop = 0.9 + Math.random() * 1.5;
      const mid = new THREE.Vector3(x, HALF - drop * 0.5, z);
      const end = new THREE.Vector3(x, HALF - drop, z);
      if (escaped.axis === 'x') { mid.z += (Math.random() - 0.5) * 0.5; end.z = mid.z; }
      else { mid.x += (Math.random() - 0.5) * 0.5; end.x = mid.x; }
      pts.push(mid, end);
    }
    const n = new THREE.Vector3();
    return pts.map((p) => {
      n.set(0, 0, 0);
      if (Math.abs(p.y - HALF) < 0.01) n.y = 1;
      if (Math.abs(Math.abs(p.x) - HALF) < 0.01) n.x = Math.sign(p.x);
      if (Math.abs(Math.abs(p.z) - HALF) < 0.01) n.z = Math.sign(p.z);
      n.normalize();
      return p.clone().addScaledVector(n, 0.028);
    });
  };
  const LINES = 14, lineStates = [], lineUniforms = [];
  const linesG = new THREE.Group(); cubeG.add(linesG);
  for (let i = 0; i < LINES; i++) {
    const curve = new THREE.CatmullRomCurve3(makePath(), false, 'catmullrom', 0.08);
    const geo = new THREE.TubeGeometry(curve, 110, 0.019, 6, false);
    const uni = { uTime: { value: 0 }, uProg: { value: 0 }, uColor: { value: new THREE.Color(CYAN) } };
    linesG.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: lineVert, fragmentShader: lineFrag })));
    lineStates.push({ p: 0 }); lineUniforms.push(uni);
  }

  /* master timeline */
  const st = { h: HOVER_H, erosion: 0, shake: 0 };
  const tl = gsap.timeline({ repeat: -1, defaults: { overwrite: 'auto' } });
  tl.to(st, { h: REST_H, duration: 1.5, ease: 'power2.in' }, 0.8)
    .to(face.scale, { x: SCALE, z: SCALE, y: SCALE * 0.82, duration: 0.12, ease: 'power2.out' }, 2.3)
    .to(face.scale, { y: SCALE, duration: 0.4, ease: 'elastic.out(1,.45)' }, 2.42)
    .to(st, { shake: 1, duration: 0.06 }, 2.3)
    .to(st, { shake: 0, duration: 0.55, ease: 'power2.out' }, 2.36)
    .to(st, { erosion: 1, duration: 0.7, ease: 'expo.out' }, 2.3)
    .to(under, { intensity: 1.6, duration: 0.3 }, 2.3)
    .add(gsap.to(lineStates, { p: 1, duration: 1.0, ease: 'power3.out', stagger: 0.055 }), 2.4)
    .add(gsap.to(lineStates, { p: 0, duration: 0.65, ease: 'power2.in', stagger: 0.035 }), 6.0)
    .to(under, { intensity: 0, duration: 0.6 }, 6.2)
    .to(st, { erosion: 0, duration: 0.9, ease: 'power3.inOut' }, 6.35)
    .to(st, { h: HOVER_H, duration: 1.7, ease: 'power3.out' }, 7.1)
    .to({}, { duration: 0.01 }, 10.55);
  if (prefersReduced) tl.pause(4.5);

  /* layout + parallax */
  const layout = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (w > 1024) { rig.position.set(2.25, -0.1, 0); rig.scale.setScalar(1); }
    else if (w > 640) { rig.position.set(0, -0.9, 0); rig.scale.setScalar(0.85); }
    else { rig.position.set(0, -1.25, 0); rig.scale.setScalar(0.66); }
  };
  addEventListener('resize', layout); layout();

  let mx = 0, my = 0;
  const onMove = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
  addEventListener('pointermove', onMove);

  const clock = new THREE.Clock();
  let raf;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    const air = Math.min(1, Math.max(0, (st.h - REST_H) / (HOVER_H - REST_H)));
    logo.position.y = HALF + st.h + Math.sin(t * 1.6) * 0.07 * air;
    logo.rotation.y = Math.sin(t * 0.55) * 0.08 * air;
    logo.rotation.x = Math.sin(t * 0.8) * 0.025 * air;
    logo.rotation.z = Math.cos(t * 0.7) * 0.025 * air;
    contact.material.opacity = 0.62 * (1 - air * 0.92);
    const cs = 1.15 + air * 1.1;
    contact.scale.set(cs, cs, 1);
    under.position.set(rig.position.x, HALF * 0.5, 1.5);
    updateVoxels(t, st.erosion);
    for (let i = 0; i < LINES; i++) {
      lineUniforms[i].uProg.value = lineStates[i].p;
      lineUniforms[i].uTime.value = t;
    }
    camera.position.x = mx * 0.45 + (Math.random() - 0.5) * 0.16 * st.shake;
    camera.position.y = 3.0 - my * 0.35 + (Math.random() - 0.5) * 0.14 * st.shake;
    camera.lookAt(LOOK);
    renderer.render(scene, camera);
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
      <div className="ogt-cube-shadow" />

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
