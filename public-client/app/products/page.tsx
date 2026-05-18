import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Server, Rocket, GitBranch, Shield, Database, Globe, ArrowRight } from 'lucide-react';
import { fetchProducts } from '@/lib/api';

export const revalidate = 86400; // ISR: Revalidate every 24 hours

export default async function ProductsPage() {
  const products = await fetchProducts();

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
            <Link href="/contact" className="text-sm text-gray-300 hover:text-white">Contact</Link>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Our Products
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Powerful tools for modern Kubernetes deployments
          </p>
        </div>

        {products.length === 0 ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 animate-pulse">
                <div className="mb-4 h-12 w-12 rounded-lg bg-gray-800" />
                <div className="mb-2 h-6 w-3/4 rounded bg-gray-800" />
                <div className="mb-4 h-4 w-full rounded bg-gray-800" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 w-2/3 rounded bg-gray-800" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 transition-all hover:border-gray-700"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400">
                  <Rocket className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">{product.name}</h3>
                <p className="mb-6 text-gray-400">{product.description}</p>
                {product.features && (
                  <ul className="mb-6 space-y-2">
                    {product.features.map((feature: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-gray-300">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">${product.price}/mo</span>
                    <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
                    <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                      Learn More
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
