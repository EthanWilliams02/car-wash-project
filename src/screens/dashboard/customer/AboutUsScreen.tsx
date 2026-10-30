import { useNavigate } from 'react-router-dom';
import {
  Crosshair,
  ShieldCheck,
  Settings2,
  Award,
  Sparkles,
  Droplets,
} from 'lucide-react';

export default function AboutUsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#101010] text-[#F5F5F5]">

      {/* 1. Hero Section */}
      <section className="relative w-full h-[50vh] min-h-[420px] flex flex-col items-center justify-center overflow-hidden rounded-2xl mb-8">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=2000")',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#101010]/80 via-[#101010]/60 to-[#101010] rounded-2xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block uppercase tracking-[0.2em] text-[#E86A33] text-sm font-bold mb-6">
            WashWizzy Identity
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            Automotive Excellence,<br />Redefined.
          </h1>
          <p className="text-base md:text-lg text-[#A1A1AA] max-w-3xl mx-auto leading-relaxed">
            We are architects of automotive perfection. WashWizzy merges advanced protective technologies with meticulous craftsmanship to elevate and preserve the world's finest vehicles.
          </p>
        </div>

        {/* Subtle bottom separator */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#E86A33]/30 to-transparent"></div>
      </section>

      {/* 2. Our Story Section */}
      <section className="py-16 px-2 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* Left side: Our Story Card */}
          <div className="bg-[#171717] rounded-2xl border border-[#E86A33]/30 p-8 md:p-12 shadow-[0_0_30px_rgba(232,106,51,0.05)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E86A33]/5 blur-[80px] rounded-full group-hover:bg-[#E86A33]/10 transition-colors duration-700"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Sparkles className="w-6 h-6 text-[#E86A33]" />
                <h2 className="text-3xl font-bold text-white">Our Story</h2>
              </div>

              <div className="space-y-6 text-[#A1A1AA] leading-relaxed text-[15px] md:text-base">
                <p>
                  Born from an obsessive passion for mechanical art, WashWizzy was established to bridge the gap between standard car care and true automotive preservation. What began as a private detailing studio for discerning collectors has evolved into a premium destination for vehicle refinement.
                </p>
                <p>
                  We don't just maintain cars; we restore their narrative. Every curve polished and every surface protected is a testament to our commitment to uncompromising quality. We utilize only the most advanced compounds, ceramics, and techniques available globally.
                </p>
              </div>
            </div>
          </div>

          {/* Right side: Feature Cards */}
          <div className="flex flex-col gap-6 justify-center">
            {[
              {
                icon: <Crosshair className="w-5 h-5 text-[#E86A33]" />,
                title: 'Precision',
                description: 'Microscopic attention to detail in every paint correction phase.'
              },
              {
                icon: <ShieldCheck className="w-5 h-5 text-[#E86A33]" />,
                title: 'Protection',
                description: 'Aerospace-grade ceramics shielding your investment.'
              },
              {
                icon: <Settings2 className="w-5 h-5 text-[#E86A33]" />,
                title: 'Performance',
                description: 'Efficiency and effectiveness engineered into our workflow.'
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 flex items-start gap-5 hover:border-[#E86A33]/30 hover:bg-[#1A1A1A] transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-[#101010] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-[#A1A1AA] text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 3. The WashWizzy Process */}
      <section className="py-20 bg-[#141414] border-y border-[#2C2C2C] rounded-2xl">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The WashWizzy Process</h2>
          <p className="text-[#A1A1AA] mb-16 max-w-2xl mx-auto">
            A systematic approach to aesthetic perfection.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Desktop connecting line */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-[#2C2C2C] -translate-y-1/2 z-0"></div>

            {[
              {
                num: '01',
                title: 'Decontamination',
                desc: 'Multi-stage chemical and mechanical purification to strip impurities from the clear coat.',
                active: true
              },
              {
                num: '02',
                title: 'Correction',
                desc: 'Surgical machine polishing to level defects, swirls, and scratches, restoring flawless clarity.',
                active: false
              },
              {
                num: '03',
                title: 'Protection',
                desc: 'Application of durable nano-ceramic coatings or PPF to lock in the finish and repel elements.',
                active: false
              }
            ].map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center bg-[#141414] px-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold mb-6 transition-colors duration-300 ${
                  step.active
                    ? 'bg-[#E86A33] text-white shadow-[0_0_20px_rgba(232,106,51,0.3)]'
                    : 'bg-[#1C1C1C] text-[#71717A] border border-[#2C2C2C]'
                }`}>
                  {step.num}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-[#A1A1AA] text-sm leading-relaxed max-w-[280px]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Master Technicians */}
      <section className="py-20 px-2 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div className="order-2 lg:order-1">
            <span className="inline-block uppercase tracking-[0.15em] text-[#E86A33] text-xs font-bold mb-4">
              MASTER TECHNICIANS
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              Certified Expertise.
            </h2>
            <p className="text-[#A1A1AA] text-base leading-relaxed mb-8 max-w-lg">
              Our studio is operated by IDA-certified detailers who undergo continuous training in the latest abrasive technologies and coating applications. Equipped with specialized lighting tunnels and climate-controlled bays, we leave nothing to chance.
            </p>
            <button
              onClick={() => navigate('/dashboard/customer/contact')}
              className="px-6 py-3 rounded-lg border border-[#E86A33]/50 text-[#E86A33] font-semibold text-sm hover:bg-[#E86A33]/10 transition-colors duration-200"
            >
              Contact Us
            </button>
          </div>

          <div className="order-1 lg:order-2 rounded-2xl overflow-hidden border border-[#2C2C2C] group">
            <img
              src="https://images.unsplash.com/photo-1600570774780-e79e6f3eb308?auto=format&fit=crop&q=80&w=1000"
              alt="Master Technician Detailing"
              className="w-full h-[400px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

        </div>
      </section>

      {/* 5. Why Choose WashWizzy */}
      <section className="py-20 bg-[#141414] border-t border-[#2C2C2C] rounded-2xl">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 text-center">
            Why WashWizzy?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Award className="w-5 h-5 text-[#E86A33]" />,
                title: 'Uncompromising Quality',
                desc: 'Every vehicle receives meticulous attention from preparation through final inspection.'
              },
              {
                icon: <Droplets className="w-5 h-5 text-[#E86A33]" />,
                title: 'Premium Products',
                desc: 'We use professional-grade compounds, coatings, and protective technologies.'
              },
              {
                icon: <Settings2 className="w-5 h-5 text-[#E86A33]" />,
                title: 'Skilled Technicians',
                desc: 'Our technicians combine technical knowledge with hands-on detailing experience.'
              },
              {
                icon: <ShieldCheck className="w-5 h-5 text-[#E86A33]" />,
                title: 'Vehicle Preservation',
                desc: 'Our goal is not simply to make vehicles look clean, but to preserve their appearance and value.'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-[#171717] rounded-xl p-6 border border-[#2C2C2C] hover:border-[#E86A33]/20 transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-[#E86A33]/10 flex items-center justify-center mb-5 border border-[#E86A33]/20">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-[#A1A1AA] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Final Call To Action */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(232,106,51,0.15)_0%,_transparent_70%)]"></div>
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Your Vehicle Deserves<br />More Than a Wash.
          </h2>
          <p className="text-[#A1A1AA] text-lg mb-10 max-w-xl mx-auto">
            Experience professional automotive detailing designed around precision, protection, and perfection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard/customer/booking')}
              className="px-8 py-3.5 rounded-lg bg-[#E86A33] text-white font-semibold text-sm hover:bg-[#E86A33]/90 transition-colors duration-200 shadow-[0_0_20px_rgba(232,106,51,0.3)]"
            >
              Book a Service
            </button>
            <button
              onClick={() => navigate('/dashboard/customer/packages')}
              className="px-8 py-3.5 rounded-lg border border-[#E86A33]/50 text-[#E86A33] font-semibold text-sm hover:bg-[#E86A33]/10 transition-colors duration-200"
            >
              Explore Our Services
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
