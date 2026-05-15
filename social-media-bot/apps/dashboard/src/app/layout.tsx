import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Social Media Growth Bot',
  description: 'Automated social media growth platform',
};

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/content', label: 'Content' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/engagement', label: 'Engagement' },
  { href: '/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <div className="flex">
          <nav className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1 fixed">
            <div className="text-lg font-bold text-purple-400 mb-6 px-3">
              SM Growth Bot
            </div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="ml-56 flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
