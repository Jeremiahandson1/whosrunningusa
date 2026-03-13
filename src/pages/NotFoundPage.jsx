import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
      <div className="empty-state">
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
