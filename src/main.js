import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './utils/mock-preload'
import { seedDemoData } from './utils/seed-data'
import { useAnswersStore } from './stores/answers'
import { useCategoriesStore } from './stores/categories'
import './main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

seedDemoData()

const answersStore = useAnswersStore(pinia)
const categoriesStore = useCategoriesStore(pinia)
answersStore.init()
categoriesStore.init()

app.config.errorHandler = (err, instance, info) => {
  if (window.preload?.isDev?.()) {
    console.error('[全局错误]', err, info)
  }
}

app.mount('#app')
