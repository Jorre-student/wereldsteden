/* eslint-disable no-unused-vars */
import { apiKey } from './secret'
import './styles/style.css'
import Swiper from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { Navigation, Pagination } from 'swiper/modules'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LightstreamerClient, Subscription } from 'lightstreamer-client-web'

// ------------------ SWIPER SETUP ------------------
document.addEventListener('DOMContentLoaded', () => {
  const swiper = new Swiper('.swiper', {
    modules: [Navigation, Pagination],
    loop: true,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    slidesPerView: 1,
    spaceBetween: 16,
  })

  // Synchroniseer globe-camera met de actieve slide (slides 1-5 corresponderen met steden)
  swiper.on('slideChange', () => {
    const index = swiper.realIndex
    let targetCity = null
    switch (index) {
      case 1:
        targetCity = 'Paris'
        break
      case 2:
        targetCity = 'New York'
        break
      case 3:
        targetCity = 'Tokyo'
        break
      case 4:
        targetCity = 'Cape Town'
        break
      case 5:
        targetCity = 'Sydney'
        break
      default:
        targetCity = null
    }
    if (targetCity && cityPositions[targetCity]) {
      const targetPos = cityPositions[targetCity].clone().multiplyScalar(3)
      camera.position.lerp(targetPos, 0.1)
      camera.lookAt(earthMesh.position)
    }
  })
})

// ------------------ WEATHER CODE (DOM) ------------------
const weatherElements = document.querySelectorAll('.weather')
async function fetchWeather(city, element) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
  try {
    const response = await fetch(url)
    const data = await response.json()
    if (data.main && data.main.temp) {
      element.textContent = `${Math.round(data.main.temp)}°C 🌡️`
    } else {
      element.textContent = 'Geen data ❌'
    }
  } catch (error) {
    element.textContent = 'Fout bij ophalen ⚠️'
  }
}
weatherElements.forEach((element) => {
  const city = element.dataset.city
  fetchWeather(city, element)
})

// ------------------ ISS CODE (DOM update) ------------------
const lsClient = new LightstreamerClient(
  'https://push.lightstreamer.com',
  'ISSLIVE',
)
lsClient.connect()
const subscription = new Subscription(
  'MERGE',
  ['NODE3000005'],
  ['Value', 'TimeStamp'],
)
subscription.addListener({
  onItemUpdate: function (update) {
    const urineTankLevel = update.getValue('Value')
    const urineTankElement = document.getElementById('urineTankLevel')
    if (urineTankElement) {
      urineTankElement.textContent = `Urine: ${urineTankLevel}%`
      urineTankElement.style.background = `linear-gradient(90deg, rgba(233,211,2,1) ${urineTankLevel}%, rgba(221,249,255,1) ${urineTankLevel}%)`
    }
    // Update ISS-label op de globe: werk de texture van het bestaande sprite bij
    if (issLabel) {
      const newText = `ISStest: ${urineTankLevel}%`
      const newSprite = createISSTextSprite(newText)
      // Werk de texture bij zonder positie te verliezen:
      issLabel.material.map.dispose()
      issLabel.material.map = newSprite.material.map
      issLabel.material.needsUpdate = true
      issLabel.scale.copy(newSprite.scale)
    }
  },
})
lsClient.subscribe(subscription)

// ------------------ THREE.JS & GLOBE CODE ------------------

// Krijg de container voor de globe uit de HTML
const globeContainer = document.getElementById('globe-container')

// Maak scene, camera en renderer
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
globeContainer.appendChild(renderer.domElement)

// Voeg verlichting toe
const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

// Stel OrbitControls in
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// Maak de aarde
const textureLoader = new THREE.TextureLoader()
const earthTexture = textureLoader.load('/earth.jpg')
const earthGeometry = new THREE.SphereGeometry(2, 64, 64)
const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture })
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
scene.add(earthMesh)

// Helper: Converteer latitude/longitude naar een positievector op de bol
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  return new THREE.Vector3(x, y, z)
}

// Helper: Maak een tekst-sprite voor labels (canvas gebaseerd)
function createTextSprite(message) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const fontsize = 16
  context.font = `bold ${fontsize}px Arial`
  const metrics = context.measureText(message)
  const textWidth = metrics.width
  const padding = 8
  canvas.width = textWidth + padding
  canvas.height = fontsize * 1.5
  context.fillStyle = '#023047'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = `bold ${fontsize}px Arial`
  context.fillStyle = 'white'
  context.fillText(message, padding / 2, fontsize)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  sprite.scale.set(canvas.width / 100, canvas.height / 100, 1)
  return sprite
}

// Helper: Maak een speciaal ISS-label (met een grotere tekst, maar nu op dezelfde schaal als de stadslabels)
function createISSTextSprite(message) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const fontsize = 16 // Zelfde als stadslabels
  context.font = `bold ${fontsize}px Arial`
  const metrics = context.measureText(message)
  const textWidth = metrics.width
  const padding = 8
  canvas.width = textWidth + padding
  canvas.height = fontsize * 1.5
  context.fillStyle = '#023047'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = `bold ${fontsize}px Arial`
  context.fillStyle = 'white'
  context.fillText(message, padding / 2, fontsize)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  sprite.scale.set(canvas.width / 100, canvas.height / 100, 1)
  return sprite
}

// Definieer steden met hun coordinaten
const cities = [
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
]
const cityPositions = {}

// Voor elke stad: voeg een pin en een label toe als kinderen van de aarde zodat ze meedraaien
cities.forEach((city) => {
  const pos = latLonToVector3(city.lat, city.lon, 2.01)
  cityPositions[city.name] = pos.clone()

  // Pin (kleine rode bol)
  const pinGeometry = new THREE.SphereGeometry(0.05, 8, 8)
  const pinMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial)
  pinMesh.position.copy(pos)
  earthMesh.add(pinMesh)

  // Label: begin met stadsnaam (later update met temperatuur)
  const label = createTextSprite(city.name)
  label.position.copy(pos.clone().multiplyScalar(1.1))
  earthMesh.add(label)
  city.labelSprite = label

  // Update label asynchroon met weerdata
  fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${city.name}&appid=${apiKey}&units=metric`,
  )
    .then((res) => res.json())
    .then((data) => {
      if (data.main && data.main.temp) {
        const newText = `${city.name}: ${Math.round(data.main.temp)}°C`
        const newLabel = createTextSprite(newText)
        newLabel.position.copy(label.position)
        earthMesh.remove(label)
        earthMesh.add(newLabel)
        city.labelSprite = newLabel
      }
    })
})

// ------------------ LAAD HET ISS MODEL MET GLTFLoader ------------------
let issModel = null
let issLabel = null
let issOrbitAngle = 0
const issOrbitRadius = 2.5
const issOrbitAltitude = 1.3

const gltfLoader = new GLTFLoader()
gltfLoader.load(
  '/models/iss.glb',
  (gltf) => {
    issModel = gltf.scene
    // Schaal het model aan zodat het passend is
    issModel.scale.set(0.01, 0.01, 0.01)
    scene.add(issModel)
    // Voeg het ISS-label toe aan de scene (zodat we de positie via worldcoords kunnen updaten)
    issLabel = createISSTextSprite('ISS: --')
    scene.add(issLabel)
  },
  undefined,
  (error) => {
    console.error('Error loading ISS model:', error)
  },
)

// Stel de initiële camera zodat de aarde goed zichtbaar is
camera.position.set(0, 0, 6)

// ------------------ ANIMATION LOOP ------------------
function animate() {
  // Draai de aarde zodat alle pins en labels meedraaien
  earthMesh.rotation.y += 0.001

  // Update OrbitControls
  controls.update()

  // Simuleer een ISS-omloop als het model geladen is
  if (issModel) {
    issOrbitAngle += 0.001
    issModel.position.x = issOrbitRadius * Math.cos(issOrbitAngle)
    issModel.position.z = issOrbitRadius * Math.sin(issOrbitAngle)
    issModel.position.y = issOrbitAltitude
    // Update het ISS-label positie op basis van de wereldpositie van het ISS-model
    issModel.updateMatrixWorld()
    const issWorldPos = new THREE.Vector3()
    issModel.getWorldPosition(issWorldPos)
    issLabel.position.copy(issWorldPos)
    issLabel.position.y += 0.5 // offset zodat het label boven het ISS staat
  }

  renderer.render(scene, camera)
}
renderer.setAnimationLoop(animate)

// Verwerk window-resize events
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
