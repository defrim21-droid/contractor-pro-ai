import React, { useState } from 'react';
import Auth from './Auth';
import {
  CheckIcon,
  FireIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function Landing() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openAuth = (mode) => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      
      {/* Auth Modal Overlay */}
      {isAuthOpen && (
        <Auth onClose={() => setIsAuthOpen(false)} defaultMode={authMode} />
      )}

      {/* Navbar */}
      <nav className="px-8 py-6 flex justify-between items-center bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="text-2xl font-extrabold text-blue-600">ContractorPro AI</div>
        <div className="space-x-4">
          <button onClick={() => openAuth('login')} className="text-slate-600 hover:text-blue-600 font-medium transition cursor-pointer">Log In</button>
          <button onClick={() => openAuth('signup')} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm cursor-pointer">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
          Win more bids with <span className="text-blue-600">AI-powered mockups</span>.
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
          Upload a photo of your client's space, draw the exact areas to renovate, and generate photorealistic renderings in seconds. Close deals faster without hiring a 3D designer.
        </p>
        <div className="flex justify-center gap-4">
          <button 
            onClick={() => openAuth('signup')} 
            className="btn-primary px-8 py-4 text-lg font-bold"
          >
            Start Free Trial
          </button>
        </div>
        
        {/* App Screenshot */}
        <div className="mt-16 w-full max-w-5xl mx-auto rounded-3xl border border-slate-200/60 shadow-large overflow-hidden bg-white animate-fade-in">
          <img 
            src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="ContractorPro AI Output Example" 
            className="w-full h-auto object-cover max-h-[600px]"
          />
        </div>
      </main>

      {/* Pricing Section */}
      <section className="bg-white py-24 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
              Choose the plan that fits your business. Upgrade anytime as you take on more projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* Tier 1 */}
            <div className="card-modern p-8 flex flex-col">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Starter</h3>
              <p className="text-slate-500 mb-6">Perfect for independent contractors.</p>
              <div className="text-5xl font-extrabold text-slate-900 mb-6">$149<span className="text-lg text-slate-500 font-medium">/mo</span></div>
              <ul className="space-y-4 mb-8 text-slate-700 font-medium flex-grow">
                <li className="flex items-center gap-2">
                  <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                  20 AI Renderings per month
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                  Standard resolution exports
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                  Email support
                </li>
              </ul>
              <button onClick={() => openAuth('signup')} className="btn-secondary w-full">
                Choose Starter
              </button>
            </div>

            {/* Tier 2 */}
            <div className="card-modern p-8 relative transform md:-translate-y-4 border-2 border-blue-500 shadow-glow flex flex-col">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-blue text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase shadow-medium whitespace-nowrap">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Contractor Pro</h3>
              <p className="text-slate-500 mb-6">Everything you need to win more bids.</p>
              <div className="text-5xl font-extrabold text-slate-900 mb-2">$199<span className="text-lg text-slate-500 font-medium">/mo</span></div>
              <p className="text-blue-600 font-bold mb-6 text-sm flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                Includes a 2-Week Free Trial
              </p>
              <ul className="space-y-4 mb-8 text-slate-700 font-medium flex-grow">
                <li className="flex items-center gap-2">
                  <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  100 AI Renderings per month
                </li>
                <li className="flex items-center gap-2">
                  <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  4K High-Resolution exports
                </li>
                <li className="flex items-center gap-2">
                  <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  Remove watermarks
                </li>
                <li className="flex items-center gap-2">
                  <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  Priority 24/7 support
                </li>
              </ul>
              <button onClick={() => openAuth('signup')} className="btn-primary w-full">
                Start Free Trial
              </button>
            </div>

            {/* Tier 3 */}
            <div className="card-modern p-8 flex flex-col">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Elite</h3>
              <p className="text-slate-500 mb-6">For high-volume design teams.</p>
              <div className="text-5xl font-extrabold text-slate-900 mb-6">$249<span className="text-lg text-slate-500 font-medium">/mo</span></div>
              <ul className="space-y-4 mb-8 text-slate-700 font-medium flex-grow">
                <li className="flex items-center gap-2">
                  <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  Unlimited AI Renderings
                </li>
                <li className="flex items-center gap-2">
                  <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  Custom AI model tuning
                </li>
                <li className="flex items-center gap-2">
                  <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  Team Workspaces
                </li>
                <li className="flex items-center gap-2">
                  <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  Dedicated account manager
                </li>
              </ul>
              <button onClick={() => openAuth('signup')} className="btn-secondary w-full">
                Choose Elite
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 text-center text-slate-400">
        <p className="text-sm">© {new Date().getFullYear()} ContractorPro AI. All rights reserved.</p>
      </footer>
    </div>
  );
}