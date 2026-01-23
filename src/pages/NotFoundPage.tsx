import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center space-y-6">
        {/* 404 Icon */}
        <div className="flex justify-center">
          <div className="bg-[#f3ece4] rounded-full p-8">
            <svg
              className="w-16 h-16 text-[#b9a99b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.563M15 6.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM9 6.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error message */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-[#4a3f35]">404</h1>
          <h2 className="text-2xl font-semibold text-[#6f5f52]">Page not found</h2>
          <p className="text-[#8d7b6d] max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-[#f5ebe0] rounded-lg font-medium text-[#6f5f52] hover:bg-[#fdf8f2] transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-[#4a3f35] text-white rounded-lg font-medium hover:bg-[#3d332b] transition-colors"
          >
            Go to Dashboard
          </button>
        </div>

        {/* Helpful links */}
        <div className="pt-6 border-t border-[#f5ebe0]/60">
          <p className="text-sm text-[#8d7b6d] mb-3">Or try these:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigate('/inventory')}
              className="text-sm text-[#4a3f35] hover:text-[#3d332b] font-medium"
            >
              My Inventory
            </button>
            <button
              onClick={() => navigate('/add')}
              className="text-sm text-[#4a3f35] hover:text-[#3d332b] font-medium"
            >
              Add Item
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-[#4a3f35] hover:text-[#3d332b] font-medium"
            >
              Settings
            </button>
            <button
              onClick={() => navigate('/shopping')}
              className="text-sm text-[#4a3f35] hover:text-[#3d332b] font-medium"
            >
              Shopping Assistant
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
