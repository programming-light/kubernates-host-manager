import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NyxTech - Kubernetes Hosting Made Simple',
    template: '%s | NyxTech',
  },
  description: 'Deploy and manage containerized applications on Kubernetes with ease. Production-grade hosting platform with CI/CD integration.',
  keywords: ['kubernetes', 'container', 'deployment', 'hosting', 'cloud', 'devops', 'ci/cd'],
  authors: [{ name: 'NyxTech' }],
  creator: 'NyxTech',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://k8s-platform.com',
    title: 'NyxTech - Kubernetes Hosting Made Simple',
    description: 'Deploy and manage containerized applications on Kubernetes with ease.',
    siteName: 'NyxTech',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NyxTech - Kubernetes Hosting Made Simple',
    description: 'Deploy and manage containerized applications on Kubernetes with ease.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}
