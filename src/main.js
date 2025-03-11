import { apiKey } from './secret'
import './styles/style.css'
import Swiper from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { Navigation, Pagination } from 'swiper/modules'

document.addEventListener('DOMContentLoaded', () => {
  new Swiper('.swiper', {
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
})

// WEATHER JS //

// ophalen

const weatherElements = document.querySelectorAll('.weather')

// Functie om de temperatuur op te halen
async function fetchWeather(city, element) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.main && data.main.temp) {
      element.textContent = `${Math.round(data.main.temp)}°C 🌡️` // Toon temperatuur
    } else {
      element.textContent = 'Geen data ❌' // Fallback bij API-fout
    }
  } catch (error) {
    element.textContent = 'Fout bij ophalen ⚠️' // Fallback bij fetch-fout
  }
}

// Voor elke stad de temperatuur ophalen
weatherElements.forEach((element) => {
  const city = element.dataset.city // Haal de stad uit data-city
  fetchWeather(city, element)
})

// ISS //
import { LightstreamerClient, Subscription } from 'lightstreamer-client-web'

// Verbinding maken met de Lightstreamer-server
const lsClient = new LightstreamerClient(
  'https://push.lightstreamer.com',
  'ISSLIVE',
)
lsClient.connect()

// Abonneren op het urinetankniveau
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
      // Stel de nieuwe achtergrond in met het dynamische percentage
      urineTankElement.style.background = `linear-gradient(90deg, rgba(233,211,2,1) ${urineTankLevel}%, rgba(221,249,255,1) ${urineTankLevel}%)`
    }
  },
})
lsClient.subscribe(subscription)
