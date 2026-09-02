/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingScreen from "./screens/auth/LandingScreen";
import FoamEffect from "./components/ui/FoamEffect";
import AuthLayout from './screens/auth/AuthLayout';
import Login from './screens/auth/Login';
import SignUpChoice from './screens/auth/SignUpChoice';
import CustomerSignUp from './screens/auth/CustomerSignUp';
import StaffActivation from './screens/auth/StaffActivation';
import ForgotPassword from './screens/auth/ForgotPassword';
import VerifyEmail from './screens/auth/VerifyEmail';
import CustomerDashboardLayout from './screens/dashboard/customer/CustomerDashboardLayout';
import CustomerDashboard from './screens/dashboard/customer/CustomerDashboard';
import CustomerAppointments from './screens/dashboard/customer/CustomerAppointments';
import CustomerReschedule from './screens/dashboard/customer/CustomerReschedule';
import CustomerCancel from './screens/dashboard/customer/CustomerCancel';
import CustomerPackages from './screens/dashboard/customer/CustomerPackages';
import CustomerBooking from './screens/dashboard/customer/CustomerBooking';
import CustomerCustomPackage from './screens/dashboard/customer/CustomerCustomPackage';
import CustomerCheckout from './screens/dashboard/customer/CustomerCheckout';
import CustomerProfile from './screens/dashboard/customer/CustomerProfile';
import CustomerContactUs from './screens/dashboard/customer/CustomerContactUs';
import CustomerAboutUs from './screens/dashboard/customer/AboutUsScreen';
import CustomerMembership from './screens/dashboard/customer/CustomerMembership';
import CustomerRewards from './screens/dashboard/customer/CustomerRewards';
import CustomerReviews from './screens/dashboard/customer/CustomerReviews';
import CustomerNotifications from './screens/dashboard/customer/CustomerNotifications';
import StaffDashboardLayout from './screens/dashboard/staff/StaffDashboardLayout';
import StaffDashboard from './screens/dashboard/staff/StaffDashboard';
import StaffAppointments from './screens/dashboard/staff/StaffAppointments';
import StaffReviews from './screens/dashboard/staff/StaffReviews';
import StaffProfile from './screens/dashboard/staff/StaffProfile';
import AdminDashboard from './screens/dashboard/admin/AdminDashboard';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <>
                <FoamEffect />
                <LandingScreen />
              </>
            } />
            <Route path="/auth" element={<AuthLayout />}>
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<SignUpChoice />} />
              <Route path="signup/customer" element={<CustomerSignUp />} />
              <Route path="signup/staff" element={<StaffActivation />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="verify-email" element={<VerifyEmail />} />
            </Route>
            <Route path="/dashboard/customer" element={
              <NotificationsProvider>
                <CustomerDashboardLayout />
              </NotificationsProvider>
            }>
              <Route index element={<CustomerDashboard />} />
              <Route path="profile" element={<CustomerProfile />} />
              <Route path="appointments" element={<CustomerAppointments />} />
              <Route path="appointments/reschedule" element={<CustomerReschedule />} />
              <Route path="appointments/cancel" element={<CustomerCancel />} />
              <Route path="packages" element={<CustomerPackages />} />
              <Route path="booking" element={<CustomerBooking />} />
              <Route path="custom-package" element={<CustomerCustomPackage />} />
              <Route path="checkout" element={<CustomerCheckout />} />
              <Route path="contact" element={<CustomerContactUs />} />
              <Route path="about-us" element={<CustomerAboutUs />} />
              <Route path="membership" element={<CustomerMembership />} />
              <Route path="rewards" element={<CustomerRewards />} />
              <Route path="reviews" element={<CustomerReviews />} />
              <Route path="notifications" element={<CustomerNotifications />} />
            </Route>
            <Route path="/dashboard/staff" element={
              <NotificationsProvider>
                <StaffDashboardLayout />
              </NotificationsProvider>
            }>
              <Route index element={<StaffDashboard />} />
              <Route path="appointments" element={<StaffAppointments />} />
              <Route path="reviews" element={<StaffReviews />} />
              <Route path="profile" element={<StaffProfile />} />
            </Route>
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
  );
}
