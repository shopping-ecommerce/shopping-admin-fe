import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilPeople, // dùng cho Quản lý Người dùng (nhiều người)
  cilUser, // dùng cho Quản lý Người bán (1 người)
  cilCart,
  cilWarning,
  cilWallet,
  cilHistory,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  // mục lớn: có icon
  {
    component: CNavItem,
    name: 'Tổng quan',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    badge: { color: 'info', text: 'NEW' },
  },

  { component: CNavTitle, name: 'Người dùng' },
  {
    component: CNavGroup,
    name: 'Quản lý Người dùng',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />, // ĐÃ ĐỔI
    items: [
      // mục con: KHÔNG icon
      { component: CNavItem, name: 'Danh sách người dùng', to: '/users' },
    ],
  },

  { component: CNavTitle, name: 'Người bán' },
  {
    component: CNavGroup,
    name: 'Quản lý Người bán',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />, // ĐÃ ĐỔI
    items: [
      { component: CNavItem, name: 'Duyệt người bán', to: '/sellers' },
      { component: CNavItem, name: 'Danh sách người bán', to: '/listSellers' },
      { component: CNavItem, name: 'Gỡ tạm ngưng', to: '/sellers/un-suspension' },
      { component: CNavItem, name: 'Khiếu nại người bán', to: '/sellers/appeals' },
    ],
  },

  { component: CNavTitle, name: 'Sản phẩm' },
  {
    component: CNavGroup,
    name: 'Quản lý Sản phẩm',
    icon: <CIcon icon={cilCart} customClassName="nav-icon" />,
    items: [
      { component: CNavItem, name: 'Duyệt sản phẩm', to: '/products/review' },
      { component: CNavItem, name: 'Sản phẩm', to: '/products' },
      { component: CNavItem, name: 'Báo cáo vi phạm', to: '/notifications/alerts' },
    ],
  },

  { component: CNavTitle, name: 'Thanh toán' },
  {
    component: CNavItem,
    name: 'Duyệt rút tiền',
    to: '/withdraw',
    icon: <CIcon icon={cilWallet} customClassName="nav-icon" />,
    badge: { color: 'info', text: 'NEW' },
  },

  { component: CNavTitle, name: 'Chính sách' },
  {
    component: CNavItem,
    name: 'Chính sách',
    to: '/policy',
    icon: <CIcon icon={cilWarning} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Lịch sử thay đổi',
    to: '/policy/history',
    icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
  },

  { component: CNavTitle, name: 'Khác' },
]

export default _nav
