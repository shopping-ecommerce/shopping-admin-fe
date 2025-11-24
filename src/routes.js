// src/routes.js
import React from 'react'
import UnSuspensionReview from './views/theme/appeals/UnSuspensionReview'

const Dashboard     = React.lazy(() => import('./views/dashboard/Dashboard'))

// Notifications
const Alerts        = React.lazy(() => import('./views/notifications/alerts/Alerts'))
const Badges        = React.lazy(() => import('./views/notifications/badges/Badges'))
const Modals        = React.lazy(() => import('./views/notifications/modals/Modals'))
const Toasts        = React.lazy(() => import('./views/notifications/toasts/Toasts'))
const Widgets       = React.lazy(() => import('./views/widgets/Widgets'))

// Seller
const BrowseSellers = React.lazy(() => import('./views/theme/seller/BrowseSellers'))
const SellerDetail  = React.lazy(() => import('./views/theme/listseller/SellerDetail'))
const ListSeller    = React.lazy(() => import('./views/theme/listseller/ListSeller'))
const Withdraw      = React.lazy(() => import('./views/withdraw/Withdraw.jsx'))
const SellerDetailBrowse = React.lazy(() => import('./views/theme/seller/SellerDetailBrowse'))

// User
const BrowseUsers   = React.lazy(() => import('./views/theme/user/BrowseUsers'))
const UserDetail    = React.lazy(() => import('./views/theme/user/UserDetail'))

// Product
const ProductList   = React.lazy(() => import('./views/theme/product/ProductList'))

const Policy        = React.lazy(() => import('./views/theme/policy/createpolicy.jsx'))
const PolicyHistory = React.lazy(() => import('./views/theme/policy/PolicyHistory'))

const ProductReviewQueue = React.lazy(() => import('./views/theme/browseproducts/ProductReviewQueue'))

const unSuspensionReview = React.lazy(() => import('./views/theme/appeals/UnSuspensionReview'))

const SellerAppeals = React.lazy(() => import('./views/theme/appeals/SellerAppeals'))

const routes = [
  { path: '/',               name: 'Home',        element: Dashboard },
  { path: '/dashboard',      name: 'Dashboard',   element: Dashboard },

  // Đừng mount SellerDetail ở /theme (tránh nhảy nhầm)
  { path: '/theme',          name: 'Theme',       element: Dashboard },

  // Chi tiết Seller (chuẩn với navigate(`/theme/seller/${id}`))
  { path: '/theme/seller/:id', name: 'Chi tiết Seller', element: SellerDetail },
  // Tương thích link cũ /sellers/:id
  { path: '/sellers/:id',      name: 'Chi tiết Seller', element: SellerDetailBrowse },

  // Notifications
  { path: '/notifications',        name: 'Notifications',     element: Alerts },
  { path: '/notifications/alerts', name: 'Báo cáo',           element: Alerts },
  { path: '/notifications/badges', name: 'Badges',            element: Badges },
  { path: '/notifications/modals', name: 'Modals',            element: Modals },
  { path: '/notifications/toasts', name: 'Toasts',            element: Toasts },

  // Widgets
  { path: '/widgets',         name: 'Widgets',     element: Widgets },

  // Seller lists
  { path: '/sellers',         name: 'Duyệt Người bán',      element: BrowseSellers },
  { path: '/listSellers',     name: 'Danh sách Người bán',  element: ListSeller },

  { path: '/sellers/un-suspension',   name: 'Gỡ tạm ngưng',  element: UnSuspensionReview },
  { path: '/sellers/appeals',          name: 'Khiếu nại Người bán',  element: SellerAppeals },

  // Withdraw
  { path: '/withdraw',        name: 'Duyệt rút tiền', element: Withdraw },

  // Users
  { path: '/users',           name: 'Quản lý User',  element: BrowseUsers },
  { path: '/users/:id',       name: 'Chi tiết User', element: UserDetail },

   // Products
  { path: '/products',        name: 'Sản phẩm', element: ProductList }, 

  { path: '/products/review',   name: 'Duyệt sản phẩm', element: ProductReviewQueue },


   { path: '/policy',          name: 'Policy',            element: Policy },
   { path: '/policy/history',  name: 'Lịch sử thay đổi', element: PolicyHistory },
]

export default routes
