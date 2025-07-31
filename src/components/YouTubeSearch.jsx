import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Search, Play, Clock, Eye, X } from 'lucide-react'

const YouTubeSearch = ({ isVisible, onClose, onVideoSelect, jitsiApi }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  // YouTube Data API key - In production, this should be stored securely
  const API_KEY = 'YOUR_YOUTUBE_API_KEY' // Replace with your actual API key

  const searchVideos = async (query) => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(
          query
        )}&type=video&key=${API_KEY}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }

      const data = await response.json()
      
      // Get additional video details (duration, view count, etc.)
      const videoIds = data.items.map(item => item.id.videoId).join(',')
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${API_KEY}`
      )
      
      const detailsData = await detailsResponse.json()
      
      // Merge search results with video details
      const enrichedResults = data.items.map(item => {
        const details = detailsData.items.find(detail => detail.id === item.id.videoId)
        return {
          ...item,
          details: details || {}
        }
      })
      
      setSearchResults(enrichedResults)
    } catch (error) {
      console.error('Error searching videos:', error)
      // For demo purposes, use mock data if API fails
      setSearchResults(getMockResults(query))
    } finally {
      setLoading(false)
    }
  }

  // Mock data for demonstration when API key is not available
  const getMockResults = (query) => [
    {
      id: { videoId: 'dQw4w9WgXcQ' },
      snippet: {
        title: `Sample Video Result for "${query}"`,
        description: 'This is a sample video result. In production, this would be replaced with real YouTube search results.',
        thumbnails: {
          medium: {
            url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
          }
        },
        channelTitle: 'Sample Channel',
        publishedAt: '2023-01-01T00:00:00Z'
      },
      details: {
        contentDetails: { duration: 'PT3M33S' },
        statistics: { viewCount: '1000000' }
      }
    },
    {
      id: { videoId: 'jNQXAC9IVRw' },
      snippet: {
        title: `Another Video for "${query}"`,
        description: 'Another sample video result for demonstration purposes.',
        thumbnails: {
          medium: {
            url: 'https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg'
          }
        },
        channelTitle: 'Demo Channel',
        publishedAt: '2023-02-01T00:00:00Z'
      },
      details: {
        contentDetails: { duration: 'PT5M20S' },
        statistics: { viewCount: '500000' }
      }
    }
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    searchVideos(searchQuery)
  }

  const formatDuration = (duration) => {
    if (!duration) return 'N/A'
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    if (!match) return 'N/A'
    
    const hours = (match[1] || '').replace('H', '')
    const minutes = (match[2] || '').replace('M', '')
    const seconds = (match[3] || '').replace('S', '')
    
    let formatted = ''
    if (hours) formatted += `${hours}:`
    formatted += `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
    
    return formatted
  }

  const formatViewCount = (count) => {
    if (!count) return 'N/A'
    const num = parseInt(count)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`
    }
    return `${num} views`
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const handleVideoSelect = (video) => {
    setSelectedVideo(video)
    if (onVideoSelect) {
      onVideoSelect(video)
    }
  }

  const embedVideo = (videoId) => {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">YouTube Video Search</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Search for videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Search Results */}
          <div className="w-1/2 border-r overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium mb-4">Search Results</h3>
              {searchResults.length === 0 && !loading && (
                <p className="text-gray-500 text-center py-8">
                  Search for videos to see results here
                </p>
              )}
              
              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Searching videos...</p>
                </div>
              )}

              <div className="space-y-4">
                {searchResults.map((video) => (
                  <div
                    key={video.id.videoId}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedVideo?.id.videoId === video.id.videoId ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleVideoSelect(video)}
                  >
                    <div className="flex gap-3">
                      <img
                        src={video.snippet.thumbnails.medium.url}
                        alt={video.snippet.title}
                        className="w-24 h-18 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 mb-1">
                          {video.snippet.title}
                        </h4>
                        <p className="text-xs text-gray-600 mb-2">
                          {video.snippet.channelTitle}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(video.details.contentDetails?.duration)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {formatViewCount(video.details.statistics?.viewCount)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(video.snippet.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Video Preview */}
          <div className="w-1/2 flex flex-col">
            {selectedVideo ? (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-medium">Video Preview</h3>
                </div>
                <div className="flex-1 p-4">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                    <iframe
                      src={embedVideo(selectedVideo.id.videoId)}
                      title={selectedVideo.snippet.title}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">{selectedVideo.snippet.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{selectedVideo.snippet.channelTitle}</p>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {selectedVideo.snippet.description}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(selectedVideo.details.contentDetails?.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {formatViewCount(selectedVideo.details.statistics?.viewCount)}
                      </span>
                      <span>{formatDate(selectedVideo.snippet.publishedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t">
                  <Button 
                    onClick={() => {
                      if (jitsiApi && selectedVideo) {
                        const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id.videoId}`
                        jitsiApi.executeCommand(
                          'startShareVideo',
                          videoUrl
                        )
                        onClose()
                      }
                    }}
                    className="w-full"
                    disabled={!jitsiApi || !selectedVideo}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Share in Conference
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a video to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default YouTubeSearch

