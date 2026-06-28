import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('../pages/Main.vue') },
    { path: '/admin', component: () => import('../pages/Admin.vue') }
  ]
})
