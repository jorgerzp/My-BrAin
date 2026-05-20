import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, Scroll, useScroll } from '@react-three/drei'
import * as THREE from 'three'

const PARTICLE_COUNT = 80000

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

function fingerprintSpherePositions(count) {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN * i
    let x = Math.cos(theta) * radiusAtY
    let z = Math.sin(theta) * radiusAtY
    const phi = Math.acos(THREE.MathUtils.clamp(y, -1, 1))

    const ridge =
      0.15 *
        Math.sin(16 * phi + 0.7 * Math.cos(theta * 4)) *
        Math.cos(11 * theta + 0.35 * Math.sin(phi * 6)) +
      0.055 * Math.sin(38 * phi)

    const r = 2.42 + ridge
    out[i * 3] = x * r
    out[i * 3 + 1] = y * r
    out[i * 3 + 2] = z * r
  }
  return out
}

function torusKnotTubePositions(count) {
  const out = new Float32Array(count * 3)
  const p = 3
  const q = 5
  const R = 2.05
  const rBase = 0.48
  const tube = 0.36

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2 * 9
    const v = (((i * 2654435761) >>> 0) % 65536) / 65536
    const tubeAngle = v * Math.PI * 2

    const rt = rBase + tube * (0.35 * Math.sin(3 * tubeAngle) + 0.65 * Math.cos(2 * tubeAngle))
    const phase = 0.28 * Math.sin(tubeAngle * 5)

    const cx = (R + rt * Math.cos(q * t + tubeAngle + phase)) * Math.cos(p * t + tubeAngle * 0.15)
    const cy = (R + rt * Math.cos(q * t + tubeAngle + phase)) * Math.sin(p * t + tubeAngle * 0.15)
    const cz = rt * Math.sin(q * t + tubeAngle * 1.1)

    out[i * 3] = cx
    out[i * 3 + 1] = cy
    out[i * 3 + 2] = cz
  }
  return out
}

function seedAttribute(count) {
  const s = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    s[i] = Math.random()
  }
  return s
}

const vertexShader = /* glsl */ `
  attribute vec3 positionA;
  attribute vec3 positionB;
  attribute float aSeed;
  uniform float uScroll;
  uniform vec3 uMouse3D;

  varying float vMorph;
  varying float vSeed;

  void main() {
    float morph = smoothstep(0.1, 0.46, uScroll);
    vec3 pos = mix(positionA, positionB, morph);

    vec3 rep = pos - uMouse3D;
    float d = length(rep);
    float push = smoothstep(1.95, 0.0, d) * 1.35;
    pos += normalize(rep + vec3(1e-6)) * push;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 2.5 * (1.0 / max(-mvPosition.z, 1e-4));
    gl_Position = projectionMatrix * mvPosition;

    vMorph = morph;
    vSeed = aSeed;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vMorph;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    if (length(c) > 0.5) discard;

    vec3 black = vec3(0.0);
    vec3 charcoal = vec3(0.07, 0.08, 0.1);

    vec3 cyan = vec3(0.0, 0.898, 1.0);
    vec3 purple = vec3(0.38, 0.06, 0.52);

    float n = fract(vSeed * 43758.5453123 + vMorph * 0.15);
    float grain = fract(sin(dot(gl_PointCoord + vSeed, vec2(12.9898, 78.233))) * 43758.5453);

    vec3 base = mix(black, charcoal, n * 0.92 + grain * 0.08);

    float ring = smoothstep(0.35, 0.5, length(c) * 2.0);
    float accentGate = smoothstep(0.62, 1.0, n) * (0.28 + 0.72 * vMorph);
    vec3 accent = mix(cyan, purple, n);

    vec3 col = mix(base, accent, accentGate * (0.45 + 0.35 * ring));
    float alpha = 0.78 + 0.18 * ring;

    gl_FragColor = vec4(col, alpha);
  }
`

function ParticleField({ groupRef }) {
  const scroll = useScroll()
  const { camera, raycaster, pointer } = useThree()

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const mouseWorld = useMemo(() => new THREE.Vector3(), [])
  const mouseLocal = useMemo(() => new THREE.Vector3(), [])
  const farAway = useMemo(() => new THREE.Vector3(1e4, 1e4, 1e4), [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const posA = fingerprintSpherePositions(PARTICLE_COUNT)
    const posB = torusKnotTubePositions(PARTICLE_COUNT)
    const seeds = seedAttribute(PARTICLE_COUNT)

    geo.setAttribute('position', new THREE.BufferAttribute(posA.slice(), 3))
    geo.setAttribute('positionA', new THREE.BufferAttribute(posA, 3))
    geo.setAttribute('positionB', new THREE.BufferAttribute(posB, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geo.computeBoundingSphere()
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uScroll: { value: 0 },
      uMouse3D: { value: new THREE.Vector3(1e4, 1e4, 1e4) },
    }),
    []
  )

  useFrame(() => {
    const offset = scroll.offset

    const camZ = THREE.MathUtils.lerp(13.8, 1.85, THREE.MathUtils.smoothstep(offset, 0.0, 0.48))
    const camY = THREE.MathUtils.lerp(0.15, -0.05, THREE.MathUtils.smoothstep(offset, 0.25, 0.85))

    camera.position.z = camZ
    camera.position.y = camY
    camera.lookAt(3.1, 0, 0)

    raycaster.setFromCamera(pointer, camera)
    const ok = raycaster.ray.intersectPlane(plane, hit)
    if (ok && groupRef.current) {
      mouseWorld.copy(hit)
      groupRef.current.worldToLocal(mouseLocal.copy(mouseWorld))
      uniforms.uMouse3D.value.copy(mouseLocal)
    } else if (groupRef.current) {
      uniforms.uMouse3D.value.copy(farAway)
    }

    uniforms.uScroll.value = offset
  })

  return (
    <group ref={groupRef} position={[3, 0, 0]}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          attach="material"
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  )
}

function SceneContent() {
  const groupRef = useRef(null)
  return <ParticleField groupRef={groupRef} />
}

export default function SonoraParticleHero() {
  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ background: '#FBFBFD' }}
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0.15, 13.8], fov: 42, near: 0.05, far: 80 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#FBFBFD', 1)
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ScrollControls pages={4} damping={0.1} infinite={false}>
          <SceneContent />
          <Scroll html style={{ width: '50%', height: '100%' }}>
            <div
              className="pointer-events-none flex flex-col"
              style={{
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                color: '#111111',
              }}
            >
              <section
                className="flex min-h-screen max-w-xl flex-col justify-center px-10 md:px-14"
                style={{ background: 'transparent' }}
              >
                <p className="pointer-events-auto mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
                  Sonora Intelligence
                </p>
                <h1 className="pointer-events-auto mb-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
                  Voice AI software that actually understands.
                </h1>
                <p className="pointer-events-auto max-w-md text-pretty text-lg font-normal leading-relaxed text-neutral-600 md:text-xl">
                  We engineer immersive AI models that perceive nuance, context, and emotion.
                </p>
              </section>

              <section
                className="flex max-w-xl flex-col px-10 md:px-14"
                style={{ background: 'transparent', minHeight: '200vh' }}
              >
                <div className="flex min-h-screen flex-col justify-center">
                  <p className="pointer-events-auto mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
                    Sonora Intelligence
                  </p>
                  <h2 className="pointer-events-auto mb-5 text-balance text-3xl font-semibold leading-[1.12] tracking-tight md:text-4xl">
                    Deep Context Engine.
                  </h2>
                  <p className="pointer-events-auto max-w-md text-pretty text-lg font-normal leading-relaxed text-neutral-600 md:text-xl">
                    Our neural architecture processes conversational data in real-time, mapping intent with
                    microscopic precision.
                  </p>
                </div>
                <div className="flex min-h-screen flex-col justify-center border-t border-neutral-200/70 pt-10">
                  <p className="pointer-events-auto max-w-md text-pretty text-base font-medium leading-relaxed text-neutral-500">
                    Intent locked to context. Every utterance mapped with production-grade fidelity — while you
                    move through the scroll narrative, the neural lattice reorganizes around you.
                  </p>
                </div>
              </section>
              <section
                className="flex min-h-screen max-w-xl flex-col justify-end px-10 pb-16 md:px-14"
                style={{ background: 'transparent' }}
              >
                <p className="pointer-events-auto text-sm text-neutral-500">
                  Sonora Intelligence · Voice AI
                </p>
                {/* <a> en lugar de <Link>: el HTML de Scroll de drei se monta en otro createRoot y pierde el contexto de Router */}
                <a
                  href="/login"
                  className="pointer-events-auto mt-6 inline-flex w-fit items-center rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400 hover:shadow-md"
                >
                  Acceder al panel
                </a>
              </section>
            </div>
          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  )
}
