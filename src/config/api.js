export const API_CONFIG = {
  baseUrl:
    import.meta.env?.VITE_API_BASE_URL ||
    "https://api.shoppingiuh.id.vn/shopping/api",

  endpoints: {
    auth: {
      register: "/authentication/register",
      verifyOtp: "/authentication/verifyOTP",
      login: "/authentication/login-email-password",
      refresh: "/authentication/refresh",
      logout: "/authentication/logout",
    },
    profile: {
      getMyProfile: "/info/profiles/getMyProfile",
      updateProfile: "/info/profiles/updateProfile",
    },
    adminSellers: {
      listPending: "/info/sellers/sellerPending",
      detail: (id) => `/info/sellers/${id}`,
      verify: "/info/sellers/verifySeller",
      listByStatus: (status) =>
        `/info/sellers/findByStatus?status=${encodeURIComponent(status)}`,
    },
    adminUsers: {
      list: "/info/profiles",
      detail: (id) => `/info/profiles/${id}`,
      search: "/info/profiles/search",
      deleteMany: "/profiles",
    },
    products: {
      getAll: "/product/getProducts",
      deleteBySeller: "/product/deleteProductBySeller",
    },
    adminOrders: {
      statisticsAdmin: "/order/order-statistics/admin",
    },
  },
};

export const apiUrl = (path) =>
  `${API_CONFIG.baseUrl}${
    path.startsWith("/") ? path : `/${path}`
  }`;
