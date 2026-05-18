'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  pageSize?: number;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterFn?: (item: T, query: string) => boolean;
}

export default function InfiniteScrollList<T extends { name?: string }>({
  items,
  renderItem,
  pageSize = 25,
  emptyMessage = 'No items found',
  searchable = true,
  searchPlaceholder = 'Search...',
  filterFn,
}: InfiniteScrollListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [searchQuery, setSearchQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const defaultFilter = useCallback((item: T, query: string) => {
    const q = query.toLowerCase();
    return Object.values(item).some(v =>
      String(v).toLowerCase().includes(q)
    );
  }, []);

  const filter = filterFn || defaultFilter;
  const filtered = searchQuery ? items.filter(item => filter(item, searchQuery)) : items;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => Math.min(prev + pageSize, filtered.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filtered.length, pageSize]);

  return (
    <div>
      {searchable && (
        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(pageSize); }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item, i) => (
            <div key={item.name || i}>{renderItem(item, i)}</div>
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="flex items-center justify-center py-4">
        {hasMore ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        ) : filtered.length > pageSize ? (
          <p className="text-xs text-gray-600">Showing all {filtered.length} items</p>
        ) : null}
      </div>
      {filtered.length > pageSize && (
        <p className="text-center text-xs text-gray-600 pb-2">
          Showing {visible.length} of {filtered.length}
        </p>
      )}
    </div>
  );
}
