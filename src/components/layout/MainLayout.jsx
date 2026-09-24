import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const MainLayout = () => {
  return (
    <div className="app-shell flex flex-col min-h-screen">
      <Navbar />
      <main className="main-content flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
