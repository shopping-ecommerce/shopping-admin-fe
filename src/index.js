import './lib/toast-bus' 
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import store from "./store"; // nếu có redux
import { AuthProvider } from "./contexts/AuthContext";
import ChatToaster from "./components/common/ChatToaster";
// ↓ bắt buộc có (1 lần duy nhất trong app)
import '@coreui/coreui/dist/css/coreui.min.css';


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
      <ChatToaster />
    </Provider>
  </React.StrictMode>
);
