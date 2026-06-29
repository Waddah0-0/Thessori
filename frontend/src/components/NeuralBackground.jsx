import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Each "word typed" adds energy to the network (drives node drift speed).
export default function NeuralBackground({ energy = 0 }) {
  const mountRef = useRef(null)
  const energyRef = useRef(energy)

  useEffect(() => {
    energyRef.current = energy
  }, [energy])

  useEffect(() => {
    const mount = mountRef.current
    const W = window.innerWidth
    const H = window.innerHeight

    // Scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Nodes
    const NODE_COUNT = 80
    const positions = Array.from({ length: NODE_COUNT }, () => ({
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 0.003,
      vy: (Math.random() - 0.5) * 0.003,
    }))

    const nodeGeo = new THREE.SphereGeometry(0.04, 8, 8)
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 })
    const nodeMeshes = positions.map((p) => {
      const m = new THREE.Mesh(nodeGeo, nodeMat.clone())
      m.position.set(p.x, p.y, p.z)
      scene.add(m)
      return m
    })

    // Edges: connect nodes within threshold distance
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: 0.3,
    })
    const edgeGroup = new THREE.Group()
    scene.add(edgeGroup)

    const THRESHOLD = 2.5

    function rebuildEdges() {
      // Dispose old line geometries before clearing to avoid a slow GPU leak.
      while (edgeGroup.children.length) {
        const line = edgeGroup.children[0]
        line.geometry.dispose()
        edgeGroup.remove(line)
      }
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < THRESHOLD) {
            const geo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(positions[i].x, positions[i].y, positions[i].z),
              new THREE.Vector3(positions[j].x, positions[j].y, positions[j].z),
            ])
            edgeGroup.add(new THREE.Line(geo, edgeMat))
          }
        }
      }
    }

    let frame = 0
    let animId

    function animate() {
      animId = requestAnimationFrame(animate)
      frame++

      const boost = 1 + energyRef.current * 0.4

      positions.forEach((p, i) => {
        p.x += p.vx * boost
        p.y += p.vy * boost
        if (Math.abs(p.x) > 6) p.vx *= -1
        if (Math.abs(p.y) > 4) p.vy *= -1
        nodeMeshes[i].position.set(p.x, p.y, p.z)
      })

      if (frame % 3 === 0) rebuildEdges() // rebuild edges every 3 frames

      renderer.render(scene, camera)
    }

    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      nodeGeo.dispose()
      renderer.dispose()
      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
