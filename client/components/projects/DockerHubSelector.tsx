'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Container, Search, Download, Star, Eye, Clock, CheckCircle, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface DockerImage {
  id: string;
  name: string;
  fullName: string;
  description: string;
  starCount: number;
  pullCount: number;
  isOfficial: boolean;
}

interface DockerHubSelectorProps {
  onSelect: (image: string, tag: string) => void;
  selectedSource?: any | null;
}

export default function DockerHubSelector({ onSelect, selectedSource }: DockerHubSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('latest');
  const [loadingTags, setLoadingTags] = useState(false);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const searchImages = async () => {
    if (!query.trim()) {
      toast.error('Enter a search term');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${baseUrl}/sources/dockerhub/search?query=${encodeURIComponent(query.trim())}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        toast.error('Failed to search Docker Hub');
      }
    } catch {
      toast.error('Failed to search Docker Hub');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async (image: string) => {
    setLoadingTags(true);
    setSelectedImage(image);
    setSelectedTag('latest');
    try {
      const res = await fetch(`${baseUrl}/sources/dockerhub/tags?image=${encodeURIComponent(image)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.map((t: any) => t.name));
      } else {
        setTags(['latest']);
      }
    } catch {
      setTags(['latest']);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedImage) return;
    onSelect(selectedImage, selectedTag);
  };

  const formatPulls = (count: number) => {
    if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
    if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
    if (count >= 1e3) return `${(count / 1e3).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Container className="h-5 w-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white">Deploy from Docker Hub</p>
          <p className="text-xs text-gray-400 mt-1">
            Search for existing Docker images to deploy directly (no build required)
          </p>
        </div>
      </div>

      {selectedSource && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-gray-400 mb-1">Selected Image</p>
          <div className="flex items-center gap-2">
            <Container className="h-4 w-4 text-green-400" />
            <span className="text-white font-medium">{selectedSource.fullName}</span>
            {selectedSource.tag && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{selectedSource.tag}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search images (e.g., nginx, node, postgres)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchImages()}
            className="pl-10 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
          />
        </div>
        <Button onClick={searchImages} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Container className="h-8 w-8 mx-auto mb-2" />
          <p>No images found for "{query}"</p>
          <p className="text-xs text-gray-600 mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {results.map((img) => (
            <button
              key={img.id}
              onClick={() => fetchTags(img.fullName)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedImage === img.fullName
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Container className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {img.isOfficial ? img.name : img.fullName}
                    </span>
                    {img.isOfficial && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Official</span>
                    )}
                  </div>
                  {img.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{img.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {img.starCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <Star className="h-3 w-3" /> {img.starCount}
                      </span>
                    )}
                    {img.pullCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Download className="h-3 w-3" /> {formatPulls(img.pullCount)}
                      </span>
                    )}
                  </div>
                </div>
                {selectedImage === img.fullName && (
                  <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="space-y-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-400" />
            <Label className="text-gray-300">Select Tag</Label>
          </div>

          {loadingTags ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tags...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 20).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    selectedTag === tag
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {tags.length > 20 && (
                <span className="text-xs text-gray-500 self-center">+{tags.length - 20} more</span>
              )}
            </div>
          )}

          <Button onClick={handleConfirm} className="w-full bg-blue-600 hover:bg-blue-700">
            <Container className="h-4 w-4 mr-2" />
            Deploy {selectedImage}:{selectedTag}
          </Button>
        </div>
      )}
    </div>
  );
}
