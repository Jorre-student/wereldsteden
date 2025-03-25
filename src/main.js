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

  // Listen for slide changes to sync globe view with the active city
  swiper.on('slideChange', () => {
    // Assuming slide 0 is ISS, slides 1-5 are cities
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
      // Calculate a target camera position (scaled version of the city vector)
      const targetPos = cityPositions[targetCity].clone().multiplyScalar(3)
      // Smoothly interpolate camera position toward the target (simple lerp)
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
    // Update the DOM element if present
    const urineTankElement = document.getElementById('urineTankLevel')
    if (urineTankElement) {
      urineTankElement.textContent = `Urine: ${urineTankLevel}%`
      urineTankElement.style.background = `linear-gradient(90deg, rgba(233,211,2,1) ${urineTankLevel}%, rgba(221,249,255,1) ${urineTankLevel}%)`
    }
    // Also update the ISS label on the globe (if available)
    if (issLabel) {
      const newText = `ISS: ${urineTankLevel}%`
      const newLabel = createTextSprite(newText)
      newLabel.position.copy(issLabel.position) // keep same relative position
      issMesh.remove(issLabel)
      issMesh.add(newLabel)
      issLabel = newLabel
    }
  },
})
lsClient.subscribe(subscription)

// ------------------ THREE.JS & GLOBE CODE ------------------

// Get the container element for the globe from the HTML
const globeContainer = document.getElementById('globe-container')

// Create scene, camera, and renderer
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

// Add lights to the scene
const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

// Set up OrbitControls for interactivity
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// Create the Earth globe using the texture from the public folder
const textureLoader = new THREE.TextureLoader()
const earthTexture = textureLoader.load('/earth.jpg')
const earthGeometry = new THREE.SphereGeometry(2, 64, 64)
const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture })
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
scene.add(earthMesh)

// Helper: Convert latitude/longitude to a position vector on the sphere
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  return new THREE.Vector3(x, y, z)
}

// Helper: Create a text sprite for labels using a canvas
function createTextSprite(message) {
  // Create a canvas element
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  // Set the h2 style (bold and larger font size)
  const fontsize = 16 // Adjust as needed for h2 size
  context.font = `bold ${fontsize}px Arial`

  // Measure text and add padding
  const metrics = context.measureText(message)
  const textWidth = metrics.width
  const padding = 8 // Total horizontal padding
  canvas.width = textWidth + padding
  canvas.height = fontsize * 1.5 // Adjust the height to include some vertical padding

  // Draw a white background (the box)
  context.fillStyle = '#023047'
  context.fillRect(0, 0, canvas.width, canvas.height)

  // Draw the text (in black) on top
  context.font = `bold ${fontsize}px Arial`
  context.fillStyle = 'white'
  context.fillText(message, padding / 2, fontsize) // position with left padding

  // Create a texture from the canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter

  // Create a sprite material with the texture
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  })
  const sprite = new THREE.Sprite(spriteMaterial)

  // Scale the sprite based on the canvas dimensions
  sprite.scale.set(canvas.width / 100, canvas.height / 100, 1)

  return sprite
}

// Helper: Fetch weather for a city and return a formatted label text
async function fetchCityWeatherForGlobe(cityName) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`
  try {
    const response = await fetch(url)
    const data = await response.json()
    if (data.main && data.main.temp) {
      return `${cityName}: ${Math.round(data.main.temp)}°C`
    }
  } catch (err) {
    console.error('Error fetching weather for globe:', err)
  }
  return `${cityName}: N/A`
}

// Define cities with coordinates
const cities = [
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
]

// Object to store each city's vector position (for syncing with slides)
const cityPositions = {}

// For each city, add a pin and a label as children of the Earth so they rotate together
cities.forEach((city) => {
  const pos = latLonToVector3(city.lat, city.lon, 2.01)
  cityPositions[city.name] = pos.clone()

  // Create a pin (small red sphere)
  const pinGeometry = new THREE.SphereGeometry(0.05, 8, 8)
  const pinMaterial = new THREE.MeshBasicMaterial({ color: 0xffb703 })
  const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial)
  pinMesh.position.copy(pos)
  earthMesh.add(pinMesh)

  // Create an initial label with just the city name
  const label = createTextSprite(city.name)
  label.position.copy(pos.clone().multiplyScalar(1.1))
  earthMesh.add(label)
  city.labelSprite = label

  // Asynchronously update the label to include temperature
  fetchCityWeatherForGlobe(city.name).then((newText) => {
    const newLabel = createTextSprite(newText)
    newLabel.position.copy(label.position)
    earthMesh.remove(label)
    earthMesh.add(newLabel)
    city.labelSprite = newLabel
  })
})

// ------------------ ADD THE ISS ------------------
// Create a simple ISS representation as a small yellow cube
const issGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
const issMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 })
const issMesh = new THREE.Mesh(issGeometry, issMaterial)
scene.add(issMesh)
// Create an ISS label and attach it to the ISS
let issLabel = createTextSprite('ISS: --')
issLabel.position.set(0, 0.2, 0) // slightly above the cube
issMesh.add(issLabel)
let issOrbitAngle = 0
const issOrbitRadius = 2.5
const issOrbitAltitude = 0.2

// Set initial camera position so the globe is fully visible
camera.position.set(0, 0, 6)

// ------------------ ANIMATION LOOP ------------------
function animate() {
  // Rotate the Earth slowly so pins and labels rotate with it
  earthMesh.rotation.y += 0.001

  // Update OrbitControls
  controls.update()

  // Simulate a slow ISS orbit around the Earth
  issOrbitAngle += 0.005
  issMesh.position.x = issOrbitRadius * Math.cos(issOrbitAngle)
  issMesh.position.z = issOrbitRadius * Math.sin(issOrbitAngle)
  issMesh.position.y = issOrbitAltitude

  renderer.render(scene, camera)
}
renderer.setAnimationLoop(animate)

// Handle window resize events
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
