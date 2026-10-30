import { useState } from 'react';
import {
  Phone,
  Mail,
  Clock,
  MapPin,
  Upload,
  Send,
  Plus,
  Minus,
  MessageCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';


export default function CustomerContactUs() {
  const [formData, setFormData] = useState({
    subject: '',
    fullName: '',
    email: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const faqs = [
    {
      question: 'What services do you offer?',
      answer: 'We offer a wide range of premium car detailing and washing services, including exterior washes, interior deep cleaning, paint correction, ceramic coatings, and custom detailing packages.',
    },
    {
      question: 'How do I make a booking?',
      answer: 'You can easily make a booking through your customer dashboard. Simply navigate to the Booking section, select your desired service package, choose an available date and time, and confirm your appointment.',
    },
    {
      question: 'How can I change or cancel my booking?',
      answer: 'To modify or cancel a booking, go to "My Appointments" in your dashboard. You can reschedule or cancel appointments up to 24 hours before the scheduled time without any penalty.',
    },
    {
      question: 'How long does a service take?',
      answer: 'Service durations vary depending on the package selected. A basic exterior wash may take 45-60 minutes, while comprehensive interior and exterior detailing can take anywhere from 2 to 4 hours.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit and debit cards (Visa, Mastercard, American Express), as well as digital wallets like Apple Pay and Google Pay through our secure online checkout.',
    },
    {
      question: 'How can I contact support?',
      answer: 'You can reach out to our support team using the contact form on this page, or by calling our customer service number during operating hours. We also offer live chat assistance.',
    },
    {
      question: 'What should I do if I experience a problem with my order or booking?',
      answer: 'If you encounter any issues, please submit a "Complaint" or "Order Assistance" query via our contact form, detailing the problem. Our support team prioritizes these requests and will respond promptly to resolve the issue.',
    },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check file size (e.g., 5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds the 5MB maximum limit.");
        return;
      }
      setFileName(file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      // Simulate success
      setSubmitStatus('success');
      setFormData({ subject: '', fullName: '', email: '', message: '' });
      setFileName(null);
      
      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);
    }, 1500);
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 max-w-[1200px] mx-auto w-full mb-16 pt-8">
        
        {/* Main Hero Section: Contact Form & Quick Support */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          
          {/* Left Column - Form */}
          <div className="lg:col-span-2 bg-[#171717] rounded-xl border border-[#2C2C2C] p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-display font-bold text-white mb-3 tracking-tight">GET IN TOUCH</h1>
              <p className="text-[#A1A1AA] text-[15px] leading-relaxed">
                Need assistance with a booking, have a question about our services, or want to provide feedback? 
                Fill out the form below and our dedicated support team will get back to you promptly.
              </p>
            </div>

            {submitStatus === 'success' && (
              <div className="mb-6 p-4 rounded-lg bg-[#35B86B]/10 border border-[#35B86B]/20 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#35B86B] flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[#35B86B] font-semibold text-[15px]">Message Sent Successfully</h4>
                  <p className="text-[#A1A1AA] text-sm mt-1">Thank you for reaching out. We will get back to you as soon as possible.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Subject Dropdown */}
              <div className="flex flex-col gap-1.5 group/field">
                <label htmlFor="subject" className="text-sm font-medium text-soft-gray ml-1">
                  SERVICE / SUBJECT
                </label>
                <div className="relative">
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full bg-[#101010] border border-[#2C2C2C] text-white rounded-lg px-4 py-3 outline-none transition-all duration-200 focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] appearance-none"
                  >
                    <option value="" disabled>Search services or choose a subject...</option>
                    <option value="General Enquiry">General Enquiry</option>
                    <option value="Booking Assistance">Booking Assistance</option>
                    <option value="Service Information">Service Information</option>
                    <option value="Order Assistance">Order Assistance</option>
                    <option value="Account Support">Account Support</option>
                    <option value="Payment Question">Payment Question</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#71717A]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="FULL NAME"
                  name="fullName"
                  placeholder="John Doe"
                  required
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
                <Input
                  label="EMAIL ADDRESS"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              {/* Message Textarea */}
              <div className="flex flex-col gap-1.5 group/field">
                <label htmlFor="message" className="text-sm font-medium text-soft-gray ml-1">
                  MESSAGE
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Tell us how we can help you..."
                  className="w-full bg-[#101010] border border-[#2C2C2C] text-white rounded-lg px-4 py-3 outline-none transition-all duration-200 focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] placeholder:text-[#71717A] resize-y"
                />
              </div>

              {/* Attachments */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-soft-gray ml-1">ATTACHMENTS (OPTIONAL)</label>
                <div className="relative w-full border-2 border-dashed border-[#2C2C2C] rounded-lg bg-[#101010] hover:bg-[#1A1A1A] transition-colors overflow-hidden group">
                  <input
                    type="file"
                    id="attachment"
                    onChange={handleFileChange}
                    accept=".png,.jpg,.jpeg,.svg,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#171717] border border-[#2C2C2C] flex items-center justify-center mb-3 group-hover:border-[#E86A33]/50 transition-colors">
                      <Upload className="w-5 h-5 text-[#71717A] group-hover:text-[#E86A33] transition-colors" />
                    </div>
                    {fileName ? (
                      <p className="text-[14px] font-medium text-[#E86A33]">{fileName}</p>
                    ) : (
                      <>
                        <p className="text-[14px] font-medium text-white mb-1">CLICK TO UPLOAD OR DRAG AND DROP</p>
                        <p className="text-xs text-[#71717A]">PNG, JPG, SVG, or PDF. Max 5MB.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" isLoading={isSubmitting} className="min-w-[200px]">
                  {isSubmitting ? 'SENDING...' : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      SEND MESSAGE
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column - Quick Support Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#171717] rounded-xl border border-[#2C2C2C] overflow-hidden relative group p-6 h-full flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-[#E86A33]/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <h2 className="text-xl font-display font-bold text-white mb-3">Quick Support</h2>
              <p className="text-[#A1A1AA] text-sm mb-8 leading-relaxed">
                Need immediate assistance? Get in touch with our support team and we'll help you as quickly as possible.
              </p>

              <div className="space-y-6 flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#E86A33]/10 flex items-center justify-center shrink-0 border border-[#E86A33]/20">
                    <Phone className="w-5 h-5 text-[#E86A33]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#71717A] mb-1 tracking-wider uppercase">Phone</p>
                    <p className="text-white font-medium">+1 (800) 123-4567</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#E86A33]/10 flex items-center justify-center shrink-0 border border-[#E86A33]/20">
                    <Mail className="w-5 h-5 text-[#E86A33]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#71717A] mb-1 tracking-wider uppercase">Email</p>
                    <p className="text-white font-medium">support@washwizzy.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#E86A33]/10 flex items-center justify-center shrink-0 border border-[#E86A33]/20">
                    <Clock className="w-5 h-5 text-[#E86A33]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#71717A] mb-1 tracking-wider uppercase">Operating Hours</p>
                    <p className="text-white font-medium text-sm">Mon - Fri: 8:00 AM - 8:00 PM</p>
                    <p className="text-[#A1A1AA] text-sm mt-0.5">Sat - Sun: 9:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#2C2C2C]">
                <Button variant="outline" fullWidth className="group/chat relative overflow-hidden">
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <MessageCircle className="w-4 h-4 group-hover/chat:text-[#E86A33] transition-colors" />
                    START LIVE CHAT
                  </span>
                </Button>
                <div className="text-center mt-4 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#35B86B] animate-pulse"></span>
                  <span className="text-xs font-medium text-[#71717A]">Typical response time: Under 2 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-white mb-3 tracking-tight">FREQUENTLY ASKED QUESTIONS</h2>
            <p className="text-[#A1A1AA] max-w-2xl mx-auto">
              Find quick answers to common questions about our services, bookings, and platform.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, index) => {
              const isActive = activeFaq === index;
              return (
                <div 
                  key={index} 
                  className={`bg-[#171717] border rounded-lg transition-all duration-300 ${isActive ? 'border-[#E86A33]/50 shadow-[0_4px_20px_rgba(232,106,51,0.05)]' : 'border-[#2C2C2C] hover:border-[#3C3C3C]'}`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                  >
                    <span className={`font-medium pr-8 transition-colors ${isActive ? 'text-white' : 'text-[#F5F5F5]'}`}>
                      {faq.question}
                    </span>
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-[#E86A33] text-white rotate-180' : 'bg-[#101010] text-[#71717A] border border-[#2C2C2C]'}`}>
                      {isActive ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isActive ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <div className="p-5 pt-0 text-[#A1A1AA] text-sm leading-relaxed border-t border-[#2C2C2C] mt-2 pb-5">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-[#171717] rounded-xl border border-[#2C2C2C] p-8 md:p-10 relative overflow-hidden text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#E86A33]/50 to-transparent"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-20 bg-[#E86A33]/20 blur-[60px] rounded-full pointer-events-none"></div>
          
          <div className="w-16 h-16 bg-[#101010] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#2C2C2C] shadow-[0_0_15px_rgba(232,106,51,0.15)] relative z-10">
            <MapPin className="w-8 h-8 text-[#E86A33]" />
          </div>
          
          <h2 className="text-xl font-display font-bold text-white mb-2 relative z-10">BUSINESS / SUPPORT LOCATION</h2>
          <p className="text-[#A1A1AA] max-w-md mx-auto mb-8 relative z-10">
            123 Sparkle Drive, Suite 100<br/>
            Clean City, ST 12345
          </p>
          
          <Button variant="primary" className="relative z-10">
            GET DIRECTIONS
          </Button>
        </div>

      </div>


    </div>
  );
}
