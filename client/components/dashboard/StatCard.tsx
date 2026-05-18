import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  stat: {
    label: string;
    value: string | number;
    icon: any;
    color: string;
    bgColor: string;
    textColor: string;
    href: string | null;
  };
  index: number;
}

export default function StatCard({ stat, index }: StatCardProps) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    stat.href ? (
      <Link href={stat.href} className="cursor-pointer block">
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <Wrapper>
      <Card
        className="group relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${stat.bgColor}`} />
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between">
            <div className={`rounded-xl ${stat.bgColor} p-3`}>
              <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
            </div>
            {stat.href && (
              <TrendingUp className="h-5 w-5 text-gray-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            )}
          </div>
          <div className="mt-4">
            <p className="text-4xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
