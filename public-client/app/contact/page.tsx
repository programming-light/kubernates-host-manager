import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Server, Mail, Phone, MapPin, Clock, Send } from 'lucide-react';

export const revalidate = 86400; // ISR: Revalidate every 24 hours

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">NyxTech</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-300 hover:text-white">Pricing</Link>
            <Link href="/services" className="text-sm text-gray-300 hover:text-white">Services</Link>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Get in Touch
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Have questions? We'd love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
            <h2 className="mb-6 text-2xl font-bold text-white">Send us a message</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-300">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="mb-2 block text-sm font-medium text-gray-300">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-300">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={6}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Tell us about your project..."
                />
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Email</h3>
                  <p className="text-sm text-gray-400">support@k8s-platform.com</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600/10 text-green-400">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Phone</h3>
                  <p className="text-sm text-gray-400">+1 (555) 123-4567</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600/10 text-purple-400">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Office</h3>
                  <p className="text-sm text-gray-400">
                    123 Kubernetes Way<br />
                    San Francisco, CA 94105
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-600/10 text-yellow-400">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Business Hours</h3>
                  <p className="text-sm text-gray-400">
                    Mon - Fri: 9:00 AM - 6:00 PM PST<br />
                    24/7 Support for Enterprise
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
